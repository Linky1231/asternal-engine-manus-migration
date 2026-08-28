import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import { createManusRecord, deleteOwnManusRecord, getOwnManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "./manus-records";

const ROLE_COLLECTION = "admin_roles";

function cleanId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} no es válido.`);
  return value;
}

function requireOwner(openId: string) {
  if (!ENV.ownerOpenId || openId !== ENV.ownerOpenId) throw new Error("Solo la administración de Asternal puede realizar esta acción.");
}

function roleRecordId(openId: string) {
  return `role_${createHash("sha256").update(openId).digest("hex").slice(0, 59)}`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value as Record<string, unknown> } : {};
}

export async function isAdminForUser(openId: string): Promise<boolean> {
  return Boolean(ENV.ownerOpenId && openId === ENV.ownerOpenId);
}

export async function isModeratorForUser(openId: string): Promise<boolean> {
  if (await isAdminForUser(openId)) return true;
  if (!ENV.ownerOpenId) return false;
  const role = await getOwnManusRecord(ENV.ownerOpenId, roleRecordId(openId));
  return role?.collection === ROLE_COLLECTION && role.data.role === "moderator";
}

export async function listManagedUsersForAdmin(openId: string, rawSearch?: unknown) {
  requireOwner(openId);
  const search = typeof rawSearch === "string" ? rawSearch.trim().toLowerCase().slice(0, 80) : "";
  const profiles = await listPublicManusRecords("profiles");
  const roles = await listOwnManusRecords(ENV.ownerOpenId, ROLE_COLLECTION);
  const moderators = new Set(roles.filter(row => row.data.role === "moderator" && typeof row.data.user_id === "string").map(row => row.data.user_id as string));
  return profiles.map(row => {
    const profile = asObject(row.data);
    return {
      id: row.id,
      username: typeof profile.username === "string" ? profile.username : `user_${row.id.slice(-8)}`,
      display_name: typeof profile.display_name === "string" ? profile.display_name : null,
      avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
      trust_points: typeof profile.trust_points === "number" ? profile.trust_points : 0,
      is_mod: moderators.has(row.id) || row.id === ENV.ownerOpenId,
      is_admin: row.id === ENV.ownerOpenId,
      is_verified: profile.is_verified === true,
    };
  }).filter(profile => !search || profile.username.toLowerCase().includes(search) || profile.display_name?.toLowerCase().includes(search));
}

export async function setModeratorForAdmin(openId: string, rawUserId: unknown, enabled: unknown) {
  requireOwner(openId);
  const userId = cleanId(rawUserId, "La cuenta");
  if (userId === ENV.ownerOpenId) return { ok: true, is_mod: true };
  if (enabled !== true && enabled !== false) throw new Error("El estado de moderación no es válido.");
  const id = roleRecordId(userId);
  const existing = await getOwnManusRecord(ENV.ownerOpenId, id);
  if (enabled) {
    if (existing) await updateOwnManusRecord({ id, ownerOpenId: ENV.ownerOpenId, data: { user_id: userId, role: "moderator" }, visibility: "private" });
    else await createManusRecord({ id, collection: ROLE_COLLECTION, ownerOpenId: ENV.ownerOpenId, data: { user_id: userId, role: "moderator" }, visibility: "private" });
  } else if (existing?.collection === ROLE_COLLECTION) {
    await deleteOwnManusRecord(ENV.ownerOpenId, id);
  }
  return { ok: true, is_mod: enabled };
}

export async function setVerifiedForAdmin(openId: string, rawUserId: unknown, enabled: unknown) {
  requireOwner(openId);
  const userId = cleanId(rawUserId, "La cuenta");
  if (enabled !== true && enabled !== false) throw new Error("El estado de verificación no es válido.");
  const profile = await getOwnManusRecord(userId, userId);
  if (!profile || profile.collection !== "profiles") throw new Error("La cuenta no tiene un perfil de Manus.");
  const data = asObject(profile.data);
  data.is_verified = enabled;
  await updateOwnManusRecord({ id: userId, ownerOpenId: userId, data, visibility: "public" });
  return { ok: true, is_verified: enabled };
}
