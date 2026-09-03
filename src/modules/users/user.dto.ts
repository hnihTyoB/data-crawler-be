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
}

export interface UpdateUserDto {
  fullName?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  role?: Role;
  maxPagesLimit?: number;
  maxJobsPerDayLimit?: number;
  maxConcurrentJobsLimit?: number;
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
  createdAt: Date;
  updatedAt: Date;
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
