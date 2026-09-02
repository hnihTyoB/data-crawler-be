import { prisma } from '../../database/prisma.client';
import { Prisma } from '@prisma/client';
import { AuditLogQueryDto, CreateAuditLogDto } from './audit-log.dto';

export class AuditLogRepository {
  async create(data: CreateAuditLogDto) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        details: (data.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  }

  async findAll(query: AuditLogQueryDto = {}) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const order = (query.order || 'desc') as Prisma.SortOrder;
    const allowedSortFields = ['createdAt', 'action'];
    const orderBy: Prisma.AuditLogOrderByWithRelationInput = allowedSortFields.includes(sortBy)
      ? { [sortBy]: order }
      : { createdAt: 'desc' };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
