const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const passport = require('../config/passport');
const User = require('../models/user');
const { issueTokens, sign2FATemp, refreshCookieOptions } = require('../utils/tokens');
const { sendMail } = require('../utils/mailer');
const { requireAuth } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// Register
router.post('/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      if (await User.findOne({ email: email.toLowerCase() })) {
        return res.status(409).json({ message: 'Email already registered' });
      }
      const user = await User.create({ name, email, password });
      const accessToken = issueTokens(res, user);
      res.status(201).json({ accessToken, user: user.toSafeJSON() });
    } catch (e) { next(e); }
  });

// Login (step 1)
router.post('/login', body('email').isEmail(), body('password').notEmpty(), validate, (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    
    if (user.twoFactorEnabled) {
      return res.json({ requires2FA: true, tempToken: sign2FATemp(user) });
    }
    
    const accessToken = issueTokens(res, user);
    res.json({ accessToken, user: user.toSafeJSON() });
  })(req, res, next);
});

// Login (step 2: 2FA)
router.post('/2fa/verify-login', body('tempToken').notEmpty(), body('code').isLength({ min: 6, max: 6 }), validate, async (req, res) => {
  try {
    const payload = jwt.verify(req.body.tempToken, process.env.JWT_2FA_SECRET);
    if (payload.stage !== '2fa') throw new Error('bad stage');
    
    const user = await User.findById(payload.sub).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) return res.status(401).json({ message: 'Invalid 2FA session' });

    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: req.body.code,
      window: 1
    });
    
    if (!ok) return res.status(401).json({ message: 'Invalid 2FA code' });
    
    const accessToken = issueTokens(res, user);
    res.json({ accessToken, user: user.toSafeJSON() });
  } catch {
    res.status(401).json({ message: '2FA session expired, log in again' });
  }
});

// 2FA setup + enable + disable
router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ name: `AuthSystem (${req.user.email || req.user.name})` });
    await User.findByIdAndUpdate(req.user._id, { twoFactorSecret: secret.base32 });
    const qr = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ qr, secret: secret.base32 });
  } catch (e) { next(e); }
});

router.post('/2fa/enable', requireAuth, body('code').isLength({ min: 6, max: 6 }), validate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) return res.status(400).json({ message: 'Run /2fa/setup first' });

    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: req.body.code,
      window: 1
    });
    if (!ok) return res.status(400).json({ message: 'Invalid code' });

    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: '2FA enabled' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: false, $unset: { twoFactorSecret: 1 } });
  res.json({ message: '2FA disabled' });
});

// Refresh + logout
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: 'No refresh token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) throw new Error('revoked');
    
    const accessToken = issueTokens(res, user);
    res.json({ accessToken, user: user.toSafeJSON() });
  } catch {
    res.status(401).json({ message: 'Session expired' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { ...refreshCookieOptions, maxAge: undefined });
  res.json({ message: 'Logged out' });
});

// Password reset
router.post('/forgot-password', body('email').isEmail(), validate, async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (user) {
      const raw = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      
      const link = `${process.env.CLIENT_URL}/reset.html?token=${raw}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click to reset (valid 15 min): <a href="${link}">${link}</a></p>`
      });
    }
    // Always return the same response to prevent email enumeration
    res.json({ message: 'If that email exists, a reset link was sent' });
  } catch (e) { next(e); }
});

router.post('/reset-password', body('token').notEmpty(), body('password').isLength({ min: 8 }), validate, async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired' });
    
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion += 1; // revoke old sessions
    await user.save();
    
    res.json({ message: 'Password updated, please log in' });
  } catch (e) { next(e); }
});

// OAuth
function oauthRoutes(name, scope) {
  router.get(`/${name}`, (req, res, next) => {
    if (!passport._strategy(name)) return res.status(501).send(`${name} OAuth not configured in .env`);
    passport.authenticate(name, { scope, session: false })(req, res, next);
  });
  
  router.get(`/${name}/callback`, (req, res, next) => {
    passport.authenticate(name, { session: false, failureRedirect: '/?error=oauth' }, (err, user) => {
      if (err || !user) return res.redirect('/?error=oauth');
      
      if (user.twoFactorEnabled) {
        return res.redirect(`/?tempToken=${sign2FATemp(user)}`);
      }
      
      issueTokens(res, user);
      res.redirect('/dashboard.html');
    })(req, res, next);
  });
}

oauthRoutes('google', ['profile', 'email']);
oauthRoutes('github', ['user:email']);

module.exports = router;