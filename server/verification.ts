import { getCommunityVerification, getCommunityVerifications, setCommunityVerification } from "./db";

const DEFAULT_SUPABASE_URL = "https://gxpgczwkovertezeydkt.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cGdjendrb3ZlcnRlemV5ZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTk5NTUsImV4cCI6MjEwMTE5NTk1NX0.GGGjdgi2l2NmQBQ1pS8k37npT3p6hx9Sl5JF0DdQ9cM";
export const VERIFICATION_ADMIN_EMAIL = "linkyteam989@gmail.com";

export type SupabaseIdentity = { id: string; email: string | null };

function supabaseAuthUrl(): string {
  return (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
}

function supabaseAnonKey(): string {
  return process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
}

export async function authenticateSupabaseToken(authorization: string | undefined): Promise<SupabaseIdentity> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Inicia sesión para gestionar verificaciones.");
  const response = await fetch(`${supabaseAuthUrl()}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey(), Authorization: `Bearer ${token}` },
  });
  const user = await response.json().catch(() => null) as { id?: string; email?: string | null } | null;
  if (!response.ok || !user?.id) throw new Error("La sesión de Supabase no es válida.");
  return { id: user.id, email: user.email ?? null };
}

export async function readManusVerification(authorization: string | undefined, targetUserId: string): Promise<{ verified: boolean }> {
  await authenticateSupabaseToken(authorization);
  return { verified: await getCommunityVerification(targetUserId) };
}

export async function readManusVerifications(authorization: string | undefined, targetUserIds: string[]): Promise<{ verifiedUserIds: string[] }> {
  await authenticateSupabaseToken(authorization);
  const ids = Array.from(new Set(targetUserIds.filter(id => typeof id === "string" && id.trim()).map(id => id.trim()))).slice(0, 500);
  const verifiedUserIds = Array.from(await getCommunityVerifications(ids));
  return { verifiedUserIds };
}

export async function writeManusVerification(authorization: string | undefined, targetUserId: string, verified: boolean): Promise<{ verified: boolean }> {
  const identity = await authenticateSupabaseToken(authorization);
  if (identity.email?.trim().toLowerCase() !== VERIFICATION_ADMIN_EMAIL) {
    throw new Error("Solo linkyteam989@gmail.com puede gestionar verificaciones.");
  }
  return { verified: await setCommunityVerification(targetUserId, verified, VERIFICATION_ADMIN_EMAIL) };
}
