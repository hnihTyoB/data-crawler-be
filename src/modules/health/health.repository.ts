import { prisma } from "../../database/prisma.client";

export class HealthRepository {
  async pingDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
}
