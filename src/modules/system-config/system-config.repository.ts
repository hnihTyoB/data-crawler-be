import { prisma } from "../../database/prisma.client";
import { Prisma } from "@prisma/client";
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigQueryDto,
} from "./system-config.dto";
import { DefaultSystemConfigItem } from "../../common/constants/system-config.constant";

export class SystemConfigRepository {
  async findAll(query: SystemConfigQueryDto = {}) {
    const where: Prisma.SystemConfigWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.isPublic !== undefined) {
      where.isPublic =
        typeof query.isPublic === "boolean"
          ? query.isPublic
          : query.isPublic === "true";
    }

    if (query.search) {
      where.OR = [
        { key: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }],
        skip,
        take: limit,
      }),
      prisma.systemConfig.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findByKey(key: string) {
    return prisma.systemConfig.findUnique({
      where: { key },
    });
  }

  async findPublicConfigs() {
    return prisma.systemConfig.findMany({
      where: { isPublic: true },
      orderBy: { key: "asc" },
    });
  }

  async create(data: CreateSystemConfigDto) {
    return prisma.systemConfig.create({
      data: {
        key: data.key,
        value: data.value as Prisma.InputJsonValue,
        description: data.description ?? null,
        category: data.category,
        isPublic: data.isPublic ?? false,
      },
    });
  }

  async update(key: string, data: UpdateSystemConfigDto) {
    const updatePayload: Prisma.SystemConfigUpdateInput = {};

    if (data.value !== undefined) {
      updatePayload.value = data.value as Prisma.InputJsonValue;
    }
    if (data.description !== undefined) {
      updatePayload.description = data.description;
    }
    if (data.category !== undefined) {
      updatePayload.category = data.category;
    }
    if (data.isPublic !== undefined) {
      updatePayload.isPublic = data.isPublic;
    }

    return prisma.systemConfig.update({
      where: { key },
      data: updatePayload,
    });
  }

  async delete(key: string) {
    return prisma.systemConfig.delete({
      where: { key },
    });
  }

  async ensureDefault(item: DefaultSystemConfigItem) {
    return prisma.systemConfig.upsert({
      where: { key: item.key },
      update: {
        description: item.description ?? null,
        category: item.category,
        isPublic: item.isPublic,
      },
      create: {
        key: item.key,
        value: item.value as Prisma.InputJsonValue,
        description: item.description ?? null,
        category: item.category,
        isPublic: item.isPublic,
      },
    });
  }
}
