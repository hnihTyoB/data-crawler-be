import { prisma } from "../../database/prisma.client";
import { Permission } from "../../common/types/database.types";
import {
  SYSTEM_PERMISSIONS_CATALOG,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../../common/constants/permission.constant";
import {
  SYSTEM_ROLE_SLUGS,
  SYSTEM_ROLES_METADATA,
  SystemRoleSlug,
} from "../../common/constants/system-role.constant";

export class PermissionRepository {
  async findAll(query?: {
    resource?: string;
    search?: string;
  }): Promise<Permission[]> {
    const where: {
      resource?: string;
      OR?: Array<{
        name?: { contains: string; mode: "insensitive" };
        slug?: { contains: string; mode: "insensitive" };
        description?: { contains: string; mode: "insensitive" };
      }>;
    } = {};

    if (query?.resource) {
      where.resource = query.resource;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return prisma.permission.findMany({
      where,
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
  }

  async findById(id: string): Promise<Permission | null> {
    return prisma.permission.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Permission | null> {
    return prisma.permission.findUnique({
      where: { slug },
    });
  }

  async findUserPermissions(userId: string): Promise<string[]> {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        role: { isActive: true },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();

    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        if (rp.permission?.slug) {
          permissionSet.add(rp.permission.slug);
        }
      }
    }

    return Array.from(permissionSet);
  }

  async findUserRoleSlugs(userId: string): Promise<string[]> {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        role: { isActive: true },
      },
      include: {
        role: true,
      },
    });

    return assignments.map((a) => a.role.slug);
  }

  async ensureSystemPermissions(): Promise<void> {
    // 1. Upsert all permissions from SYSTEM_PERMISSIONS_CATALOG
    for (const perm of SYSTEM_PERMISSIONS_CATALOG) {
      await prisma.permission.upsert({
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
    }

    // 2. Ensure system roles exist
    for (const slug of Object.values(SYSTEM_ROLE_SLUGS)) {
      const meta = SYSTEM_ROLES_METADATA[slug as SystemRoleSlug];
      if (meta) {
        await prisma.role.upsert({
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
      }
    }

    // 3. Fetch all permissions map: slug -> id
    const allPermissions = await prisma.permission.findMany({
      select: { id: true, slug: true },
    });
    const permissionMap = new Map<string, string>(
      allPermissions.map((p) => [p.slug, p.id]),
    );

    // 4. For each system role, ensure default permissions are assigned in role_permissions
    for (const slug of Object.values(SYSTEM_ROLE_SLUGS)) {
      const role = await prisma.role.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!role) continue;

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
  }
}
