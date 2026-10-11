import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt with OWASP-recommended cost (N=2^17, r=8, p=1). Built into Node; no dependency.
const N = 2 ** 17;
const r = 8;
const p = 1;
const KEYLEN = 32;
const MAXMEM = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 12;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

// Format: scrypt$N$r$p$saltBase64$hashBase64 — parameters stored so they can be raised later.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, { N, r, p, maxmem: MAXMEM });
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, rr, pp, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export { generatePassword } from "./password-generator";
