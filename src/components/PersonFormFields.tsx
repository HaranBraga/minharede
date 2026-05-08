"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const CIDADES_AC = [
  "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba",
  "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima",
  "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre",
  "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus",
  "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri",
];

export interface PersonFormState {
  name: string;
  phone: string;
  email: string;
  dataNascimento: string;
  genero: string;
  rua: string;
  bairro: string;
  cidade: string;
  zona: string;
}

export const initialPersonForm: PersonFormState = {
  name: "", phone: "", email: "", dataNascimento: "", genero: "",
  rua: "", bairro: "", cidade: "", zona: "Urbana",
};

const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";
const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

/**
 * Campos básicos (nome + telefone obrigatórios) + seção "Mais dados (opcional)"
 * que expande email, nascimento, gênero, endereço.
 *
 * Uso: <PersonFormFields form={form} setForm={setForm} />
 */
export function PersonFormFields({ form, setForm, autoFocus = true }: {
  form: PersonFormState;
  setForm: (next: PersonFormState | ((prev: PersonFormState) => PersonFormState)) => void;
  autoFocus?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  function setField<K extends keyof PersonFormState>(k: K, v: PersonFormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Nome completo *</label>
        <input required autoFocus={autoFocus} value={form.name}
          onChange={e => setField("name", e.target.value)} className={inp} />
      </div>
      <div>
        <label className={lbl}>WhatsApp / Telefone * <span className="text-gray-400">11 dígitos</span></label>
        <input required type="tel" inputMode="numeric" maxLength={11}
          value={form.phone} onChange={e => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="68999551835" className={inp} />
      </div>

      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-600 active:bg-gray-50">
        <span className="font-medium">Mais dados (opcional)</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <div>
            <label className={lbl}>E-mail</label>
            <input type="email" value={form.email}
              onChange={e => setField("email", e.target.value)}
              placeholder="email@exemplo.com" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nascimento</label>
              <input type="date" value={form.dataNascimento}
                onChange={e => setField("dataNascimento", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Gênero</label>
              <select value={form.genero} onChange={e => setField("genero", e.target.value)}
                className={inp + " bg-white"}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Rua e Número</label>
            <input value={form.rua} onChange={e => setField("rua", e.target.value)}
              placeholder="Ex: Rua das Flores, 123" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Bairro</label>
              <input value={form.bairro} onChange={e => setField("bairro", e.target.value)}
                placeholder="Centro" className={inp} />
            </div>
            <div>
              <label className={lbl}>Cidade (AC)</label>
              <select value={form.cidade} onChange={e => setField("cidade", e.target.value)}
                className={inp + " bg-white"}>
                <option value="">—</option>
                {CIDADES_AC.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Zona</label>
            <div className="flex gap-2">
              {["Urbana", "Rural"].map(z => (
                <label key={z} className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl cursor-pointer text-sm font-medium ${
                  form.zona === z ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"
                }`}>
                  <input type="radio" name="zona" value={z} checked={form.zona === z}
                    onChange={() => setField("zona", z)}
                    className="w-4 h-4 text-brand-600" />
                  Zona {z}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Constrói payload pra POST a partir do estado do form. */
export function personFormToPayload(form: PersonFormState): Record<string, any> {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email || undefined,
    dataNascimento: form.dataNascimento || undefined,
    genero: form.genero || undefined,
    rua: form.rua || undefined,
    bairro: form.bairro || undefined,
    cidade: form.cidade || undefined,
    zona: form.zona || undefined,
  };
}
