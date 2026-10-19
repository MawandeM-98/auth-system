require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const passport = require('../config/passport'); // registers strategies
const User = require('../models/user');

(async () => {
  try {
    await connectDB();

    // Clean up any prior test users
    await User.deleteMany({ email: /^passport_test_/ });

    // Create a user with a real bcrypt password
    const email = `passport_test_${Date.now()}@example.com`;
    await User.create({ name: 'Passport Test', email, password: 'correcthorsebatterystaple' });

    console.log('\n--- Local strategy ---');

    // Use passport.authenticate programmatically
    const req = { body: { email, password: 'correcthorsebatterystaple' } };
    passport.authenticate('local', { session: false }, (err, user, info) => {
      if (err) throw err;
      console.log('correct password → user found:', !!user, '| email:', user && user.email);
      console.log('  password field hidden on user object? (should be undefined):', user.password === undefined);

      // Now try wrong password
      const req2 = { body: { email, password: 'wrong' } };
      passport.authenticate('local', { session: false }, async (err2, user2, info2) => {
        console.log('wrong password → user found (should be false):', !!user2);
        console.log('  info.message:', info2 && info2.message);

        // Unknown email
        const req3 = { body: { email: 'nobody@example.com', password: 'whatever' } };
        passport.authenticate('local', { session: false }, async (err3, user3, info3) => {
          console.log('unknown email → user found (should be false):', !!user3);

          // Cleanup
          await User.deleteMany({ email: /^passport_test_/ });
          console.log('\n🧹 Cleaned test users.');
          await mongoose.connection.close();
          console.log('🔌 MongoDB disconnected cleanly.');
          process.exit(0);
        })(req3);
      })(req2);
    })(req);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
})();