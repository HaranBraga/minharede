"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApoiadorForm } from "@/components/ApoiadorForm";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>}>
      <Home />
    </Suspense>
  );
}

/**
 * Landing pública. Reproduz a dinâmica dos links do formelider:
 *   - ?coord=NOME      → AUTO-LOGIN do coord (mesma URL antiga)
 *   - ?coord_form=NOME → formulário do apoiador, vinculado direto ao coord
 *   - ?lider=NOME      → formulário do apoiador, vinculado ao líder
 *   - sem param        → redireciona pro login (ou painel se logado)
 */
function Home() {
  const router = useRouter();
  const sp = useSearchParams();
  const lider     = sp.get("lider");
  const coord     = sp.get("coord");
  const coordForm = sp.get("coord_form");

  const [target, setTarget] = useState<{ id: string; name: string; coordinator: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ?coord=X → auto-login (igual formelider antigo)
    if (coord && !lider && !coordForm) {
      fetch("/api/auth/login-by-name", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: coord }),
      }).then(async r => {
        if (r.ok) {
          // Limpa ?coord= da URL antes de ir pro dashboard
          window.history.replaceState({}, "", window.location.pathname);
          router.replace("/dashboard");
        } else {
          // Se não achou, manda pro login com nome pré-preenchido
          router.replace(`/login?suggest=${encodeURIComponent(coord)}`);
        }
      }).catch(() => router.replace("/login"));
      return;
    }

    // Sem param: vai pro painel se logado, senão login
    if (!lider && !coordForm) {
      fetch("/api/auth/me").then(r => r.json()).then(d => {
        if (d?.session?.type === "admin") router.replace("/admin");
        else if (d?.session?.type === "member") router.replace("/dashboard");
        else router.replace("/login");
      });
      return;
    }

    // ?lider= → busca coord do líder pra preencher hidden no form
    if (lider) {
      fetch(`/api/leaders/by-name/${encodeURIComponent(lider)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.data) { setErrorMsg("Link inválido."); return; }
          setTarget({ id: d.data.id, name: d.data.name, coordinator: d.data.coordinator || "" });
        })
        .catch(() => setErrorMsg("Erro ao carregar."))
        .finally(() => setLoading(false));
      return;
    }

    // ?coord_form= → form com coord pré-vinculado (sem buscar no banco)
    if (coordForm) {
      setTarget({ id: "", name: coordForm, coordinator: coordForm });
      setLoading(false);
      return;
    }
  }, [lider, coord, coordForm, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;
  }
  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Link inválido</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }
  if (target) {
    return <ApoiadorForm
      target={target}
      liderSlug={lider ?? undefined}
      coordSlug={coordForm ?? undefined}
    />;
  }
  return null;
}
