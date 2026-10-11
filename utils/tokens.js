const jwt = require('jsonwebtoken');

const signAccess = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefresh = (user) =>
  jwt.sign(
    { sub: user._id.toString(), v: user.tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

const sign2FATemp = (user) =>
  jwt.sign(
    { sub: user._id.toString(), stage: '2fa' },
    process.env.JWT_2FA_SECRET,
    { expiresIn: '5m' }
  );

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function issueTokens(res, user) {
  res.cookie('refreshToken', signRefresh(user), refreshCookieOptions);
  return signAccess(user);
}

module.exports = { signAccess, signRefresh, sign2FATemp, issueTokens, refreshCookieOptions };