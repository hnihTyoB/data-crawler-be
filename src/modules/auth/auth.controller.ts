import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateMeDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, ChangePasswordDto, ResendVerificationDto } from './auth.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AUDIT_ACTIONS } from '../../common/constants/audit-action.constant';
import { MailService } from '../mail/mail.service';

export class AuthController {
  private readonly service = new AuthService();
  private readonly auditLogService = new AuditLogService();
  private readonly mailService = new MailService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const loginDto: LoginDto = req.body;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip;
      const result = await this.service.login(loginDto, { userAgent, ipAddress });

      await this.auditLogService.log({
        userId: result.user.id,
        action: AUDIT_ACTIONS.LOGIN,
        ipAddress,
        userAgent,
        details: { email: loginDto.email },
      });

      const decodedAccess = jwt.decode(result.accessToken) as { exp: number };
      const accessMaxAge = decodedAccess.exp * 1000 - Date.now();

      const decodedRefresh = jwt.decode(result.refreshToken) as { exp: number };
      const refreshMaxAge = decodedRefresh.exp * 1000 - Date.now();

      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: accessMaxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: refreshMaxAge,
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMe(req.user.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip;
      const result = await this.service.refresh(refreshToken, { userAgent, ipAddress });

      const decodedAccess = jwt.decode(result.accessToken) as { exp: number };
      const accessMaxAge = decodedAccess.exp * 1000 - Date.now();

      const decodedRefresh = jwt.decode(result.refreshToken) as { exp: number };
      const refreshMaxAge = decodedRefresh.exp * 1000 - Date.now();

      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: accessMaxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: refreshMaxAge,
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await this.service.logout(refreshToken);

      let userId: string | null = null;
      try {
        const decoded = jwt.decode(refreshToken) as { id?: string } | null;
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (err) {
        // ignore decode failure
      }

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.LOGOUT,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registerDto: RegisterDto = req.body;
      const result = await this.service.register(registerDto);

      await this.auditLogService.log({
        userId: result.id,
        action: AUDIT_ACTIONS.REGISTER,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { email: registerDto.email },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updateMeDto: UpdateMeDto = req.body;
      const result = await this.service.updateMe(req.user.id, updateMeDto);

      const updatedFields = Object.keys(updateMeDto);
      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.UPDATE_ME,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { updatedFields },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const changePasswordDto: ChangePasswordDto = req.body;
      const result = await this.service.changePassword(req.user.id, changePasswordDto, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.CHANGE_PASSWORD,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });

      const decodedAccess = jwt.decode(result.accessToken) as { exp: number };
      const accessMaxAge = decodedAccess.exp * 1000 - Date.now();

      const decodedRefresh = jwt.decode(result.refreshToken) as { exp: number };
      const refreshMaxAge = decodedRefresh.exp * 1000 - Date.now();

      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: accessMaxAge,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: refreshMaxAge,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const forgotPasswordDto: ForgotPasswordDto = req.body;
      const result = await this.service.forgotPassword(forgotPasswordDto);

      if (result.userId && result.resetToken) {
        await this.auditLogService.log({
          userId: result.userId,
          action: AUDIT_ACTIONS.FORGOT_PASSWORD,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
          details: { email: forgotPasswordDto.email },
        });

        await this.mailService.sendPasswordResetEmail(forgotPasswordDto.email, result.resetToken);
      }

      res.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resetPasswordDto: ResetPasswordDto = req.body;
      const result = await this.service.resetPassword(resetPasswordDto);

      await this.auditLogService.log({
        userId: result.userId,
        action: AUDIT_ACTIONS.RESET_PASSWORD,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });

      res.json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resendVerificationDto: ResendVerificationDto = req.body;
      const result = await this.service.resendVerificationEmail(resendVerificationDto.email);

      if (result.sent && result.userId) {
        await this.auditLogService.log({
          userId: result.userId,
          action: AUDIT_ACTIONS.RESEND_VERIFICATION,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
          details: { email: resendVerificationDto.email },
        });
      }

      res.json({
        success: result.success,
        message: 'Nếu email đã đăng ký và chưa được xác thực, liên kết xác thực đã được gửi.',
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verifyEmailDto: VerifyEmailDto = req.body;
      const result = await this.service.verifyEmail(verifyEmailDto.token);

      await this.auditLogService.log({
        userId: result.userId,
        action: AUDIT_ACTIONS.VERIFY_EMAIL,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
