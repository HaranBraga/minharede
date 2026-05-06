"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApoiadorForm } from "@/components/ApoiadorForm";
import toast from "react-hot-toast";

/**
 * Landing pública.
 * Detecta query params e renderiza o fluxo certo:
 *   - ?lider=NOME       → formulário do apoiador, vinculado ao líder
 *   - ?coord_form=NOME  → formulário do apoiador, vinculado direto ao coord
 *   - ?coord=NOME       → auto-login do coord (precisa user vinculado a esse Contact)
 *   - sem param         → redireciona pra /login
 */
export default function HomePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const liderSlug     = sp.get("lider");
  const coordSlug     = sp.get("coord");
  const coordFormSlug = sp.get("coord_form");

  const [target, setTarget] = useState<{ id: string; name: string; role: { label: string; level: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Auto-login do coord — cookie HttpOnly não dá pra setar via JS, então
    // o ?coord=X só serve pra direcionar — o user precisa fazer login normal.
    if (coordSlug) {
      // Persiste o slug pra pré-preencher username no login se ele tiver username = slug
      router.replace(`/login?from=/dashboard&suggest=${encodeURIComponent(coordSlug)}`);
      return;
    }

    const slug = liderSlug || coordFormSlug;
    if (!slug) {
      // Sem nenhum param — manda pro login
      router.replace("/login");
      return;
    }

    fetch(`/api/public/resolve-slug?slug=${encodeURIComponent(slug)}`)
      .then(async r => {
        if (!r.ok) {
          setErrorMsg("Link inválido ou contato não encontrado.");
          return;
        }
        const d = await r.json();
        setTarget(d.contact);
      })
      .catch(() => setErrorMsg("Erro ao carregar."))
      .finally(() => setLoading(false));
  }, [liderSlug, coordSlug, coordFormSlug, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Link inválido</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (target) {
    return (
      <ApoiadorForm
        target={target}
        liderSlug={liderSlug || undefined}
        coordSlug={coordFormSlug || undefined}
      />
    );
  }

  return null;
}
