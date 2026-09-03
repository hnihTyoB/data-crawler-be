import crypto from "crypto";
import { envConfig } from "../../config/env.config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Gets the encryption key buffer from config.
 * Supports both 32-byte hex strings and falls back to UTF-8 parsing with padding.
 */
function getEncryptionKey(): Buffer {
  const keyStr = envConfig.webhook.encryptionKey;
  if (/^[0-9a-fA-F]{64}$/.test(keyStr)) {
    return Buffer.from(keyStr, "hex");
  }
  // Fallback / safety pad/truncation to exactly 32 bytes
  const hashed = crypto.createHash("sha256").update(keyStr).digest();
  return hashed;
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns string format: "iv:authTag:encryptedText" (hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted text
 * Expects format: "iv:authTag:encryptedText" (hex encoded)
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted text format. Must be "iv:authTag:ciphertext"',
    );
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = Buffer.from(parts[2], "hex");

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid authentication tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

export function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verifySignature(
  secret: string,
  body: string,
  signature: string,
): boolean {
  const expectedSignature = signPayload(secret, body);

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSignature, "utf8"),
  );
}
