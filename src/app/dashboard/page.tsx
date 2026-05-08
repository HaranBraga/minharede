"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NetworkBrowser } from "@/components/NetworkBrowser";

interface Session {
  type: "admin" | "member";
  contactId?: string; slug?: string; name?: string;
  roleLevel?: number; roleLabel?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.session) { router.replace("/login"); return; }
      if (d.session.type === "admin") { router.replace("/admin"); return; }
      setSession(d.session);
    });
  }, [router]);

  if (!session) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;

  const subtitle = session.name
    ? `${session.name} · ${session.roleLabel ?? ""}`
    : "Minha rede";

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle={subtitle} showAdminLink={false} />
      <main className="max-w-3xl mx-auto px-4 py-4">
        <NetworkBrowser session={session} />
      </main>
    </div>
  );
}
