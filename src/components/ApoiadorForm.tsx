"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";

const CIDADES_AC = [
  "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba",
  "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima",
  "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre",
  "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus",
  "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri",
];

interface Props {
  target: { id: string; name: string; role: { label: string; level: number } };
  liderSlug?: string;
  coordSlug?: string;
}

function formatPhoneBR(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function formatDateBR(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2)  return d;
  if (d.length <= 4)  return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

export function ApoiadorForm({ target, liderSlug, coordSlug }: Props) {
  const [form, setForm] = useState({
    nome: "", telefone: "", dataNascimento: "",
    genero: "", generoOutro: "",
    rua: "", bairro: "", cidade: "", zona: "Urbana",
    lgpd: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField(k: string, v: any) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim())          e.nome = "Obrigatório";
    if (!form.telefone.trim() || form.telefone.replace(/\D/g, "").length < 10) e.telefone = "Telefone inválido";
    if (!form.dataNascimento.match(/^\d{2}\/\d{2}\/\d{4}$/)) e.dataNascimento = "Use DD/MM/AAAA";
    if (!form.genero)               e.genero = "Selecione";
    if (form.genero === "Outro" && !form.generoOutro.trim()) e.generoOutro = "Especifique";
    if (!form.rua.trim())           e.rua = "Obrigatório";
    if (!form.bairro.trim())        e.bairro = "Obrigatório";
    if (!form.cidade)               e.cidade = "Selecione";
    if (!form.lgpd)                 e.lgpd = "Você precisa concordar";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Verifique os campos");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone,
          dataNascimento: form.dataNascimento,
          genero: form.genero === "Outro" ? form.generoOutro : form.genero,
          rua: form.rua,
          bairro: form.bairro,
          cidade: form.cidade,
          zona: form.zona,
          liderSlug,
          coordSlug,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Falha no envio");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Realizado!</h2>
          <p className="text-gray-500 text-sm mb-6">Seus dados foram recebidos. Nossa equipe entrará em contato em breve.</p>
          <button
            onClick={() => { setDone(false); setForm({
              nome: "", telefone: "", dataNascimento: "",
              genero: "", generoOutro: "",
              rua: "", bairro: "", cidade: "", zona: "Urbana", lgpd: false,
            }); }}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm"
          >
            Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-colors text-sm";
  const inpErr = inp + " border-red-400 ring-1 ring-red-200";

  return (
    <div className="min-h-screen flex items-center justify-center md:p-4">
      <div className="max-w-xl w-full bg-white md:rounded-2xl md:shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-7 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white opacity-5"></div>
          <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-white opacity-5"></div>
          <h1 className="text-2xl font-bold text-white relative">Formulário de Cadastro</h1>
          <p className="text-blue-100 mt-1 text-sm relative">
            Convidado por <span className="font-semibold">{target.name}</span>
            <span className="text-[11px] block opacity-75 mt-0.5">{target.role.label}</span>
          </p>
        </div>

        <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
            <input value={form.nome} onChange={e => setField("nome", e.target.value)}
              className={errors.nome ? inpErr : inp} placeholder="Digite seu nome" />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
              <input value={form.dataNascimento}
                onChange={e => setField("dataNascimento", formatDateBR(e.target.value))}
                placeholder="DD/MM/AAAA" maxLength={10}
                className={errors.dataNascimento ? inpErr : inp} />
              {errors.dataNascimento && <p className="text-xs text-red-500 mt-1">{errors.dataNascimento}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp) *</label>
              <input value={form.telefone}
                onChange={e => setField("telefone", formatPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000" maxLength={15}
                className={errors.telefone ? inpErr : inp} />
              {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gênero *</label>
            <div className="flex flex-wrap gap-5">
              {["Masculino", "Feminino", "Outro"].map(g => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="genero" value={g} checked={form.genero === g}
                    onChange={() => setField("genero", g)}
                    className="w-4 h-4 text-brand-600 focus:ring-brand-600" />
                  <span className="text-sm text-gray-700">{g}</span>
                </label>
              ))}
            </div>
            {form.genero === "Outro" && (
              <input value={form.generoOutro}
                onChange={e => setField("generoOutro", e.target.value)}
                placeholder="Especifique..." className={errors.generoOutro ? inpErr : inp + " mt-3"} />
            )}
            {errors.genero && <p className="text-xs text-red-500 mt-1">{errors.genero}</p>}
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-medium text-gray-900 mb-3">Endereço</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rua e Número *</label>
                <input value={form.rua} onChange={e => setField("rua", e.target.value)}
                  placeholder="Ex: Rua das Flores, 123" className={errors.rua ? inpErr : inp} />
                {errors.rua && <p className="text-xs text-red-500 mt-1">{errors.rua}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
                  <input value={form.bairro} onChange={e => setField("bairro", e.target.value)}
                    placeholder="Ex: Centro" className={errors.bairro ? inpErr : inp} />
                  {errors.bairro && <p className="text-xs text-red-500 mt-1">{errors.bairro}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade (Acre) *</label>
                  <select value={form.cidade} onChange={e => setField("cidade", e.target.value)}
                    className={errors.cidade ? inpErr : inp + " bg-white"}>
                    <option value="">Selecione a cidade</option>
                    {CIDADES_AC.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.cidade && <p className="text-xs text-red-500 mt-1">{errors.cidade}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Zona de Residência *</label>
                <div className="flex gap-5">
                  {["Urbana", "Rural"].map(z => (
                    <label key={z} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="zona" value={z} checked={form.zona === z}
                        onChange={() => setField("zona", z)}
                        className="w-4 h-4 text-brand-600 focus:ring-brand-600" />
                      <span className="text-sm text-gray-700">{z === "Urbana" ? "Zona Urbana" : "Zona Rural"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.lgpd}
                onChange={e => setField("lgpd", e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded focus:ring-brand-600" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">Concordo com a Política de Privacidade *</p>
                <p className="text-gray-600 mt-0.5 text-xs">
                  Concordo em fornecer meus dados para serem contatado com conteúdos e materiais. (Não fazemos spam.)
                </p>
              </div>
            </label>
            {errors.lgpd && <p className="text-xs text-red-500 mt-1 ml-7">{errors.lgpd}</p>}
          </div>

          <button disabled={submitting}
            className="w-full flex items-center justify-center bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg py-3 transition-colors">
            {submitting ? "Enviando..." : "Enviar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}
