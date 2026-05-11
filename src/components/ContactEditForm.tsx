"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { displayPhoneOrEmpty } from "@/lib/phone-display";

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
  redeUser?: { id: string; username: string; active: boolean } | null;
}

interface Role { id: string; key: string; label: string; level: number; color: string; bgColor: string; }

/**
 * Modal mobile-first de edição COMPLETA do contato. Aceita todos os campos
 * relevantes (identificação + endereço + dados pessoais).
 */
export function ContactEditForm({ contactId, onClose, onSaved, canChangeRole = false, canCreateLogin = false }: {
  contactId: string;
  onClose: () => void;
  onSaved: (c: Contact) => void;
  canChangeRole?: boolean;
  canCreateLogin?: boolean;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  // Sub-form de criação de login pra contato existente
  const [showCreateLogin, setShowCreateLogin] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [createdLoginInfo, setCreatedLoginInfo] = useState<{ username: string; password: string | null } | null>(null);

  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    rua: "", bairro: "", cidade: "", zona: "Urbana",
    dataNascimento: "", genero: "",
    roleId: "",
  });

  useEffect(() => {
    fetch(`/api/contacts/${contactId}`).then(r => r.json()).then((c: Contact) => {
      setContact(c);
      const phoneFinal = displayPhoneOrEmpty(c.phone);
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
        roleId: c.role?.id ?? "",
      });
      setLoading(false);
    }).catch(() => { toast.error("Erro ao carregar"); setLoading(false); });
  }, [contactId]);

  useEffect(() => {
    if (!canChangeRole) return;
    fetch("/api/roles").then(r => r.json()).then(setRoles).catch(() => setRoles([]));
  }, [canChangeRole]);

  async function createLogin() {
    if (!contact) return;
    if (newUsername.trim().length < 3) { toast.error("Usuário inválido (mín 3 chars)"); return; }
    setCreatingLogin(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          username: newUsername.trim().toLowerCase(),
          password: newPassword || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Erro"); return; }
      toast.success("Login criado");
      setCreatedLoginInfo({
        username: data.username,
        password: newPassword ? null : "123456",
      });
      // Atualiza o contact local pra mostrar o novo login
      setContact(c => c ? { ...c, redeUser: { id: data.id, username: data.username, active: data.active ?? true } } : c);
      setShowCreateLogin(false);
      setNewUsername(""); setNewPassword("");
    } finally { setCreatingLogin(false); }
  }

  function suggestUsername(): string {
    if (!contact) return "";
    return contact.name.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")
      .slice(0, 32);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = { ...form };
      if (!canChangeRole || !payload.roleId || payload.roleId === contact?.role?.id) delete payload.roleId;
      const r = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          {canChangeRole && roles.length > 0 && (
            <div>
              <label className={lbl}>Cargo</label>
              <select value={form.roleId}
                onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                className={inp + " bg-white"}>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
                {/* Mantém o cargo atual disponível se /api/roles não o retornar */}
                {contact?.role && !roles.find(r => r.id === contact.role!.id) && (
                  <option value={contact.role.id}>{contact.role.label} (atual)</option>
                )}
              </select>
              {form.roleId !== contact?.role?.id && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5">
                  ⚠ Mudar o cargo pode desvincular o pai. Confira o vínculo depois.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={lbl}>Telefone (11 dígitos) {isApoiad ? "*" : <span className="text-gray-400">opcional</span>}</label>
              <input type="tel" inputMode="numeric" maxLength={11}
                required={isApoiad}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                placeholder="Apenas números" className={inp} />
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

        {/* Acesso (login) — só pra admin (canCreateLogin) e cargos elegíveis */}
        {canCreateLogin && contact && contact.role && contact.role.level <= 2 && (
          <section className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Acesso</h3>
            {contact.redeUser ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                  @
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-gray-900 truncate">@{contact.redeUser.username}</p>
                  <p className="text-[11px] text-gray-500">
                    {contact.redeUser.active ? "Login ativo" : "Login inativo"}
                  </p>
                </div>
              </div>
            ) : createdLoginInfo ? (
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Login criado!</p>
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Usuário</p>
                  <p className="font-mono text-base text-gray-900 mt-0.5">{createdLoginInfo.username}</p>
                </div>
                {createdLoginInfo.password && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Senha padrão</p>
                    <p className="font-mono text-base text-gray-900 mt-0.5">{createdLoginInfo.password}</p>
                  </div>
                )}
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ⚠ Anote ou tire um print. A senha pode ser trocada depois.
                </p>
              </div>
            ) : !showCreateLogin ? (
              <button type="button"
                onClick={() => { setShowCreateLogin(true); setNewUsername(suggestUsername()); }}
                className="w-full py-3 text-sm font-semibold text-brand-700 border border-brand-200 bg-brand-50 active:bg-brand-100 rounded-xl">
                + Criar login pra esse contato
              </button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                <div>
                  <label className={lbl}>Usuário *</label>
                  <input value={newUsername} autoCapitalize="none"
                    onChange={e => setNewUsername(e.target.value.toLowerCase())}
                    placeholder="ex: joao.silva" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Senha <span className="text-gray-400 font-normal">(opcional — default: 123456)</span></label>
                  <div className="relative">
                    <input type={showNewPwd ? "text" : "password"}
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Deixe vazio pra usar 123456" className={inp + " pr-11"} />
                    <button type="button" onClick={() => setShowNewPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
                      {showNewPwd ? "👁" : "👁"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreateLogin(false)}
                    className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg active:bg-gray-100">
                    Cancelar
                  </button>
                  <button type="button" onClick={createLogin} disabled={creatingLogin || newUsername.length < 3}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-lg disabled:opacity-50">
                    {creatingLogin ? "Criando..." : "Criar login"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

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
