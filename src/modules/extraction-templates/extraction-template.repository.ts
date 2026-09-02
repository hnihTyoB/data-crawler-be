import { prisma } from '../../database/prisma.client';
import { CreateExtractionTemplateDto, UpdateExtractionTemplateDto } from './extraction-template.dto';

export class ExtractionTemplateRepository {
  create(userId: string, data: CreateExtractionTemplateDto) {
    return prisma.extractionTemplate.create({
      data: {
        userId,
        name: data.name,
        domain: data.domain,
        fields: data.fields as any,
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

  update(id: string, data: UpdateExtractionTemplateDto) {
    return prisma.extractionTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.fields !== undefined && { fields: data.fields as any }),
      },
    });
  }

  delete(id: string) {
    return prisma.extractionTemplate.delete({ where: { id } });
  }
}