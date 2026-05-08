"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, ShieldCheck, ChevronLeft } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-amber-50 to-white">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl p-7">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-500 mt-1">Acesso administrativo</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <input required type={showPwd ? "text" : "password"} value={pwd}
                  onChange={e => setPwd(e.target.value)} autoFocus
                  placeholder="Digite a senha de admin"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button disabled={busy}
              className="w-full bg-amber-500 active:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-base">
              {busy ? "Entrando..." : "Entrar como admin"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/login" className="inline-flex items-center gap-1 text-[11px] text-gray-400 active:text-gray-600">
            <ChevronLeft size={12} /> Voltar pro login normal
          </Link>
        </div>
      </div>
    </div>
  );
}
