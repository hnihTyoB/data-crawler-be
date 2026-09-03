import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SYSTEM_ROLE_SLUGS,
  SYSTEM_ROLES_METADATA,
  SystemRoleSlug,
} from "../src/common/constants/system-role.constant";
import {
  SYSTEM_PERMISSIONS_CATALOG,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../src/common/constants/permission.constant";

const prisma = new PrismaClient();

async function seedPermissions(): Promise<Map<string, string>> {
  console.log("Seeding system permissions...");
  const permissionMap = new Map<string, string>(); // slug -> id

  for (const perm of SYSTEM_PERMISSIONS_CATALOG) {
    const record = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: perm.isSystem,
      },
      create: {
        name: perm.name,
        slug: perm.slug,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        isSystem: perm.isSystem,
      },
    });
    permissionMap.set(record.slug, record.id);
  }

  return permissionMap;
}

async function seedRoles(
  permissionMap: Map<string, string>,
): Promise<Map<string, string>> {
  console.log("Seeding system roles & binding permissions...");
  const roleMap = new Map<string, string>(); // slug -> id

  for (const slug of Object.values(SYSTEM_ROLE_SLUGS)) {
    const meta = SYSTEM_ROLES_METADATA[slug as SystemRoleSlug];
    const role = await prisma.role.upsert({
      where: { slug },
      update: {
        name: meta.name,
        description: meta.description,
        isSystem: meta.isSystem,
        isActive: true,
      },
      create: {
        name: meta.name,
        slug: meta.slug,
        description: meta.description,
        isSystem: meta.isSystem,
        isActive: true,
      },
    });
    roleMap.set(role.slug, role.id);

    // Bind default permissions
    const defaultPermSlugs =
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[slug as SystemRoleSlug] || [];
    for (const permSlug of defaultPermSlugs) {
      const permId = permissionMap.get(permSlug);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  return roleMap;
}

async function seedUsers(roleMap: Map<string, string>) {
  console.log("Seeding base users and user role assignments...");
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 10);
  const crawlerPasswordHash = await bcrypt.hash("Crawler@123456", 10);
  const viewerPasswordHash = await bcrypt.hash("Viewer@123456", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@crawl.local" },
    update: {},
    create: {
      email: "admin@crawl.local",
      passwordHash: adminPasswordHash,
      fullName: "System Super Admin",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const crawlerUser = await prisma.user.upsert({
    where: { email: "crawl@crawl.local" },
    update: {},
    create: {
      email: "crawl@crawl.local",
      passwordHash: crawlerPasswordHash,
      fullName: "Crawl User",
      role: UserRole.CRAWLER_USER,
      isActive: true,
      maxPagesLimit: 100,
      maxJobsPerDayLimit: 10,
      maxConcurrentJobsLimit: 3,
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: "viewer@crawl.local" },
    update: {},
    create: {
      email: "viewer@crawl.local",
      passwordHash: viewerPasswordHash,
      fullName: "Viewer User",
      role: UserRole.VIEWER,
      isActive: true,
      maxPagesLimit: 20,
      maxJobsPerDayLimit: 2,
      maxConcurrentJobsLimit: 1,
    },
  });

  // Assign roles
  const superAdminRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.SUPER_ADMIN);
  const adminRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.ADMIN);
  const crawlerRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.CRAWLER_USER);
  const viewerRoleId = roleMap.get(SYSTEM_ROLE_SLUGS.VIEWER);

  if (adminRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: adminRoleId },
      },
      update: {},
      create: { userId: adminUser.id, roleId: adminRoleId },
    });
  }

  if (superAdminRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: superAdminRoleId },
      },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRoleId },
    });
  }

  if (crawlerRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: crawlerUser.id, roleId: crawlerRoleId },
      },
      update: {},
      create: { userId: crawlerUser.id, roleId: crawlerRoleId },
    });
  }

  if (viewerRoleId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: viewerUser.id, roleId: viewerRoleId },
      },
      update: {},
      create: { userId: viewerUser.id, roleId: viewerRoleId },
    });
  }

  // Backfill existing users in database
  console.log("Backfilling legacy users into UserRoleAssignment...");
  const allUsers = await prisma.user.findMany({
    include: { userRoles: true },
  });

  for (const user of allUsers) {
    if (user.userRoles.length === 0) {
      let targetRoleId: string | undefined;
      if (user.role === UserRole.ADMIN) {
        targetRoleId = adminRoleId;
      } else if (user.role === UserRole.VIEWER) {
        targetRoleId = viewerRoleId;
      } else {
        targetRoleId = crawlerRoleId;
      }

      if (targetRoleId) {
        await prisma.userRoleAssignment.upsert({
          where: {
            userId_roleId: { userId: user.id, roleId: targetRoleId },
          },
          update: {},
          create: { userId: user.id, roleId: targetRoleId },
        });
      }
    }
  }
}

async function main() {
  const permissionMap = await seedPermissions();
  const roleMap = await seedRoles(permissionMap);
  await seedUsers(roleMap);
  console.log("Seed completed successfully!");
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
