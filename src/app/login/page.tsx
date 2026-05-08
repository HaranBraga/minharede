"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Network, ChevronRight } from "lucide-react";

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
  const sp = useSearchParams();
  const [tab, setTab] = useState<"member" | "admin">("member");

  // Member (login pelo nome)
  const [name, setName] = useState("");
  const [coords, setCoords] = useState<CoordPub[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Admin
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Já logado? redireciona
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.session?.type === "admin") router.replace("/admin");
      else if (d?.session?.type === "member") router.replace("/dashboard");
    }).catch(() => {});
    fetch("/api/coordinators-public").then(r => r.json()).then(d => setCoords(d.data ?? [])).catch(() => setCoords([]));
  }, [router]);

  async function memberLogin(useName: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login-by-name", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: useName }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Não encontrado");
        return;
      }
      router.replace("/dashboard");
    } finally { setBusy(false); }
  }

  async function adminLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Senha incorreta");
        return;
      }
      router.replace("/admin");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-brand-50 to-white">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="text-center pt-7 pb-2">
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Network size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Minha Rede</h1>
            <p className="text-xs text-gray-500 mt-0.5">Acesse seu painel</p>
          </div>

          <div className="px-5 pt-3">
            <div className="flex gap-1 border-b border-gray-200">
              <button onClick={() => setTab("member")}
                className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  tab === "member" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-400"
                }`}>
                Coord / Líder
              </button>
              <button onClick={() => setTab("admin")}
                className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  tab === "admin" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-400"
                }`}>
                Admin
              </button>
            </div>
          </div>

          {tab === "member" ? (
            <div className="px-5 py-5 space-y-4">
              <form onSubmit={e => { e.preventDefault(); if (name.trim()) memberLogin(name.trim()); }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Digite seu nome" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-600" />
                <button disabled={busy}
                  className="mt-3 w-full bg-brand-600 active:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-base">
                  Entrar
                </button>
              </form>

              {coords && coords.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[11px] text-gray-400">ou clique no seu nome</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {coords.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => memberLogin(c.publicSlug ?? c.name)}
                        className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 active:bg-brand-50 active:border-brand-200 active:text-brand-700 flex items-center justify-between">
                        <span className="truncate">{c.name}</span>
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={adminLogin} className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha de admin</label>
                <div className="relative">
                  <input required type={showPwd ? "text" : "password"}
                    value={pwd} onChange={e => setPwd(e.target.value)}
                    placeholder="Digite a senha"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-brand-600" />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button disabled={busy}
                className="w-full bg-brand-600 active:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-base">
                Entrar como admin
              </button>
            </form>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-5 px-4">
          Não está na lista? Peça ao admin pra cadastrar você.
        </p>
      </div>
    </div>
  );
}
