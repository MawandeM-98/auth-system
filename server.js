require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const passport = require('./config/passport');

const app = express();

// Security and parsing middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Rate limiting for auth routes (max 100 requests per 15 min)
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

// Start server
connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${process.env.PORT}`);
  });
}).catch((e) => {
  console.error('DB connection failed', e.message);
  process.exit(1);
});