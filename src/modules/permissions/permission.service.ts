import { PermissionRepository } from "./permission.repository";
import { PermissionResponseDto, PermissionQueryDto } from "./permission.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { authorizationCache } from "../../common/helpers/authorization-cache.helper";

export class PermissionService {
  private readonly repository = new PermissionRepository();

  async findAll(query?: PermissionQueryDto): Promise<PermissionResponseDto[]> {
    const permissions = await this.repository.findAll(query);
    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      resource: p.resource,
      action: p.action,
      isSystem: p.isSystem,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async findById(id: string): Promise<PermissionResponseDto> {
    const permission = await this.repository.findById(id);
    if (!permission) {
      throw new AppError(
        "Permission not found",
        404,
        ERROR_CODE.PERMISSION_NOT_FOUND,
      );
    }

    return {
      id: permission.id,
      name: permission.name,
      slug: permission.slug,
      description: permission.description,
      resource: permission.resource,
      action: permission.action,
      isSystem: permission.isSystem,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const cached = authorizationCache.getCachedPermissions(userId);
    if (cached) {
      return cached;
    }

    const permissions = await this.repository.findUserPermissions(userId);
    authorizationCache.setCachedPermissions(userId, permissions);
    return permissions;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const cached = authorizationCache.getCachedRoles(userId);
    if (cached) {
      return cached;
    }

    const roles = await this.repository.findUserRoleSlugs(userId);
    authorizationCache.setCachedRoles(userId, roles);
    return roles;
  }

  async ensureSystemPermissions(): Promise<void> {
    await this.repository.ensureSystemPermissions();
    authorizationCache.invalidateAll();
  }
}

export const permissionService = new PermissionService();
