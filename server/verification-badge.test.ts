import { describe, expect, it } from "vitest";
import { isVerificationAdministrator, VERIFICATION_ADMIN_EMAIL } from "../src/lib/social/verification";

describe("badge de verificación", () => {
  it("autoriza únicamente el correo administrador confirmado", () => {
    expect(isVerificationAdministrator(VERIFICATION_ADMIN_EMAIL)).toBe(true);
    expect(isVerificationAdministrator(` ${VERIFICATION_ADMIN_EMAIL.toUpperCase()} `)).toBe(true);
    expect(isVerificationAdministrator("otro@example.com")).toBe(false);
    expect(isVerificationAdministrator(undefined)).toBe(false);
  });
});
