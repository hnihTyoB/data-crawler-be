import { prisma } from "../../database/prisma.client";
import { ApiKey } from "@prisma/client";

export class ApiKeyRepository {
  async create(data: {
    userId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    expiresAt?: Date | null;
  }): Promise<ApiKey> {
    return prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findAllByUserId(userId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({
      where: { id },
    });
  }

  async findByHash(keyHash: string) {
    return prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: true,
      },
    });
  }

  async update(
    id: string,
    data: Partial<Omit<ApiKey, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ApiKey> {
    return prisma.apiKey.delete({
      where: { id },
    });
  }
}
