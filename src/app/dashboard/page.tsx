"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, KeyRound, UserCog, X } from "lucide-react";
import toast from "react-hot-toast";
import { NetworkExplorer, type ExplorerSession } from "@/components/NetworkExplorer";
import { ChangePasswordSheet } from "@/components/ChangePasswordSheet";
import { ContactEditForm } from "@/components/ContactEditForm";
import { FullScreenLoader } from "@/components/Spinner";

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

  if (!session) return <FullScreenLoader />;

  const initial = session.name[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
            style={{
              backgroundColor: session.roleBgColor ?? "#e0e7ff",
              color:           session.roleColor ?? "#4f46e5",
            }}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{session.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{session.roleLabel}</p>
          </div>
          <button onClick={() => setShowMenu(true)}
            className="p-2.5 text-gray-600 bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
            title="Menu">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowMenu(false)} />
          <div className="relative bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl sheet-anim overflow-hidden">
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
                  style={{
                    backgroundColor: session.roleBgColor ?? "#e0e7ff",
                    color:           session.roleColor ?? "#4f46e5",
                  }}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{session.name}</p>
                  <p className="text-[11px] text-gray-500">{session.roleLabel}</p>
                </div>
                <button onClick={() => setShowMenu(false)} className="text-gray-400 active:text-gray-600 p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-3">
              <MenuButton
                icon={UserCog} iconBg="bg-brand-50" iconColor="text-brand-600"
                title="Meu cadastro"
                desc="Complete ou atualize seus dados pessoais"
                onClick={() => { setShowMenu(false); setShowProfile(true); }} />
              <MenuButton
                icon={KeyRound} iconBg="bg-blue-50" iconColor="text-blue-600"
                title="Trocar senha"
                desc="Altere sua senha de acesso"
                onClick={() => { setShowMenu(false); setShowPwd(true); }} />
              <div className="border-t border-gray-100 my-2" />
              <MenuButton
                icon={LogOut} iconBg="bg-red-50" iconColor="text-red-600"
                title="Sair" titleColor="text-red-600"
                desc="Encerrar sessão"
                onClick={logout} />
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

function MenuButton({ icon: Icon, iconBg, iconColor, title, titleColor = "text-gray-900", desc, onClick }: any) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left active:bg-gray-50 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${titleColor}`}>{title}</p>
        <p className="text-[11px] text-gray-500 truncate">{desc}</p>
      </div>
    </button>
  );
}
