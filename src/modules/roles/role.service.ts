import { RoleRepository } from "./role.repository";
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleQueryDto,
  RoleResponseDto,
} from "./role.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { SYSTEM_ROLE_SLUGS } from "../../common/constants/system-role.constant";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { authorizationCache } from "../../common/helpers/authorization-cache.helper";

interface AuditContext {
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface RoleWithPermissions {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  rolePermissions?: Array<{
    permission: {
      id: string;
      name: string;
      slug: string;
      resource: string;
      action: string;
    };
  }>;
  _count?: {
    userRoles?: number;
  };
}

export class RoleService {
  private readonly repository = new RoleRepository();
  private readonly auditLogService = new AuditLogService();

  private formatRole(role: RoleWithPermissions): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description ?? null,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: role.rolePermissions
        ? role.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            slug: rp.permission.slug,
            resource: rp.permission.resource,
            action: rp.permission.action,
          }))
        : undefined,
      userCount: role._count?.userRoles ?? undefined,
    };
  }

  async findAll(query: RoleQueryDto = {}) {
    const { items, total, page, limit } = await this.repository.findAll(query);
    return {
      items: items.map((r) => this.formatRole(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.repository.findById(id);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }
    return this.formatRole(role);
  }

  async create(
    dto: CreateRoleDto,
    context?: AuditContext,
  ): Promise<RoleResponseDto> {
    const normalizedSlug = dto.slug.toLowerCase().trim();

    // Check reserved system slug
    const reservedSlugs = Object.values(SYSTEM_ROLE_SLUGS) as string[];
    if (reservedSlugs.includes(normalizedSlug)) {
      throw new AppError(
        `Cannot create role with reserved system slug: ${normalizedSlug}`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Check duplicate
    const existing = await this.repository.findBySlug(normalizedSlug);
    if (existing) {
      throw new AppError(
        `Role with slug '${normalizedSlug}' already exists`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const created = await this.repository.create({
      name: dto.name,
      slug: normalizedSlug,
      description: dto.description,
      isSystem: false,
      permissionIds: dto.permissionIds,
    });

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: context.actorId,
        action: AUDIT_ACTIONS.ROLE_CREATED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          roleId: created.id,
          name: created.name,
          slug: created.slug,
          permissionCount: dto.permissionIds?.length ?? 0,
        },
      });
    }

    authorizationCache.invalidateAll();
    return this.formatRole(created);
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    context?: AuditContext,
  ): Promise<RoleResponseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    // Protect system roles from deactivation
    if (existing.isSystem && dto.isActive === false) {
      throw new AppError(
        "System roles cannot be deactivated.",
        400,
        ERROR_CODE.SYSTEM_ROLE_PROTECTED,
      );
    }

    const updated = await this.repository.update(id, {
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
    });

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: context.actorId,
        action: AUDIT_ACTIONS.ROLE_UPDATED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          roleId: updated.id,
          slug: updated.slug,
          updatedFields: Object.keys(dto),
        },
      });
    }

    authorizationCache.invalidateAll();
    return this.formatRole(updated);
  }

  async delete(id: string, context?: AuditContext): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    // Protect system roles from deletion
    if (existing.isSystem) {
      throw new AppError(
        "System roles cannot be deleted.",
        400,
        ERROR_CODE.SYSTEM_ROLE_PROTECTED,
      );
    }

    await this.repository.delete(id);

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: context.actorId,
        action: AUDIT_ACTIONS.ROLE_DELETED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          roleId: id,
          slug: existing.slug,
          name: existing.name,
        },
      });
    }

    authorizationCache.invalidateAll();
  }

  async getRolePermissions(roleId: string) {
    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    const permissions = await this.repository.getRolePermissions(roleId);
    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      resource: p.resource,
      action: p.action,
    }));
  }

  async setRolePermissions(
    roleId: string,
    permissionIds: string[],
    actorRoles: string[] = [],
    context?: AuditContext,
  ): Promise<RoleResponseDto> {
    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    // Privilege escalation defense: Only super_admin can modify permissions of super_admin role
    if (
      role.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN &&
      !actorRoles.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      if (context?.actorId) {
        await this.auditLogService.log({
          userId: context.actorId,
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            reason:
              "Non-super-admin attempted to modify super_admin permissions",
            targetRoleId: roleId,
          },
        });
      }
      throw new AppError(
        "Forbidden: Only Super Administrators can modify Super Admin permissions.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    const updated = await this.repository.setRolePermissions(
      roleId,
      permissionIds,
    );

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: context.actorId,
        action: AUDIT_ACTIONS.PERMISSION_ASSIGNED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          roleId,
          roleSlug: role.slug,
          assignedPermissionCount: permissionIds.length,
        },
      });
    }

    authorizationCache.invalidateAll();
    return this.formatRole(updated);
  }

  async getRoleUsers(roleId: string) {
    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }
    return this.repository.getUsersWithRole(roleId);
  }
}
