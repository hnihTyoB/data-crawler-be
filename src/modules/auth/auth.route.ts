import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware, copyRefreshTokenToBody } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rate-limit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { loginSchema, refreshSchema, logoutSchema, registerSchema, updateMeSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema, changePasswordSchema } from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/login', authRateLimiter, validate(loginSchema), (req, res, next) => {
  controller.login(req, res, next);
});
router.post('/refresh', copyRefreshTokenToBody, validate(refreshSchema), (req, res, next) => {
  controller.refresh(req, res, next);
});
router.post('/logout', copyRefreshTokenToBody, validate(logoutSchema), (req, res, next) => {
  controller.logout(req, res, next);
});
router.get('/me', authMiddleware, controller.me);
router.get('/me/usage', authMiddleware, controller.usage);
router.put("/me", authMiddleware, validate(updateMeSchema), (req, res, next) => {
  controller.updateMe(req, res, next);
});
router.post('/change-password', authMiddleware, validate(changePasswordSchema), (req, res, next) => {
  controller.changePassword(req, res, next);
});
router.post("/register", authRateLimiter, validate(registerSchema), (req, res, next) => {
  controller.register(req, res, next);
});
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), (req, res, next) => {
  controller.forgotPassword(req, res, next);
});
router.post("/reset-password", validate(resetPasswordSchema), (req, res, next) => {
  controller.resetPassword(req, res, next);
});
router.post("/resend-verification", authRateLimiter, validate(resendVerificationSchema), (req, res, next) => {
  controller.resendVerification(req, res, next);
});

router.post("/verify-email", validate(verifyEmailSchema), (req, res, next) => {
  controller.verifyEmail(req, res, next);
});

export default router;
