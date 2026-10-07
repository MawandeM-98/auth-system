require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    await connectDB();

    const email = `test_${Date.now()}@example.com`;
    const user = await User.create({
      name: 'Test User',
      email,
      password: 'correcthorsebatterystaple'
    });
    console.log('\n✅ User created:', user._id.toString());

    const fetched = await User.findById(user._id).select('+password');
    console.log('Stored hash:', fetched.password);
    console.log('Starts with $2a$/$2b$ cost 12:', /^\$2[aby]\$12\$/.test(fetched.password));

    console.log('comparePassword(correct):', await fetched.comparePassword('correcthorsebatterystaple'));
    console.log('comparePassword(wrong):  ', await fetched.comparePassword('wrongpassword'));

    console.log('\ntoSafeJSON():', fetched.toSafeJSON());

    await User.deleteOne({ _id: user._id });
    console.log('\n🧹 Test user deleted.');

    await mongoose.connection.close();
    console.log('🔌 MongoDB disconnected cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
})();