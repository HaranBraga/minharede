"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Network } from "lucide-react";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [busy, setBusy]         = useState(false);

  // Se já estiver logado, redireciona
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) {
        const isAdminLike = d.user.isAdmin || d.user.roleLevel === 0;
        router.replace(isAdminLike && from === "/dashboard" ? "/admin" : from);
      }
    }).catch(() => {});
  }, [router, from]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Falha no login");
        return;
      }
      const d = await r.json();
      const isAdminLike = d.user.isAdmin || d.user.roleLevel === 0;
      router.replace(isAdminLike ? "/admin" : "/dashboard");
    } finally { setBusy(false); }
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
            <p className="text-xs text-gray-500 mt-1">Entre com seu usuário e senha</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuário</label>
              <input
                required autoFocus value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                autoCapitalize="none" spellCheck={false}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  required type={showPwd ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 active:text-gray-600">
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button disabled={busy}
              className="w-full mt-2 bg-brand-600 active:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-base">
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
        <p className="text-xs text-gray-400 text-center mt-5 px-4">
          Não tem usuário? Solicite ao administrador da sua rede.
        </p>
      </div>
    </div>
  );
}
