type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: SupabaseUser;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta la configuración de Supabase en el servidor.");
  return { url, key };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.msg === "string" ? body.msg : typeof body?.message === "string" ? body.message : `Supabase respondió ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export async function listSupabaseUsers(): Promise<SupabaseUser[]> {
  return request<SupabaseUser[]>("/auth/v1/admin/users?page=1&per_page=1000");
}

export async function createSupabaseUser(input: { email: string; password: string; metadata: Record<string, unknown> }): Promise<SupabaseUser> {
  return request<SupabaseUser>("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: input.email, password: input.password, email_confirm: true, user_metadata: input.metadata }) });
}

export async function updateSupabaseUser(id: string, input: { password: string; metadata: Record<string, unknown> }): Promise<SupabaseUser> {
  return request<SupabaseUser>(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ password: input.password, user_metadata: input.metadata }) });
}

export async function upsertSupabaseProfile(input: { id: string; username: string; displayName: string }): Promise<void> {
  await request<unknown>("/rest/v1/profiles?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: input.id, username: input.username, display_name: input.displayName, updated_at: new Date().toISOString() }) });
}

export async function verifySupabaseProfile(id: string): Promise<{ id: string; username: string }> {
  const rows = await request<Array<{ id: string; username: string }>>(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,username&limit=1`);
  const profile = rows[0];
  if (!profile?.id) throw new Error("Supabase no confirmó la fila del perfil sincronizado.");
  return profile;
}

export async function signInSupabaseUser(email: string, password: string): Promise<SupabaseSession> {
  return request<SupabaseSession>("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
}
