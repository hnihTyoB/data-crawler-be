import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Email không đúng định dạng.'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự.'),
  fullName: z.string().optional(),
  avatarUrl: z.string().url('Avatar URL không đúng định dạng.').or(z.literal('')).optional(),
  role: z.enum(['ADMIN', 'CRAWLER_USER', 'VIEWER']).optional(),
  maxPagesLimit: z.number().int().min(1).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().optional(),
  avatarUrl: z.string().url('Avatar URL không đúng định dạng.').or(z.literal('')).nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'CRAWLER_USER', 'VIEWER']).optional(),
  maxPagesLimit: z.number().int().min(1).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).optional(),
});

export const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(['ADMIN', 'CRAWLER_USER', 'VIEWER']).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
