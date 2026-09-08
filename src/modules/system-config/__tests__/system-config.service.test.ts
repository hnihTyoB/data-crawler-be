import { SystemConfigService } from "../system-config.service";
import { SystemConfigRepository } from "../system-config.repository";
import { AuditLogService } from "../../audit-logs/audit-log.service";
import {
  SYSTEM_CONFIG_CATEGORY,
  DEFAULT_SYSTEM_CONFIGS,
} from "../../../common/constants/system-config.constant";
import { AppError } from "../../../common/errors/app-error";
import { ERROR_CODE } from "../../../common/errors/error-code";

describe("SystemConfigService", () => {
  let service: SystemConfigService;
  let mockRepo: jest.Mocked<SystemConfigRepository>;
  let mockAudit: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findByKey: jest.fn(),
      findPublicConfigs: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      ensureDefault: jest.fn(),
    } as unknown as jest.Mocked<SystemConfigRepository>;

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    service = new SystemConfigService(mockRepo, mockAudit);
  });

  describe("get & Level 1 Cache", () => {
    it("should fetch from repository on cache miss and cache the result", async () => {
      const mockRecord = {
        id: "1",
        key: "app.name",
        value: "Custom App",
        description: "Test",
        category: SYSTEM_CONFIG_CATEGORY.GENERAL,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findByKey.mockResolvedValueOnce(mockRecord);

      // Miss: queries repo
      const val1 = await service.get("app.name");
      expect(val1).toBe("Custom App");
      expect(mockRepo.findByKey).toHaveBeenCalledTimes(1);

      // Hit: serves from in-memory cache without calling repo again
      const val2 = await service.get("app.name");
      expect(val2).toBe("Custom App");
      expect(mockRepo.findByKey).toHaveBeenCalledTimes(1);
    });

    it("should return defaultValue when key does not exist", async () => {
      mockRepo.findByKey.mockResolvedValueOnce(null);

      const val = await service.get("non_existent_key", "default_val");
      expect(val).toBe("default_val");
    });
  });

  describe("isFeatureEnabled", () => {
    it("should return true when value is boolean true", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "1",
        key: "feature.registration.enabled",
        value: true,
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const enabled = await service.isFeatureEnabled(
        "feature.registration.enabled",
      );
      expect(enabled).toBe(true);
    });

    it("should return false when value is boolean false", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "2",
        key: "feature.ai.enabled",
        value: false,
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const enabled = await service.isFeatureEnabled("feature.ai.enabled");
      expect(enabled).toBe(false);
    });

    it("should handle string boolean values ('true' / 'false')", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "3",
        key: "feature.flag.string",
        value: "true",
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const enabled = await service.isFeatureEnabled("feature.flag.string");
      expect(enabled).toBe(true);
    });

    it("should fallback to default value when flag not found", async () => {
      mockRepo.findByKey.mockResolvedValueOnce(null);

      const enabled = await service.isFeatureEnabled("missing.flag", true);
      expect(enabled).toBe(true);
    });
  });

  describe("getPublicConfigs", () => {
    it("should return public configs list and dictionary map", async () => {
      mockRepo.findPublicConfigs.mockResolvedValueOnce([
        {
          id: "1",
          key: "app.name",
          value: "DataCrawler",
          description: "App Name",
          category: SYSTEM_CONFIG_CATEGORY.GENERAL,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          key: "feature.registration.enabled",
          value: true,
          description: "Registration Flag",
          category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await service.getPublicConfigs();
      expect(res.configs).toHaveLength(2);
      expect(res.map).toEqual({
        "app.name": "DataCrawler",
        "feature.registration.enabled": true,
      });

      // Second call should be served from memory cache
      const res2 = await service.getPublicConfigs();
      expect(res2).toEqual(res);
      expect(mockRepo.findPublicConfigs).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("should create new config, clear cache and log audit action", async () => {
      mockRepo.findByKey.mockResolvedValueOnce(null);
      mockRepo.create.mockResolvedValueOnce({
        id: "uuid-1",
        key: "feature.new_module",
        value: true,
        description: "New module flag",
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        {
          key: "feature.new_module",
          value: true,
          category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
          isPublic: true,
        },
        { actorId: "admin-id" },
      );

      expect(result.key).toBe("feature.new_module");
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-id",
          action: "SYSTEM_CONFIG_CREATED",
        }),
      );
    });

    it("should throw DUPLICATE_ENTRY when key already exists", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "uuid-1",
        key: "app.name",
        value: "My App",
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.GENERAL,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.create({
          key: "app.name",
          value: "Conflict",
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("update", () => {
    it("should update config, clear cache and log audit action", async () => {
      const existing = {
        id: "uuid-1",
        key: "app.name",
        value: "Old App",
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.GENERAL,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findByKey.mockResolvedValueOnce(existing);
      mockRepo.update.mockResolvedValueOnce({
        ...existing,
        value: "New App",
      });

      const updated = await service.update(
        "app.name",
        { value: "New App" },
        { actorId: "admin-id" },
      );

      expect(updated.value).toBe("New App");
      expect(mockRepo.update).toHaveBeenCalledWith("app.name", {
        value: "New App",
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-id",
          action: "SYSTEM_CONFIG_UPDATED",
        }),
      );
    });

    it("should throw NOT_FOUND when updating non-existent config", async () => {
      mockRepo.findByKey.mockResolvedValueOnce(null);

      await expect(
        service.update("not.found", { value: 123 }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("toggleFeature", () => {
    it("should toggle boolean feature flag from true to false", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "uuid-1",
        key: "feature.ai.enabled",
        value: true,
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepo.update.mockResolvedValueOnce({
        id: "uuid-1",
        key: "feature.ai.enabled",
        value: false,
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const toggled = await service.toggleFeature("feature.ai.enabled", {
        actorId: "admin-1",
      });

      expect(toggled.value).toBe(false);
      expect(mockRepo.update).toHaveBeenCalledWith("feature.ai.enabled", {
        value: false,
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          action: "SYSTEM_CONFIG_TOGGLED",
        }),
      );
    });

    it("should throw VALIDATION_ERROR when trying to toggle non-boolean config", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "uuid-1",
        key: "rate_limit.max_requests_per_minute",
        value: 60,
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.SECURITY,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.toggleFeature("rate_limit.max_requests_per_minute"),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ERROR_CODE.VALIDATION_ERROR,
        }),
      );
    });
  });

  describe("delete", () => {
    it("should delete existing config and log audit action", async () => {
      mockRepo.findByKey.mockResolvedValueOnce({
        id: "uuid-1",
        key: "temp.config",
        value: "test",
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.GENERAL,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepo.delete.mockResolvedValueOnce({
        id: "uuid-1",
        key: "temp.config",
        value: "test",
        description: null,
        category: SYSTEM_CONFIG_CATEGORY.GENERAL,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.delete("temp.config", { actorId: "admin-1" });
      expect(res.success).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("temp.config");
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          action: "SYSTEM_CONFIG_DELETED",
        }),
      );
    });
  });

  describe("ensureDefaultConfigs", () => {
    it("should ensure all default configs are inserted", async () => {
      mockRepo.ensureDefault.mockResolvedValue({} as any);

      await service.ensureDefaultConfigs();

      expect(mockRepo.ensureDefault).toHaveBeenCalledTimes(
        DEFAULT_SYSTEM_CONFIGS.length,
      );
    });
  });
});
