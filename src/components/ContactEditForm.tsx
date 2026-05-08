"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";

const CIDADES_AC = [
  "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba",
  "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima",
  "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre",
  "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus",
  "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri",
];

interface Contact {
  id: string;
  name: string; phone: string; email?: string | null;
  cidade?: string | null; bairro?: string | null; rua?: string | null;
  zona?: string | null; genero?: string | null;
  dataNascimento?: string | null;
  role?: { id: string; label: string; level: number };
  parent?: { id: string; name: string } | null;
}

/**
 * Modal mobile-first de edição COMPLETA do contato. Aceita todos os campos
 * relevantes (identificação + endereço + dados pessoais).
 */
export function ContactEditForm({ contactId, onClose, onSaved }: {
  contactId: string;
  onClose: () => void;
  onSaved: (c: Contact) => void;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    rua: "", bairro: "", cidade: "", zona: "Urbana",
    dataNascimento: "", genero: "",
  });

  useEffect(() => {
    fetch(`/api/contacts/${contactId}`).then(r => r.json()).then((c: Contact) => {
      setContact(c);
      const phoneStripped = (c.phone || "").replace(/\D/g, "");
      const phoneShown = phoneStripped.startsWith("55") ? phoneStripped.slice(2) : phoneStripped;
      // se for placeholder, não mostra
      const phoneFinal = phoneStripped.startsWith("placeholder") ? "" : phoneShown;
      setForm({
        name: c.name || "",
        phone: phoneFinal,
        email: c.email || "",
        rua: c.rua || "",
        bairro: c.bairro || "",
        cidade: c.cidade || "",
        zona: c.zona || "Urbana",
        dataNascimento: c.dataNascimento ? new Date(c.dataNascimento).toISOString().slice(0, 10) : "",
        genero: c.genero || "",
      });
      setLoading(false);
    }).catch(() => { toast.error("Erro ao carregar"); setLoading(false); });
  }, [contactId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      const updated = await r.json();
      toast.success("Salvo");
      onSaved(updated);
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";
  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

  if (loading || !contact) {
    return (
      <BottomSheet open onClose={onClose} title="Carregando...">
        <p className="text-center py-8 text-sm text-gray-400">Buscando dados...</p>
      </BottomSheet>
    );
  }

  const isApoiad = contact.role && contact.role.level >= 3;

  return (
    <BottomSheet open onClose={onClose} title={`Editar ${contact.role?.label ?? "Contato"}`}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Identificação */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Identificação</h3>
          <div>
            <label className={lbl}>Nome completo *</label>
            <input required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={lbl}>Telefone (11 dígitos) {isApoiad ? "*" : <span className="text-gray-400">opcional</span>}</label>
              <input type="tel" inputMode="numeric" maxLength={11}
                required={isApoiad}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                placeholder="68999551835" className={inp} />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com" className={inp} />
            </div>
          </div>
        </section>

        {/* Pessoal */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Dados Pessoais</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nascimento</label>
              <input type="date" value={form.dataNascimento}
                onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))}
                className={inp} />
            </div>
            <div>
              <label className={lbl}>Gênero</label>
              <select value={form.genero}
                onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}
                className={inp + " bg-white"}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Endereço</h3>
          <div>
            <label className={lbl}>Rua e Número</label>
            <input value={form.rua}
              onChange={e => setForm(f => ({ ...f, rua: e.target.value }))}
              placeholder="Ex: Rua das Flores, 123" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Bairro</label>
              <input value={form.bairro}
                onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                placeholder="Ex: Centro" className={inp} />
            </div>
            <div>
              <label className={lbl}>Cidade</label>
              <select value={form.cidade}
                onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                className={inp + " bg-white"}>
                <option value="">—</option>
                {CIDADES_AC.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Zona</label>
            <div className="flex gap-3">
              {["Urbana", "Rural"].map(z => (
                <label key={z} className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl cursor-pointer text-sm font-medium ${
                  form.zona === z ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"
                }`}>
                  <input type="radio" name="zona" value={z} checked={form.zona === z}
                    onChange={() => setForm(f => ({ ...f, zona: z }))}
                    className="w-4 h-4 text-brand-600" />
                  Zona {z}
                </label>
              ))}
            </div>
          </div>
        </section>

        <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white -mx-5 px-5 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
