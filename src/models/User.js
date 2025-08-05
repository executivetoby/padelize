import { Schema, model } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      minlength: [3, 'Full name must be at least 3 characters'],
      trim: true,
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    image: {
      type: String,
    },
    experienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      // default: 'beginner',
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      // default: 'daily',
    },
    password: {
      type: String,
      // required: [true, 'Password is required'],
      select: false,
    },
    gender: {
      type: String,
    },
    dob: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [160, 'Description must be less than 160 characters'],
    },
    favouriteHand: {
      type: String,
      enum: ['right', 'left'],
      default: 'right',
    },
    authProvider: {
      type: String,
      enum: ['email', 'google', 'facebook', 'apple'],
      default: 'email',
    },
    phone: {
      type: String,
      // required: [true, 'Phone number is required'],
      // unique: true,
      trim: true,
      minlength: [10, 'Phone number must be at least 10 characters'],
    },
    countryCode: {
      type: String,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'invited'],
      default: 'active',
    },
    language: {
      type: String,
      default: 'en',
    },
    passwordChangedAt: {
      type: Date,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
  },
  {
    timestamps: true,
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  }
);

userSchema.pre(/^find/, async function (next) {
  this.populate({
    path: 'subscription',
  });

  next();
});

userSchema.pre('save', async function (next) {
  console.log('Password for Pre:', this.password);
  if (!this.isModified('password')) {
    console.log('This is called');
    next();
  }

  this.password = await bcrypt.hash(this.password, 10);

  next();
});

userSchema.pre('save', async function (next) {
  if (this.isNew || !this.isModified('password')) return next();

  console.log('We got here:', this.password);

  this.passwordChangedAt = Date.now() - 2000;

  console.log({ passwordChangedAt: this.passwordChangedAt });
  next();
});

userSchema.methods.comparePasswords = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    console.log({ JWTTimestamp, changedTimestamp });
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

const User = model('User', userSchema);

export default User;
