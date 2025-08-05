const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const User = require('./models/User'); // Replace with the path to your User model

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: 'GOOGLE_CLIENT_ID', // Replace with your Google Client ID
      clientSecret: 'GOOGLE_CLIENT_SECRET', // Replace with your Google Client Secret
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            image: profile.photos[0].value,
          });
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// LinkedIn Strategy
passport.use(
  new LinkedInStrategy(
    {
      clientID: 'LINKEDIN_CLIENT_ID', // Replace with your LinkedIn Client ID
      clientSecret: 'LINKEDIN_CLIENT_SECRET', // Replace with your LinkedIn Client Secret
      callbackURL: '/auth/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ linkedinId: profile.id });
        if (!user) {
          user = await User.create({
            linkedinId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            image: profile.photos[0].value,
          });
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

module.exports = passport;
