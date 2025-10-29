import { createOne, findOne } from '../factory/repo.js';
import {
  createToken,
  findTokenByEmail,
  findTokenByPin,
} from '../factory/tokenRepo.js';
import { findUserByEmail, findUserById } from '../factory/userRepo.js';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import JWT from 'jsonwebtoken';
import randomNumber from 'random-number';
import nodeMailer from '../config/nodemailer.js';

/**
 * Generates a JSON Web Token (JWT) for a given user ID.
 * @param {string} id - The user ID to generate the JWT for.
 * @returns {string} The generated JWT.
 */
export const signToken = (id) => {
  return JWT.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/**
 * Creates a signed JSON Web Token (JWT) for a given user and returns it in the response.
 * @param {Object} user - The user document to generate the JWT for.
 * @param {Response} res - The response object to send the response to.
 * @param {number} statusCode - The HTTP status code to send in the response.
 * @param {string} message - The message to include in the response.
 */
const createSignedToken = (user, res, statusCode, message) => {
  const token = signToken(user._id);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    message: message,
    data: {
      user,
    },
  });
};

const options = {
  min: 100000,
  max: 999999,
  integer: true,
};

const createRandomNumber = () => {
  return randomNumber(options);
};

export const signupService = catchAsync(async (req, res, next) => {
  const { email, regid } = req.body;

  const requiredFields = [
    'fullName',
    'email',
    'password',
    'frequency',
    'experienceLevel',
  ];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0)
    return next(
      new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400)
    );

  const isExist = await findUserByEmail(User, email.toLowerCase());

  console.log({ isExist });

  if (isExist)
    return next(new AppError('User with this email already exists', 400));

  const user = await createOne(User, req.body);

  regid &&
    (await createOne(FirebaseToken, {
      user: user._id,
      regid,
    }));

  createSignedToken(user, res, 201, 'User created successfully');
});

export const loginService = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(User, email.toLowerCase(), '+password');

  if (!user || !(await user.comparePasswords(password, user.password)))
    return next(new AppError('Invalid email or password', 401));

  console.log({ user });

  createSignedToken(user, res, 200, 'Logged in successfully');
});

export const forgotPasswordService = catchAsync(async (req, res, next) => {
  let user;
  const normalUser = await findUserByEmail(User, req.body.email);
  // const adminUser = await findUserByEmail(Admin, req.body.email);

  console.log(normalUser?.fullName);

  user = normalUser;

  if (!user) {
    return next(new AppError('User with this email not found', 404));
  }

  const pin = createRandomNumber();

  console.log({ pin });

  let token = await findTokenByEmail(req.body.email);

  if (!token) {
    token = await createToken(pin, req.body.email);
  } else {
    token.pin = pin;
    await token.save();
  }

  console.log({ token });

  const subject = 'Reset Your Password';

  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
        <p>Hi ${user.fullName.split(' ')[0]},</p>
        <p>We received a request to reset your password. Don't worry, it happens to the best of us!</p>
        <p>Use the PIN below to reset your password:</p>

        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; color: #856404; letter-spacing: 5px;">${pin}</span>
        </div>

        <p style="color: #666; font-size: 14px;">This PIN will expire in 15 minutes for security purposes.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 13px; margin: 5px 0;">
            <strong>Security Alert:</strong> If you didn't request a password reset, please secure your account immediately by changing your password and contacting our support team.
          </p>
        </div>

        <p style="margin-top: 30px;">Best regards,<br><strong>The Padelize Team</strong></p>
      </div>

      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>Need help? Contact us at support@padelize.com</p>
      </div>
    </div>
  `;

  await nodeMailer(req.body.email, subject, message);

  res.status(200).json({
    status: 'success',
    message: 'Reset pin sent successfully',
    data: {},
  });
});

export const resetPasswordService = catchAsync(async (req, res, next) => {
  const { pin, password } = req.body;

  const token = await findTokenByPin(pin);

  if (!token || token.pin !== pin)
    return next(new AppError('Invalid pin', 400));

  console.log(Date.parse(token.updatedAt) + 5 * 60 * 1000 < Date.now());

  if (Date.parse(token.updatedAt) + 5 * 60 * 1000 < Date.now()) {
    return next(new AppError('Expired pin, request for another one.', 400));
  }

  let user;
  const normalUser = await findUserByEmail(User, token.email, '+password');
  // const adminUser = await findUserByEmail(Admin, token.email, '+password');

  user = normalUser;

  user.password = password;

  await user.save();

  console.log({ user });
  // await deleteToken(pin);

  // createOne(Notification, {
  //   message: req.t('success.resetPassword.success'),
  //   user: user._id,
  // });

  res.status(200).json({
    status: 'success',
    message: 'Reset password done successfully',
    data: {},
  });
});

export const changePasswordService = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  const user = await findUserById(User, req.user.id, '+password');

  console.log({ user });

  if (user.authType === 'email') {
    if (!user || !(await user.comparePasswords(oldPassword, user.password))) {
      return next(new AppError('Incorrect password', 401));
    }
  }

  user.password = newPassword;

  await user.save();

  user.password = undefined;

  // const data = {
  //   user: user._id,
  //   title: 'Change Password',
  //   message: req.t('success.resetPassword.success'),
  // };

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully',
    data: {
      user,
    },
  });
});

export const sendOTPService = catchAsync(async (req, res, next) => {
  const { email, fullName } = req.user;

  const pin = createRandomNumber();

  let token = await findTokenByEmail(email);

  if (!token) {
    token = await createToken(pin, email);
  } else {
    token.pin = pin;
    await token.save();
  }

  const subject = 'Your One-Time Password (OTP)';

  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">Verify Your Identity</h2>
        <p>Hi ${fullName.split(' ')[0]},</p>
        <p>You requested a one-time password to verify your identity. Please use the code below:</p>

        <div style="background-color: #f0f7ff; border-left: 4px solid #007bff; padding: 15px; margin: 25px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${pin}</span>
        </div>

        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes for security purposes.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 13px; margin: 5px 0;">
            <strong>Security Note:</strong> If you didn't request this code, please ignore this email or contact our support team immediately.
          </p>
        </div>

        <p style="margin-top: 30px;">Best regards,<br><strong>The Padelize Team</strong></p>
      </div>
    </div>
  `;

  await nodeMailer(email, subject, message);

  res.status(200).json({
    status: 'success',
    message: 'OTP sent successfully',
  });
});
export const verifyEmailService = catchAsync(async (req, res, next) => {
  const { pin } = req.body;

  const token = await findTokenByPin(pin);

  console.log({ token });

  console.log(Date.now(), Date.parse(token.updatedAt) + 5 * 60 * 1000);

  if (!token || Date.now() > Date.parse(token.updatedAt) + 5 * 60 * 1000)
    return next(new AppError('Invalid token or expired token', 400));

  const user = await findUserByEmail(User, token.email);

  if (!user) return next(new AppError('User not found', 404));

  user.verified = true;

  await user.save();

  // await deleteToken(pin);

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully',
    data: {
      user,
    },
  });
});

import { OAuth2Client } from 'google-auth-library';
import FirebaseToken from '../models/FirebaseToken.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleSignInService = catchAsync(async (req, res, next) => {
  const { idToken, regid } = req.body;

  const audience = process.env.GOOGLE_CLIENT_IDS.split(',');

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience,
  });

  const payload = ticket.getPayload();

  const { email, name, picture } = payload;

  console.log({ picture, payload });

  const user = await findUserByEmail(User, email);

  if (!user) {
    const newUser = await createOne(User, {
      email,
      fullName: name,
      image: picture,
      password: 'googleSignIn',
      authProvider: 'google',
      verified: true,
    });

    regid &&
      (await createOne(FirebaseToken, {
        user: newUser._id,
        regid,
      }));

    createSignedToken(newUser, res, 201, 'User created successfully');
  } else {
    createSignedToken(user, res, 200, 'Logged in successfully');
  }
});

export const facebookSignInService = catchAsync(async (req, res, next) => {
  const { accessToken, regid } = req.body;

  const response = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
  );

  const data = await response.json();

  const { email, name, picture } = data;

  const user = await findUserByEmail(User, email);

  if (!user) {
    const newUser = await createOne(User, {
      email,
      fullName: name,
      image: picture.data.url,
      password: 'facebookSignIn',
      authProvider: 'facebook',
      verified: true,
    });

    regid &&
      (await createOne(FirebaseToken, {
        user: newUser._id,
        regid,
      }));

    createSignedToken(newUser, res, 201, 'User created successfully');
  } else {
    createSignedToken(user, res, 200, 'Logged in successfully');
  }
});

export const appleSignInService = catchAsync(async (req, res, next) => {
  const { idToken, regid } = req.body;

  const response = await fetch(`https://appleid.apple.com/auth/keys`);

  const data = await response.json();

  console.log({ data });

  const { email, name, picture } = data;

  const user = await findUserByEmail(User, email);

  if (!user) {
    const newUser = await createOne(User, {
      email,
      fullName: name,
      image: picture.data.url,
      password: 'appleSignIn',
      authProvider: 'apple',
      verified: true,
    });

    createSignedToken(newUser, res, 201, 'User created successfully');
  } else {
    createSignedToken(user, res, 200, 'Logged in successfully');
  }
});
