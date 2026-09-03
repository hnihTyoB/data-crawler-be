import { prisma } from "../../database/prisma.client";
import { Permission } from "../../common/types/database.types";

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
}
