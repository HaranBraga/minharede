"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Copy, Search, Trash2, Edit2, Phone, Link as LinkIcon,
  Users, UserCheck, User as UserIcon, MapPin, Crown,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { ContactEditForm } from "./ContactEditForm";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null; parentId: string | null;
  cidade?: string | null; bairro?: string | null;
  role: Role;
  _count: { children: number };
}
interface MemberSession {
  type: "member";
  contactId: string; slug: string; name: string;
  roleLevel: number; roleLabel: string;
  roleColor?: string; roleBgColor?: string;
}

function publicLinkFor(slug: string, kind: "lider" | "coord" | "coord_form"): string {
  return `${window.location.origin}/?${kind}=${encodeURIComponent(slug)}`;
}

const LEVEL_LABELS: Record<number, string> = {
  0: "Coordenadores de Grupo",
  1: "Coordenadores",
  2: "Líderes",
  3: "Apoiadores",
};
const LEVEL_ICONS: Record<number, any> = { 0: Crown, 1: UserCheck, 2: Users, 3: UserIcon };
const LEVEL_LABEL_SINGULAR: Record<number, string> = {
  0: "Coordenador de Grupo", 1: "Coordenador", 2: "Líder", 3: "Apoiador",
};

export function MemberDashboard({ session }: { session: MemberSession }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number | null>(null);
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

  // Tabs disponíveis pra esse cargo (níveis abaixo do dele, exceto o seu)
  const availableLevels = useMemo(() => {
    return [0, 1, 2, 3].filter(lv => lv > session.roleLevel);
  }, [session.roleLevel]);

  // Stats: contagem por nível dentro da rede dele
  const stats = useMemo(() => {
    const out: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    contacts.forEach(c => {
      if (c.id !== session.contactId) out[c.role.level] = (out[c.role.level] ?? 0) + 1;
    });
    return out;
  }, [contacts, session.contactId]);

  // Default activeTab = primeiro nível disponível
  useEffect(() => {
    if (activeTab === null && availableLevels.length > 0) {
      setActiveTab(availableLevels[0]);
    }
  }, [activeTab, availableLevels]);

  // Lista filtrada da tab atual
  const listForTab = useMemo(() => {
    if (activeTab === null) return [];
    let list = contacts.filter(c => c.role.level === activeTab && c.id !== session.contactId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list;
  }, [contacts, activeTab, search, session.contactId]);

  async function deleteContact(c: Contact) {
    if (!confirm(`Excluir "${c.name}"?${c.role.level < 3 ? "\nFilhos serão desvinculados (não excluídos)." : ""}`)) return;
    const r = await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }

  async function createInLevel(level: number, name: string, phone?: string) {
    const role = roles.find(r => r.level === level);
    if (!role) { toast.error("Cargo não disponível"); return false; }

    let endpoint = "/api/apoiadores";
    let body: any = { name, phone, parentId: session.contactId };
    if (level <= 1) {
      endpoint = "/api/coordinators";
      body = { name };
    } else if (level === 2) {
      endpoint = "/api/leaders";
      body = { name, coordinator: session.name };
    }
    const r = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return false; }
    toast.success("Adicionado");
    load();
    return true;
  }

  const myKind = session.roleLevel <= 1 ? "coord" : "lider";

  return (
    <div className="space-y-4 pb-20 relative">
      {/* Header card com link próprio + stats */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ backgroundColor: session.roleBgColor ?? "#e0e7ff", color: session.roleColor ?? "#4f46e5" }}>
            {session.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base truncate">{session.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{session.roleLabel}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            <LinkIcon size={11} className="text-brand-600" /> Seu link público
          </div>
          <CopyableLink url={publicLinkFor(session.slug, myKind)} />
          {session.roleLevel <= 1 && (
            <>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">
                <LinkIcon size={11} className="text-brand-600" /> Link de cadastro direto
              </div>
              <CopyableLink url={publicLinkFor(session.slug, "coord_form")} />
            </>
          )}
        </div>

        {availableLevels.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {availableLevels.slice(0, 3).map(lv => {
              const Icon = LEVEL_ICONS[lv];
              return (
                <button key={lv} onClick={() => setActiveTab(lv)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    activeTab === lv ? "border-brand-300 bg-brand-50" : "border-gray-200 active:bg-gray-50"
                  }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className={activeTab === lv ? "text-brand-600" : "text-gray-400"} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 truncate">{LEVEL_LABELS[lv]}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{stats[lv]}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Tabs e lista */}
      {availableLevels.length > 1 && (
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
          {availableLevels.map(lv => (
            <button key={lv} onClick={() => setActiveTab(lv)}
              className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${
                activeTab === lv
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
              }`}>
              {LEVEL_LABELS[lv]} <span className="opacity-70">({stats[lv]})</span>
            </button>
          ))}
        </div>
      )}

      {/* Busca */}
      {activeTab !== null && stats[activeTab] > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Buscar em ${LEVEL_LABELS[activeTab]?.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>
      ) : activeTab === null ? null : listForTab.length === 0 ? (
        <EmptyState
          level={activeTab}
          canCreate={availableLevels.includes(activeTab)}
          onCreate={() => setCreateTargetLevel(activeTab)} />
      ) : (
        <div className="space-y-2">
          {listForTab.map(c => (
            <ContactCard key={c.id} contact={c}
              onEdit={() => setEditingId(c.id)}
              onDelete={() => deleteContact(c)} />
          ))}
        </div>
      )}

      {/* FAB Adicionar */}
      {activeTab !== null && availableLevels.includes(activeTab) && stats[activeTab] > 0 && (
        <button onClick={() => setCreateTargetLevel(activeTab)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 active:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center z-30">
          <Plus size={24} />
        </button>
      )}

      {createTargetLevel !== null && (
        <CreateContactSheet
          level={createTargetLevel}
          parentName={session.name}
          onClose={() => setCreateTargetLevel(null)}
          onSubmit={async (name, phone) => {
            const ok = await createInLevel(createTargetLevel, name, phone);
            if (ok) setCreateTargetLevel(null);
            return ok;
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

function CopyableLink({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
      <input readOnly value={url} className="flex-1 bg-transparent text-xs text-gray-700 outline-none truncate select-all" />
      <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}
        className="text-xs font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-lg px-3 py-2 flex items-center gap-1 shrink-0">
        <Copy size={12} /> Copiar
      </button>
    </div>
  );
}

function ContactCard({ contact, onEdit, onDelete }: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const phoneStripped = (contact.phone || "").replace(/\D/g, "");
  const phoneShown = phoneStripped.startsWith("placeholder") ? null
    : phoneStripped.startsWith("55") ? phoneStripped.slice(2) : phoneStripped;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ backgroundColor: contact.role.bgColor, color: contact.role.color }}>
          {contact.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            {contact._count.children > 0 && <span>{contact._count.children} abaixo</span>}
            {phoneShown && <span className="flex items-center gap-0.5"><Phone size={9} />{phoneShown}</span>}
            {contact.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{contact.cidade}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {contact.role.level <= 2 && (
            <button onClick={() => {
              const link = publicLinkFor(contact.publicSlug ?? contact.name, contact.role.level <= 1 ? "coord" : "lider");
              navigator.clipboard.writeText(link); toast.success("Link copiado");
            }} className="p-2 text-gray-400 active:text-brand-600 active:bg-brand-50 rounded-lg" title="Copiar link">
              <Copy size={14} />
            </button>
          )}
          <button onClick={onEdit}
            className="p-2 text-gray-500 active:text-brand-700 active:bg-brand-50 rounded-lg" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="p-2 text-red-400 active:text-red-700 active:bg-red-50 rounded-lg" title="Excluir">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ level, canCreate, onCreate }: {
  level: number;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const Icon = LEVEL_ICONS[level];
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Icon size={26} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">Nenhum {LEVEL_LABEL_SINGULAR[level]?.toLowerCase()} ainda</p>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        Adicione o primeiro {LEVEL_LABEL_SINGULAR[level]?.toLowerCase()} da sua rede.
      </p>
      {canCreate && (
        <button onClick={onCreate}
          className="inline-flex items-center gap-1.5 bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm">
          <Plus size={14} /> Adicionar {LEVEL_LABEL_SINGULAR[level]}
        </button>
      )}
    </div>
  );
}

function CreateContactSheet({ level, parentName, onClose, onSubmit }: {
  level: number;
  parentName: string;
  onClose: () => void;
  onSubmit: (name: string, phone?: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim(), phone || undefined);
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";
  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";
  const isApoiad = level === 3;

  return (
    <BottomSheet open onClose={onClose} title={`Adicionar ${LEVEL_LABEL_SINGULAR[level]}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-2">
          Abaixo de <span className="font-semibold text-gray-700">{parentName}</span>
        </p>
        <div>
          <label className={lbl}>Nome *</label>
          <input required autoFocus value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        {isApoiad && (
          <div>
            <label className={lbl}>Telefone (11 dígitos) <span className="text-gray-400">opcional</span></label>
            <input type="tel" inputMode="numeric" maxLength={11}
              value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="68999551835" className={inp} />
          </div>
        )}
        <div className="flex gap-2 pt-2">
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
