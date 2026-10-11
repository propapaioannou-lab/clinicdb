import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";

describe("password", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password here", stored)).toBe(false);
  });

  it("salts every hash differently", async () => {
    expect(await hashPassword("same password!")).not.toBe(await hashPassword("same password!"));
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("generates long, unambiguous, unique passwords", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const pw = generatePassword();
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
      expect(pw.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
      seen.add(pw);
    }
    expect(seen.size).toBe(1000);
  });
});
