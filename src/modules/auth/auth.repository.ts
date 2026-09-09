import { prisma } from "../../database/prisma.client";
import { ROLES } from "../../common/constants/role.constant";
import { SYSTEM_ROLE_SLUGS } from "../../common/constants/system-role.constant";

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  findByEmailWithDeleted(email: string) {
    return prisma.user.findFirst({
      where: { email },
    });
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName?: string;
    isActive?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          fullName: data.fullName,
          role: ROLES.CRAWLER_USER,
          isActive: data.isActive ?? true,
        },
      });

      const defaultRole = await tx.role.findUnique({
        where: { slug: SYSTEM_ROLE_SLUGS.CRAWLER_USER },
      });

      if (defaultRole) {
        await tx.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId: defaultRole.id,
          },
        });
      }

      return user;
    });
  }

  updateUser(
    id: string,
    data: {
      fullName?: string;
      avatarUrl?: string | null;
      passwordHash?: string;
      isActive?: boolean;
    },
  ) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  deleteUnverifiedUser(id: string) {
    return prisma.user.deleteMany({
      where: { id, isActive: false },
    });
  }

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
  ) {
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteRefreshToken(token: string) {
    return prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteUserRefreshTokens(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async countActiveAdmins(): Promise<number> {
    return prisma.user.count({
      where: {
        role: ROLES.ADMIN,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async deactivateUser(userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedBy: userId,
        },
      });

      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      await tx.apiKey.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      await tx.crawlSchedule.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      await tx.webhookConfig.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    });
  }
}
