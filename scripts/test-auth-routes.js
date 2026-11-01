require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/user');
const authRouter = require('../routes/auth');

// Build a minimal test app (no helmet, no rate limit, no static)
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

(async () => {
  try {
    await connectDB();
    await User.deleteMany({ email: /^test_route_/ });

    const email = `test_route_${Date.now()}@example.com`;
    const password = 'supersecret123';
    let accessToken, refreshCookie, userId;

    // 1. Register
    console.log('\n--- 1. Register ---');
    let res = await request(app).post('/api/auth/register').send({ name: 'Test Route', email, password });
    console.log('Status:', res.status, '(expect 201)');
    console.log('Has accessToken:', !!res.body.accessToken);
    console.log('User email:', res.body.user && res.body.user.email);
    accessToken = res.body.accessToken;
    userId = res.body.user.id;
    
    // Set-Cookie should contain refreshToken
    const cookies = res.headers['set-cookie'] || [];
    refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    console.log('Has refreshToken cookie:', !!refreshCookie);

    // 2. Login (correct)
    console.log('\n--- 2. Login (correct) ---');
    res = await request(app).post('/api/auth/login').send({ email, password });
    console.log('Status:', res.status, '(expect 200)');
    console.log('Has accessToken:', !!res.body.accessToken);

    // 3. Login (wrong password)
    console.log('\n--- 3. Login (wrong password) ---');
    res = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass' });
    console.log('Status:', res.status, '(expect 401)');
    console.log('Message:', res.body.message);

    // 4. /me with token
    console.log('\n--- 4. GET /me (with token) ---');
    
    // fallback: we inline a mini endpoint to simulate /me
    app.get('/api/test-me', (req, res) => res.json({ user: req.user.toSafeJSON() }));
    const passport = require('passport');
    app.get('/api/test-me-auth', passport.authenticate('jwt', { session: false }), (req, res) => res.json({ user: req.user.toSafeJSON() }));
    
    res = await request(app).get('/api/test-me-auth').set('Authorization', `Bearer ${accessToken}`);
    console.log('Status:', res.status, '(expect 200)');
    console.log('User email:', res.body.user && res.body.user.email);

    // 5. 2FA setup
    console.log('\n--- 5. 2FA setup ---');
    res = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${accessToken}`);
    console.log('Status:', res.status, '(expect 200)');
    console.log('Has QR data URI:', !!(res.body.qr && res.body.qr.startsWith('data:image/png;base64,')));
    console.log('Has base32 secret:', !!res.body.secret);
    const base32Secret = res.body.secret;

    // 6. 2FA enable — generate a valid TOTP
    const speakeasy = require('speakeasy');
    const totp = speakeasy.totp({ secret: base32Secret, encoding: 'base32' });
    console.log('\n--- 6. 2FA enable ---');
    res = await request(app).post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: totp });
    console.log('Status:', res.status, '(expect 200)');
    console.log('Message:', res.body.message);

    // 7. Login now requires 2FA
    console.log('\n--- 7. Login now requires 2FA ---');
    res = await request(app).post('/api/auth/login').send({ email, password });
    console.log('Status:', res.status, '(expect 200)');
    console.log('requires2FA:', res.body.requires2FA, '(expect true)');
    console.log('Has tempToken:', !!res.body.tempToken);
    const tempToken = res.body.tempToken;

    // 8. 2FA verify-login
    const totp2 = speakeasy.totp({ secret: base32Secret, encoding: 'base32' });
    console.log('\n--- 8. 2FA verify-login ---');
    res = await request(app).post('/api/auth/2fa/verify-login').send({ tempToken, code: totp2 });
    console.log('Status:', res.status, '(expect 200)');
    console.log('Has accessToken:', !!res.body.accessToken);

    // 9. Refresh
    console.log('\n--- 9. Refresh ---');
    res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    console.log('Status:', res.status, '(expect 200)');
    console.log('New accessToken different from old:', res.body.accessToken !== accessToken);

    // 10. Forgot password
    console.log('\n--- 10. Forgot password (check terminal for Ethereal URL) ---');
    res = await request(app).post('/api/auth/forgot-password').send({ email });
    console.log('Status:', res.status, '(expect 200)');
    console.log('Message:', res.body.message);

    // Cleanup
    await User.deleteMany({ email: /^test_route_/ });
    console.log('\n🧹 Cleaned test users.');
    await mongoose.connection.close();
    console.log('🔌 MongoDB disconnected cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    try { await User.deleteMany({ email: /^test_route_/ }); } catch {}
    process.exit(1);
  }
})();