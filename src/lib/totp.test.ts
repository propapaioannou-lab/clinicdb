import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, verifyTotp, generateTotpSecret, otpauthUrl } from "./totp";

// Official test values from RFC 6238 (SHA-1 key "12345678901234567890", 8 digits).
const RFC_KEY = Buffer.from("12345678901234567890");
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("totp", () => {
  it("matches the RFC 6238 test vectors", () => {
    for (const [t, code] of RFC_VECTORS) expect(hotp(RFC_KEY, Math.floor(t / 30), 8)).toBe(code);
  });

  it("round-trips base32", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Encode(RFC_KEY)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("accepts the current code and ±30 s drift, not more", () => {
    const secret = base32Encode(RFC_KEY);
    const now = new Date(1111111111 * 1000);
    const step = Math.floor(1111111111 / 30);
    const code = (s: number) => hotp(RFC_KEY, s);
    expect(verifyTotp(secret, code(step), now, null)).toBe(step);
    expect(verifyTotp(secret, code(step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(secret, code(step + 1), now, null)).toBe(step + 1);
    expect(verifyTotp(secret, code(step - 2), now, null)).toBeNull();
    expect(verifyTotp(secret, "12345", now, null)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now, null)).toBeNull();
  });

  it("never accepts the same code twice", () => {
    const secret = base32Encode(RFC_KEY);
    const now = new Date(1111111111 * 1000);
    const step = Math.floor(1111111111 / 30);
    const used = verifyTotp(secret, hotp(RFC_KEY, step), now, null);
    expect(verifyTotp(secret, hotp(RFC_KEY, step), now, used)).toBeNull();
    expect(verifyTotp(secret, hotp(RFC_KEY, step - 1), now, used)).toBeNull();
  });

  it("builds an authenticator-app link", () => {
    expect(otpauthUrl("ABC", "a@b.gr", "ClinicDB")).toBe(
      "otpauth://totp/ClinicDB%3Aa%40b.gr?secret=ABC&issuer=ClinicDB&algorithm=SHA1&digits=6&period=30",
    );
  });
});
