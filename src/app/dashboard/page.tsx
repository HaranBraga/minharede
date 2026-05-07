"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NetworkBrowser } from "@/components/NetworkBrowser";

interface Me {
  id: string; name: string; isAdmin: boolean;
  contactId: string | null; roleLevel: number | null;
  contactSlug: string | null; contactName: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.replace("/login"); return; }
      setMe(d.user);
    });
  }, [router]);

  if (!me) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;

  const isAdminLike = me.isAdmin || me.roleLevel === 0;
  const subtitle = me.contactName
    ? `${me.contactName}${me.roleLevel != null ? ` · nível ${me.roleLevel}` : ""}`
    : me.name;

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle={subtitle} showAdminLink={isAdminLike} />
      <main className="max-w-3xl mx-auto px-4 py-4">
        <NetworkBrowser me={me} />
      </main>
    </div>
  );
}
