import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) throw new Error("ENCRYPTION_KEY is missing or too short (min 16 chars)");
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Output: v1:<iv>:<tag>:<ciphertext> (base64). */
export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** "sk-abc...wxyz" style hint so the UI can identify a key without revealing it. */
export function keyHint(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

/** Verify Meta's X-Hub-Signature-256 header. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
