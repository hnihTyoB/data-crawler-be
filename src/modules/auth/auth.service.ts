import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { jwtConfig } from '../../config/jwt.config';
import { LoginDto, AuthTokensDto, MeDto, LoginResponseDto, RegisterDto, UpdateMeDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './auth.dto';
import { MailService } from '../mail/mail.service';

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly mailService = new MailService();

  private async deliverVerificationEmail(
    user: { id: string; email: string },
    rollbackOnFailure = false,
  ): Promise<void> {
    const verificationToken = this.createEmailVerificationToken(user.email);

    try {
      await this.mailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error: unknown) {
      if (rollbackOnFailure) {
        await this.repository.deleteUnverifiedUser(user.id).catch((rollbackError: unknown) => {
          console.error('[Mail] Failed to roll back unverified user after delivery error:', rollbackError);
        });
      }

      const mailError = error as { code?: string; responseCode?: number };
      console.error(
        `[Mail] Verification delivery failed: ${mailError.code ?? 'UNKNOWN'}${mailError.responseCode ? ` (SMTP ${mailError.responseCode})` : ''}`,
      );
      throw new AppError(
        'Không thể gửi email xác thực. Vui lòng thử lại sau.',
        503,
        ERROR_CODE.MAIL_DELIVERY_FAILED,
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      const { mailConfig } = await import('../../config/mail.config');
      console.log(`[DEV ONLY] Verification Link: ${mailConfig.frontendUrl}/verify-email?token=${verificationToken}`);
    }
  }

  async login(data: LoginDto, metadata?: { userAgent?: string; ipAddress?: string }): Promise<LoginResponseDto> {
    const { email, password } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError('Tài khoản hoặc mật khẩu không chính xác.', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new AppError(
        'Tài khoản chưa được xác thực hoặc đã bị khóa.',
        403,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Tài khoản hoặc mật khẩu không chính xác.', 401, ERROR_CODE.INVALID_CREDENTIALS);
    }

    const payload = { id: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as any,
    });

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(user.id, refreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async refresh(token: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthTokensDto> {
    let payload: any;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (error) {
      await this.repository.deleteRefreshToken(token).catch(() => { });
      throw new AppError('Invalid refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    const savedToken = await this.repository.findRefreshToken(token);
    if (!savedToken) {
      throw new AppError('Invalid or expired refresh token', 401, ERROR_CODE.TOKEN_INVALID);
    }

    if (savedToken.expiresAt < new Date()) {
      await this.repository.deleteRefreshToken(token);
      throw new AppError('Refresh token expired', 401, ERROR_CODE.TOKEN_EXPIRED);
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, ERROR_CODE.USER_INACTIVE);
    }

    const newPayload = { id: user.id, email: user.email, role: user.role };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const newRefreshToken = jwt.sign(newPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as any,
    });

    await this.repository.deleteRefreshToken(token);

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(user.id, newRefreshToken, expiresAt, metadata?.userAgent, metadata?.ipAddress);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    await this.repository.deleteRefreshToken(token);
  }

  private createEmailVerificationToken(email: string): string {
    return jwt.sign(
      { email, purpose: 'email-verification' },
      jwtConfig.accessSecret,
      { expiresIn: '24h' },
    );
  }

  async register(data: RegisterDto): Promise<MeDto> {
    const existing = await this.repository.findByEmail(data.email);

    if (existing) {
      if (!existing.isActive) {
        await this.deliverVerificationEmail(existing);
        return {
          id: existing.id,
          email: existing.email,
          fullName: existing.fullName,
          role: existing.role,
          isActive: existing.isActive,
          createdAt: existing.createdAt,
        };
      }

      throw new AppError(
        "Email already exists",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repository.createUser({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      isActive: false,
    });

    await this.deliverVerificationEmail(user, true);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async resendVerificationEmail(
    email: string,
  ): Promise<{ success: boolean; sent: boolean; userId?: string }> {
    const user = await this.repository.findByEmail(email);
    if (!user || user.isActive) {
      return { success: true, sent: false };
    }

    await this.deliverVerificationEmail(user);

    return { success: true, sent: true, userId: user.id };
  }

  async updateMe(userId: string, data: UpdateMeDto): Promise<MeDto> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const normalizedFullName = data.fullName?.trim();
    if (
      normalizedFullName !== undefined &&
      normalizedFullName === (user.fullName ?? '')
    ) {
      throw new AppError(
        'Không có thay đổi nào để cập nhật.',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const updateData: { fullName?: string } = {};

    if (normalizedFullName !== undefined) {
      updateData.fullName = normalizedFullName;
    }

    const updatedUser = await this.repository.updateUser(userId, updateData);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
    };
  }

  async changePassword(
    userId: string,
    data: ChangePasswordDto,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthTokensDto> {
    const { currentPassword, newPassword } = data;
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError("User not found or inactive", 404, ERROR_CODE.NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid current password",
        400,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AppError(
        "New password must differ from the current password",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repository.updateUser(userId, { passwordHash });

    // Revoke all existing refresh tokens
    await this.repository.deleteUserRefreshTokens(userId);

    // Generate new tokens for the current session
    const payload = { id: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as any,
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as any,
    });

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<{ success: boolean; resetToken?: string; userId?: string }> {
    const { email } = data;
    const user = await this.repository.findByEmail(email);

    if (!user || !user.isActive) {
      return { success: true };
    }

    const secret = `${jwtConfig.accessSecret}-${user.passwordHash}`;
    const resetToken = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn: '15m' }
    );

    return {
      success: true,
      resetToken,
      userId: user.id,
    };
  }

  async resetPassword(data: ResetPasswordDto): Promise<{ success: boolean; userId: string }> {
    const { token, password } = data;

    let payload: any;
    try {
      payload = jwt.decode(token);
    } catch (error) {
      throw new AppError('Invalid token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (!payload || !payload.id) {
      throw new AppError('Invalid token payload', 400, ERROR_CODE.TOKEN_INVALID);
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 404, ERROR_CODE.NOT_FOUND);
    }

    const secret = `${jwtConfig.accessSecret}-${user.passwordHash}`;
    try {
      jwt.verify(token, secret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Reset token has expired', 400, ERROR_CODE.TOKEN_EXPIRED);
      }
      throw new AppError('Invalid reset token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.repository.updateUser(user.id, { passwordHash });
    await this.repository.deleteUserRefreshTokens(user.id);

    return { success: true, userId: user.id };
  }

  async verifyEmail(token: string): Promise<{ success: boolean; userId: string }> {
    let payload: any;
    try {
      payload = jwt.verify(token, jwtConfig.accessSecret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Verification token has expired', 400, ERROR_CODE.TOKEN_EXPIRED);
      }
      throw new AppError('Invalid verification token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (!payload || !payload.email || payload.purpose !== 'email-verification') {
      throw new AppError('Invalid verification token payload', 400, ERROR_CODE.TOKEN_INVALID);
    }

    const user = await this.repository.findByEmail(payload.email);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.isActive) {
      return { success: true, userId: user.id };
    }

    await this.repository.updateUser(user.id, { isActive: true });

    return { success: true, userId: user.id };
  }
}
