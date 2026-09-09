export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface MeDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  roles?: string[];
  permissions?: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl?: string | null;
    role: string;
    roles?: string[];
    permissions?: string[];
  };
}

export interface RegisterDto {
  email: string;
  password: string;
  fullName?: string;
}

export interface UpdateMeDto {
  fullName?: string;
}

export interface UserUsageDto {
  quota: {
    maxPagesLimit: number;
    maxJobsPerDayLimit: number;
    maxConcurrentJobsLimit: number;
    maxPagesPerMonthLimit?: number | null;
    maxJobsPerMonthLimit?: number | null;
  };
  usage: {
    jobsUsedToday: number;
    jobsRemainingToday: number;
    concurrentJobsRunning: number;
    concurrentJobsAvailable: number;
    totalPagesCrawled: number;
    pagesCrawledToday: number;
    pagesRemainingToday: number;
    jobsUsedThisMonth: number;
    jobsRemainingThisMonth?: number | null;
    pagesCrawledThisMonth: number;
    pagesRemainingThisMonth?: number | null;
  };
  resetAt: string;
  monthlyResetAt?: string;
  quotaResetAt?: string | null;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface RequestDeactivationDto {
  password: string;
}

export interface ConfirmDeactivationDto {
  token: string;
}
