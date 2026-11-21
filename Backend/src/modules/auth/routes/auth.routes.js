import { Router } from 'express';
import { adminLogin, login, signup } from '../controllers/auth.controller.js';
import {
  logout,
  refreshTokens,
  requestOtp,
  signupWithMobile,
  verifyOtp,
} from '../controllers/identity.controller.js';
import { accessAuth } from '../middlewares/access-auth.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import {
  mobileSignupSchema,
  otpRequestSchema,
  otpVerificationSchema,
  refreshTokenSchema,
} from '../validators/identity.validator.js';
import { signupSchema } from '../validators/signup.validator.js';
import { loginSchema } from '../validators/login.validator.js';

const router = Router();

router.post('/signup', validateRequest(signupSchema), signup);
router.post('/login', validateRequest(loginSchema), login);
router.post('/admin/login', validateRequest(loginSchema), adminLogin);
router.post('/signup/mobile', validateRequest(mobileSignupSchema), signupWithMobile);
router.post('/otp/request', validateRequest(otpRequestSchema), requestOtp);
router.post('/otp/verify', validateRequest(otpVerificationSchema), verifyOtp);
router.post(
  '/token/refresh',
  validateRequest(refreshTokenSchema),
  refreshTokens,
);
router.post('/logout', accessAuth, logout);

export default router;
