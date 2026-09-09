import { ExtractionTemplateRepository } from "./extraction-template.repository";
import {
  CreateExtractionTemplateDto,
  UpdateExtractionTemplateDto,
} from "./extraction-template.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { clearTemplateCache } from "./extraction-runner";

export class ExtractionTemplateService {
  private readonly repository = new ExtractionTemplateRepository();

  async create(userId: string, payload: CreateExtractionTemplateDto) {
    try {
      const result = await this.repository.create(userId, payload);
      clearTemplateCache();
      return result;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
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
      throw new AppError(
        "Extraction template not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    return template;
  }

  async update(
    userId: string,
    id: string,
    payload: UpdateExtractionTemplateDto,
  ) {
    await this.findById(userId, id);
    const result = await this.repository.update(id, payload);
    clearTemplateCache();
    return result;
  }

  async delete(userId: string, id: string) {
    await this.findById(userId, id);
    const result = await this.repository.delete(id);
    clearTemplateCache();
    return result;
  }
}
