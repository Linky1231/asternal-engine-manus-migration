import { useEffect, useState } from "react";
import type { Profile } from "@/lib/social/api";
import { getManusSessionUser, startMultimodalLogin } from "@/lib/auth/manus";

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
        import("@/lib/social/api").then(({ getMyProfile }) => {
          getMyProfile().then(p => {
            if (mounted) {
              setUser(p as Profile | null);
              setIsLoading(false);
            }
          }).catch(() => { if (mounted) setIsLoading(false); });
        });
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
    startMultimodalLogin();
  };

  const signOut = async () => {
    await fetch("/api/manus/logout", { method: "POST", credentials: "include" });
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
