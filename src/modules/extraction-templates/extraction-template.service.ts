import { ExtractionTemplateRepository } from './extraction-template.repository';
import { CreateExtractionTemplateDto, UpdateExtractionTemplateDto } from './extraction-template.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class ExtractionTemplateService {
  private readonly repository = new ExtractionTemplateRepository();

  async create(userId: string, payload: CreateExtractionTemplateDto) {
    try {
      return await this.repository.create(userId, payload);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError(
          `A template for domain "${payload.domain}" already exists`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
      throw err;
    }
  }

  findAll(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  async findById(userId: string, id: string) {
    const template = await this.repository.findById(id);
    if (!template || template.userId !== userId) {
      throw new AppError('Extraction template not found', 404, ERROR_CODE.NOT_FOUND);
    }
    return template;
  }

  async update(userId: string, id: string, payload: UpdateExtractionTemplateDto) {
    await this.findById(userId, id);
    return this.repository.update(id, payload);
  }

  async delete(userId: string, id: string) {
    await this.findById(userId, id);
    return this.repository.delete(id);
  }
}