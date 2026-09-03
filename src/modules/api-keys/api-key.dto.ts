import type { ApiKey } from "@prisma/client";

export type PublicApiKey = Omit<ApiKey, "keyHash">;

export type CreatedApiKey = PublicApiKey & {
  rawKey: string;
};

export function toPublicApiKey({
  keyHash: _keyHash,
  ...apiKey
}: ApiKey): PublicApiKey {
  return apiKey;
}
