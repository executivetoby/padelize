import { Router } from 'express';
import {
  appleSignIn,
  changePassword,
  facebookSignIn,
  forgotPassword,
  googleSignIn,
  login,
  protect,
  resetPassword,
  sendOTP,
  signup,
  verifyEmail,
} from '../controllers/authController.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot_password', forgotPassword);
router.post('/reset_password', resetPassword);
router.post('/google', googleSignIn);
router.post('/facebook_signin', facebookSignIn);
router.post('/apple_signin', appleSignIn);
router.post('/verify_email', verifyEmail);

router.use(protect);
router.post('/send_otp', sendOTP);
router.post('/change_password', changePassword);

export default router;
