export interface PermissionResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  resource: string;
  action: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionQueryDto {
  resource?: string;
  search?: string;
}
