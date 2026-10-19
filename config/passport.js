const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const User = require('../models/user');

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +twoFactorSecret');
    if (!user || !(await user.comparePassword(password))) {
      return done(null, false, { message: 'Invalid email or password' });
    }
    return done(null, user);
  } catch (e) {
    return done(e);
  }
}));

passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_ACCESS_SECRET
  },
  async (payload, done) => {
    try {
      const user = await User.findById(payload.sub);
      return user ? done(null, user) : done(null, false);
    } catch (e) {
      return done(e);
    }
  }
));

async function oauthUpsert(provider, profile, done) {
  try {
    const idField = provider === 'google' ? 'googleId' : 'githubId';
    const email = profile.emails && profile.emails[0]
      ? profile.emails[0].value.toLowerCase()
      : undefined;

    let user = await User.findOne({ [idField]: profile.id });
    if (!user && email) user = await User.findOne({ email });
    if (!user) user = new User({ email, name: profile.displayName || profile.username });

    user[idField] = profile.id;
    user.avatar = user.avatar || (profile.photos && profile.photos[0] && profile.photos[0].value);
    await user.save();
    return done(null, user);
  } catch (e) {
    return done(e);
  }
}

// OAuth strategies are only registered if the env vars exist, so the app runs
// without Google/GitHub configured. Routes will return 501 for missing providers.
if (process.env.GOOGLE_CLIENT_ID) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, (at, rt, profile, done) => oauthUpsert('google', profile, done)));
}

if (process.env.GITHUB_CLIENT_ID) {
  const GitHubStrategy = require('passport-github2').Strategy;
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email']
  }, (at, rt, profile, done) => oauthUpsert('github', profile, done)));
}

module.exports = passport;