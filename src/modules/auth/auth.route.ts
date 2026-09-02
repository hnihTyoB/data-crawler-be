import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware, copyRefreshTokenToBody } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { loginSchema, refreshSchema, logoutSchema, registerSchema, updateMeSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema, changePasswordSchema } from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/login', validate(loginSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/LoginRequest' } }
  controller.login(req, res, next);
});
router.post('/refresh', copyRefreshTokenToBody, validate(refreshSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/RefreshRequest' } }
  controller.refresh(req, res, next);
});
router.post('/logout', copyRefreshTokenToBody, validate(logoutSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/LogoutRequest' } }
  controller.logout(req, res, next);
});
router.get('/me', authMiddleware, controller.me);
router.put("/me", authMiddleware, validate(updateMeSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/UpdateMeRequest' } }
  controller.updateMe(req, res, next);
});
router.post('/change-password', authMiddleware, validate(changePasswordSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } }
  controller.changePassword(req, res, next);
});
router.post("/register", validate(registerSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/RegisterRequest' } }
  controller.register(req, res, next);
});
router.post("/forgot-password", validate(forgotPasswordSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } }
  controller.forgotPassword(req, res, next);
});
router.post("/reset-password", validate(resetPasswordSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } }
  controller.resetPassword(req, res, next);
});
router.post("/resend-verification", validate(resendVerificationSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/ResendVerificationRequest' } }
  controller.resendVerification(req, res, next);
});

router.post("/verify-email", validate(verifyEmailSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/VerifyEmailRequest' } }
  controller.verifyEmail(req, res, next);
});

export default router;
