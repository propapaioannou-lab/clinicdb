import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// Keys derived from APP_SECRET (in .env). Changing APP_SECRET makes stored 2FA secrets
// unreadable, so everyone would have to set up 2FA again.
function key(purpose: string): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET missing or too short (see .env.example)");
  return Buffer.from(hkdfSync("sha256", secret, "clinicdb", purpose, 32));
}

// AES-256-GCM. Format: iv.tag.ciphertext (base64url).
export function encrypt(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(stored: string, purpose: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Keyed fingerprint: useless without APP_SECRET, so a copied database cannot be brute-forced.
export function fingerprint(value: string, purpose: string): string {
  return createHmac("sha256", key(purpose)).update(value).digest("hex");
}
