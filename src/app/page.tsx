"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApoiadorForm } from "@/components/ApoiadorForm";
import { FullScreenLoader } from "@/components/Spinner";

export default function Page() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Home />
    </Suspense>
  );
}

/**
 * Landing pública.
 *
 * URLs públicas (formulário do apoiador):
 *   - /?lider=NOME       → formulário vinculado ao líder
 *   - /?coord_form=NOME  → formulário vinculado ao coord
 *
 * URL de coord/líder NÃO É MAIS auto-login pelo nome (segurança):
 *   - /?coord=NOME       → redireciona pro /login (precisa user+senha)
 *
 * Sem param: redireciona pro login (ou painel se logado).
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
    // ?coord=X → SEM auto-login. Manda pro /login (segurança).
    if (coord && !lider && !coordForm) {
      router.replace("/login");
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

    // ?lider=X → busca coord do líder pra preencher hidden
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

    // ?coord_form=X → form com coord pré-vinculado
    if (coordForm) {
      setTarget({ id: "", name: coordForm, coordinator: coordForm });
      setLoading(false);
      return;
    }
  }, [lider, coord, coordForm, router]);

  if (loading) {
    return <FullScreenLoader />;
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
    return <ApoiadorForm target={target}
      liderSlug={lider ?? undefined}
      coordSlug={coordForm ?? undefined} />;
  }
  return null;
}
