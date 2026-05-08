"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, Copy, Edit2, Trash2, Phone, MapPin, Crown, UserCheck, Users, User as UserIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { ContactEditForm } from "./ContactEditForm";
import { PersonFormFields, personFormToPayload, initialPersonForm, type PersonFormState } from "./PersonFormFields";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null; parentId: string | null;
  cidade?: string | null;
  role: Role;
  _count: { children: number };
}

const LEVEL_LABEL_PL: Record<number, string> = {
  0: "Coord. de Grupo", 1: "Coordenadores", 2: "Líderes", 3: "Apoiadores",
};
const LEVEL_LABEL_SG: Record<number, string> = {
  0: "Coordenador de Grupo", 1: "Coordenador", 2: "Líder", 3: "Apoiador",
};
const LEVEL_ICONS: Record<number, any> = { 0: Crown, 1: UserCheck, 2: Users, 3: UserIcon };

function publicLinkFor(slug: string, kind: "lider" | "coord" | "coord_form"): string {
  return `${window.location.origin}/?${kind}=${encodeURIComponent(slug)}`;
}

export function AdminNetworkView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<number | "all">(1);
  const [search, setSearch] = useState("");
  const [createTargetLevel, setCreateTargetLevel] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rolesRes] = await Promise.all([
        fetch("/api/rede"),
        fetch("/api/roles"),
      ]);
      if (r.ok) setContacts((await r.json()).contacts ?? []);
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const out: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    contacts.forEach(c => { out[c.role.level] = (out[c.role.level] ?? 0) + 1; });
    return out;
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = activeLevel === "all" ? contacts : contacts.filter(c => c.role.level === activeLevel);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (a.role.level !== b.role.level) return a.role.level - b.role.level;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, activeLevel, search]);

  async function deleteContact(c: Contact) {
    if (!confirm(`Excluir "${c.name}"?`)) return;
    const r = await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }

  async function createInLevel(level: number, form: PersonFormState): Promise<{ ok: boolean; login?: { username: string; password: string | null } }> {
    const role = roles.find(r => r.level === level);
    if (!role) return { ok: false };

    let endpoint = "/api/apoiadores";
    const payload: any = personFormToPayload(form);
    if (level <= 1) endpoint = "/api/coordinators";
    else if (level === 2) endpoint = "/api/leaders";

    const r = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return { ok: false }; }
    const data = await r.json();
    toast.success("Adicionado");
    load();
    return { ok: true, login: data.login };
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {([0, 1, 2, 3] as const).map(lv => {
          const Icon = LEVEL_ICONS[lv];
          const active = activeLevel === lv;
          return (
            <button key={lv} onClick={() => setActiveLevel(lv)}
              className={`p-3 rounded-2xl border text-left transition-colors ${
                active ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white active:bg-gray-50"
              }`}>
              <Icon size={14} className={active ? "text-brand-600" : "text-gray-400"} />
              <p className="text-lg font-bold text-gray-900 mt-2">{stats[lv]}</p>
              <p className="text-[10px] uppercase tracking-wide font-medium text-gray-500 truncate">{LEVEL_LABEL_PL[lv]}</p>
            </button>
          );
        })}
      </div>

      {/* Tabs/Filtros */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        <button onClick={() => setActiveLevel("all")}
          className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap ${
            activeLevel === "all" ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
          }`}>
          Todos ({contacts.length})
        </button>
        {([0, 1, 2, 3] as const).map(lv => (
          <button key={lv} onClick={() => setActiveLevel(lv)}
            className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap ${
              activeLevel === lv ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
            }`}>
            {LEVEL_LABEL_PL[lv]}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar pelo nome..."
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">Nada encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const phoneStripped = (c.phone || "").replace(/\D/g, "");
            const phoneShown = phoneStripped.startsWith("placeholder") ? null
              : phoneStripped.startsWith("55") ? phoneStripped.slice(2) : phoneStripped;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-200 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ backgroundColor: c.role.bgColor, color: c.role.color }}>
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                      <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
                        style={{ color: c.role.color, backgroundColor: c.role.bgColor }}>
                        {c.role.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      {c._count.children > 0 && <span>{c._count.children} abaixo</span>}
                      {phoneShown && <span className="flex items-center gap-0.5"><Phone size={9} />{phoneShown}</span>}
                      {c.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{c.cidade}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.role.level <= 2 && (
                      <button onClick={() => {
                        const link = publicLinkFor(c.publicSlug ?? c.name, c.role.level <= 1 ? "coord" : "lider");
                        navigator.clipboard.writeText(link); toast.success("Link copiado");
                      }} className="p-2 text-gray-400 active:text-brand-600 active:bg-brand-50 rounded-lg">
                        <Copy size={14} />
                      </button>
                    )}
                    <button onClick={() => setEditingId(c.id)}
                      className="p-2 text-gray-500 active:text-brand-700 active:bg-brand-50 rounded-lg">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteContact(c)}
                      className="p-2 text-red-400 active:text-red-700 active:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setCreateTargetLevel(activeLevel === "all" ? 1 : activeLevel as number)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 active:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center z-30">
        <Plus size={24} />
      </button>

      {createTargetLevel !== null && (
        <CreateContactSheet
          level={createTargetLevel}
          onClose={() => setCreateTargetLevel(null)}
          onLevelChange={setCreateTargetLevel}
          onSubmit={async (level, form) => {
            return await createInLevel(level, form);
          }} />
      )}

      {editingId && (
        <ContactEditForm
          contactId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); }} />
      )}
    </div>
  );
}

function CreateContactSheet({ level, onLevelChange, onClose, onSubmit }: {
  level: number;
  onLevelChange: (lv: number) => void;
  onClose: () => void;
  onSubmit: (level: number, form: PersonFormState) => Promise<{ ok: boolean; login?: { username: string; password: string | null } }>;
}) {
  const [form, setForm] = useState<PersonFormState>(initialPersonForm);
  const [busy, setBusy] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ username: string; password: string | null; name: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.length < 10) return;
    setBusy(true);
    try {
      const result = await onSubmit(level, form);
      if (!result.ok) return;
      if (result.login?.username) {
        setCreatedLogin({
          username: result.login.username,
          password: result.login.password,
          name: form.name,
        });
      } else {
        onClose();
      }
    } finally { setBusy(false); }
  }

  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

  if (createdLogin) {
    return (
      <BottomSheet open onClose={onClose} title="Login criado!">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{createdLogin.name}</span> foi adicionado(a) com login automático.
          </p>
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Usuário</p>
              <p className="font-mono text-base text-gray-900 mt-0.5">{createdLogin.username}</p>
            </div>
            {createdLogin.password && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Senha padrão</p>
                <p className="font-mono text-base text-gray-900 mt-0.5">{createdLogin.password}</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠ Anote essas credenciais. A senha pode ser trocada no primeiro acesso.
          </p>
          <button onClick={onClose}
            className="w-full py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl">
            OK, fechar
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title="Adicionar à Rede">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={lbl}>Cargo *</label>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map(lv => (
              <button key={lv} type="button" onClick={() => onLevelChange(lv)}
                className={`py-2.5 px-3 text-sm font-semibold rounded-xl border ${
                  level === lv
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 active:bg-gray-50"
                }`}>
                {LEVEL_LABEL_SG[lv]}
              </button>
            ))}
          </div>
        </div>

        <PersonFormFields form={form} setForm={setForm} />

        <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white -mx-5 px-5 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
