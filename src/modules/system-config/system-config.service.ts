import { SystemConfigRepository } from "./system-config.repository";
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigQueryDto,
  PublicConfigsResponseDto,
  SystemConfigEventPayload,
  SystemConfigResponseDto,
} from "./system-config.dto";
import {
  DEFAULT_SYSTEM_CONFIGS,
  SYSTEM_CONFIG_CACHE_TTL_MS,
  SYSTEM_CONFIG_EVENTS_CHANNEL,
} from "../../common/constants/system-config.constant";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { AuditLogService } from "../audit-logs/audit-log.service";
import {
  getRedisPublisher,
  getRedisSubscriber,
} from "../../common/redis/redis-pubsub";

interface AuditContext {
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  config: SystemConfigResponseDto;
}

export class SystemConfigService {
  private cache = new Map<string, CacheEntry>();
  private publicConfigsCache: {
    data: PublicConfigsResponseDto;
    expiresAt: number;
  } | null = null;
  private isSubscriberInitialized = false;

  constructor(
    private readonly repository = new SystemConfigRepository(),
    private readonly auditLogService = new AuditLogService(),
  ) {}

  /**
   * Khởi tạo Redis Subscriber để lắng nghe thông điệp xóa cache từ các node khác
   */
  public initRedisSubscriber(): void {
    if (this.isSubscriberInitialized) return;
    const subscriber = getRedisSubscriber();
    if (!subscriber) return;

    try {
      subscriber.subscribe(SYSTEM_CONFIG_EVENTS_CHANNEL, (err) => {
        if (err) {
          console.warn(
            "[SystemConfig:RedisSub] Failed to subscribe:",
            err.message,
          );
        } else {
          this.isSubscriberInitialized = true;
          console.log(
            `[SystemConfig] Subscribed to Redis channel: ${SYSTEM_CONFIG_EVENTS_CHANNEL}`,
          );
        }
      });

      subscriber.on("message", (channel, message) => {
        if (channel === SYSTEM_CONFIG_EVENTS_CHANNEL) {
          try {
            const event: SystemConfigEventPayload = JSON.parse(message);
            this.clearLocalCache(event.key);
          } catch {
            this.clearLocalCache();
          }
        }
      });
    } catch (error) {
      console.warn("[SystemConfig:RedisSub] Subscriber setup failed:", error);
    }
  }

  /**
   * Phát thông điệp xóa cache toàn cluster qua Redis Pub/Sub
   */
  public async publishInvalidation(
    key?: string,
    action: SystemConfigEventPayload["action"] = "invalidate",
  ): Promise<void> {
    this.clearLocalCache(key);
    const publisher = getRedisPublisher();
    if (!publisher) return;

    try {
      const payload: SystemConfigEventPayload = {
        key,
        action,
        timestamp: Date.now(),
      };
      await publisher.publish(
        SYSTEM_CONFIG_EVENTS_CHANNEL,
        JSON.stringify(payload),
      );
    } catch {
      // Degraded mode: local cache already invalidated
    }
  }

  /**
   * Xóa RAM cache cục bộ (Level 1)
   */
  public clearLocalCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    this.publicConfigsCache = null;
  }

  /**
   * Level 1 Cache Getter: Truy xuất giá trị cấu hình theo key với tốc độ < 0.1ms
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as T;
    }

    const record = await this.repository.findByKey(key);
    if (!record) {
      return defaultValue as T;
    }

    this.cache.set(key, {
      value: record.value,
      expiresAt: Date.now() + SYSTEM_CONFIG_CACHE_TTL_MS,
      config: record as SystemConfigResponseDto,
    });

    return record.value as T;
  }

  /**
   * Kiểm tra nhanh Feature Flag dạng boolean cho các service nội bộ
   */
  async isFeatureEnabled(
    key: string,
    defaultValue: boolean = false,
  ): Promise<boolean> {
    const value = await this.get(key, defaultValue);
    if (typeof value === "boolean") {
      return value;
    }
    if (value === "true" || value === 1 || value === "1") {
      return true;
    }
    if (value === "false" || value === 0 || value === "0") {
      return false;
    }
    return Boolean(value);
  }

  /**
   * Lấy danh sách cấu hình công khai (isPublic: true) cho client
   */
  async getPublicConfigs(): Promise<PublicConfigsResponseDto> {
    if (
      this.publicConfigsCache &&
      Date.now() < this.publicConfigsCache.expiresAt
    ) {
      return this.publicConfigsCache.data;
    }

    const records = await this.repository.findPublicConfigs();
    const configs = records.map((r) => ({
      key: r.key,
      value: r.value,
      category: r.category,
      description: r.description,
    }));

    const map: Record<string, unknown> = {};
    for (const item of configs) {
      map[item.key] = item.value;
    }

    const result: PublicConfigsResponseDto = { configs, map };
    this.publicConfigsCache = {
      data: result,
      expiresAt: Date.now() + SYSTEM_CONFIG_CACHE_TTL_MS,
    };

    return result;
  }

  /**
   * Lấy danh sách cấu hình hệ thống (Admin)
   */
  async findAll(query: SystemConfigQueryDto = {}) {
    return this.repository.findAll(query);
  }

  /**
   * Lấy chi tiết 1 cấu hình theo key
   */
  async findByKey(key: string): Promise<SystemConfigResponseDto> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config;
    }

    const config = await this.repository.findByKey(key);
    if (!config) {
      throw new AppError(
        `Không tìm thấy cấu hình với khóa [${key}]`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const dto = config as SystemConfigResponseDto;
    this.cache.set(key, {
      value: config.value,
      expiresAt: Date.now() + SYSTEM_CONFIG_CACHE_TTL_MS,
      config: dto,
    });

    return dto;
  }

  /**
   * Tạo cấu hình mới
   */
  async create(
    data: CreateSystemConfigDto,
    context?: AuditContext,
  ): Promise<SystemConfigResponseDto> {
    const existing = await this.repository.findByKey(data.key);
    if (existing) {
      throw new AppError(
        `Khóa cấu hình [${data.key}] đã tồn tại`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const created = await this.repository.create(data);
    await this.publishInvalidation(data.key, "create");

    await this.auditLogService.log({
      userId: context?.actorId,
      action: AUDIT_ACTIONS.SYSTEM_CONFIG_CREATED,
      details: {
        key: created.key,
        category: created.category,
        isPublic: created.isPublic,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return created as SystemConfigResponseDto;
  }

  /**
   * Cập nhật cấu hình
   */
  async update(
    key: string,
    data: UpdateSystemConfigDto,
    context?: AuditContext,
  ): Promise<SystemConfigResponseDto> {
    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new AppError(
        `Không tìm thấy cấu hình với khóa [${key}]`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const updated = await this.repository.update(key, data);
    await this.publishInvalidation(key, "update");

    await this.auditLogService.log({
      userId: context?.actorId,
      action: AUDIT_ACTIONS.SYSTEM_CONFIG_UPDATED,
      details: {
        key,
        oldValue: existing.value,
        newValue: updated.value,
        category: updated.category,
        isPublic: updated.isPublic,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated as SystemConfigResponseDto;
  }

  /**
   * Bật/tắt nhanh Feature Flag dạng boolean
   */
  async toggleFeature(
    key: string,
    context?: AuditContext,
  ): Promise<SystemConfigResponseDto> {
    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new AppError(
        `Không tìm thấy Feature Flag với khóa [${key}]`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    let currentBool: boolean;
    if (typeof existing.value === "boolean") {
      currentBool = existing.value;
    } else if (existing.value === "true" || existing.value === "1") {
      currentBool = true;
    } else if (existing.value === "false" || existing.value === "0") {
      currentBool = false;
    } else {
      throw new AppError(
        `Cấu hình [${key}] không phải là cờ tính năng (boolean)`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const nextValue = !currentBool;
    const updated = await this.repository.update(key, { value: nextValue });
    await this.publishInvalidation(key, "toggle");

    await this.auditLogService.log({
      userId: context?.actorId,
      action: AUDIT_ACTIONS.SYSTEM_CONFIG_TOGGLED,
      details: {
        key,
        previousState: currentBool,
        newState: nextValue,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated as SystemConfigResponseDto;
  }

  /**
   * Xóa cấu hình
   */
  async delete(
    key: string,
    context?: AuditContext,
  ): Promise<{ success: boolean }> {
    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new AppError(
        `Không tìm thấy cấu hình với khóa [${key}]`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    await this.repository.delete(key);
    await this.publishInvalidation(key, "delete");

    await this.auditLogService.log({
      userId: context?.actorId,
      action: AUDIT_ACTIONS.SYSTEM_CONFIG_DELETED,
      details: {
        key,
        category: existing.category,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { success: true };
  }

  /**
   * Khởi tạo cấu hình mặc định nếu chưa tồn tại trong Database
   */
  async ensureDefaultConfigs(): Promise<void> {
    for (const item of DEFAULT_SYSTEM_CONFIGS) {
      try {
        await this.repository.ensureDefault(item);
      } catch (err) {
        console.warn(
          `[SystemConfig] ensureDefault error for ${item.key}:`,
          err,
        );
      }
    }
    this.clearLocalCache();
  }
}

export const systemConfigService = new SystemConfigService();
