import bcrypt from "bcryptjs";
import { UserRepository } from "./user.repository";
import { RoleRepository } from "../roles/role.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { User } from "../../common/types/database.types";
import { ROLES } from "../../common/constants/role.constant";
import { SYSTEM_ROLE_SLUGS } from "../../common/constants/system-role.constant";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { authorizationCache } from "../../common/helpers/authorization-cache.helper";
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserQueryDto,
} from "./user.dto";

interface AuditContext {
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class UserService {
  private readonly repository = new UserRepository();
  private readonly roleRepository = new RoleRepository();
  private readonly auditLogService = new AuditLogService();

  private formatUser(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      isActive: user.isActive,
      maxPagesLimit: user.maxPagesLimit,
      maxJobsPerDayLimit: user.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: user.maxConcurrentJobsLimit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll(query: UserQueryDto) {
    const { items, total, page, limit } = await this.repository.findAll(query);
    return {
      items: items.map((user) => this.formatUser(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return this.formatUser(user);
  }

  async create(data: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.repository.findByEmail(data.email);

    if (existing) {
      throw new AppError(
        "Email already exists",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.repository.create({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
      maxPagesLimit: data.maxPagesLimit,
      maxJobsPerDayLimit: data.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: data.maxConcurrentJobsLimit,
    });

    // Auto assign matching default system role
    const targetSlug =
      data.role === ROLES.ADMIN
        ? SYSTEM_ROLE_SLUGS.ADMIN
        : data.role === ROLES.VIEWER
          ? SYSTEM_ROLE_SLUGS.VIEWER
          : SYSTEM_ROLE_SLUGS.CRAWLER_USER;

    const role = await this.roleRepository.findBySlug(targetSlug);
    if (role) {
      await this.repository.assignSingleRole(user.id, role.id);
    }

    return this.formatUser(user);
  }

  async update(
    id: string,
    data: UpdateUserDto,
    actorId?: string,
    actorRoles: string[] = [],
  ): Promise<UserResponseDto> {
    const existingUser = await this.findById(id);
    const isTargetSuperAdmin =
      typeof this.repository.isUserSuperAdmin === "function"
        ? await this.repository.isUserSuperAdmin(id)
        : false;

    // Defense: Non-super-admin cannot modify or deactivate a Super Admin
    if (
      isTargetSuperAdmin &&
      actorRoles.length > 0 &&
      !actorRoles.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      throw new AppError(
        "Forbidden: Only Super Administrators can modify a Super Administrator account.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    // Defense: If deactivating user, check last active Super Admin
    if (data.isActive === false && isTargetSuperAdmin) {
      const activeSuperAdmins =
        typeof this.repository.countActiveSuperAdmins === "function"
          ? await this.repository.countActiveSuperAdmins()
          : 0;
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          "Cannot deactivate the last active Super Admin account.",
          400,
          ERROR_CODE.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        );
      }
    }

    if (
      existingUser.role === ROLES.ADMIN &&
      data.role !== undefined &&
      data.role !== ROLES.ADMIN
    ) {
      throw new AppError(
        "Không thể thay đổi vai trò của tài khoản Admin.",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const user = await this.repository.update(id, {
      fullName: data.fullName,
      isActive: data.isActive,
      role: data.role,
      maxPagesLimit: data.maxPagesLimit,
      maxJobsPerDayLimit: data.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: data.maxConcurrentJobsLimit,
    });

    authorizationCache.invalidateUser(id);
    return this.formatUser(user);
  }

  async delete(
    id: string,
    currentUserId: string,
    actorRoles: string[] = [],
  ): Promise<void> {
    if (id === currentUserId) {
      throw new AppError(
        "Cannot delete your own account",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    await this.findById(id);

    const isTargetSuperAdmin =
      typeof this.repository.isUserSuperAdmin === "function"
        ? await this.repository.isUserSuperAdmin(id)
        : false;

    // Defense: Non-super-admin cannot delete a Super Admin
    if (
      isTargetSuperAdmin &&
      actorRoles.length > 0 &&
      !actorRoles.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      throw new AppError(
        "Forbidden: Only Super Administrators can delete a Super Administrator account.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    // Defense: Cannot delete the last active Super Admin
    if (isTargetSuperAdmin) {
      const activeSuperAdmins =
        typeof this.repository.countActiveSuperAdmins === "function"
          ? await this.repository.countActiveSuperAdmins()
          : 0;
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          "Cannot delete the last active Super Admin account.",
          400,
          ERROR_CODE.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        );
      }
    }

    await this.repository.delete(id, currentUserId);
    authorizationCache.invalidateUser(id);
  }

  // --- Dynamic User Roles Management & Privilege Escalation Defense ---

  async getUserRoles(userId: string) {
    await this.findById(userId);
    return this.repository.getUserRoles(userId);
  }

  async assignUserRoles(
    actorId: string,
    actorRoles: string[],
    targetUserId: string,
    roleIds: string[],
    context?: AuditContext,
  ) {
    // 1. Self-escalation barrier: Cannot modify own roles
    if (actorId === targetUserId) {
      if (context?.actorId) {
        await this.auditLogService.log({
          userId: actorId,
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            reason:
              "User attempted to modify own roles (self-escalation blocked)",
            targetUserId,
          },
        });
      }
      throw new AppError(
        "Forbidden: You cannot modify your own roles.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    await this.findById(targetUserId);

    // 2. Fetch target roles to validate
    const targetRoles = await this.roleRepository.findByIds(roleIds);

    if (targetRoles.length !== roleIds.length) {
      throw new AppError(
        "One or more roles not found",
        404,
        ERROR_CODE.ROLE_NOT_FOUND,
      );
    }

    const targetSlugs = targetRoles.map((r) => r!.slug);
    const isAssigningSuperAdmin = targetSlugs.includes(
      SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
    );
    const isActorSuperAdmin = actorRoles.includes(
      SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
    );
    const isTargetCurrentlySuperAdmin =
      await this.repository.isUserSuperAdmin(targetUserId);

    // 3. Super Admin isolation: Non-super-admin cannot assign Super Admin
    if (isAssigningSuperAdmin && !isActorSuperAdmin) {
      if (context?.actorId) {
        await this.auditLogService.log({
          userId: actorId,
          action: AUDIT_ACTIONS.SUPER_ADMIN_ASSIGN_ATTEMPT,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            reason: "Non-super-admin attempted to assign Super Admin role",
            targetUserId,
          },
        });
      }
      throw new AppError(
        "Forbidden: Only Super Administrators can assign the Super Admin role.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    // 4. Target protection: Non-super-admin cannot modify roles of an existing Super Admin
    if (isTargetCurrentlySuperAdmin && !isActorSuperAdmin) {
      throw new AppError(
        "Forbidden: Only Super Administrators can modify roles of a Super Administrator.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    // 5. Last active Super Admin protection: Cannot revoke Super Admin if it's the last one
    if (isTargetCurrentlySuperAdmin && !isAssigningSuperAdmin) {
      const activeSuperAdmins = await this.repository.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          "Cannot revoke the last active Super Admin role from the system.",
          400,
          ERROR_CODE.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        );
      }
    }

    const result = await this.repository.assignUserRoles(
      targetUserId,
      roleIds,
      actorId,
    );

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: actorId,
        action: AUDIT_ACTIONS.ROLE_ASSIGNED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          targetUserId,
          assignedRoleSlugs: targetSlugs,
          roleCount: roleIds.length,
        },
      });
    }

    authorizationCache.invalidateUser(targetUserId);
    return result;
  }

  async assignSingleRole(
    actorId: string,
    actorRoles: string[],
    targetUserId: string,
    roleId: string,
    context?: AuditContext,
  ) {
    if (actorId === targetUserId) {
      if (context?.actorId) {
        await this.auditLogService.log({
          userId: actorId,
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            reason: "Self-assignment blocked",
            targetUserId,
            roleId,
          },
        });
      }
      throw new AppError(
        "Forbidden: You cannot assign roles to yourself.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    await this.findById(targetUserId);

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    if (
      role.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN &&
      !actorRoles.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      if (context?.actorId) {
        await this.auditLogService.log({
          userId: actorId,
          action: AUDIT_ACTIONS.SUPER_ADMIN_ASSIGN_ATTEMPT,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            reason: "Non-super-admin attempted to assign Super Admin role",
            targetUserId,
            roleId,
          },
        });
      }
      throw new AppError(
        "Forbidden: Only Super Administrators can assign the Super Admin role.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    const isTargetCurrentlySuperAdmin =
      await this.repository.isUserSuperAdmin(targetUserId);
    if (
      isTargetCurrentlySuperAdmin &&
      !actorRoles.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      throw new AppError(
        "Forbidden: Only Super Administrators can modify roles of a Super Administrator.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    const assignment = await this.repository.assignSingleRole(
      targetUserId,
      roleId,
      actorId,
    );

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: actorId,
        action: AUDIT_ACTIONS.ROLE_ASSIGNED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          targetUserId,
          roleId,
          roleSlug: role.slug,
        },
      });
    }

    authorizationCache.invalidateUser(targetUserId);
    return assignment;
  }

  async revokeSingleRole(
    actorId: string,
    actorRoles: string[],
    targetUserId: string,
    roleId: string,
    context?: AuditContext,
  ) {
    if (actorId === targetUserId) {
      throw new AppError(
        "Forbidden: You cannot revoke roles from yourself.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    await this.findById(targetUserId);

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.ROLE_NOT_FOUND);
    }

    const isActorSuperAdmin = actorRoles.includes(
      SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
    );

    if (role.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN) {
      if (!isActorSuperAdmin) {
        throw new AppError(
          "Forbidden: Only Super Administrators can revoke the Super Admin role.",
          403,
          ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
        );
      }

      const activeSuperAdmins = await this.repository.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new AppError(
          "Cannot revoke the last active Super Admin role from the system.",
          400,
          ERROR_CODE.CANNOT_REMOVE_LAST_SUPER_ADMIN,
        );
      }
    }

    const isTargetCurrentlySuperAdmin =
      await this.repository.isUserSuperAdmin(targetUserId);
    if (isTargetCurrentlySuperAdmin && !isActorSuperAdmin) {
      throw new AppError(
        "Forbidden: Only Super Administrators can modify roles of a Super Administrator.",
        403,
        ERROR_CODE.PRIVILEGE_ESCALATION_DENIED,
      );
    }

    const remaining = await this.repository.revokeSingleRole(
      targetUserId,
      roleId,
    );

    if (context?.actorId) {
      await this.auditLogService.log({
        userId: actorId,
        action: AUDIT_ACTIONS.ROLE_REVOKED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          targetUserId,
          revokedRoleId: roleId,
          revokedRoleSlug: role.slug,
        },
      });
    }

    authorizationCache.invalidateUser(targetUserId);
    return remaining;
  }
}
