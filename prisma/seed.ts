import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const crawlerPasswordHash = await bcrypt.hash('Crawler@123456', 10);
  const viewerPasswordHash = await bcrypt.hash('Viewer@123456', 10);

  await prisma.user.upsert({
    where: { email: 'admin@crawl.local' },
    update: {},
    create: {
      email: 'admin@crawl.local',
      passwordHash: adminPasswordHash,
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'crawl@crawl.local' },
    update: {},
    create: {
      email: 'crawl@crawl.local',
      passwordHash: crawlerPasswordHash,
      fullName: 'Crawl User',
      role: UserRole.CRAWLER_USER,
      isActive: true,
      maxPagesLimit: 100,
      maxJobsPerDayLimit: 10,
      maxConcurrentJobsLimit: 3,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@crawl.local' },
    update: {},
    create: {
      email: 'viewer@crawl.local',
      passwordHash: viewerPasswordHash,
      fullName: 'Viewer User',
      role: UserRole.VIEWER,
      isActive: true,
      maxPagesLimit: 20,
      maxJobsPerDayLimit: 2,
      maxConcurrentJobsLimit: 1,
    },
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
