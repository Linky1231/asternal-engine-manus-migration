import { useEffect, useState } from "react";
import type { Profile } from "@/lib/social/api";
import { getManusSessionUser, signOut } from "@/lib/auth/manus";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    getManusSessionUser().then(sessionUser => {
      if (!mounted) return;
      const hasSession = !!sessionUser;
      setIsAuthenticated(hasSession);
      if (hasSession) {
        // Build a minimal profile from the Google session data.
        const profile: Profile = {
          id: sessionUser!.openId ?? sessionUser!.id ?? "",
          username: (sessionUser!.name ?? sessionUser!.email ?? "user").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 32),
          display_name: sessionUser!.name ?? null,
          avatar_url: sessionUser!.picture ?? null,
          bio: null,
          show_orbes: true,
        };
        setUser(profile);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }).catch(() => { if (mounted) setIsLoading(false); });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (_method?: string, _formData?: FormData) => {
    void _method;
    void _formData;
    // The auth page handles the Google sign-in flow.
    window.location.href = "/auth";
  };

  const signOutUser = async () => {
    await signOut();
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut: signOutUser,
  };
}
