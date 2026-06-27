import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const masterKey = Buffer.from(env.MASTER_ENCRYPTION_KEY, "hex");
const ALGO = "aes-256-gcm";

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGO, masterKey, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export function maskApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return "••••";
  const prefixMatch = trimmed.match(/^[a-zA-Z]+-+/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const last4 = trimmed.slice(-4);
  return `${prefix}••••${last4}`;
}
