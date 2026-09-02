import { prisma } from '../../database/prisma.client';

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  createUser(data: { email: string; passwordHash: string; fullName?: string; isActive?: boolean }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: "CRAWLER_USER",
        isActive: data.isActive ?? true,
      },
    });
  }

  updateUser(id: string, data: { fullName?: string; passwordHash?: string; isActive?: boolean }) {
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

  async saveRefreshToken(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string) {
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
}
