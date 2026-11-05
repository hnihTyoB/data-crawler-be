import {
  getCachedTemplate,
  clearTemplateCache,
  extractStructuredDataIfTemplate,
} from "../extraction-runner";
import { ExtractionTemplateRepository } from "../extraction-template.repository";
import * as redisPubSub from "../../../common/redis/redis-pubsub";

jest.mock("../extraction-template.repository");
jest.mock("../../../common/redis/redis-pubsub");

describe("Extraction Runner Security Patches (SEC-24, SEC-25)", () => {
  let mockTemplateRepo: {
    findByUserAndDomain: jest.Mock;
    findByDomain: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearTemplateCache();
    mockTemplateRepo = {
      findByUserAndDomain: jest.fn(),
      findByDomain: jest.fn(),
    };
    (ExtractionTemplateRepository as jest.Mock).mockReturnValue(mockTemplateRepo);
  });

  describe("SEC-24: Cross-Tenant Extraction Template Isolation", () => {
    it("returns null and rejects unscoped fallback when userId is not provided", async () => {
      // Even if an unscoped template exists for this domain, it must not be loaded without userId
      mockTemplateRepo.findByDomain.mockResolvedValue({
        id: "tpl-tenant-a",
        userId: "user-a",
        domain: "target.com",
        name: "Tenant A Template",
      });

      const result = await getCachedTemplate("target.com");

      expect(result).toBeNull();
      expect(mockTemplateRepo.findByDomain).not.toHaveBeenCalled();
      expect(mockTemplateRepo.findByUserAndDomain).not.toHaveBeenCalled();
    });

    it("scopes template lookup strictly to the authenticated userId", async () => {
      const tenantTemplate = {
        id: "tpl-tenant-b",
        userId: "user-b",
        domain: "target.com",
        name: "Tenant B Template",
        fields: [],
      };

      mockTemplateRepo.findByUserAndDomain.mockResolvedValue(tenantTemplate);

      const result = await getCachedTemplate("target.com", "user-b");

      expect(result).toEqual(tenantTemplate);
      expect(mockTemplateRepo.findByUserAndDomain).toHaveBeenCalledWith(
        "user-b",
        "target.com",
      );
      expect(mockTemplateRepo.findByDomain).not.toHaveBeenCalled();
    });

    it("does not leak Tenant A template to Tenant B", async () => {
      mockTemplateRepo.findByUserAndDomain.mockImplementation(
        (userId: string, domain: string) => {
          if (userId === "user-a") {
            return Promise.resolve({
              id: "tpl-tenant-a",
              userId: "user-a",
              domain,
              name: "Tenant A's Secret Template",
              fields: [],
            });
          }
          return Promise.resolve(null);
        },
      );

      // User A loads their template
      const resA = await getCachedTemplate("target.com", "user-a");
      expect(resA?.userId).toBe("user-a");

      // User B requests same domain - must NOT get User A's cached template
      const resB = await getCachedTemplate("target.com", "user-b");
      expect(resB).toBeNull();
    });
  });

  describe("SEC-25: Distributed Template Cache Invalidation", () => {
    it("publishes cache invalidation event via Redis pub/sub when clearTemplateCache is called", () => {
      const mockPublish = jest.fn().mockResolvedValue(1);
      (redisPubSub.getRedisPublisher as jest.Mock).mockReturnValue({
        publish: mockPublish,
      });

      clearTemplateCache("example.com", "user-1", true);

      expect(mockPublish).toHaveBeenCalledWith(
        "template:cache:invalidate",
        JSON.stringify({ domain: "example.com", userId: "user-1" }),
      );
    });

    it("does not propagate when propagate=false", () => {
      const mockPublish = jest.fn();
      (redisPubSub.getRedisPublisher as jest.Mock).mockReturnValue({
        publish: mockPublish,
      });

      clearTemplateCache("example.com", "user-1", false);

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
