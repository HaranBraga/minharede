"use client";
import { useState } from "react";
import { Check, FileText } from "lucide-react";
import toast from "react-hot-toast";

const CIDADES_AC = [
  "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba",
  "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima",
  "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre",
  "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus",
  "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri",
];

function maskPhone(v: string): string {
  const x = v.replace(/\D/g, "").match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
  if (!x) return v;
  return !x[2] ? x[1] : "(" + x[1] + ") " + x[2] + (x[3] ? "-" + x[3] : "");
}
function maskDate(v: string): string {
  const x = v.replace(/\D/g, "").match(/(\d{0,2})(\d{0,2})(\d{0,4})/);
  if (!x) return v;
  return !x[2] ? x[1] : x[1] + "/" + x[2] + (x[3] ? "/" + x[3] : "");
}
function capitalize(s: string): string {
  return s.replace(/(?:^|\s)[a-zà-ú]/g, m => m.toUpperCase());
}

interface Props {
  target: { id: string; name: string; coordinator: string };
  liderSlug?: string;
  coordSlug?: string;
}

export function ApoiadorForm({ target, liderSlug, coordSlug }: Props) {
  const [form, setForm] = useState({
    nome: "", data_nascimento: "", telefone: "", genero: "", genero_outro: "",
    rua: "", bairro: "", cidade: "", zona: "Urbana", lgpd: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showLgpd, setShowLgpd] = useState(false);

  function setField(k: keyof typeof form, v: any) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors(e => ({ ...e, [k]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.nome || form.nome.trim().length < 3) er.nome = "Nome é obrigatório.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.data_nascimento)) er.data_nascimento = "Data inválida (DD/MM/AAAA).";
    if (!form.telefone || form.telefone.replace(/\D/g, "").length < 10) er.telefone = "Telefone inválido.";
    if (!form.genero) er.genero = "Selecione.";
    if (form.genero === "Outro" && !form.genero_outro.trim()) er.genero = "Especifique.";
    if (!form.rua || form.rua.trim().length < 3) er.rua = "Rua é obrigatória.";
    if (!form.bairro || form.bairro.trim().length < 2) er.bairro = "Bairro é obrigatório.";
    if (!form.cidade) er.cidade = "Selecione a cidade.";
    if (!form.lgpd) er.lgpd = "Você deve aceitar a Política.";
    setErrors(er);
    if (Object.keys(er).length > 0) return;

    setBusy(true);
    try {
      const generoFinal = form.genero === "Outro" ? form.genero_outro.trim() || "Outro" : form.genero;
      const payload: any = {
        nome: form.nome,
        data_nascimento: form.data_nascimento,
        telefone: form.telefone.replace(/\D/g, ""),
        genero: generoFinal,
        rua: form.rua, bairro: form.bairro, cidade: form.cidade, zona: form.zona,
        lgpd: form.lgpd ? "on" : "",
        nome_lider: liderSlug || "",
        nome_coordenador: coordSlug || target.coordinator || "",
      };
      await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDone(true);
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm({ nome: "", data_nascimento: "", telefone: "", genero: "", genero_outro: "",
      rua: "", bairro: "", cidade: "", zona: "Urbana", lgpd: false });
    setErrors({});
    setDone(false);
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-colors";
  const inpErr = "w-full px-4 py-3 border border-red-400 ring-1 ring-red-200 rounded-xl text-base focus:outline-none";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center md:p-4 bg-gradient-to-br from-brand-50 to-white">
        <div className="max-w-md w-full bg-white md:rounded-2xl md:shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-100">
            <Check size={36} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Realizado!</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">Seus dados foram recebidos. Nossa equipe entrará em contato em breve.</p>
          <button onClick={reset} className="w-full bg-brand-600 active:bg-brand-700 text-white px-6 py-3 rounded-xl font-semibold">
            Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:p-4 bg-gradient-to-br from-brand-50 to-white flex items-start md:items-center justify-center">
      <div className="max-w-xl w-full bg-white md:rounded-2xl md:shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-7 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white opacity-10" />
          <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-white opacity-10" />
          <div className="relative">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Formulário de Cadastro</h1>
            <p className="text-brand-100 mt-1 text-sm">Convidado por <span className="font-semibold text-white">{target.name}</span></p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 md:p-8 space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome Completo *</label>
            <input value={form.nome} onChange={e => setField("nome", capitalize(e.target.value))}
              placeholder="Digite seu nome" className={errors.nome ? inpErr : inp} />
            {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nascimento *</label>
              <input value={form.data_nascimento} onChange={e => setField("data_nascimento", maskDate(e.target.value))}
                placeholder="DD/MM/AAAA" maxLength={10} inputMode="numeric"
                className={errors.data_nascimento ? inpErr : inp} />
              {errors.data_nascimento && <p className="text-red-500 text-xs mt-1">{errors.data_nascimento}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp *</label>
              <input type="tel" inputMode="numeric" value={form.telefone}
                onChange={e => setField("telefone", maskPhone(e.target.value))}
                placeholder="(00) 00000-0000" maxLength={15}
                className={errors.telefone ? inpErr : inp} />
              {errors.telefone && <p className="text-red-500 text-xs mt-1">{errors.telefone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gênero *</label>
            <div className="flex flex-wrap gap-4">
              {["Masculino", "Feminino", "Outro"].map(g => (
                <label key={g} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="genero" value={g} checked={form.genero === g}
                    onChange={() => setField("genero", g)}
                    className="w-4 h-4 text-brand-600 focus:ring-brand-600" />
                  <span className="text-gray-700">{g}</span>
                </label>
              ))}
            </div>
            {form.genero === "Outro" && (
              <input value={form.genero_outro} onChange={e => setField("genero_outro", e.target.value)}
                placeholder="Especifique..." className={inp + " mt-3"} />
            )}
            {errors.genero && <p className="text-red-500 text-xs mt-1">{errors.genero}</p>}
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Endereço</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rua e Número *</label>
                <input value={form.rua} onChange={e => setField("rua", capitalize(e.target.value))}
                  placeholder="Ex: Rua das Flores, 123" className={errors.rua ? inpErr : inp} />
                {errors.rua && <p className="text-red-500 text-xs mt-1">{errors.rua}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bairro *</label>
                  <input value={form.bairro} onChange={e => setField("bairro", capitalize(e.target.value))}
                    placeholder="Ex: Centro" className={errors.bairro ? inpErr : inp} />
                  {errors.bairro && <p className="text-red-500 text-xs mt-1">{errors.bairro}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cidade *</label>
                  <select value={form.cidade} onChange={e => setField("cidade", e.target.value)}
                    className={(errors.cidade ? inpErr : inp) + " bg-white"}>
                    <option value="">Selecione a cidade</option>
                    {CIDADES_AC.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.cidade && <p className="text-red-500 text-xs mt-1">{errors.cidade}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Zona *</label>
                <div className="flex gap-5">
                  {["Urbana", "Rural"].map(z => (
                    <label key={z} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="zona" value={z} checked={form.zona === z}
                        onChange={() => setField("zona", z)}
                        className="w-4 h-4 text-brand-600 focus:ring-brand-600" />
                      <span className="text-gray-700">Zona {z}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.lgpd} onChange={e => setField("lgpd", e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded focus:ring-brand-600" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  Concordo com a <button type="button" onClick={() => setShowLgpd(true)} className="text-brand-600 active:text-brand-700 underline">Política de Privacidade</button> *
                </p>
                <p className="text-gray-600 mt-0.5 text-xs">
                  Concordo em fornecer meus dados para serem contatado com conteúdos e materiais. (Não fazemos spam.)
                </p>
              </div>
            </label>
            {errors.lgpd && <p className="text-red-500 text-xs mt-1 ml-7">{errors.lgpd}</p>}
          </div>

          <button disabled={busy}
            className="w-full flex items-center justify-center bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl py-3 text-base disabled:opacity-60">
            {busy ? "Enviando..." : "Enviar Cadastro"}
          </button>
        </form>
      </div>

      {showLgpd && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowLgpd(false)} />
          <div className="relative bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto sheet-anim">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Política de Privacidade</h3>
            </div>
            <div className="px-5 py-4 text-sm text-gray-600 space-y-3">
              <p><strong>1. Coleta de Dados:</strong> Coletamos apenas os dados solicitados no formulário.</p>
              <p><strong>2. Finalidade:</strong> Identificar você e permitir contato com conteúdos relevantes.</p>
              <p><strong>3. Sem Spam:</strong> Não vendemos nem repassamos seus dados a terceiros.</p>
              <p><strong>4. Cancelamento:</strong> Você pode pedir a parada das comunicações a qualquer momento.</p>
              <p><strong>5. Seus Direitos (LGPD):</strong> Você pode alterar, acessar ou excluir seus dados (Lei nº 13.709/2018).</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { setShowLgpd(false); setField("lgpd", true); }}
                className="w-full py-3 bg-brand-600 active:bg-brand-700 text-white rounded-xl text-sm font-semibold">
                Estou de acordo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
