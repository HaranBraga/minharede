"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Network, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Spinner, FullScreenLoader } from "@/components/Spinner";

export default function Page() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.session?.type === "admin") router.replace("/admin");
      else if (d?.session?.type === "member") router.replace("/dashboard");
    }).catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Credenciais inválidas");
        return;
      }
      router.replace("/dashboard");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center px-4 py-8">
      {/* Decoração de fundo */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full bg-brand-500 opacity-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-brand-700 opacity-10 blur-3xl" />

      <div className="w-full max-w-sm relative animate-scale-in">
        {/* Hero/logo */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-600/25">
            <Network size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Minha Rede</h1>
          <p className="text-sm text-gray-500 mt-1">Acesse seu painel</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-900/5 ring-1 ring-gray-900/5 p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Usuário</label>
              <input required value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                placeholder="seu usuário" autoFocus autoCapitalize="none" spellCheck={false}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3.5 text-base focus:outline-none focus:bg-white focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <input required type={showPwd ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3.5 pr-12 text-base focus:outline-none focus:bg-white focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition-all" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 active:text-gray-600">
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button disabled={busy}
              className="w-full mt-2 bg-gradient-to-br from-brand-600 to-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3.5 text-base flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition-transform">
              {busy ? <Spinner size={18} className="text-white" /> : (
                <>Entrar <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
