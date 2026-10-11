require('dotenv').config();
const jwt = require('jsonwebtoken');
const { signAccess, signRefresh, sign2FATemp } = require('../utils/tokens');
const { sendMail } = require('../utils/mailer');

(async () => {
  try {
    const fakeUser = { _id: '66f3a9c1e2b3d4a5f6c7d8e9', tokenVersion: 0 };

    // --- Tokens ---
    const access = signAccess(fakeUser);
    const refresh = signRefresh(fakeUser);
    const twoFA = sign2FATemp(fakeUser);

    console.log('\n--- Tokens ---');
    console.log('access :', access.slice(0, 40) + '...');
    console.log('refresh:', refresh.slice(0, 40) + '...');
    console.log('2fa    :', twoFA.slice(0, 40) + '...');

    const accessDecoded = jwt.verify(access, process.env.JWT_ACCESS_SECRET);
    const refreshDecoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const twoFADecoded = jwt.verify(twoFA, process.env.JWT_2FA_SECRET);

    console.log('\nDecoded access  sub:', accessDecoded.sub, 'exp in ~', accessDecoded.exp - accessDecoded.iat, 's');
    console.log('Decoded refresh sub:', refreshDecoded.sub, 'v:', refreshDecoded.v, 'exp in ~', refreshDecoded.exp - refreshDecoded.iat, 's');
    console.log('Decoded 2fa     sub:', twoFADecoded.sub, 'stage:', twoFADecoded.stage, 'exp in ~', twoFADecoded.exp - twoFADecoded.iat, 's');

    // Cross-secret rejection: an access token must NOT verify with the refresh secret.
    let crossed = false;
    try { jwt.verify(access, process.env.JWT_REFRESH_SECRET); } catch { crossed = true; }
    console.log('\nAccess token rejected by refresh secret (expected true):', crossed);

    // --- Mailer ---
    console.log('\n--- Mailer ---');
    await sendMail({
      to: 'someone@example.com',
      subject: 'Test email from auth-system',
      html: '<p>If you can read this in Ethereal, mailer.js works.</p>'
    });
    console.log('sendMail returned without throwing.');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
})();