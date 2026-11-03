// 1. Mouse Tilt Effect
const card = document.getElementById('card');
if (card) {
  document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rx = (y / h - 0.5) * -8;
    const ry = (x / w - 0.5) * 8;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  document.addEventListener('mouseleave', () => {
    card.style.transform = `rotateX(0) rotateY(0)`;
  });
}

// 2. Auth / Fetch Logic
let accessToken = sessionStorage.getItem('accessToken') || null;
let tempToken = null;

const api = async (url, options = {}) => {
  options.headers = { ...options.headers, 'Content-Type': 'application/json' };
  if (accessToken) options.headers['Authorization'] = `Bearer ${accessToken}`;
  options.credentials = 'include'; // send cookies

  let res = await fetch(url, options);

  // If 401, try refresh once
  if (res.status === 401 && !options._retry) {
    options._retry = true;
    const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      accessToken = data.accessToken;
      sessionStorage.setItem('accessToken', accessToken);
      options.headers['Authorization'] = `Bearer ${accessToken}`;
      return fetch(url, options);
    } else {
      sessionStorage.removeItem('accessToken');
      window.location.href = '/';
    }
  }
  return res;
};

const showMsg = (text, isOk = false) => {
  const msg = document.getElementById('msg');
  if (msg) {
    msg.textContent = text;
    msg.className = isOk ? 'msg ok' : 'msg';
  }
};

// 3. Page Routing Logic
const path = window.location.pathname;
const urlParams = new URLSearchParams(window.location.search);

if (path === '/dashboard.html') {
  initDashboard();
} else if (path === '/reset.html') {
  initReset();
} else {
  initIndex();
}

// --- INDEX PAGE (Login/Register/2FA) ---
function initIndex() {
  const tabs = document.getElementById('tabs');
  const forms = {
    login: document.getElementById('form-login'),
    register: document.getElementById('form-register'),
    forgot: document.getElementById('form-forgot'),
    '2fa': document.getElementById('form-2fa')
  };

  // Handle URL params (OAuth 2FA redirect)
  if (urlParams.get('tempToken')) {
    tempToken = urlParams.get('tempToken');
    switchTab('2fa');
  }

  function switchTab(target) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    Object.values(forms).forEach(f => f.classList.remove('active'));
    
    if (target === '2fa') {
      if (tabs) tabs.style.display = 'none';
      document.getElementById('oauth-section').style.display = 'none';
      document.getElementById('title').textContent = 'Two-Factor Auth';
      document.getElementById('subtitle').textContent = 'Enter your 6-digit code';
      forms['2fa'].classList.add('active');
      forms['2fa'].querySelector('input').focus();
    } else {
      if (tabs) {
        tabs.style.display = 'flex';
        tabs.querySelector(`[data-target="${target}"]`)?.classList.add('active');
      }
      document.getElementById('oauth-section').style.display = 'block';
      document.getElementById('title').textContent = 'Welcome back';
      document.getElementById('subtitle').textContent = target === 'register' ? 'Create an account' : target === 'forgot' ? 'Reset your password' : 'Log in to your account';
      forms[target].classList.add('active');
    }
    showMsg('');
  }

  if (tabs) {
    tabs.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') switchTab(e.target.dataset.target);
    });
  }

  // Login
  forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const data = await res.json();
    
    if (res.ok) {
      if (data.requires2FA) {
        tempToken = data.tempToken;
        switchTab('2fa');
      } else {
        accessToken = data.accessToken;
        sessionStorage.setItem('accessToken', accessToken);
        window.location.href = '/dashboard.html';
      }
    } else {
      showMsg(data.message || 'Login failed');
    }
  });

  // Register
  forms.register.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    const data = await res.json();
    
    if (res.ok) {
      accessToken = data.accessToken;
      sessionStorage.setItem('accessToken', accessToken);
      window.location.href = '/dashboard.html';
    } else {
      showMsg(data.message || 'Registration failed');
    }
  });

  // Forgot
  forms.forgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const res = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    const data = await res.json();
    showMsg(data.message, res.ok);
  });

  // 2FA Verify
  forms['2fa'].addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
    if (code.length !== 6) return showMsg('Enter all 6 digits');
    
    const res = await api('/api/auth/2fa/verify-login', { method: 'POST', body: JSON.stringify({ tempToken, code }) });
    const data = await res.json();
    
    if (res.ok) {
      accessToken = data.accessToken;
      sessionStorage.setItem('accessToken', accessToken);
      window.location.href = '/dashboard.html';
    } else {
      showMsg(data.message || 'Invalid code');
    }
  });

  // OTP Input Auto-Advance
  const otpInputs = document.querySelectorAll('.otp-input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) otpInputs[index - 1].focus();
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      paste.split('').forEach((char, i) => {
        if (otpInputs[i]) otpInputs[i].value = char;
      });
      if (paste.length === 6) otpInputs[5].focus();
    });
  });
}

// --- DASHBOARD PAGE ---
async function initDashboard() {
  if (!accessToken) {
    // Try refresh
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      accessToken = data.accessToken;
      sessionStorage.setItem('accessToken', accessToken);
    } else {
      window.location.href = '/';
      return;
    }
  }

  const res = await api('/api/user/me');
  if (!res.ok) return window.location.href = '/';
  const { user } = await res.json();
  
  document.getElementById('welcome-msg').textContent = `Logged in as ${user.name || user.email}`;

  // Setup 2FA
  document.getElementById('btn-setup-2fa').addEventListener('click', async () => {
    const res = await api('/api/auth/2fa/setup', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('qr-image').src = data.qr;
      document.getElementById('2fa-setup').style.display = 'block';
      document.getElementById('btn-setup-2fa').style.display = 'none';
    } else {
      showMsg(data.message);
    }
  });

  // Verify 2FA
  document.getElementById('btn-verify-2fa').addEventListener('click', async () => {
    const code = document.getElementById('2fa-code').value;
    const res = await api('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
    const data = await res.json();
    if (res.ok) {
      showMsg('2FA Enabled successfully!', true);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showMsg(data.message);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('accessToken');
    window.location.href = '/';
  });
}

// --- RESET PAGE ---
function initReset() {
  const token = urlParams.get('token');
  if (!token) return showMsg('No reset token found in URL.');

  document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('new-password').value;
    const res = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
    const data = await res.json();
    
    if (res.ok) {
      showMsg('Password updated! Redirecting to login...', true);
      setTimeout(() => window.location.href = '/', 2000);
    } else {
      showMsg(data.message || 'Failed to reset');
    }
  });
}