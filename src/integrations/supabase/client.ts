/**
 * Asternal Local Database
 * ─────────────────────────
 * Complete localStorage-backed replacement for Supabase.
 * No external services needed. All auth, data, and storage
 * lives in the browser via localStorage.
 */


// ───── Types ─────

type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type LocalSession = {
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: string;
};

type QueryFilter = {
  type: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains' | 'not';
  column: string;
  value: unknown;
};

type QueryOrder = { column: string; ascending: boolean; nullsFirst?: boolean };

type SelectJoin = { column: string; relation: string; relationColumn: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult = { data: any; error: Error | null; count: number | null };

// ───── Helpers ─────

function uid(): string { return crypto.randomUUID(); }
function now(): string { return new Date().toISOString(); }

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h.toString(36) + '_' + s.length.toString(36);
}

function getTableData<T = Record<string, unknown>>(table: string): T[] {
  try { const raw = localStorage.getItem(`_local_data_${table}`); return raw ? JSON.parse(raw) as T[] : []; }
  catch { return []; }
}

function saveTableData(table: string, data: unknown[]): void {
  localStorage.setItem(`_local_data_${table}`, JSON.stringify(data));
}

const MANUS_COLLECTIONS = new Set([
  "profiles", "posts", "comments", "reactions", "reposts", "follows", "notifications", "reports", "blocks",
  "tags", "post_tags", "post_polls", "post_poll_votes", "game_purchases", "game_plays", "orbe_transactions",
  "forum_categories", "forum_threads", "forum_posts", "forum_thread_votes", "forum_votes", "chats", "chat_members",
  "chat_messages", "stickers", "events", "event_submissions", "event_participants", "trust_points_history",
]);

function isManusCollection(table: string): boolean { return MANUS_COLLECTIONS.has(table); }

async function manusRecordRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "No se pudo sincronizar con Manus.");
  return body as T;
}

function persistManusRecord(table: string, row: Record<string, unknown>): void {
  if (!isManusCollection(table) || !row.id) return;
  void manusRecordRequest(`/api/manus/records/${encodeURIComponent(table)}`, {
    method: "POST",
    body: JSON.stringify({ id: row.id, data: row }),
  }).catch(() => { /* La copia local se reintenta al volver a sincronizar. */ });
}

function removeManusRecord(table: string, id: unknown): void {
  if (!isManusCollection(table) || typeof id !== "string") return;
  void manusRecordRequest(`/api/manus/records/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => { /* La copia local conserva el estado hasta la siguiente sesión. */ });
}

/** Carga en local las colecciones asociadas a la sesión oficial de Manus. */
export async function hydrateManusCollections(): Promise<{ id: string; name?: string | null } | null> {
  if (typeof window === "undefined") return null;
  const session = await manusRecordRequest<{ user: { id: string; name?: string | null } }>("/api/manus/session");
  const marker = localStorage.getItem("_ast_manus_open_id");
  if (marker !== session.user.id) {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith("_local_data_") || key?.startsWith("_local_storage_")));
    keys.forEach(key => localStorage.removeItem(key));
    localStorage.setItem("_ast_manus_open_id", session.user.id);
  }
  await Promise.all([...MANUS_COLLECTIONS].map(async collection => {
    const rows = await manusRecordRequest<Record<string, unknown>[]>(`/api/manus/records/${encodeURIComponent(collection)}`);
    saveTableData(collection, rows);
  }));
  return session.user;
}

function applyFilters(rows: Record<string, unknown>[], filters: QueryFilter[]): Record<string, unknown>[] {
  return rows.filter(row => filters.every(f => {
    const val = row[f.column];
    switch (f.type) {
      case 'eq': return val === f.value;
      case 'neq': return val !== f.value;
      case 'gt': return val != null && f.value != null && Number(val) > Number(f.value);
      case 'gte': return val != null && f.value != null && Number(val) >= Number(f.value);
      case 'lt': return val != null && f.value != null && Number(val) < Number(f.value);
      case 'lte': return val != null && f.value != null && Number(val) <= Number(f.value);
      case 'like': return typeof val === 'string' && typeof f.value === 'string' && new RegExp(`^${(f.value as string).replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(val);
      case 'ilike': return typeof val === 'string' && typeof f.value === 'string' && new RegExp(`^${(f.value as string).replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(val);
      case 'is': return f.value === null ? (val === null || val === undefined) : val === f.value;
      case 'in': return Array.isArray(f.value) && (f.value as unknown[]).includes(val);
      case 'contains': return Array.isArray(val) && (f.value as unknown[])?.every(v => (val as unknown[]).includes(v));
      case 'not': return f.value === null ? (val !== null && val !== undefined) : val !== f.value;
      default: return true;
    }
  }));
}

function parseSelectColumns(select: string): { columns: string[]; joins: SelectJoin[] } {
  const columns: string[] = []; const joins: SelectJoin[] = [];
  for (const part of select.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '*') { columns.push('*'); continue; }
    const match = trimmed.match(/^(\w+)\((\w+)\)$/);
    if (match) { joins.push({ column: match[1], relation: match[1], relationColumn: match[2] }); columns.push(match[1]); }
    else { columns.push(trimmed); }
  }
  return { columns, joins };
}

function resolveJoins(rows: Record<string, unknown>[], joins: SelectJoin[]): Record<string, unknown>[] {
  if (!joins.length) return rows;
  for (const join of joins) {
    for (const row of rows) {
      const fkValue = row[join.column];
      if (fkValue == null) continue;
      const relatedData = getTableData(join.relation);
      const related = relatedData.find(r => (r as Record<string, unknown>).id === fkValue);
      if (related) {
        const r = related as Record<string, unknown>;
        row[join.column] = join.relationColumn === 'name' ? { name: r.name } : join.relationColumn === '*' ? related : { [join.relationColumn]: r[join.relationColumn] };
      } else { row[join.column] = null; }
    }
  }
  return rows;
}

function orFilter(rows: Record<string, unknown>[], filterString: string): Record<string, unknown>[] {
  return rows.filter(row => filterString.split(',').some(cond => {
    const parts = cond.split('.');
    if (parts.length < 2) return false;
    const column = parts[0], op = parts[1];
    let value: unknown = null;
    if (parts.length >= 3) { const vs = parts.slice(2).join('.'); value = vs === 'null' ? null : vs; }
    else value = true;
    const val = row[column];
    switch (op) {
      case 'eq': return val === value;
      case 'neq': return val !== value;
      case 'is': return value === null ? (val === null || val === undefined) : val === value;
      case 'ilike': return typeof val === 'string' && typeof value === 'string' && new RegExp(`^${(value as string).replace(/%/g, '.*')}$`, 'i').test(val);
      default: return false;
    }
  }));
}

// ───── Auth ─────

function getAuthUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem('_local_auth_users') || '[]') as LocalUser[]; }
  catch { return []; }
}
function saveAuthUsers(users: LocalUser[]): void { localStorage.setItem('_local_auth_users', JSON.stringify(users)); }

function getSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem('_local_auth_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as LocalSession;
    if (new Date(session.expiresAt) < new Date()) { localStorage.removeItem('_local_auth_session'); return null; }
    return session;
  } catch { return null; }
}
function saveSession(user: LocalUser): LocalSession {
  const s: LocalSession = { userId: user.id, email: user.email, accessToken: simpleHash(user.id + now()), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
  localStorage.setItem('_local_auth_session', JSON.stringify(s)); return s;
}
function clearSession(): void { localStorage.removeItem('_local_auth_session'); }

function ensureProfileExists(userId: string, email: string, username?: string): void {
  const profiles = getTableData('profiles');
  if (profiles.find(p => (p as Record<string, unknown>).id === userId)) return;
  const username_ = username || email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');    profiles.push({
    id: userId, username: username_, display_name: null, avatar_url: null, bio: null,
    banner_url: null, pronouns: null, location: null, status_text: null, status_emoji: null,
    accent_color: null, favorite_genre: null, custom_title: null, birthday: null,
    show_orbes: true, theme_mode: 'dark', interests: [], orbes: 100, is_plus: false,
    show_plus_badge: false, avatar_frame: null, social_links: null, last_plus_claim_at: null,
    plus_expires_at: null, name_effect: null, profile_background: null, post_effect: null,
    creator_card_style: null, featured_post_id: null, created_at: now(), updated_at: now(),
  });
  saveTableData('profiles', profiles);

  // Auto-assign admin role to the owner email
  if (email === 'Linkyteam989@gmail.com') {
    const roles = getTableData<Record<string, unknown>>('user_roles');
    if (!roles.find(r => r.user_id === userId && r.role === 'admin')) {
      roles.push({ user_id: userId, role: 'admin' });
      saveTableData('user_roles', roles);
    }
  }
}

// ───── Auth handlers ─────

type AuthCallback = (event: string, session: Record<string, unknown> | null) => void;
let authChangeSubscribers: AuthCallback[] = [];
function notifyAuth(event: string, s: LocalSession | null): void {
  const sessionPayload = s ? { user: { id: s.userId, email: s.email }, access_token: s.accessToken, expires_at: new Date(s.expiresAt).getTime() / 1000 } : null;
  authChangeSubscribers.forEach(cb => cb(event, sessionPayload as never));
}

function makeUserObj(u: LocalUser): Record<string, unknown> { return { id: u.id, email: u.email }; }
function makeSessionObj(u: LocalUser, s: LocalSession): Record<string, unknown> {
  return { user: makeUserObj(u), access_token: s.accessToken, expires_at: new Date(s.expiresAt).getTime() / 1000 };

}
function makeSignInResult(u: LocalUser, s: LocalSession) {
  return { data: { user: makeUserObj(u), session: makeSessionObj(u, s) }, error: null };
}

const localAuth = {
  getSession: async () => {
    const s = getSession();
    return { data: { session: s ? { user: { id: s.userId, email: s.email }, access_token: s.accessToken, expires_at: new Date(s.expiresAt).getTime() / 1000 } : null }, error: null };
  },
  getUser: async () => {
    const s = getSession();
    return { data: { user: s ? { id: s.userId, email: s.email } : null }, error: null };
  },
  setSession: async ({ access_token, expires_at, user }: { access_token: string; refresh_token?: string; expires_at?: number; user?: { id?: string; email?: string; user_metadata?: { username?: string; manus_username?: string } } }) => {
    if (!user?.id || !user.email) return { data: { session: null }, error: new Error('Sesión Supabase incompleta') };
    // El enlace server-side crea la identidad real, pero el cliente local de
    // compatibilidad también necesita materializar el perfil para que la UI no
    // quede autenticada con un encabezado vacío cuando no hay anon key local.
    ensureProfileExists(user.id, user.email, user.user_metadata?.username || user.user_metadata?.manus_username);
    const session: LocalSession = {
      userId: user.id,
      email: user.email,
      accessToken: access_token,
      expiresAt: new Date((expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
    };
    localStorage.setItem('_local_auth_session', JSON.stringify(session));
    notifyAuth('SIGNED_IN', session);
    return { data: { session: { user: { id: user.id, email: user.email }, access_token, expires_at }, error: null } };
  },
  signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: { username?: string } } }) => {
    const users = getAuthUsers();
    if (users.find(u => u.email === email.toLowerCase())) return { data: { user: null, session: null }, error: new Error('Este email ya está registrado') };
    const id = uid();
    const user: LocalUser = { id, email: email.toLowerCase(), passwordHash: simpleHash(password), createdAt: now() };
    users.push(user); saveAuthUsers(users);
    ensureProfileExists(id, email, options?.data?.username);
    const session = saveSession(user); notifyAuth('SIGNED_IN', session);
    return makeSignInResult(user, session) as { data: { user: Record<string, unknown>; session: Record<string, unknown> }; error: null };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const users = getAuthUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user || user.passwordHash !== simpleHash(password)) return { data: { user: null, session: null }, error: new Error('Email o contraseña incorrectos') };
    ensureProfileExists(user.id, user.email);
    const session = saveSession(user); notifyAuth('SIGNED_IN', session);
    return makeSignInResult(user, session) as { data: { user: Record<string, unknown>; session: Record<string, unknown> }; error: null };
  },
  signInWithOAuth: async () => ({ data: null, error: new Error('OAuth no disponible en modo local') }),
  signOut: async () => { clearSession(); notifyAuth('SIGNED_OUT', null); return { error: null }; },
  resetPasswordForEmail: async (email: string) => {
    const users = getAuthUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (user) localStorage.setItem('_local_auth_reset_token', JSON.stringify({ email: user.email, userId: user.id, expiresAt: new Date(Date.now() + 3600000).toISOString() }));
    return { data: null, error: null };
  },
  updateUser: async ({ password }: { password: string }) => {
    const s = getSession();
    if (!s) return { data: { user: null }, error: new Error('No hay sesión activa') };
    const users = getAuthUsers();
    const idx = users.findIndex(u => u.id === s.userId);
    if (idx === -1) return { data: { user: null }, error: new Error('Usuario no encontrado') };
    users[idx].passwordHash = simpleHash(password); saveAuthUsers(users);
    return { data: { user: { id: s.userId, email: s.email } }, error: null };
  },
  onAuthStateChange: (callback: AuthCallback) => {
    authChangeSubscribers.push(callback);
    const s = getSession();
    callback('INITIAL_SESSION', s ? { user: { id: s.userId, email: s.email }, access_token: s.accessToken } as never : null);
    return { data: { subscription: { unsubscribe: () => { authChangeSubscribers = authChangeSubscribers.filter(cb => cb !== callback); } } } };
  },
};

// ───── Query Builder ─────

class LocalQueryBuilder {
  private table: string;
  private filters: QueryFilter[] = [];
  private orderBy: QueryOrder[] = [];
  private limitCount: number | null = null;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private selectColumns = '*';
  private isInsertOp = false;
  private isUpdateOp = false;
  private isDeleteOp = false;
  private insertData: Record<string, unknown> | null = null;
  private updateData: Record<string, unknown> | null = null;
  private orFilterStr: string | null = null;

  constructor(table: string) { this.table = table; }

  select(columns?: string): this { this.selectColumns = columns || '*'; return this; }
  eq(col: string, val: unknown): this { this.filters.push({ type: 'eq', column: col, value: val }); return this; }
  neq(col: string, val: unknown): this { this.filters.push({ type: 'neq', column: col, value: val }); return this; }
  gt(col: string, val: unknown): this { this.filters.push({ type: 'gt', column: col, value: val }); return this; }
  gte(col: string, val: unknown): this { this.filters.push({ type: 'gte', column: col, value: val }); return this; }
  lt(col: string, val: unknown): this { this.filters.push({ type: 'lt', column: col, value: val }); return this; }
  lte(col: string, val: unknown): this { this.filters.push({ type: 'lte', column: col, value: val }); return this; }
  like(col: string, val: string): this { this.filters.push({ type: 'like', column: col, value: val }); return this; }
  ilike(col: string, val: string): this { this.filters.push({ type: 'ilike', column: col, value: val }); return this; }
  is(col: string, val: unknown): this { this.filters.push({ type: 'is', column: col, value: val }); return this; }
  in(col: string, vals: unknown[]): this { this.filters.push({ type: 'in', column: col, value: vals }); return this; }
  contains(col: string, val: unknown[]): this { this.filters.push({ type: 'contains', column: col, value: val }); return this; }
  not(col: string, op: string, val: unknown): this {
    if (op === 'eq') this.filters.push({ type: 'neq', column: col, value: val });
    else if (op === 'is') this.filters.push({ type: 'not', column: col, value: val });
    return this;
  }
  or(filterString: string): this { this.orFilterStr = filterString; return this; }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy.push({ column: col, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst }); return this;
  }
  limit(n: number): this { this.limitCount = n; return this; }
  range(start: number, end: number): this { this.rangeStart = start; this.rangeEnd = end; return this; }
  single(): this { this.singleMode = 'single'; return this; }
  maybeSingle(): this { this.singleMode = 'maybeSingle'; return this; }
  insert(data: Record<string, unknown> | Record<string, unknown>[]): this { this.isInsertOp = true; this.insertData = Array.isArray(data) ? data[0] : data; return this; }
  update(data: Record<string, unknown>): this { this.isUpdateOp = true; this.updateData = data; return this; }
  delete(): this { this.isDeleteOp = true; return this; }

  private execute(): QueryResult {
    if (this.isInsertOp) return this.execInsert();
    if (this.isUpdateOp) return this.execUpdate();
    if (this.isDeleteOp) return this.execDelete();
    return this.execSelect();
  }

  private execInsert(): QueryResult {
    const rows = getTableData(this.table);
    const newRow: Record<string, unknown> = { ...(this.insertData || {}), id: (this.insertData?.id as string) || uid(), created_at: now(), updated_at: now() };
    rows.push(newRow); saveTableData(this.table, rows);
    persistManusRecord(this.table, newRow);
    if (this.singleMode) return { data: this.project(newRow), error: null, count: null };
    return { data: [this.project(newRow)], error: null, count: null };
  }

  private execUpdate(): QueryResult {
    const rows = getTableData<Record<string, unknown>>(this.table);
    const filtered = applyFilters(rows, this.filters);
    for (const row of filtered) Object.assign(row, this.updateData || {}, { updated_at: now() });
    saveTableData(this.table, rows);
    filtered.forEach(row => persistManusRecord(this.table, row));
    if (this.singleMode) return { data: filtered.length ? this.project(filtered[0]) : null, error: null, count: null };
    return { data: filtered.map(r => this.project(r)), error: null, count: null };
  }

  private execDelete(): QueryResult {
    const rows = getTableData<Record<string, unknown>>(this.table);
    const filtered = applyFilters(rows, this.filters);
    const deletedIds = new Set(filtered.map(r => r.id));
    saveTableData(this.table, rows.filter(r => !deletedIds.has(r.id)));
    filtered.forEach(row => removeManusRecord(this.table, row.id));
    return { data: filtered.map(r => this.project(r)), error: null, count: null };
  }

  private execSelect(): QueryResult {
    let rows = getTableData<Record<string, unknown>>(this.table);
    rows = applyFilters(rows, this.filters);
    if (this.orFilterStr) rows = orFilter(rows, this.orFilterStr);
    for (const order of this.orderBy) {
      rows.sort((a, b) => {
        const va = a[order.column], vb = b[order.column];
        if (va == null && vb == null) return 0;
        if (va == null) return order.nullsFirst ? -1 : 1;
        if (vb == null) return order.nullsFirst ? 1 : -1;
        if (typeof va === 'string' && typeof vb === 'string') return order.ascending ? va.localeCompare(vb) : vb.localeCompare(va);
        return order.ascending ? Number(va) - Number(vb) : Number(vb) - Number(va);
      });
    }
    if (this.limitCount !== null && rows.length > this.limitCount) rows = rows.slice(0, this.limitCount);
    if (this.rangeStart !== null && this.rangeEnd !== null) rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    const { columns, joins } = parseSelectColumns(this.selectColumns);
    rows = rows.map(r => this.project(r, columns));
    rows = resolveJoins(rows, joins);
    if (this.singleMode === 'maybeSingle') return { data: rows[0] || null, error: null, count: null };
    if (this.singleMode === 'single') return rows.length ? { data: rows[0], error: null, count: null } : { data: null, error: new Error('Row not found'), count: null };
    return { data: rows, error: null, count: rows.length };
  }

  private project(row: Record<string, unknown>, columns?: string[]): Record<string, unknown> {
    if (!columns || columns.length === 0 || columns[0] === '*' || columns[0] === '') return { ...row };
    const p: Record<string, unknown> = {};
    for (const col of columns) p[col] = col in row ? row[col] : null;
    return p;
  }

  then<TResult1 = QueryResult>(resolve?: ((v: QueryResult) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((r: unknown) => TResult1 | PromiseLike<TResult1>) | null): Promise<TResult1> {
    return Promise.resolve(this.execute()).then(resolve as (v: QueryResult) => TResult1 | PromiseLike<TResult1>, reject);
  }
  catch<TResult = never>(reject?: ((r: unknown) => TResult | PromiseLike<TResult>) | null): Promise<QueryResult | TResult> { return this.then(undefined, reject); }
  finally(onFinally?: (() => void) | null): Promise<QueryResult> { return this.then().finally(onFinally!); }
}

// ───── Storage ─────

function compressImage(file: File | Blob, maxDim: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => {
        if (b) resolve(b);
        else reject(new Error('Canvas compression failed'));
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function isImageFile(file: File | Blob): boolean {
  return file.type?.startsWith('image/') ?? false;
}

function makeStorageBucket(bucket: string) {
  return {
    upload: async (path: string, file: File | Blob, _opts?: Record<string, unknown>) => {
      try {
        // Compress images before storing to avoid localStorage quota issues
        let finalFile = file;
        if (isImageFile(file)) {
          const maxDim = path.includes('avatar') || path.includes('banner') ? 400 : 1200;
          finalFile = await compressImage(file, maxDim);
        }
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('File read failed'));
          reader.readAsDataURL(finalFile);
        });

        // If this key already exists, remove it first to stay under quota
        const key = `_local_storage_${bucket}_${path}`;
        const existingSize = localStorage.getItem(key)?.length ?? 0;
        localStorage.removeItem(key);

        // Try to set; if quota error, evict oldest stored keys
        try {
          localStorage.setItem(key, dataUrl);
        } catch {
          // Evict old stored media to free space
          const prefix = '_local_storage_';
          const keys: { k: string; ts: number }[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(prefix)) {
              try {
                const raw = localStorage.getItem(k) ?? '';
                keys.push({ k, ts: raw.length });
              } catch { /* skip */ }
            }
          }
          // Remove largest files first until we have room
          keys.sort((a, b) => b.ts - a.ts);
          for (const entry of keys) {
            localStorage.removeItem(entry.k);
            try {
              localStorage.setItem(key, dataUrl);
              break;
            } catch { /* keep evicting */ }
          }
        }
        return { data: { path }, error: null };
      } catch (e) { return { data: null, error: e as Error }; }
    },
    createSignedUrl: async (path: string, _expiresIn?: number) => {
      const dataUrl = localStorage.getItem(`_local_storage_${bucket}_${path}`);
      if (dataUrl) return { data: { signedUrl: dataUrl }, error: null };
      if (/^https?:\/\//.test(path) || /^data:/.test(path)) return { data: { signedUrl: path }, error: null };
      return { data: null, error: new Error('File not found') };
    },
    getPublicUrl: (path: string) => {
      const dataUrl = localStorage.getItem(`_local_storage_${bucket}_${path}`);
      return { data: { publicUrl: dataUrl || '' } };
    },
    list: async () => ({ data: [], error: null }),
    remove: async (paths: string | string[]) => {
      const list = Array.isArray(paths) ? paths : [paths];
      for (const p of list) localStorage.removeItem(`_local_storage_${bucket}_${p}`);
      return { data: null, error: null };
    },
  };
}

const localStorageBackend = { from: (bucket: string) => makeStorageBucket(bucket) };

// ───── RPC ─────

const localRpc = async (fn: string, _args?: Record<string, unknown>) => {
  switch (fn) {
    case 'purchase_game': return { data: { ok: true, free: true }, error: null };
    case 'purchase_artwork': {
      const postId = _args?._post_id as string;
      if (!postId) return { data: { ok: false, paid: 0 }, error: null };
      const posts = getTableData('posts');
      const post = posts.find(p => (p as Record<string, unknown>).id === postId);
      if (!post) return { data: { ok: false }, error: null };
      const price = (post as Record<string, unknown>).price_orbes as number || 0;
      const authorId = (post as Record<string, unknown>).author_id as string;
      const { data: { user } } = await localAuth.getUser();
      if (!user) return { data: { ok: false }, error: null };
      if (user.id === authorId) return { data: { ok: true, free: true, paid: 0 }, error: null };
      const profiles = getTableData('profiles');
      const buyerIdx = profiles.findIndex(p => (p as Record<string, unknown>).id === user.id);
      const sellerIdx = profiles.findIndex(p => (p as Record<string, unknown>).id === authorId);
      if (buyerIdx === -1) return { data: { ok: false }, error: null };
      const buyerOrbes = (profiles[buyerIdx] as Record<string, unknown>).orbes as number || 0;
      if (buyerOrbes < price) return { data: { ok: false, paid: 0, balance: buyerOrbes }, error: null };
      // Check if already owned
      const purchases = getTableData('game_purchases');
      if (purchases.find(p => (p as Record<string, unknown>).post_id === postId && (p as Record<string, unknown>).user_id === user.id)) {
        return { data: { ok: false, already_owned: true }, error: null };
      }
      // Deduct from buyer
      profiles[buyerIdx] = { ...profiles[buyerIdx], orbes: buyerOrbes - price } as Record<string, unknown>;
      // Credit seller
      if (sellerIdx !== -1) {
        const sellerOrbes = (profiles[sellerIdx] as Record<string, unknown>).orbes as number || 0;
        profiles[sellerIdx] = { ...profiles[sellerIdx], orbes: sellerOrbes + price } as Record<string, unknown>;
      }
      saveTableData('profiles', profiles);
      // Record purchase
      purchases.push({
        id: uid(), post_id: postId, user_id: user.id, created_at: now(),
      } as never);
      saveTableData('game_purchases', purchases);
      return { data: { ok: true, paid: price, balance: buyerOrbes - price }, error: null };
    }
    case 'claim_plus_orbes': {
      const { data: { user } } = await localAuth.getUser();
      if (!user) return { data: { ok: false }, error: null };
      const profiles = getTableData('profiles');
      const idx = profiles.findIndex(p => (p as Record<string, unknown>).id === user.id);
      if (idx === -1) return { data: { ok: false }, error: null };
      const prof = profiles[idx] as Record<string, unknown>;
      const last = prof.last_plus_claim_at as string | null;
      if (last) {
        const next = new Date(new Date(last).getTime() + 30 * 86400000).toISOString();
        if (new Date(last).getTime() + 30 * 86400000 > Date.now()) {
          return { data: { ok: false, already_claimed: true, next_at: next }, error: null };
        }
      }
      const nowIso = now();
      profiles[idx] = { ...prof, orbes: (prof.orbes as number ?? 0) + 10000, last_plus_claim_at: nowIso };
      saveTableData('profiles', profiles);
      const nextAt = new Date(Date.now() + 30 * 86400000).toISOString();
      return { data: { ok: true, amount: 10000, next_at: nextAt }, error: null };
    }
    case 'forum_vote_thread': {
      const threadId = _args?._thread_id as string;
      const userId = _args?._user_id as string;
      const vote = _args?._vote as 'up' | 'down';
      const threads = getTableData('forum_threads');
      const thread = threads.find(t => (t as Record<string, unknown>).id === threadId);
      if (!thread) return { data: { upvotes: 0, downvotes: 0 }, error: null };
      const t = thread as Record<string, unknown>;
      let votes = getTableData<Record<string, unknown>>('forum_thread_votes');
      const existing = votes.find(v => v.thread_id === threadId && v.user_id === userId);
      if (existing) {
        if (existing.vote === 'up') t.upvotes = Math.max(0, (t.upvotes as number ?? 0) - 1);
        if (existing.vote === 'down') t.downvotes = Math.max(0, (t.downvotes as number ?? 0) - 1);
        votes = votes.filter(v => !(v.thread_id === threadId && v.user_id === userId));
      }
      if (existing?.vote === vote) {
        saveTableData('forum_threads', threads);
        saveTableData('forum_thread_votes', votes);
        return { data: { upvotes: t.upvotes, downvotes: t.downvotes }, error: null };
      }
      votes.push({ thread_id: threadId, user_id: userId, vote });
      if (vote === 'up') t.upvotes = (t.upvotes as number ?? 0) + 1;
      if (vote === 'down') t.downvotes = (t.downvotes as number ?? 0) + 1;
      saveTableData('forum_threads', threads);
      saveTableData('forum_thread_votes', votes);
      return { data: { upvotes: t.upvotes, downvotes: t.downvotes }, error: null };
    }
    case 'forum_vote_post': {
      const postId = _args?._post_id as string;
      const userId = _args?._user_id as string;
      const vote = _args?._vote as 'up' | 'down';
      const posts = getTableData('forum_posts');
      const post = posts.find(p => (p as Record<string, unknown>).id === postId);
      if (!post) return { data: { upvotes: 0, downvotes: 0 }, error: null };
      const p = post as Record<string, unknown>;
      let votes = getTableData<Record<string, unknown>>('forum_votes');
      const existing = votes.find(v => v.post_id === postId && v.user_id === userId);
      if (existing) {
        if (existing.vote === 'up') p.upvotes = Math.max(0, (p.upvotes as number ?? 0) - 1);
        if (existing.vote === 'down') p.downvotes = Math.max(0, (p.downvotes as number ?? 0) - 1);
        votes = votes.filter(v => !(v.post_id === postId && v.user_id === userId));
      }
      if (existing?.vote === vote) {
        saveTableData('forum_posts', posts);
        saveTableData('forum_votes', votes);
        return { data: { upvotes: p.upvotes, downvotes: p.downvotes }, error: null };
      }
      votes.push({ post_id: postId, user_id: userId, vote });
      if (vote === 'up') p.upvotes = (p.upvotes as number ?? 0) + 1;
      if (vote === 'down') p.downvotes = (p.downvotes as number ?? 0) + 1;
      saveTableData('forum_posts', posts);
      saveTableData('forum_votes', votes);
      return { data: { upvotes: p.upvotes, downvotes: p.downvotes }, error: null };
    }
    case 'forum_bump_views': {
      const threadId = _args?._thread_id as string;
      const threads = getTableData('forum_threads');
      const thread = threads.find(t => (t as Record<string, unknown>).id === threadId);
      if (thread) {
        (thread as Record<string, unknown>).views = ((thread as Record<string, unknown>).views as number ?? 0) + 1;
        saveTableData('forum_threads', threads);
      }
      return { data: null, error: null };
    }
    case 'forum_touch_thread': {
      const threadId = _args?._thread_id as string;
      const author = (_args?._author as string) ?? '';
      const threads = getTableData('forum_threads');
      const thread = threads.find(t => (t as Record<string, unknown>).id === threadId);
      if (thread) {
        const t = thread as Record<string, unknown>;
        const posts = getTableData('forum_posts');
        t.post_count = posts.filter(p => (p as Record<string, unknown>).thread_id === threadId).length;
        t.last_post_at = now();
        t.last_post_author = author;
        t.updated_at = now();
        saveTableData('forum_threads', threads);
      }
      return { data: null, error: null };
    }
    case 'activate_plus': return { data: { ok: true, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }, error: null };
    case 'can_play_game': return { data: true, error: null };
    case 'expire_lapsed_plus': return { data: [], error: null };
    default: return { data: null, error: new Error(`RPC "${fn}" no implementada`) };
  }
};

// ───── Realtime mock ─────

const localChannels: Record<string, { unsubscribe: () => void }> = {};

const localRealtime = {
  channels: () => Object.values(localChannels),
};

// ───── LocalClient interface ─────

interface LocalClient {
  auth: typeof localAuth;
  from(table: string): LocalQueryBuilder;
  storage: typeof localStorageBackend;
  rpc: typeof localRpc;
  channel(name?: string): { on: (event: string, config: Record<string, unknown>, callback: (payload: Record<string, unknown>) => void) => { subscribe(callback?: (status: string) => void): { unsubscribe: () => void }; unsubscribe: () => void } };
  removeChannel(c: { unsubscribe: () => void }): void;
  realtime: typeof localRealtime;
  functions: { invoke: (fn: string) => Promise<{ data: unknown; error: Error | null }> };
}

function createLocalClient(): LocalClient {
  return {
    auth: localAuth,
    from: (table: string) => new LocalQueryBuilder(table),
    storage: localStorageBackend,
    rpc: localRpc,
    channel: (name?: string) => {
      const key = name || '_default';
      const ch = {
        on: (_event: string, _config: Record<string, unknown>, _cb: (p: Record<string, unknown>) => void) => {
          const sub = {
            subscribe: (_cb2?: (status: string) => void) => { _cb2?.('SUBSCRIBED'); return sub; },
            unsubscribe: () => { delete localChannels[key]; },
          };
          localChannels[key] = sub;
          return sub;
        },
        unsubscribe: () => { delete localChannels[key]; },
      };
      localChannels[key] = ch;
      return ch;
    },
    removeChannel: (c: { unsubscribe: () => void }) => c.unsubscribe(),
    realtime: localRealtime,
    functions: { invoke: async () => ({ data: null, error: new Error('Functions not available locally') }) },
  };
}

/* ───── Real Supabase client (when credentials exist) ─────
 *
 * Las credenciales se resuelven en este orden:
 *   1. Override guardado por el usuario en el diálogo de configuración
 *      (localStorage) — permite conectar sin depender de la inyección de
 *      variables de entorno al compilar.
 *   2. Variables de entorno de Vite (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *      inyectadas por el entorno desde el tab Keys.
 *   3. Credenciales por defecto incrustadas aquí (configuración única del
 *      administrador): así TODOS los dispositivos usan la misma base sin que
 *      nadie tenga que pegar claves. La anon key es pública por diseño — la
 *      seguridad real la da RLS en la base de datos.
 */

export type SaveCredentialsResult = { ok: boolean; error?: string };

/** @deprecated La migración a Manus no expone URL ni claves externas. */
export function getSupabaseUrl(): undefined { return undefined; }

/** @deprecated La migración a Manus no expone URL ni claves externas. */
export function getSupabaseAnonKey(): undefined { return undefined; }

/**
 * Guarda (o borra) las credenciales escritas a mano en el diálogo de
 * configuración. Valida el formato antes de guardar para evitar guardar un
 * token de acceso personal (sbp_…) como anon key, que rompería toda la app
 * con "Invalid API key".
 */
export function saveSupabaseCredentials(url: string, anonKey: string): SaveCredentialsResult {
  void url;
  void anonKey;
  return { ok: false, error: "La configuración externa fue retirada; Asternal ahora usa los servicios de Manus." };
}

export function clearSupabaseCredentials(): void {
  // No se almacenan credenciales externas en el navegador.
}

export function hasSupabaseConfig(): boolean {
  return false;
}

/**
 * Detecta errores de PostgREST cuando una tabla aún no existe en la base de
 * datos (esquema sin crear). La app usa esto para degradar a listas vacías en
 * lugar de crashear mientras el usuario configura Supabase.
 */
export function isSchemaMissing(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string"
    ? err
    : (err as { message?: string })?.message ?? "";
  const code = (err as { code?: string })?.code ?? "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /could not find the table/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /undefined_table/i.test(msg)
  );
}

function createSupabaseClient(): LocalClient {
  // Adaptador de transición: no realiza llamadas a Supabase. Las colecciones
  // se migrarán gradualmente a los servicios autenticados de Manus.
  return createLocalClient();
}

let _supabase: LocalClient | undefined;

export const supabase = new Proxy({} as LocalClient, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
