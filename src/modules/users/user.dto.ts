import { Role } from "../../common/constants/role.constant";

export interface CreateUserDto {
  email: string;
  password: string;
  fullName?: string;
  avatarUrl?: string;
  role?: Role;
  maxPagesLimit?: number;
  maxJobsPerDayLimit?: number;
  maxConcurrentJobsLimit?: number;
  maxPagesPerMonthLimit?: number | null;
  maxJobsPerMonthLimit?: number | null;
}

export interface UpdateUserDto {
  email?: string;
  fullName?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  role?: Role;
  maxPagesLimit?: number;
  maxJobsPerDayLimit?: number;
  maxConcurrentJobsLimit?: number;
  maxPagesPerMonthLimit?: number | null;
  maxJobsPerMonthLimit?: number | null;
}

export interface ResetUserQuotaDto {
  resetLimitsToRole?: boolean;
}

export interface UserAssignedRoleSummaryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
}

export interface UserResponseDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  maxPagesLimit: number;
  maxJobsPerDayLimit: number;
  maxConcurrentJobsLimit: number;
  maxPagesPerMonthLimit?: number | null;
  maxJobsPerMonthLimit?: number | null;
  quotaResetAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles?: UserAssignedRoleSummaryDto[];
}

export interface UserQueryDto {
  role?: Role;
  isActive?: string | boolean;
  search?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: string | number;
  limit?: string | number;
}
