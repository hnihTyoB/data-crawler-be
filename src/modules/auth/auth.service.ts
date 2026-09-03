import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { jwtConfig } from '../../config/jwt.config';
import { LoginDto, AuthTokensDto, MeDto, LoginResponseDto, RegisterDto, UpdateMeDto, UserUsageDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './auth.dto';
import { MailService } from '../mail/mail.service';
import { CrawlJobRepository } from '../crawl-jobs/crawl-job.repository';
import { JOB_STATUS } from '../../common/constants/job-status.constant';
import {
  getZonedDateParts,
  createUtcDateFromZonedParts,
} from '../../common/helpers/schedule-calculator.helper';

interface AuthJwtPayload {
  id: string;
  email: string;
  role: string;
  purpose?: string;
}

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

    const payload: AuthJwtPayload = { id: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as unknown as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as unknown as SignOptions['expiresIn'],
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
        avatarUrl: user.avatarUrl,
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
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async refresh(token: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthTokensDto> {
    let payload: AuthJwtPayload;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret) as AuthJwtPayload;
    } catch {
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

    const newPayload: AuthJwtPayload = { id: user.id, email: user.email, role: user.role };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as unknown as SignOptions['expiresIn'],
    });

    const newRefreshToken = jwt.sign(newPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as unknown as SignOptions['expiresIn'],
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
      jwtConfig.emailVerificationSecret,
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
          avatarUrl: existing.avatarUrl ?? null,
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
      avatarUrl: user.avatarUrl ?? null,
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
    const avatarUrl = data.avatarUrl;

    const hasNameChange =
      normalizedFullName !== undefined && normalizedFullName !== (user.fullName ?? '');
    const hasAvatarChange =
      avatarUrl !== undefined && avatarUrl !== (user.avatarUrl ?? null);

    if (!hasNameChange && !hasAvatarChange) {
      throw new AppError(
        'Không có thay đổi nào để cập nhật.',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const updateData: { fullName?: string; avatarUrl?: string | null } = {};

    if (hasNameChange) {
      updateData.fullName = normalizedFullName;
    }
    if (hasAvatarChange) {
      updateData.avatarUrl = avatarUrl;
    }

    const updatedUser = await this.repository.updateUser(userId, updateData);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
    };
  }

  async getUsage(userId: string): Promise<UserUsageDto> {
    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const crawlJobRepo = new CrawlJobRepository();
    const nowZoned = getZonedDateParts(new Date(), 'Asia/Ho_Chi_Minh');
    const startOfDay = createUtcDateFromZonedParts(
      nowZoned.year,
      nowZoned.month,
      nowZoned.day,
      0,
      0,
      'Asia/Ho_Chi_Minh',
    );
    const nextDay = createUtcDateFromZonedParts(
      nowZoned.year,
      nowZoned.month,
      nowZoned.day + 1,
      0,
      0,
      'Asia/Ho_Chi_Minh',
    );

    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const activeStatuses = [
      JOB_STATUS.PENDING,
      JOB_STATUS.QUEUED,
      JOB_STATUS.RUNNING,
      JOB_STATUS.PROCESSING_EXPORT,
    ];

    const [jobsTodayCount, concurrentJobsCount, totalPages] = await Promise.all([
      crawlJobRepo.countJobsSince(userId, startOfDay),
      crawlJobRepo.countConcurrentJobs(userId, activeStatuses, twoHoursAgo),
      crawlJobRepo.sumPagesCrawledByUser(userId),
    ]);

    return {
      quota: {
        maxPagesLimit: user.maxPagesLimit,
        maxJobsPerDayLimit: user.maxJobsPerDayLimit,
        maxConcurrentJobsLimit: user.maxConcurrentJobsLimit,
      },
      usage: {
        jobsUsedToday: jobsTodayCount,
        jobsRemainingToday: Math.max(0, user.maxJobsPerDayLimit - jobsTodayCount),
        concurrentJobsRunning: concurrentJobsCount,
        concurrentJobsAvailable: Math.max(0, user.maxConcurrentJobsLimit - concurrentJobsCount),
        totalPagesCrawled: totalPages,
      },
      resetAt: nextDay.toISOString(),
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
    const payload: AuthJwtPayload = { id: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn as unknown as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as unknown as SignOptions['expiresIn'],
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

  /**
   * Verifies a password-reset JWT and returns the authenticated User.
   *
   * Pattern: decode (untrusted) → fetch user by id → verify with passwordHash-bound secret.
   * This is intentional: the reset token is stateless and embeds userId so we can derive the
   * per-user secret (accessSecret + passwordHash). The decode step only extracts the userId
   * for the DB lookup; NO business logic is performed until jwt.verify() has succeeded.
   */
  private async verifyResetToken(token: string) {
    // Step 1: structural decode only — do NOT trust any field yet
    let untrustedPayload: AuthJwtPayload | null = null;
    try {
      untrustedPayload = jwt.decode(token) as AuthJwtPayload | null;
    } catch {
      throw new AppError('Invalid token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (!untrustedPayload || !untrustedPayload.id) {
      throw new AppError('Invalid token payload', 400, ERROR_CODE.TOKEN_INVALID);
    }

    // Step 2: fetch user needed to derive the per-user signing secret
    const user = await this.repository.findById(untrustedPayload.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 404, ERROR_CODE.NOT_FOUND);
    }

    // Step 3: cryptographic verification — all business logic below this point is safe
    const secret = `${jwtConfig.accessSecret}-${user.passwordHash}`;
    try {
      jwt.verify(token, secret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Reset token has expired', 400, ERROR_CODE.TOKEN_EXPIRED);
      }
      throw new AppError('Invalid reset token', 400, ERROR_CODE.TOKEN_INVALID);
    }

    return user; // fully authenticated — caller may trust this object
  }

  async resetPassword(data: ResetPasswordDto): Promise<{ success: boolean; userId: string }> {
    const { token, password } = data;

    // verifyResetToken throws on any invalid/expired/tampered token
    const user = await this.verifyResetToken(token);

    const passwordHash = await bcrypt.hash(password, 10);
    await this.repository.updateUser(user.id, { passwordHash });
    await this.repository.deleteUserRefreshTokens(user.id);

    return { success: true, userId: user.id };
  }

  async verifyEmail(token: string): Promise<{ success: boolean; userId: string }> {
    let payload: AuthJwtPayload | null = null;
    try {
      payload = jwt.verify(token, jwtConfig.emailVerificationSecret) as AuthJwtPayload;
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
