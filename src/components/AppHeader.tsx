"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, Network } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  title?: string;
  subtitle?: string;
  showAdminLink?: boolean;
}

export function AppHeader({ title = "Minha Rede", subtitle, showAdminLink }: Props) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white shrink-0">
          <Network size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
        </div>
        {showAdminLink && (
          <Link href="/admin" className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 active:bg-amber-100">
            <ShieldCheck size={12} /> Admin
          </Link>
        )}
        <button onClick={logout}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 active:bg-gray-50">
          <LogOut size={12} /> Sair
        </button>
      </div>
    </header>
  );
}
