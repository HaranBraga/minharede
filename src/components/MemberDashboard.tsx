"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, Edit2, Phone, MapPin, ChevronRight, Home, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { ContactEditForm } from "./ContactEditForm";
import { PersonFormFields, personFormToPayload, initialPersonForm, type PersonFormState } from "./PersonFormFields";

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

const LEVEL_LABEL_SG: Record<number, string> = {
  0: "Coordenador de Grupo", 1: "Coordenador", 2: "Líder", 3: "Apoiador",
};

export function MemberDashboard({ session }: { session: MemberSession }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Navegação drill-down: stack de contactIds visitados (último = atual)
  const [path, setPath] = useState<string[]>([session.contactId]);
  const currentId = path[path.length - 1];

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
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

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach(c => m.set(c.id, c));
    return m;
  }, [contacts]);

  // Contato sendo visualizado (dados completos) — pode ser o próprio user ou um descendente
  const currentContact: { id: string; name: string; role?: Role | null; level: number } = useMemo(() => {
    if (currentId === session.contactId) {
      return { id: session.contactId, name: session.name, role: null, level: session.roleLevel };
    }
    const c = contactById.get(currentId);
    if (c) return { id: c.id, name: c.name, role: c.role, level: c.role.level };
    return { id: session.contactId, name: session.name, role: null, level: session.roleLevel };
  }, [currentId, session, contactById]);

  // Filhos diretos do contato atual
  const children = useMemo(() => {
    let list = contacts.filter(c => c.parentId === currentId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (a.role.level !== b.role.level) return a.role.level - b.role.level;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, currentId, search]);

  // Subárvore do contato atual (recursivo) pra contar total de descendentes
  const descendantCount = useMemo(() => {
    const visited = new Set<string>();
    let frontier = [currentId];
    let total = 0;
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        const kids = contacts.filter(c => c.parentId === id);
        for (const k of kids) {
          if (visited.has(k.id)) continue;
          visited.add(k.id);
          total++;
          next.push(k.id);
        }
      }
      frontier = next;
    }
    return total;
  }, [contacts, currentId]);

  // Cargo que o user pode criar nesse nível (filho do current)
  const targetChildLevel = useMemo(() => {
    // Cria sempre o nível imediatamente abaixo do contato atual
    return Math.min(3, currentContact.level + 1);
  }, [currentContact.level]);
  const canCreateHere = targetChildLevel > session.roleLevel;

  // Breadcrumb (max 3 niveis pra não estourar)
  const breadcrumb = useMemo(() => path.map(id => {
    if (id === session.contactId) return { id, name: "Você", isRoot: true };
    const c = contactById.get(id);
    return { id, name: c?.name ?? "?", isRoot: false };
  }), [path, contactById, session]);

  function navigateTo(id: string) {
    setSearch("");
    if (id === session.contactId) { setPath([session.contactId]); return; }
    // Se já está no path, trunca até esse id
    const idx = path.indexOf(id);
    if (idx >= 0) { setPath(path.slice(0, idx + 1)); return; }
    setPath([...path, id]);
  }
  function navigateUp() {
    if (path.length > 1) setPath(path.slice(0, -1));
  }

  async function deleteContact(c: Contact) {
    if (!confirm(`Excluir "${c.name}"?${c.role.level < 3 ? "\nDescendentes ficam desvinculados." : ""}`)) return;
    const r = await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-4 pb-24 relative">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {breadcrumb.map((b, i) => (
          <div key={b.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
            <button onClick={() => navigateTo(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${
                i === breadcrumb.length - 1
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
              }`}>
              {b.isRoot && <Home size={11} />}
              {b.name}
            </button>
          </div>
        ))}
      </nav>

      {/* Header do nó atual */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
            style={{
              backgroundColor: currentContact.role?.bgColor ?? session.roleBgColor ?? "#e0e7ff",
              color:           currentContact.role?.color   ?? session.roleColor   ?? "#4f46e5",
            }}>
            {currentContact.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base truncate">{currentContact.name}</p>
            <p className="text-xs text-gray-500">
              {LEVEL_LABEL_SG[currentContact.level] ?? "—"}
              {currentId !== session.contactId && <span> · da sua rede</span>}
            </p>
          </div>
          {path.length > 1 && (
            <button onClick={navigateUp}
              className="text-xs text-gray-500 active:text-gray-800 px-2 py-1 border border-gray-200 rounded-lg shrink-0">
              ← voltar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1"><Users size={10} />Diretos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{contacts.filter(c => c.parentId === currentId).length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Total na rede</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{descendantCount}</p>
          </div>
        </div>
      </section>

      {/* Busca + título da seção */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {currentId === session.contactId ? "Sua rede direta" : `Rede de ${currentContact.name}`}
        </h2>
        <span className="text-xs text-gray-400">{children.length} {children.length === 1 ? "pessoa" : "pessoas"}</span>
      </div>

      {contacts.filter(c => c.parentId === currentId).length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>
      ) : children.length === 0 ? (
        <EmptyState
          targetLevel={targetChildLevel}
          canCreate={canCreateHere}
          onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-2">
          {children.map(c => (
            <ChildRow key={c.id} contact={c}
              onOpen={() => navigateTo(c.id)}
              onEdit={() => setEditingId(c.id)}
              onDelete={() => deleteContact(c)} />
          ))}
        </div>
      )}

      {/* FAB */}
      {canCreateHere && children.length > 0 && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 active:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center z-30">
          <Plus size={24} />
        </button>
      )}

      {showCreate && (
        <CreateBelow
          parentId={currentId}
          parentName={currentContact.name}
          targetLevel={targetChildLevel}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }} />
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

function ChildRow({ contact, onOpen, onEdit, onDelete }: {
  contact: Contact;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const phoneStripped = (contact.phone || "").replace(/\D/g, "");
  const phoneShown = phoneStripped.startsWith("placeholder") ? null
    : phoneStripped.startsWith("55") ? phoneStripped.slice(2) : phoneStripped;
  const isApoiad = contact.role.level >= 3;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={onOpen} disabled={isApoiad}
        className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-gray-50 disabled:cursor-default disabled:active:bg-white">
        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ backgroundColor: contact.role.bgColor, color: contact.role.color }}>
          {contact.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
              style={{ color: contact.role.color, backgroundColor: contact.role.bgColor }}>
              {contact.role.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            {!isApoiad && contact._count.children > 0 && (
              <span className="font-semibold text-brand-600">{contact._count.children} {contact._count.children === 1 ? "pessoa" : "pessoas"}</span>
            )}
            {phoneShown && <span className="flex items-center gap-0.5"><Phone size={9} />{phoneShown}</span>}
            {contact.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{contact.cidade}</span>}
          </div>
        </div>
        {!isApoiad && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
      </button>
      <div className="flex border-t border-gray-100 divide-x divide-gray-100">
        <button onClick={onEdit}
          className="flex-1 py-2 text-xs font-medium text-gray-600 active:text-brand-700 active:bg-brand-50 flex items-center justify-center gap-1.5">
          <Edit2 size={12} /> Editar
        </button>
        <button onClick={onDelete}
          className="flex-1 py-2 text-xs font-medium text-red-500 active:text-red-700 active:bg-red-50 flex items-center justify-center gap-1.5">
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </div>
  );
}

function EmptyState({ targetLevel, canCreate, onCreate }: {
  targetLevel: number;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const target = LEVEL_LABEL_SG[targetLevel] ?? "pessoa";
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Users size={26} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">Nenhum {target.toLowerCase()} ainda</p>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        {canCreate
          ? `Toque abaixo pra adicionar o primeiro ${target.toLowerCase()}.`
          : `Você não tem permissão pra adicionar nesse nível.`}
      </p>
      {canCreate && (
        <button onClick={onCreate}
          className="inline-flex items-center gap-1.5 bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm">
          <Plus size={14} /> Adicionar {target}
        </button>
      )}
    </div>
  );
}

function CreateBelow({ parentId, parentName, targetLevel, onClose, onSaved }: {
  parentId: string;
  parentName: string;
  targetLevel: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PersonFormState>(initialPersonForm);
  const [busy, setBusy] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ username: string; password: string | null; name: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.length < 10) return;
    setBusy(true);
    try {
      let endpoint = "/api/apoiadores";
      const payload: any = personFormToPayload(form);
      if (targetLevel <= 1) endpoint = "/api/coordinators";
      else if (targetLevel === 2) {
        endpoint = "/api/leaders";
        payload.coordinator = parentName;
      } else {
        payload.parentId = parentId;
      }
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      const data = await r.json();
      toast.success("Adicionado");
      if (data.login?.username) {
        setCreatedLogin({
          username: data.login.username,
          password: data.login.defaultPassword,
          name: form.name,
        });
      } else {
        onSaved();
      }
    } finally { setBusy(false); }
  }

  const targetLabel = LEVEL_LABEL_SG[targetLevel] ?? "Pessoa";

  if (createdLogin) {
    return (
      <BottomSheet open onClose={onSaved} title="Login criado!">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{createdLogin.name}</span> foi adicionado(a) à sua rede com login automático.
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
            ⚠ Anote ou tire um print. A senha pode ser trocada no primeiro acesso.
          </p>
          <button onClick={onSaved}
            className="w-full py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl">
            OK, fechar
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={`Adicionar ${targetLabel}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-2">
          Abaixo de <span className="font-semibold text-gray-700">{parentName}</span>
        </p>
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
