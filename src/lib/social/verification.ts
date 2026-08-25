export const VERIFICATION_ADMIN_EMAIL = "linkyteam989@gmail.com";

export function isVerificationAdministrator(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === VERIFICATION_ADMIN_EMAIL;
}
