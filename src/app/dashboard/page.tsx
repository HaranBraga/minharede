"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Network, Settings } from "lucide-react";
import toast from "react-hot-toast";
import { MemberDashboard } from "@/components/MemberDashboard";
import { ChangePasswordSheet } from "@/components/ChangePasswordSheet";

interface MemberSession {
  type: "member";
  contactId: string; slug: string; name: string;
  roleLevel: number; roleLabel: string;
  roleColor?: string; roleBgColor?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.session) { router.replace("/login"); return; }
      if (d.session.type === "admin") { router.replace("/admin"); return; }
      setSession(d.session);
    });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  if (!session) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/dashboard" className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white shrink-0">
            <Network size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Minha Rede</p>
            <p className="text-[11px] text-gray-500 truncate">{session.roleLabel}</p>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 border border-gray-200 rounded-lg active:bg-gray-50"
            title="Trocar senha">
            <Settings size={14} />
          </button>
          <button onClick={logout}
            className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-2 rounded-lg flex items-center gap-1.5 active:bg-gray-50">
            <LogOut size={12} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <MemberDashboard session={session} />
      </main>

      {showSettings && <ChangePasswordSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}
