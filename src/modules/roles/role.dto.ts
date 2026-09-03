export interface CreateRoleDto {
  name: string;
  slug: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface RoleQueryDto {
  search?: string;
  isSystem?: boolean | string;
  isActive?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface AssignRolePermissionsDto {
  permissionIds: string[];
}

export interface RolePermissionItemDto {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions?: RolePermissionItemDto[];
  userCount?: number;
}
