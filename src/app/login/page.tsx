"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Network, ChevronRight, Eye, EyeOff } from "lucide-react";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>}>
      <LoginInner />
    </Suspense>
  );
}

interface CoordPub { id: string; name: string; publicSlug: string | null; }

function LoginInner() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [needsPwd, setNeedsPwd] = useState(false);
  const [coords, setCoords] = useState<CoordPub[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.session?.type === "admin") router.replace("/admin");
      else if (d?.session?.type === "member") router.replace("/dashboard");
    }).catch(() => {});
    fetch("/api/coordinators-public").then(r => r.json()).then(d => setCoords(d.data ?? [])).catch(() => setCoords([]));
  }, [router]);

  async function tryLogin(useId: string, pwd?: string) {
    setBusy(true);
    try {
      // Se passou senha, tenta /api/auth/login direto (username + password)
      if (pwd) {
        const r = await fetch("/api/auth/login", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: useId, password: pwd }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          toast.error(d.error || "Credenciais inválidas");
          return;
        }
        router.replace("/dashboard");
        return;
      }

      // Senão, tenta login pelo nome (sem senha)
      const r = await fetch("/api/auth/login-by-name", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: useId }),
      });
      if (r.ok) {
        router.replace("/dashboard");
        return;
      }
      // Se servidor disse que precisa de senha, mostra o campo
      const d = await r.json().catch(() => ({}));
      if (d?.error === "needs_password") {
        setNeedsPwd(true);
        toast("Esse contato tem senha. Informe abaixo.", { icon: "🔒" });
        return;
      }
      toast.error(d.error || "Não encontrado");
    } finally { setBusy(false); }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    tryLogin(identifier.trim(), password || undefined);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl p-7">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Network size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Minha Rede</h1>
            <p className="text-xs text-gray-500 mt-1">Acesse seu painel</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome ou usuário</label>
              <input value={identifier} onChange={e => { setIdentifier(e.target.value); setNeedsPwd(false); }}
                placeholder="Digite seu nome" autoFocus autoCapitalize="none"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Senha {needsPwd ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(se você tiver)</span>}
              </label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-brand-600" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button disabled={busy}
              className="w-full bg-brand-600 active:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-base">
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {coords && coords.length > 0 && !needsPwd && (
            <div className="mt-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400">ou clique no seu nome</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {coords.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => tryLogin(c.publicSlug ?? c.name)}
                    className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 active:bg-brand-50 active:border-brand-200 active:text-brand-700 flex items-center justify-between">
                    <span className="truncate">{c.name}</span>
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <Link href="/admin/login" className="text-[11px] text-gray-400 active:text-gray-600 underline">
            Acesso de administrador
          </Link>
        </div>
      </div>
    </div>
  );
}
