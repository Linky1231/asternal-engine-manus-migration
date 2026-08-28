/**
 * Google OAuth authentication via Google Identity Services (GIS).
 * Replaces the previous Manus OAuth system.
 */

export type ManusSessionUser = {
  openId?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

const STORAGE_KEY = "_ast_google_session";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById("google-gsi-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("No se pudo cargar Google Identity Services."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

type AuthCallback = (user: ManusSessionUser) => void;
let activeCallback: AuthCallback | null = null;

function handleCredentialResponse(response: { credential: string }) {
  const payload = decodeJwt(response.credential);
  if (!payload) return;
  const user: ManusSessionUser = {
    openId: payload.sub as string,
    id: payload.sub as string,
    name: (payload.name as string) ?? null,
    email: (payload.email as string) ?? null,
    picture: (payload.picture as string) ?? null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  activeCallback?.(user);
}

/**
 * Initializes Google Identity Services.
 * @param onSuccess Called when a user successfully signs in.
 */
export async function initGoogleAuth(onSuccess?: AuthCallback): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Falta VITE_GOOGLE_CLIENT_ID.");

  activeCallback = onSuccess ?? null;
  await loadGoogleScript();

  window.google?.accounts?.id?.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
  });
}

/**
 * Renders the standard "Continue with Google" button inside the given element.
 */
export async function renderGoogleButton(
  element: HTMLElement,
  onSuccess: AuthCallback,
): Promise<void> {
  await initGoogleAuth(onSuccess);
  window.google?.accounts?.id?.renderButton(element, {
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width: 360,
  });
}

/** Reads the stored Google session from localStorage (no network call). */
export async function getManusSessionUser(): Promise<ManusSessionUser | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as ManusSessionUser;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return null;
}

/** Returns the stable user ID from the session, if any. */
export function getManusUserId(user: ManusSessionUser | null): string | null {
  return user?.openId ?? user?.id ?? null;
}

/** Triggers the Google One Tap prompt. */
export function startMultimodalLogin(): void {
  window.google?.accounts?.id?.prompt();
}

/** Clears the stored Google session. */
export async function signOut(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  window.google?.accounts?.id?.disableAutoSelect?.();
}
