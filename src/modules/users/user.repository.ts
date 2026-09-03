import { prisma } from "../../database/prisma.client";
import { UserRole, Prisma, User } from "@prisma/client";
import { UserQueryDto } from "./user.dto";
import { envConfig } from "../../config/env.config";
import { ROLES } from "../../common/constants/role.constant";

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

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    fullName?: string;
    avatarUrl?: string;
    role?: UserRole;
    maxPagesLimit?: number;
    maxJobsPerDayLimit?: number;
    maxConcurrentJobsLimit?: number;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        role: data.role ?? ROLES.CRAWLER_USER,
        maxPagesLimit: data.maxPagesLimit ?? envConfig.quota.defaultMaxPages,
        maxJobsPerDayLimit:
          data.maxJobsPerDayLimit ?? envConfig.quota.defaultMaxJobsPerDay,
        maxConcurrentJobsLimit:
          data.maxConcurrentJobsLimit ??
          envConfig.quota.defaultMaxConcurrentJobs,
      },
    });
  }

  update(
    id: string,
    data: {
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

      return user;
    });
  }
}
