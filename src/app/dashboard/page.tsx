"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Network, Settings, KeyRound, UserCog, X } from "lucide-react";
import toast from "react-hot-toast";
import { NetworkExplorer, type ExplorerSession } from "@/components/NetworkExplorer";
import { ChangePasswordSheet } from "@/components/ChangePasswordSheet";
import { ContactEditForm } from "@/components/ContactEditForm";

interface MemberSession {
  type: "member";
  contactId: string; slug: string; name: string;
  roleLevel: number; roleLabel: string;
  roleColor?: string; roleBgColor?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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
          <button onClick={() => setShowMenu(true)}
            className="p-2 text-gray-600 border border-gray-200 rounded-lg active:bg-gray-50"
            title="Menu">
            <Settings size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <NetworkExplorer session={{
          isAdmin: false,
          contactId: session.contactId,
          name: session.name,
          slug: session.slug,
          roleLevel: session.roleLevel,
          roleLabel: session.roleLabel,
          roleColor: session.roleColor,
          roleBgColor: session.roleBgColor,
        } as ExplorerSession} />
      </main>

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMenu(false)} />
          <div className="relative bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl shadow-2xl sheet-anim">
            <div className="md:hidden flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-900">Configurações</p>
              <button onClick={() => setShowMenu(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-3 space-y-1.5">
              <button onClick={() => { setShowMenu(false); setShowProfile(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:bg-gray-50">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <UserCog size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Meu cadastro</p>
                  <p className="text-[11px] text-gray-500">Complete ou atualize seus dados pessoais</p>
                </div>
              </button>
              <button onClick={() => { setShowMenu(false); setShowPwd(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:bg-gray-50">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <KeyRound size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Trocar senha</p>
                  <p className="text-[11px] text-gray-500">Altere sua senha de acesso</p>
                </div>
              </button>
              <button onClick={logout}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:bg-red-50">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <LogOut size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-red-600 text-sm">Sair</p>
                  <p className="text-[11px] text-gray-500">Encerrar sessão</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPwd && <ChangePasswordSheet onClose={() => setShowPwd(false)} />}
      {showProfile && (
        <ContactEditForm
          contactId={session.contactId}
          onClose={() => setShowProfile(false)}
          onSaved={() => setShowProfile(false)} />
      )}
    </div>
  );
}
