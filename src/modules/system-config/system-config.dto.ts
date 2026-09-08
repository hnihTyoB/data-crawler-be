import { SystemConfigCategory } from "../../common/constants/system-config.constant";

export interface CreateSystemConfigDto {
  key: string;
  value: unknown;
  description?: string;
  category?: SystemConfigCategory;
  isPublic?: boolean;
}

export interface UpdateSystemConfigDto {
  value?: unknown;
  description?: string;
  category?: SystemConfigCategory;
  isPublic?: boolean;
}

export interface SystemConfigQueryDto {
  category?: SystemConfigCategory;
  search?: string;
  isPublic?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface SystemConfigResponseDto {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  category: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicConfigsResponseDto {
  configs: Array<{
    key: string;
    value: unknown;
    category: string;
    description: string | null;
  }>;
  map: Record<string, unknown>;
}

export interface SystemConfigEventPayload {
  key?: string;
  action: "create" | "update" | "toggle" | "delete" | "invalidate";
  timestamp: number;
}
