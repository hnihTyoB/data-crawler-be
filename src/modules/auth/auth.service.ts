import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import path from "path";
import { Readable } from "stream";
import { AuthRepository } from "./auth.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { jwtConfig } from "../../config/jwt.config";
import {
  LoginDto,
  AuthTokensDto,
  MeDto,
  LoginResponseDto,
  RegisterDto,
  UpdateMeDto,
  UserUsageDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RequestDeactivationDto,
  ConfirmDeactivationDto,
} from "./auth.dto";
import { MailService } from "../mail/mail.service";
import { CrawlJobRepository } from "../crawl-jobs/crawl-job.repository";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { ROLES } from "../../common/constants/role.constant";
import { DEFAULT_TIMEZONE } from "../../common/constants/timezone.constant";
import { UPLOAD_SUBDIRS } from "../../common/constants/storage-path.constant";
import { StorageFactory } from "../../common/storage/storage.factory";
import {
  getZonedDateParts,
  createUtcDateFromZonedParts,
} from "../../common/helpers/schedule-calculator.helper";

interface AuthJwtPayload {
  id: string;
  email: string;
  role: string;
  purpose?: string;
}

export class AuthService {
  private readonly repository = new AuthRepository();
  private readonly mailService = new MailService();
  private readonly storageService = StorageFactory.getStorageService();
  private readonly crawlJobRepository = new CrawlJobRepository();

  private async deliverVerificationEmail(
    user: { id: string; email: string },
    rollbackOnFailure = false,
  ): Promise<void> {
    const verificationToken = this.createEmailVerificationToken(user.email);

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        verificationToken,
      );
    } catch (error: unknown) {
      if (rollbackOnFailure) {
        await this.repository
          .deleteUnverifiedUser(user.id)
          .catch((rollbackError: unknown) => {
            console.error(
              "[Mail] Failed to roll back unverified user after delivery error:",
              rollbackError,
            );
          });
      }

      const mailError = error as { code?: string; responseCode?: number };
      console.error(
        `[Mail] Verification delivery failed: ${mailError.code ?? "UNKNOWN"}${mailError.responseCode ? ` (SMTP ${mailError.responseCode})` : ""}`,
      );
      throw new AppError(
        "Không thể gửi email xác thực. Vui lòng thử lại sau.",
        503,
        ERROR_CODE.MAIL_DELIVERY_FAILED,
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const { mailConfig } = await import("../../config/mail.config");
      console.log(
        `[DEV ONLY] Verification Link: ${mailConfig.frontendUrl}/verify-email?token=${verificationToken}`,
      );
    }
  }

  async login(
    data: LoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponseDto> {
    const { email, password } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Tài khoản hoặc mật khẩu không chính xác.",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Tài khoản chưa được xác thực hoặc đã bị khóa.",
        403,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError(
        "Tài khoản hoặc mật khẩu không chính xác.",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const payload: AuthJwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn:
        jwtConfig.accessExpiresIn as unknown as SignOptions["expiresIn"],
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn:
        jwtConfig.refreshExpiresIn as unknown as SignOptions["expiresIn"],
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
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
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

  async refresh(
    token: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokensDto> {
    let payload: AuthJwtPayload;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret) as AuthJwtPayload;
    } catch {
      await this.repository.deleteRefreshToken(token).catch(() => {});
      throw new AppError(
        "Invalid refresh token",
        401,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    const savedToken = await this.repository.findRefreshToken(token);
    if (!savedToken) {
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (savedToken.expiresAt < new Date()) {
      await this.repository.deleteRefreshToken(token);
      throw new AppError(
        "Refresh token expired",
        401,
        ERROR_CODE.TOKEN_EXPIRED,
      );
    }

    const user = await this.repository.findById(payload.id);
    if (!user || !user.isActive) {
      throw new AppError(
        "User not found or inactive",
        401,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    const newPayload: AuthJwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = jwt.sign(newPayload, jwtConfig.accessSecret, {
      expiresIn:
        jwtConfig.accessExpiresIn as unknown as SignOptions["expiresIn"],
    });

    const newRefreshToken = jwt.sign(newPayload, jwtConfig.refreshSecret, {
      expiresIn:
        jwtConfig.refreshExpiresIn as unknown as SignOptions["expiresIn"],
    });

    await this.repository.deleteRefreshToken(token);

    const decoded = jwt.decode(newRefreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);
    await this.repository.saveRefreshToken(
      user.id,
      newRefreshToken,
      expiresAt,
      metadata?.userAgent,
      metadata?.ipAddress,
    );

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
      { email, purpose: "email-verification" },
      jwtConfig.emailVerificationSecret,
      { expiresIn: "24h" },
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

    const hasNameChange =
      normalizedFullName !== undefined &&
      normalizedFullName !== (user.fullName ?? "");

    if (!hasNameChange) {
      throw new AppError(
        "Không có thay đổi nào để cập nhật.",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const updateData: { fullName?: string } = {};

    if (hasNameChange) {
      updateData.fullName = normalizedFullName;
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

  async uploadAvatar(
    userId: string,
    file?: Express.Multer.File,
  ): Promise<MeDto> {
    if (!file) {
      throw new AppError(
        "Vui lòng chọn tệp hình ảnh để tải lên.",
        422,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const extension =
      path.extname(file.originalname).toLowerCase() ||
      (file.mimetype === "image/png"
        ? ".png"
        : file.mimetype === "image/webp"
          ? ".webp"
          : file.mimetype === "image/gif"
            ? ".gif"
            : ".jpg");

    const fileName = `${userId}-${Date.now()}${extension}`;
    const destinationKey = `${UPLOAD_SUBDIRS.AVATARS}/${fileName}`;

    const stream = Readable.from(file.buffer);
    const uploadResult = await this.storageService.uploadStream(
      destinationKey,
      stream,
      {
        contentType: file.mimetype,
        contentLength: file.size,
      },
    );

    const avatarUrl = uploadResult.url ?? `/api/v1/auth/avatar/${fileName}`;

    if (user.avatarUrl) {
      const oldFileName = this.extractAvatarFileName(user.avatarUrl);
      if (oldFileName && oldFileName !== fileName) {
        await this.storageService
          .deleteFile(`${UPLOAD_SUBDIRS.AVATARS}/${oldFileName}`)
          .catch(() => {});
      }
    }

    const updatedUser = await this.repository.updateUser(userId, {
      avatarUrl,
    });

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

  private extractAvatarFileName(avatarUrl: string): string | null {
    const match =
      avatarUrl.match(/\/avatars\/([^/?#]+)$/i) ||
      avatarUrl.match(/\/api\/v1\/auth\/avatar\/([^/?#]+)$/i);
    return match ? match[1] : null;
  }

  async getAvatarStream(
    fileName: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const sanitizedFileName = path.basename(fileName);
    const destinationKey = `${UPLOAD_SUBDIRS.AVATARS}/${sanitizedFileName}`;

    const exists = await this.storageService.exists(destinationKey);
    if (!exists) {
      throw new AppError("Avatar not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const stream = await this.storageService.getReadStream(destinationKey);
    const ext = path.extname(sanitizedFileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    return { stream, mimeType };
  }

  async getUsage(userId: string): Promise<UserUsageDto> {
    const user = await this.repository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const crawlJobRepo = this.crawlJobRepository;
    const nowZoned = getZonedDateParts(new Date(), DEFAULT_TIMEZONE);
    const startOfDay = createUtcDateFromZonedParts(
      nowZoned.year,
      nowZoned.month,
      nowZoned.day,
      0,
      0,
      DEFAULT_TIMEZONE,
    );
    const nextDay = createUtcDateFromZonedParts(
      nowZoned.year,
      nowZoned.month,
      nowZoned.day + 1,
      0,
      0,
      DEFAULT_TIMEZONE,
    );

    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const activeStatuses = [
      JOB_STATUS.PENDING,
      JOB_STATUS.QUEUED,
      JOB_STATUS.RUNNING,
      JOB_STATUS.PROCESSING_EXPORT,
    ];

    const [jobsTodayCount, concurrentJobsCount, totalPages] = await Promise.all(
      [
        crawlJobRepo.countJobsSince(userId, startOfDay),
        crawlJobRepo.countConcurrentJobs(userId, activeStatuses, twoHoursAgo),
        crawlJobRepo.sumPagesCrawledByUser(userId),
      ],
    );

    return {
      quota: {
        maxPagesLimit: user.maxPagesLimit,
        maxJobsPerDayLimit: user.maxJobsPerDayLimit,
        maxConcurrentJobsLimit: user.maxConcurrentJobsLimit,
      },
      usage: {
        jobsUsedToday: jobsTodayCount,
        jobsRemainingToday: Math.max(
          0,
          user.maxJobsPerDayLimit - jobsTodayCount,
        ),
        concurrentJobsRunning: concurrentJobsCount,
        concurrentJobsAvailable: Math.max(
          0,
          user.maxConcurrentJobsLimit - concurrentJobsCount,
        ),
        totalPagesCrawled: totalPages,
      },
      resetAt: nextDay.toISOString(),
    };
  }

  async changePassword(
    userId: string,
    data: ChangePasswordDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokensDto> {
    const { currentPassword, newPassword } = data;
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError(
        "User not found or inactive",
        404,
        ERROR_CODE.NOT_FOUND,
      );
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
    const payload: AuthJwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, jwtConfig.accessSecret, {
      expiresIn:
        jwtConfig.accessExpiresIn as unknown as SignOptions["expiresIn"],
    });

    const refreshToken = jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn:
        jwtConfig.refreshExpiresIn as unknown as SignOptions["expiresIn"],
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

  async forgotPassword(data: ForgotPasswordDto): Promise<{ success: boolean }> {
    const { email } = data;
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Email không tồn tại trong hệ thống.",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Tài khoản chưa được kích hoạt hoặc đã bị khóa.",
        403,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    const secret = `${jwtConfig.accessSecret}-${user.passwordHash}`;
    const resetToken = jwt.sign({ id: user.id, email: user.email }, secret, {
      expiresIn: "15m",
    });

    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error: unknown) {
      console.error("[Mail] Password reset delivery failed:", error);
    }

    return {
      success: true,
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
      throw new AppError("Invalid token", 400, ERROR_CODE.TOKEN_INVALID);
    }

    if (!untrustedPayload || !untrustedPayload.id) {
      throw new AppError(
        "Invalid token payload",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    // Step 2: fetch user needed to derive the per-user signing secret
    const user = await this.repository.findById(untrustedPayload.id);
    if (!user || !user.isActive) {
      throw new AppError(
        "User not found or inactive",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Step 3: cryptographic verification — all business logic below this point is safe
    const secret = `${jwtConfig.accessSecret}-${user.passwordHash}`;
    try {
      jwt.verify(token, secret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Reset token has expired",
          400,
          ERROR_CODE.TOKEN_EXPIRED,
        );
      }
      throw new AppError("Invalid reset token", 400, ERROR_CODE.TOKEN_INVALID);
    }

    return user; // fully authenticated — caller may trust this object
  }

  async resetPassword(
    data: ResetPasswordDto,
  ): Promise<{ success: boolean; userId: string }> {
    const { token, password } = data;

    // verifyResetToken throws on any invalid/expired/tampered token
    const user = await this.verifyResetToken(token);

    const passwordHash = await bcrypt.hash(password, 10);
    await this.repository.updateUser(user.id, { passwordHash });
    await this.repository.deleteUserRefreshTokens(user.id);

    return { success: true, userId: user.id };
  }

  async verifyEmail(
    token: string,
  ): Promise<{ success: boolean; userId: string }> {
    let payload: AuthJwtPayload | null = null;
    try {
      payload = jwt.verify(
        token,
        jwtConfig.emailVerificationSecret,
      ) as AuthJwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Verification token has expired",
          400,
          ERROR_CODE.TOKEN_EXPIRED,
        );
      }
      throw new AppError(
        "Invalid verification token",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (
      !payload ||
      !payload.email ||
      payload.purpose !== "email-verification"
    ) {
      throw new AppError(
        "Invalid verification token payload",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    const user = await this.repository.findByEmail(payload.email);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.isActive) {
      return { success: true, userId: user.id };
    }

    await this.repository.updateUser(user.id, { isActive: true });

    return { success: true, userId: user.id };
  }

  async requestDeactivation(
    userId: string,
    data: RequestDeactivationDto,
  ): Promise<{ success: boolean }> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError(
        "Người dùng không tồn tại hoặc tài khoản đã bị vô hiệu hóa.",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (user.role === ROLES.ADMIN) {
      const activeAdmins = await this.repository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          "Không thể vô hiệu hóa tài khoản Quản trị viên duy nhất trong hệ thống.",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError(
        "Mật khẩu xác nhận không chính xác.",
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const deactivationToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        purpose: "deactivate-account",
      },
      `${jwtConfig.accessSecret}:deactivate:${user.passwordHash}`,
      { expiresIn: "15m" },
    );

    try {
      await this.mailService.sendDeactivationEmail(
        user.email,
        deactivationToken,
      );
    } catch (error: unknown) {
      const mailError = error as { code?: string; responseCode?: number };
      console.error(
        `[Mail] Deactivation delivery failed: ${mailError.code ?? "UNKNOWN"}${mailError.responseCode ? ` (SMTP ${mailError.responseCode})` : ""}`,
      );
      throw new AppError(
        "Không thể gửi email xác nhận vô hiệu hóa. Vui lòng thử lại sau.",
        503,
        ERROR_CODE.MAIL_DELIVERY_FAILED,
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const { mailConfig } = await import("../../config/mail.config");
      console.log(
        `[DEV ONLY] Deactivation Link: ${mailConfig.frontendUrl}/deactivate-account?token=${deactivationToken}`,
      );
    }

    return { success: true };
  }

  async confirmDeactivation(
    data: ConfirmDeactivationDto,
  ): Promise<{ success: boolean; userId: string; email: string }> {
    const { token } = data;

    let untrustedPayload: AuthJwtPayload | null = null;
    try {
      untrustedPayload = jwt.decode(token) as AuthJwtPayload | null;
    } catch {
      throw new AppError(
        "Mã xác nhận không hợp lệ.",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (
      !untrustedPayload ||
      !untrustedPayload.id ||
      untrustedPayload.purpose !== "deactivate-account"
    ) {
      throw new AppError(
        "Mã xác nhận không hợp lệ.",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    const user = await this.repository.findById(untrustedPayload.id);
    if (!user || !user.isActive) {
      throw new AppError(
        "Người dùng không tồn tại hoặc tài khoản đã bị vô hiệu hóa.",
        400,
        ERROR_CODE.USER_INACTIVE,
      );
    }

    try {
      jwt.verify(
        token,
        `${jwtConfig.accessSecret}:deactivate:${user.passwordHash}`,
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Mã xác nhận vô hiệu hóa đã hết hạn.",
          400,
          ERROR_CODE.TOKEN_EXPIRED,
        );
      }
      throw new AppError(
        "Mã xác nhận không hợp lệ.",
        400,
        ERROR_CODE.TOKEN_INVALID,
      );
    }

    if (user.role === ROLES.ADMIN) {
      const activeAdmins = await this.repository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          "Không thể vô hiệu hóa tài khoản Quản trị viên duy nhất trong hệ thống.",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    await this.repository.deactivateUser(user.id);

    return {
      success: true,
      userId: user.id,
      email: user.email,
    };
  }
}
