import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SubPageHeader } from "@/components/social/SubPageHeader";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { isMod as checkMod } from "@/lib/social/api";
import { getManusSessionUser, getManusUserId } from "@/lib/auth/manus";

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({ meta: [{ title: "Perfil · Asternal" }] }),
  component: ProfileByIdPage,
});

function ProfileByIdPage() {
  const navigate = useNavigate();
  const { userId } = useParams({ from: "/profile/$userId" });
  const [myId, setMyId] = useState<string | null>(null);
  const [mod, setMod] = useState(false);

  useEffect(() => {
    (async () => {
      const myId = getManusUserId(await getManusSessionUser().catch(() => null));
      if (!myId) { navigate({ to: "/auth", search: { returnTo: `/profile/${userId}` } }); return; }
      setMyId(myId);
      setMod(await checkMod());
    })();
  }, [navigate]);

  if (!myId) return null;
  const viewingOwn = myId === userId;
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <SubPageHeader
        title={viewingOwn ? "MI PERFIL" : "PERFIL"}
        subtitle={`@${userId.slice(0, 10)}…`}
      />
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-3 py-3 pb-24">
        <ProfilePanel key={userId} userId={userId} myId={myId} isMod={mod} viewingOwn={viewingOwn} />
      </main>
    </div>
  );
}
