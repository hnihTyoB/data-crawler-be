import { AuditAction } from '../../common/constants/audit-action.constant';

export interface AuditLogQueryDto {
  userId?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: string | number;
  limit?: string | number;
}

export interface CreateAuditLogDto {
  userId?: string | null;
  action: AuditAction;
  details?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}
