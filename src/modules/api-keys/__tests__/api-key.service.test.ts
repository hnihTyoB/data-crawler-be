jest.mock('../../../database/prisma.client', () => ({
  prisma: {
    apiKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '../../../database/prisma.client';
import { ApiKeyService } from '../api-key.service';
import crypto from 'crypto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiKeyService();
  });

  describe('create()', () => {
    it('generates a valid api key and hashes it to store in DB', async () => {
      const mockApiKeyRecord = {
        id: 'key-uuid-123',
        userId: 'user-uuid-123',
        name: 'Test key',
        keyHash: 'dummy_hash',
        keyPrefix: 'dc_abcdefgh',
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.apiKey.create as jest.Mock).mockResolvedValue(mockApiKeyRecord);

      const result = await service.create('user-uuid-123', 'Test key');

      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('dc_')).toBe(true);
      expect(result.keyPrefix).toBe(mockApiKeyRecord.keyPrefix);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid-123',
          name: 'Test key',
          keyPrefix: expect.any(String),
          keyHash: expect.any(String),
          expiresAt: null,
        }),
      });
    });
  });

  describe('validate()', () => {
    it('validates a valid raw key successfully and updates lastUsedAt', async () => {
      const randomHex = crypto.randomBytes(32).toString('hex');
      const rawKey = `dc_${randomHex}`;
      const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');

      const mockApiKeyRecord = {
        id: 'key-uuid-123',
        userId: 'user-uuid-123',
        name: 'Test key',
        keyHash: hashed,
        keyPrefix: 'dc_' + randomHex.substring(0, 8),
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(mockApiKeyRecord);
      (prisma.apiKey.update as jest.Mock).mockResolvedValue({
        ...mockApiKeyRecord,
        lastUsedAt: new Date(),
      });

      const validatedKey = await service.validate(rawKey);

      expect(validatedKey.id).toBe(mockApiKeyRecord.id);
      expect(validatedKey.userId).toBe(mockApiKeyRecord.userId);
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: hashed },
      });
      // Verification of background lastUsedAt update
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: mockApiKeyRecord.id },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('throws error for invalid format keys', async () => {
      await expect(service.validate('invalid_prefix_key')).rejects.toThrow('Invalid API Key format');
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    });

    it('throws error if key does not exist in DB', async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validate('dc_non_existent_key_123456789')).rejects.toThrow('Invalid API Key');
    });

    it('throws error if key is inactive', async () => {
      const rawKey = 'dc_some_inactive_key_value_12345';
      const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: 'key-uuid-123',
        isActive: false,
        expiresAt: null,
      });

      await expect(service.validate(rawKey)).rejects.toThrow('API Key is inactive');
    });

    it('throws error if key has expired', async () => {
      const rawKey = 'dc_some_expired_key_value_12345';
      const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: 'key-uuid-123',
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired 10 seconds ago
      });

      await expect(service.validate(rawKey)).rejects.toThrow('API Key has expired');
    });
  });
});
