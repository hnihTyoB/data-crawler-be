import { AuditLogRepository } from "./audit-log.repository";
import { AuditLogQueryDto, CreateAuditLogDto } from "./audit-log.dto";

export class AuditLogService {
  private readonly repository = new AuditLogRepository();

  async log(data: CreateAuditLogDto) {
    try {
      return await this.repository.create(data);
    } catch (error) {
      console.error("Failed to save audit log:", error);
    }
  }

  async findAll(query: AuditLogQueryDto) {
    return this.repository.findAll(query);
  }
}
