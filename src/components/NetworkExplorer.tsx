"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Search, Trash2, Edit2, Phone, MapPin, ChevronRight, Home, Users,
  Link as LinkIcon, Copy, Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { ContactEditForm } from "./ContactEditForm";
import { PersonFormFields, personFormToPayload, initialPersonForm, type PersonFormState } from "./PersonFormFields";
import { CenteredLoader } from "./Spinner";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null; parentId: string | null;
  cidade?: string | null;
  role: Role;
  _count: { children: number };
}

/**
 * Sessão unificada — funciona tanto pra member (member dashboard) quanto
 * pra admin (admin dashboard).
 *
 * - isAdmin=true + contactId=null → admin vê toda a rede (raiz = top-level)
 * - isAdmin=false + contactId=X   → member vê a rede dele (raiz = X)
 */
export interface ExplorerSession {
  isAdmin: boolean;
  contactId: string | null;
  name: string;
  slug: string | null;
  roleLevel: number;        // -1 pra admin (criar tudo)
  roleLabel?: string;
  roleColor?: string;
  roleBgColor?: string;
}

const LEVEL_LABEL_SG: Record<number, string> = {
  0: "Coordenador de Grupo", 1: "Coordenador", 2: "Líder", 3: "Apoiador",
};
const LEVEL_LABEL_PL: Record<number, string> = {
  0: "Coordenadores de Grupo", 1: "Coordenadores", 2: "Líderes", 3: "Apoiadores",
};

export function NetworkExplorer({ session }: { session: ExplorerSession }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // path: stack de contactIds. Empty array = raiz da rede inteira (admin).
  // Pra member: começa com [contactId] (vê próprios filhos). Pra admin: [] (vê top-level).
  const [path, setPath] = useState<string[]>(
    session.contactId ? [session.contactId] : []
  );
  const currentId: string | null = path[path.length - 1] ?? null;

  // Categoria selecionada dentro do nó atual (drill em "Coordenadores",
  // "Líderes" ou "Apoiadores" diretos do nó). null = mostra os cards de
  // categoria; número = mostra a lista daquele cargo.
  const [category, setCategory] = useState<number | null>(null);

  // Reseta categoria ao navegar pra outro nó
  useEffect(() => { setCategory(null); }, [currentId]);

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/rede");
      if (r.ok) setContacts((await r.json()).contacts ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach(c => m.set(c.id, c));
    return m;
  }, [contacts]);

  // Contato sendo visualizado
  const currentContact: { id: string | null; name: string; slug: string | null; role: Role | null; level: number } = useMemo(() => {
    if (currentId === null) {
      return { id: null, name: "Toda a rede", slug: null, role: null, level: -1 };
    }
    if (currentId === session.contactId) {
      return { id: session.contactId, name: session.name, slug: session.slug, role: null, level: session.roleLevel };
    }
    const c = contactById.get(currentId);
    if (c) return { id: c.id, name: c.name, slug: c.publicSlug, role: c.role, level: c.role.level };
    return { id: currentId, name: "?", slug: null, role: null, level: 99 };
  }, [currentId, session, contactById]);

  // Todos os filhos diretos (sem filtro de busca)
  const allChildren = useMemo(() => {
    return contacts.filter(c => c.parentId === currentId)
      .sort((a, b) => {
        if (a.role.level !== b.role.level) return a.role.level - b.role.level;
        return a.name.localeCompare(b.name);
      });
  }, [contacts, currentId]);

  // Categorias presentes (cargos que têm pelo menos 1 filho direto)
  const categories = useMemo(() => {
    const map = new Map<number, { level: number; role: Role; items: Contact[] }>();
    for (const c of allChildren) {
      const g = map.get(c.role.level);
      if (g) g.items.push(c);
      else map.set(c.role.level, { level: c.role.level, role: c.role, items: [c] });
    }
    return Array.from(map.values()).sort((a, b) => a.level - b.level);
  }, [allChildren]);

  // Quando uma categoria está selecionada, lista filtrada pelo search
  const categoryItems = useMemo(() => {
    if (category === null) return [];
    let list = allChildren.filter(c => c.role.level === category);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list;
  }, [allChildren, category, search]);

  // Total descendentes recursivo
  const descendantCount = useMemo(() => {
    if (currentId === null) return contacts.length;
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

  // Cargos que o user pode criar abaixo do contato atual
  const availableLevels = useMemo(() => {
    const minByCurrent = currentContact.level + 1;
    const minBySession = session.roleLevel + 1;
    const min = Math.max(minByCurrent, minBySession);
    return [0, 1, 2, 3].filter(lv => lv >= Math.max(0, min));
  }, [currentContact.level, session.roleLevel]);
  const canCreateHere = availableLevels.length > 0;

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const items: { id: string | null; name: string; isRoot: boolean }[] = [];
    if (session.isAdmin) {
      items.push({ id: null, name: "Toda a rede", isRoot: true });
    }
    path.forEach(id => {
      if (id === session.contactId) {
        items.push({ id, name: session.isAdmin ? (contactById.get(id)?.name ?? "?") : "Você", isRoot: !session.isAdmin });
      } else {
        const c = contactById.get(id);
        items.push({ id, name: c?.name ?? "?", isRoot: false });
      }
    });
    return items;
  }, [path, contactById, session]);

  function navigateTo(id: string | null) {
    setSearch("");
    if (id === null) { setPath([]); return; }
    const idx = path.indexOf(id);
    if (idx >= 0) { setPath(path.slice(0, idx + 1)); return; }
    setPath([...path, id]);
  }
  function navigateUp() {
    if (path.length > 0) setPath(path.slice(0, -1));
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
          <div key={b.id ?? "root"} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
            <button onClick={() => navigateTo(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${
                i === breadcrumb.length - 1
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
              }`}>
              {b.isRoot && (b.id === null ? <Globe size={11} /> : <Home size={11} />)}
              {b.name}
            </button>
          </div>
        ))}
      </nav>

      {/* Header do nó atual */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {currentId === null ? (
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Globe size={22} />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
              style={{
                backgroundColor: currentContact.role?.bgColor ?? session.roleBgColor ?? "#e0e7ff",
                color:           currentContact.role?.color   ?? session.roleColor   ?? "#4f46e5",
              }}>
              {currentContact.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base truncate">{currentContact.name}</p>
            <p className="text-xs text-gray-500">
              {currentId === null ? "Visão de administrador" : (LEVEL_LABEL_SG[currentContact.level] ?? "—")}
              {currentId !== session.contactId && currentId !== null && <span> · da sua rede</span>}
            </p>
          </div>
          {path.length > (session.isAdmin ? 0 : 1) && (
            <button onClick={navigateUp}
              className="text-xs text-gray-500 active:text-gray-800 px-2 py-1 border border-gray-200 rounded-lg shrink-0">
              ← voltar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1">
              <Users size={10} />Diretos
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {contacts.filter(c => c.parentId === currentId).length}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">
              {currentId === null ? "Total cadastrados" : "Total na rede"}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{descendantCount}</p>
          </div>
        </div>

        {/* Link público pra apoiador se cadastrar */}
        {currentContact.level >= 0 && currentContact.level <= 2 && currentContact.slug && (() => {
          const kind = currentContact.level <= 1 ? "coord_form" : "lider";
          const url  = `${typeof window !== "undefined" ? window.location.origin : ""}/?${kind}=${encodeURIComponent(currentContact.slug)}`;
          return (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <LinkIcon size={10} />Link pra apoiador se cadastrar
              </p>
              <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
                <input readOnly value={url}
                  className="flex-1 bg-transparent text-xs text-gray-700 outline-none truncate select-all" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}
                  className="text-xs font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-lg px-3 py-2 flex items-center gap-1 shrink-0">
                  <Copy size={12} /> Copiar
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                Cadastros via esse link entram automaticamente sob <strong>{currentContact.name}</strong>.
              </p>
            </div>
          );
        })()}
      </section>

      {/* === MODO CATEGORIA: lista filtrada por cargo === */}
      {category !== null ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setCategory(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 active:text-brand-700">
              <ChevronRight size={14} className="rotate-180" />
              {LEVEL_LABEL_PL[category]}
            </button>
            <span className="text-xs text-gray-400">
              {categoryItems.length} {categoryItems.length === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>

          {allChildren.filter(c => c.role.level === category).length > 5 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Buscar em ${LEVEL_LABEL_PL[category]?.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
          )}

          {loading ? (
            <CenteredLoader />
          ) : categoryItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nada encontrado.</p>
          ) : (
            <div className="space-y-2">
              {categoryItems.map(c => (
                <ChildRow key={c.id} contact={c}
                  onOpen={() => navigateTo(c.id)}
                  onEdit={() => setEditingId(c.id)}
                  onDelete={() => deleteContact(c)} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* === MODO RAIZ: cards de categoria + ações === */
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              {currentId === null ? "Top da rede" : `Rede de ${currentContact.name}`}
            </h2>
          </div>

          {loading ? (
            <CenteredLoader />
          ) : allChildren.length === 0 ? (
            <EmptyState
              availableLevels={availableLevels}
              canCreate={canCreateHere}
              onCreate={() => setShowCreate(true)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <CategoryCard key={cat.level}
                  level={cat.level}
                  role={cat.role}
                  count={cat.items.length}
                  onClick={() => setCategory(cat.level)} />
              ))}
            </div>
          )}
        </>
      )}

      {canCreateHere && allChildren.length > 0 && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 active:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center z-30 transition-transform active:scale-95">
          <Plus size={24} />
        </button>
      )}

      {showCreate && (
        <CreateBelow
          parentId={currentId}
          parentName={currentContact.name}
          availableLevels={availableLevels}
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

function CategoryCard({ level, role, count, onClick }: {
  level: number;
  role: Role;
  count: number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl p-4 text-left active:scale-[0.98] active:bg-gray-50 transition-transform overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8"
        style={{ backgroundColor: role.color }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: role.bgColor, color: role.color }}>
          <Users size={18} />
        </div>
        <p className="text-3xl font-bold text-gray-900 leading-none">{count}</p>
        <p className="text-[11px] uppercase tracking-wide font-semibold mt-1.5"
          style={{ color: role.color }}>
          {LEVEL_LABEL_PL[level] ?? role.label}
        </p>
        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          Ver lista <ChevronRight size={10} />
        </p>
      </div>
    </button>
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
              <span className="font-semibold text-brand-600">
                {contact._count.children} {contact._count.children === 1 ? "pessoa" : "pessoas"}
              </span>
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

function EmptyState({ availableLevels, canCreate, onCreate }: {
  availableLevels: number[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  const labels = availableLevels.map(lv => LEVEL_LABEL_SG[lv]?.toLowerCase() ?? "pessoa");
  const desc = labels.length === 0 ? "pessoa"
    : labels.length === 1 ? labels[0]
    : labels.slice(0, -1).join(", ") + " ou " + labels[labels.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Users size={26} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">Rede vazia</p>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        {canCreate ? `Adicione ${desc} abaixo.` : "Você não tem permissão pra adicionar nesse nível."}
      </p>
      {canCreate && (
        <button onClick={onCreate}
          className="inline-flex items-center gap-1.5 bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm">
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  );
}

function CreateBelow({ parentId, parentName, availableLevels, onClose, onSaved }: {
  parentId: string | null;
  parentName: string;
  availableLevels: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PersonFormState>(initialPersonForm);
  const [selectedLevel, setSelectedLevel] = useState<number>(
    availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : 3
  );
  const [busy, setBusy] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ username: string; password: string | null; name: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.length < 10) return;
    setBusy(true);
    try {
      let endpoint = "/api/apoiadores";
      const payload: any = personFormToPayload(form);
      if (selectedLevel <= 1) endpoint = "/api/coordinators";
      else if (selectedLevel === 2) {
        endpoint = "/api/leaders";
        if (parentId) payload.coordinator = parentName;
      } else if (parentId) {
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

  if (createdLogin) {
    return (
      <BottomSheet open onClose={onSaved} title="Login criado!">
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
    <BottomSheet open onClose={onClose} title="Adicionar à rede">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-2">
          Abaixo de <span className="font-semibold text-gray-700">{parentName}</span>
        </p>

        {availableLevels.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo *</label>
            <div className="grid grid-cols-2 gap-2">
              {availableLevels.map(lv => (
                <button key={lv} type="button" onClick={() => setSelectedLevel(lv)}
                  className={`py-2.5 px-3 text-sm font-semibold rounded-xl border transition-colors ${
                    selectedLevel === lv
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 active:bg-gray-50"
                  }`}>
                  {LEVEL_LABEL_SG[lv]}
                </button>
              ))}
            </div>
          </div>
        )}

        <PersonFormFields form={form} setForm={setForm}
          alwaysExpanded={selectedLevel === 3} />

        <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white -mx-5 px-5 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : `Adicionar ${LEVEL_LABEL_SG[selectedLevel] ?? ""}`}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
