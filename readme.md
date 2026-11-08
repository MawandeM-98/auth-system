# 🔐 Production-Style Auth System

A comprehensive, production-ready authentication system built with **Node.js**, **Express**, **MongoDB**, and **Passport.js**. It features a sleek, semi-3D glassmorphism frontend and implements industry-standard security practices including JWT rotation, bcrypt hashing, and TOTP (Time-Based One-Time Password) Two-Factor Authentication.

## ✨ Features

- **Email & Password Auth**: Secure registration and login.
- **Password Hashing**: Uses `bcryptjs` with a cost factor of 12.
- **JWT Architecture**: Short-lived Access Tokens (15 mins) + httpOnly Refresh Tokens (7 days).
- **Two-Factor Authentication (2FA)**: TOTP implementation compatible with Google Authenticator, complete with QR code generation.
- **OAuth 2.0**: Google and GitHub login integration (conditionally enabled based on environment variables).
- **Password Reset**: Secure, time-limited token-based reset flow via email (uses Ethereal for local dev).
- **Security Hardening**: Helmet, CORS, rate-limiting on auth routes, and generic error messages to prevent email enumeration.
- **Modern UI**: Semi-3D glass cards, interactive mouse-tilt effects, and smooth form transitions using vanilla HTML/CSS/JS.

## 🛠️ Tech Stack

- **Backend**: Node.js (v20+), Express.js
- **Database**: MongoDB & Mongoose
- **Authentication**: Passport.js (Local, JWT, Google, GitHub)
- **Security & Tokens**: bcryptjs, jsonwebtoken, speakeasy (2FA), qrcode
- **Email**: Nodemailer
- **Frontend**: Plain HTML, CSS, JavaScript (no framework)

---

## 🚀 Local Setup

### 1. Prerequisites
- Node.js installed (v20 or higher recommended).
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI.

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/MawandeM-98/auth-system.git
cd auth-system
npm install