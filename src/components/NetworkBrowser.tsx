"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Copy, Search, ChevronDown, ChevronRight, Trash2, Edit2, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null; parentId: string | null;
  cidade?: string | null; bairro?: string | null;
  role: Role;
  _count: { children: number };
}
interface Session {
  type: "admin" | "member";
  contactId?: string; slug?: string; name?: string; roleLevel?: number; roleLabel?: string;
}

function publicLinkFor(slug: string | null, name: string, kind: "lider" | "coord" | "coord_form"): string {
  const s = slug ?? name;
  return `${window.location.origin}/?${kind}=${encodeURIComponent(s)}`;
}
function linkKindFor(level: number): "lider" | "coord" | "coord_form" {
  return level <= 1 ? "coord" : "lider";
}

export function NetworkBrowser({ session }: { session: Session }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createTarget, setCreateTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);

  const isAdmin = session.type === "admin";
  const myContactId = session.contactId ?? null;
  const myRoleLevel = session.roleLevel ?? null;
  const mySlug = session.slug ?? null;
  const myName = session.name ?? null;

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

  const topLevel = useMemo(() => {
    if (isAdmin) return contacts.filter(c => !c.parentId);
    return contacts.filter(c => c.parentId === myContactId);
  }, [contacts, isAdmin, myContactId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return contacts.filter(c => c.name.toLowerCase().includes(q));
  }, [contacts, search]);

  async function deleteContact(c: Contact) {
    const isApoiador = c.role.level >= 3;
    if (!confirm(`Excluir "${c.name}"?${!isApoiador ? "\nSeus descendentes ficarão sem coordenador/líder, mas não serão excluídos." : ""}`)) return;
    const endpoint =
      c.role.level <= 1 ? `/api/coordinators/${c.id}` :
      c.role.level === 2 ? `/api/leaders/${c.id}` :
      `/api/apoiadores/${c.id}`;
    const r = await fetch(endpoint, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-4">
      {/* Link próprio (member) */}
      {!isAdmin && mySlug && myName && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon size={14} className="text-brand-600" />
            <p className="text-sm font-semibold text-gray-700">Seu link público</p>
          </div>
          <CopyableLink url={publicLinkFor(mySlug, myName, linkKindFor(myRoleLevel ?? 99))} />
          {myRoleLevel != null && myRoleLevel <= 1 && (
            <div className="mt-2">
              <p className="text-[11px] text-gray-500 mb-1">Link de formulário (cadastra direto pra você)</p>
              <CopyableLink url={publicLinkFor(mySlug, myName, "coord_form")} />
            </div>
          )}
        </div>
      )}

      {/* busca + criar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar na rede..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
          </div>
          {roles.length > 0 && (
            <button
              onClick={() => setCreateTarget({ id: myContactId, name: isAdmin ? "(raiz)" : (myName ?? "você") })}
              className="text-xs font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl px-3 py-2.5 flex items-center gap-1 shrink-0">
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>}

      {!loading && search.trim() && filtered && (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Nada encontrado</p>}
          {filtered.map(c => (
            <ContactRow key={c.id} contact={c}
              onEdit={() => setEditing(c)} onDelete={() => deleteContact(c)}
              onCreate={c.role.level < 3 ? () => setCreateTarget({ id: c.id, name: c.name }) : undefined}
              showCreate={isAdmin || (myRoleLevel != null && c.role.level >= myRoleLevel)} />
          ))}
        </div>
      )}

      {!loading && !search.trim() && (
        <div className="bg-white rounded-2xl border border-gray-200">
          {topLevel.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400 px-6">
              Sua rede está vazia. Toque em <strong>Adicionar</strong> pra começar.
            </p>
          ) : (
            <div>
              {topLevel.map(c => (
                <TreeNode key={c.id} contact={c} all={contacts} depth={0}
                  onEdit={setEditing}
                  onDelete={deleteContact}
                  onCreate={(target) => setCreateTarget(target)}
                  isAdmin={isAdmin} myRoleLevel={myRoleLevel} />
              ))}
            </div>
          )}
        </div>
      )}

      {createTarget && (
        <CreateModal session={session} parent={createTarget} roles={roles}
          onClose={() => setCreateTarget(null)}
          onSaved={() => { setCreateTarget(null); load(); }} />
      )}
      {editing && (
        <EditModal contact={editing} isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function CopyableLink({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
      <input readOnly value={url} className="flex-1 bg-transparent text-xs text-gray-700 outline-none truncate" />
      <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}
        className="text-xs font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1 shrink-0">
        <Copy size={11} />
      </button>
    </div>
  );
}

function ContactRow({ contact, onEdit, onDelete, onCreate, showCreate }: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onCreate?: () => void;
  showCreate: boolean;
}) {
  const link = publicLinkFor(contact.publicSlug, contact.name, linkKindFor(contact.role.level));
  return (
    <div className="px-3 py-2.5 group">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: contact.role.bgColor, color: contact.role.color }}>
          {contact.name[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
              style={{ color: contact.role.color, backgroundColor: contact.role.bgColor }}>
              {contact.role.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            {contact._count.children > 0 && <span>{contact._count.children} abaixo</span>}
            {contact.cidade && <span>· {contact.cidade}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2 ml-12 flex-wrap">
        {contact.role.level <= 2 && (
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
            className="text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 active:bg-gray-100">
            <Copy size={10} className="inline mr-1" />link
          </button>
        )}
        {showCreate && onCreate && contact.role.level < 3 && (
          <button onClick={onCreate} className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1 active:bg-brand-100">
            <Plus size={10} className="inline mr-1" />abaixo
          </button>
        )}
        <button onClick={onEdit} className="text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 active:bg-gray-100">
          <Edit2 size={10} className="inline mr-1" />editar
        </button>
        <button onClick={onDelete} className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 active:bg-red-100">
          <Trash2 size={10} className="inline mr-1" />excluir
        </button>
      </div>
    </div>
  );
}

function TreeNode({ contact, all, depth, onEdit, onDelete, onCreate, isAdmin, myRoleLevel }: {
  contact: Contact;
  all: Contact[];
  depth: number;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onCreate: (target: { id: string; name: string }) => void;
  isAdmin: boolean;
  myRoleLevel: number | null;
}) {
  const [open, setOpen] = useState(depth === 0);
  const children = all.filter(c => c.parentId === contact.id);
  const hasChildren = children.length > 0;
  const canCreate = isAdmin || (myRoleLevel != null && contact.role.level >= myRoleLevel);

  return (
    <div className={depth === 0 ? "border-b border-gray-100 last:border-b-0" : ""}>
      <div className="flex items-center gap-2 px-3 py-2.5"
        style={{ paddingLeft: `${12 + depth * 14}px` }}>
        <button onClick={() => setOpen(o => !o)}
          className={`p-1 ${hasChildren ? "text-gray-500 active:text-gray-800" : "text-gray-200"}`}
          disabled={!hasChildren}>
          {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <ChevronRight size={14} />}
        </button>
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: contact.role.bgColor, color: contact.role.color }}>
          {contact.name[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
              style={{ color: contact.role.color, backgroundColor: contact.role.bgColor }}>
              {contact.role.label}
            </span>
          </div>
          {contact._count.children > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">{contact._count.children} abaixo</p>
          )}
        </div>
        <div className="flex gap-0.5 shrink-0">
          {contact.role.level <= 2 && (
            <button onClick={() => {
              const link = publicLinkFor(contact.publicSlug, contact.name, linkKindFor(contact.role.level));
              navigator.clipboard.writeText(link); toast.success("Link copiado");
            }} className="p-1.5 text-gray-400 active:text-gray-700"><Copy size={13} /></button>
          )}
          {canCreate && contact.role.level < 3 && (
            <button onClick={() => onCreate({ id: contact.id, name: contact.name })}
              className="p-1.5 text-brand-600 active:text-brand-700"><Plus size={14} /></button>
          )}
          <button onClick={() => onEdit(contact)} className="p-1.5 text-gray-400 active:text-gray-700"><Edit2 size={13} /></button>
          <button onClick={() => onDelete(contact)} className="p-1.5 text-red-400 active:text-red-600"><Trash2 size={13} /></button>
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {children.map(c => (
            <TreeNode key={c.id} contact={c} all={all} depth={depth + 1}
              onEdit={onEdit} onDelete={onDelete} onCreate={onCreate}
              isAdmin={isAdmin} myRoleLevel={myRoleLevel} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateModal({ session, parent, roles, onClose, onSaved }: {
  session: Session;
  parent: { id: string | null; name: string };
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const role = roles.find(r => r.id === roleId);
      if (!role) { toast.error("Cargo inválido"); return; }

      let endpoint = "/api/apoiadores";
      let body: any = { name, phone, parentId: parent.id };
      if (role.level <= 1) {
        endpoint = "/api/coordinators";
        body = { name };
      } else if (role.level === 2) {
        endpoint = "/api/leaders";
        body = { name, coordinator: parent.name };
      }
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success("Criado");
      onSaved();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <BottomSheet open onClose={onClose} title="Adicionar à Rede">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500">
          {parent.id ? <>Criando abaixo de <span className="font-semibold text-gray-700">{parent.name}</span></> : <>Criando na raiz da rede</>}
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo *</label>
          <select required value={roleId} onChange={e => setRoleId(e.target.value)} className={inp}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
          <input required autoFocus value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Telefone (opcional, 11 dígitos)</label>
          <input type="tel" inputMode="numeric" maxLength={11}
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="68999551835" className={inp} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Criar"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function EditModal({ contact, isAdmin, onClose, onSaved }: {
  contact: Contact;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(() => {
    const d = (contact.phone || "").replace(/\D/g, "");
    return d.startsWith("55") ? d.slice(2) : d;
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const endpoint =
        contact.role.level <= 1 ? `/api/coordinators/${contact.id}` :
        contact.role.level === 2 ? `/api/leaders/${contact.id}` :
        `/api/apoiadores/${contact.id}`;
      const r = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success("Salvo");
      onSaved();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <BottomSheet open onClose={onClose} title={`Editar ${contact.role.label}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        {contact.role.level === 3 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Telefone (11 dígitos)</label>
            <input type="tel" inputMode="numeric" maxLength={11}
              value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="68999551835" className={inp} />
          </div>
        )}
        {contact.role.level <= 2 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Atenção: alterar o nome muda o link público. Os links anteriores deixarão de funcionar.
          </p>
        )}
        <div className="flex gap-2 pt-2">
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
