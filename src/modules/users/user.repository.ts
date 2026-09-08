import { prisma } from "../../database/prisma.client";
import { UserRole, Prisma, User } from "@prisma/client";
import { UserQueryDto } from "./user.dto";
import { envConfig } from "../../config/env.config";
import { ROLES } from "../../common/constants/role.constant";
import { SYSTEM_ROLE_SLUGS } from "../../common/constants/system-role.constant";
import { systemConfigService } from "../system-config/system-config.service";

export class UserRepository {
  async findAll(query: UserQueryDto = {}) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      if (typeof query.isActive === "boolean") {
        where.isActive = query.isActive;
      } else {
        where.isActive = query.isActive === "true";
      }
    }
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { fullName: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const sortBy = query.sortBy || "createdAt";
    const order = query.order || "desc";
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "email",
      "fullName",
      "role",
      "isActive",
    ];
    const orderBy: Prisma.UserOrderByWithRelationInput =
      allowedSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { createdAt: "desc" };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByIdWithRoles(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName?: string;
    avatarUrl?: string;
    role?: UserRole;
    maxPagesLimit?: number;
    maxJobsPerDayLimit?: number;
    maxConcurrentJobsLimit?: number;
  }): Promise<User> {
    const defaultMaxPages = await systemConfigService.get<number>(
      "quota.user_max_pages",
      envConfig.quota.defaultMaxPages,
    );
    const defaultMaxJobsPerDay = await systemConfigService.get<number>(
      "quota.user_max_jobs_per_day",
      envConfig.quota.defaultMaxJobsPerDay,
    );
    const defaultMaxConcurrentJobs = await systemConfigService.get<number>(
      "quota.user_max_concurrent_jobs",
      envConfig.quota.defaultMaxConcurrentJobs,
    );

    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        role: data.role ?? ROLES.CRAWLER_USER,
        maxPagesLimit: data.maxPagesLimit ?? defaultMaxPages,
        maxJobsPerDayLimit: data.maxJobsPerDayLimit ?? defaultMaxJobsPerDay,
        maxConcurrentJobsLimit:
          data.maxConcurrentJobsLimit ?? defaultMaxConcurrentJobs,
      },
    });
  }

  update(
    id: string,
    data: {
      email?: string;
      fullName?: string;
      avatarUrl?: string | null;
      isActive?: boolean;
      role?: UserRole;
      maxPagesLimit?: number;
      maxJobsPerDayLimit?: number;
      maxConcurrentJobsLimit?: number;
    },
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, deletedBy: string): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedBy,
        },
      });

      await tx.refreshToken.deleteMany({
        where: { userId: id },
      });

      await tx.crawlSchedule.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      await tx.apiKey.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      await tx.webhookConfig.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      return user;
    });
  }

  async getUserRoles(userId: string) {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: true,
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    return assignments.map((a) => ({
      id: a.role.id,
      name: a.role.name,
      slug: a.role.slug,
      description: a.role.description,
      isSystem: a.role.isSystem,
      isActive: a.role.isActive,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
    }));
  }

  async assignUserRoles(
    userId: string,
    roleIds: string[],
    assignedBy?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: { userId },
      });

      if (roleIds.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
            assignedBy,
          })),
          skipDuplicates: true,
        });
      }

      // Sync legacy role enum
      const assignedRoles = await tx.role.findMany({
        where: { id: { in: roleIds } },
      });

      const slugs = assignedRoles.map((r) => r.slug);
      let legacyRole: UserRole = ROLES.VIEWER;
      if (
        slugs.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN) ||
        slugs.includes(SYSTEM_ROLE_SLUGS.ADMIN)
      ) {
        legacyRole = ROLES.ADMIN;
      } else if (slugs.includes(SYSTEM_ROLE_SLUGS.CRAWLER_USER)) {
        legacyRole = ROLES.CRAWLER_USER;
      }

      await tx.user.update({
        where: { id: userId },
        data: { role: legacyRole },
      });

      return tx.userRoleAssignment.findMany({
        where: { userId },
        include: { role: true },
      });
    });
  }

  async assignSingleRole(userId: string, roleId: string, assignedBy?: string) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.upsert({
        where: {
          userId_roleId: { userId, roleId },
        },
        update: { assignedBy },
        create: { userId, roleId, assignedBy },
        include: { role: true },
      });

      if (
        assignment.role.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN ||
        assignment.role.slug === SYSTEM_ROLE_SLUGS.ADMIN
      ) {
        await tx.user.update({
          where: { id: userId },
          data: { role: ROLES.ADMIN },
        });
      }

      return assignment;
    });
  }

  async revokeSingleRole(userId: string, roleId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: { userId, roleId },
      });

      // Update legacy role enum based on remaining roles
      const remainingAssignments = await tx.userRoleAssignment.findMany({
        where: { userId },
        include: { role: true },
      });

      const slugs = remainingAssignments.map((a) => a.role.slug);
      let legacyRole: UserRole = ROLES.VIEWER;
      if (
        slugs.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN) ||
        slugs.includes(SYSTEM_ROLE_SLUGS.ADMIN)
      ) {
        legacyRole = ROLES.ADMIN;
      } else if (slugs.includes(SYSTEM_ROLE_SLUGS.CRAWLER_USER)) {
        legacyRole = ROLES.CRAWLER_USER;
      }

      await tx.user.update({
        where: { id: userId },
        data: { role: legacyRole },
      });

      return remainingAssignments;
    });
  }

  async countActiveSuperAdmins(): Promise<number> {
    return prisma.userRoleAssignment.count({
      where: {
        role: { slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN },
        user: { isActive: true, deletedAt: null },
      },
    });
  }

  async isUserSuperAdmin(userId: string): Promise<boolean> {
    const count = await prisma.userRoleAssignment.count({
      where: {
        userId,
        role: { slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN },
      },
    });
    return count > 0;
  }
}
