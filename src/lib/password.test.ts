import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

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
});
