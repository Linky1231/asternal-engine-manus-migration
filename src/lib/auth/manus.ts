import { encodeOAuthState, MULTIMODAL_LINK_COOKIE, OAUTH_STATE_COOKIE } from "../../../shared/const";

export type ManusSessionUser = {
  openId?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
};

/** Recupera la identidad vigente desde la cookie segura de Manus. */
export async function getManusSessionUser(): Promise<ManusSessionUser | null> {
  const response = await fetch("/api/manus/session", { credentials: "include" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as { user?: ManusSessionUser } | null;
  return payload?.user ?? null;
}

/** Devuelve el identificador estable del usuario Manus si hay sesión activa. */
export function getManusUserId(user: ManusSessionUser | null): string | null {
  return user?.openId ?? user?.id ?? null;
}

/** Inicia el OAuth de Manus y marca el retorno como vinculación multimodal. */
export function startMultimodalLogin(): void {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  const appId = import.meta.env.VITE_APP_ID as string | undefined;
  if (!oauthPortalUrl || !appId) throw new Error("Falta la configuración OAuth de Manus.");

  // El callback debe pertenecer al origen que realmente abrió el OAuth.
  // No se adivina ni se sustituye por un dominio fijo: el portal valida esta
  // URI y el backend recibe el mismo host que estableció las cookies.
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  document.cookie = `${MULTIMODAL_LINK_COOKIE}=1; Path=/; Max-Age=600; SameSite=None; Secure`;

  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  window.location.href = url.toString();
}
