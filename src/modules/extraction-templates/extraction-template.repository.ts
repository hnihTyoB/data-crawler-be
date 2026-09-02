import { prisma } from '../../database/prisma.client';
import { Prisma } from '@prisma/client';
import { CreateExtractionTemplateDto, UpdateExtractionTemplateDto } from './extraction-template.dto';

export class ExtractionTemplateRepository {
  create(userId: string, data: CreateExtractionTemplateDto) {
    return prisma.extractionTemplate.create({
      data: {
        userId,
        name: data.name,
        domain: data.domain,
        fields: data.fields as unknown as Prisma.InputJsonValue,
      },
    });
  }

  findAllByUser(userId: string) {
    return prisma.extractionTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return prisma.extractionTemplate.findUnique({ where: { id } });
  }

  findByDomain(domain: string) {
    return prisma.extractionTemplate.findFirst({ where: { domain } });
  }

  findByUserAndDomain(userId: string, domain: string) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    if (!isUuid) return null;

    return prisma.extractionTemplate.findUnique({
      where: {
        userId_domain: {
          userId,
          domain,
        },
      },
    });
  }

  update(id: string, data: UpdateExtractionTemplateDto) {
    return prisma.extractionTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.fields !== undefined && { fields: data.fields as unknown as Prisma.InputJsonValue }),
      },
    });
  }

  delete(id: string) {
    return prisma.extractionTemplate.delete({ where: { id } });
  }
}