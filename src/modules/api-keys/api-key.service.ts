import crypto from "crypto";
import { ApiKeyRepository } from "./api-key.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import type { ApiKey } from "@prisma/client";
import {
  toPublicApiKey,
  type CreatedApiKey,
  type PublicApiKey,
} from "./api-key.dto";

export class ApiKeyService {
  private readonly repository = new ApiKeyRepository();

  async create(
    userId: string,
    name: string,
    expiresAt?: Date | string | null,
  ): Promise<CreatedApiKey> {
    const randomHex = crypto.randomBytes(32).toString("hex");
    const rawKey = `dc_${randomHex}`;

    const keyPrefix = `dc_${randomHex.substring(0, 8)}`;

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;

    const apiKey = await this.repository.create({
      userId,
      name,
      keyHash,
      keyPrefix,
      expiresAt: parsedExpiresAt,
    });

    return { ...toPublicApiKey(apiKey), rawKey };
  }

  async list(userId: string): Promise<PublicApiKey[]> {
    const keys = await this.repository.findAllByUserId(userId);
    return keys.map(toPublicApiKey);
  }

  async setActive(
    userId: string,
    keyId: string,
    isActive: boolean,
  ): Promise<PublicApiKey> {
    const key = await this.repository.findById(keyId);

    if (!key || key.userId !== userId) {
      throw new AppError("API key not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const updatedKey = await this.repository.update(keyId, { isActive });
    return toPublicApiKey(updatedKey);
  }

  async revoke(userId: string, keyId: string): Promise<PublicApiKey> {
    const key = await this.repository.findById(keyId);

    if (!key || key.userId !== userId) {
      throw new AppError("API key not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const deletedKey = await this.repository.delete(keyId);
    return toPublicApiKey(deletedKey);
  }

  async validate(rawKey: string) {
    if (!rawKey || !rawKey.startsWith("dc_")) {
      throw new AppError(
        "Invalid API Key format",
        401,
        ERROR_CODE.API_KEY_INVALID,
      );
    }

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const key = await this.repository.findByHash(keyHash);

    if (!key) {
      throw new AppError("Invalid API Key", 401, ERROR_CODE.API_KEY_INVALID);
    }

    if (!key.isActive) {
      throw new AppError(
        "API Key is inactive",
        401,
        ERROR_CODE.API_KEY_INVALID,
      );
    }

    if (key.expiresAt && new Date() > new Date(key.expiresAt)) {
      throw new AppError(
        "API Key has expired",
        401,
        ERROR_CODE.API_KEY_EXPIRED,
      );
    }

    void this.repository
      .update(key.id, { lastUsedAt: new Date() })
      .catch((err) => {
        console.error(
          `Failed to update lastUsedAt for API Key ${key.id}:`,
          err,
        );
      });

    return key;
  }
}
