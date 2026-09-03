import type { ApiKey } from "../../common/types/database.types";

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
