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
 * Landing pública.
 * Detecta query params e renderiza o fluxo certo:
 *   - ?lider=NOME       → formulário do apoiador, vinculado ao líder
 *   - ?coord_form=NOME  → formulário do apoiador, vinculado direto ao coord
 *   - ?coord=NOME       → redireciona pro login (sem auto-login — auth real)
 *   - sem param         → redireciona pro login (ou dashboard se logado)
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
    if (coord && !lider && !coordForm) {
      router.replace("/login");
      return;
    }
    if (!lider && !coordForm) {
      // sem nenhum param: tenta descobrir se está logado, senão login
      fetch("/api/auth/me").then(r => r.json()).then(d => {
        if (d?.user) router.replace("/dashboard");
        else router.replace("/login");
      });
      return;
    }
    const slug = lider || coordForm!;
    if (lider) {
      // tenta pegar o coord do líder
      fetch(`/api/leaders/by-name/${encodeURIComponent(slug)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.data) { setErrorMsg("Link inválido."); return; }
          setTarget({ id: d.data.id, name: d.data.name, coordinator: d.data.coordinator || "" });
        })
        .catch(() => setErrorMsg("Erro ao carregar."))
        .finally(() => setLoading(false));
    } else {
      // coord_form — só usa o nome direto
      setTarget({ id: "", name: coordForm!, coordinator: coordForm! });
      setLoading(false);
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
