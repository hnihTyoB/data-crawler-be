import { prisma } from "../../database/prisma.client";
import { Prisma } from "@prisma/client";
import { RoleQueryDto } from "./role.dto";

export class RoleRepository {
  async findAll(query: RoleQueryDto = {}) {
    const where: Prisma.RoleWhereInput = {};

    if (query.isSystem !== undefined) {
      where.isSystem =
        typeof query.isSystem === "boolean"
          ? query.isSystem
          : query.isSystem === "true";
    }

    if (query.isActive !== undefined) {
      where.isActive =
        typeof query.isActive === "boolean"
          ? query.isActive
          : query.isActive === "true";
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: { userRoles: true },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.role.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.role.findUnique({
      where: { slug },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });
  }

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    isSystem?: boolean;
    permissionIds?: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          isSystem: data.isSystem ?? false,
          isActive: true,
        },
      });

      if (data.permissionIds && data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
          _count: {
            select: { userRoles: true },
          },
        },
      });
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return prisma.role.update({
      where: { id },
      data,
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.role.delete({
      where: { id },
    });
  }

  async getRolePermissions(roleId: string) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
      orderBy: [
        { permission: { resource: "asc" } },
        { permission: { action: "asc" } },
      ],
    });

    return rolePermissions.map((rp) => rp.permission);
  }

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
          _count: {
            select: { userRoles: true },
          },
        },
      });
    });
  }

  async getUsersWithRole(roleId: string) {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    return assignments.map((a) => a.user);
  }
}
