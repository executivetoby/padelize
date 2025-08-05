const keys = {
  PORT: process.env.PORT,
  ENVIRONMENT: process.env.NODE_ENV,
  BCRYPT: process.env.BCRYPT,
  TOKEN_GENERATION_LIMIT: process.env.TOKEN_GENERATION_LIMIT,
  DATABASE: {
    MONGODB: {
      DEVELOPMENT: {
        CONNECTION_STRING: process.env.DATABASE,
      },
      STAGING: {
        CONNECTION_STRING: process.env.MONGO_URI_DEV,
      },
      PRODUCTION: {
        CONNECTION_STRING: process.env.MONGO_URI_DEV,
      },
    },
  },
  JWT: {
    REFRESH_TOKEN: process.env.JWT_REFRESH_TOKEN,
    SECRET: process.env.JWT_SECRET,
    EXPIRES: process.env.JWT_EXPIRES,
    REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES,
  },
};

export default keys;
