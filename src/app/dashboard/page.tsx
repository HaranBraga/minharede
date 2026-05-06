"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, LogOut, Copy, Search, Users, Link as LinkIcon, ShieldCheck,
  ChevronDown, ChevronRight, X,
} from "lucide-react";
import toast from "react-hot-toast";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; publicSlug: string | null; phone: string;
  role: Role;
  parent: { id: string; name: string } | null;
  parentId: string | null;
  _count: { children: number };
}

interface Me {
  id: string; name: string; isAdmin: boolean;
  contactId: string | null; contactSlug: string | null; roleLevel: number | null;
}

function publicLinkFor(slug: string | null, kind: "lider" | "coord" | "coord_form"): string {
  if (!slug) return "";
  const base = window.location.origin;
  return `${base}/?${kind}=${encodeURIComponent(slug)}`;
}

function CopyableLink({ url, label }: { url: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
      <LinkIcon size={13} className="text-brand-600 shrink-0" />
      <input readOnly value={url} className="flex-1 bg-transparent text-xs text-gray-700 outline-none truncate" />
      <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}
        className="text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded px-2 py-1 flex items-center gap-1 shrink-0">
        <Copy size={11} /> {label || "Copiar"}
      </button>
    </div>
  );
}

function CreateForm({ me, parentContactId, parentName, onSaved, onClose }: {
  me: Me;
  parentContactId: string;
  parentName: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/roles").then(r => r.json()).then((all: Role[]) => {
      // Filtra: só níveis estritamente abaixo do parent (parent não é o user, é o nó alvo)
      // Para admin: tudo; pra não-admin a API já filtrou.
      setRoles(all);
      if (all.length > 0) setRoleId(all[0].id);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/rede/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, roleId, parentId: parentContactId }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Erro"); return; }
      toast.success("Criado!");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-gray-500">
        Criando abaixo de <span className="font-semibold text-gray-700">{parentName}</span>
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
        <input required autoFocus value={name} onChange={e => setName(e.target.value)} className={inp} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Telefone (opcional, 11 dígitos)</label>
        <input type="tel" inputMode="numeric" maxLength={11}
          value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="68999551835" className={inp} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Cargo *</label>
        <select required value={roleId} onChange={e => setRoleId(e.target.value)} className={inp}>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60">
          {saving ? "Salvando..." : "Criar"}
        </button>
      </div>
    </form>
  );
}

function NodeCard({ node, descendants, depth, me, onCreated, onSelect }: {
  node: Contact;
  descendants: Contact[];
  depth: number;
  me: Me;
  onCreated: () => void;
  onSelect: (c: Contact) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const children = descendants.filter(d => d.parentId === node.id);
  const hasChildren = children.length > 0;
  const canCreateBelow = me.isAdmin || (me.roleLevel != null && node.role.level >= me.roleLevel);
  const linkKind = node.role.key === "COORDENADOR" ? "coord" : "lider";

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg group">
        <button
          onClick={() => setOpen(o => !o)}
          className={`p-1 ${hasChildren ? "text-gray-500 hover:text-gray-700" : "text-gray-200 cursor-default"}`}
          disabled={!hasChildren}
        >
          {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <ChevronRight size={14} />}
        </button>
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: node.role.bgColor, color: node.role.color }}>
          {node.name[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{node.name}</p>
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
              style={{ color: node.role.color, backgroundColor: node.role.bgColor }}>
              {node.role.label}
            </span>
          </div>
          {node._count.children > 0 && (
            <p className="text-[11px] text-gray-400">{node._count.children} {node._count.children === 1 ? "abaixo" : "abaixo"}</p>
          )}
        </div>
        {node.publicSlug && (
          <button
            onClick={() => {
              const link = publicLinkFor(node.publicSlug, linkKind);
              navigator.clipboard.writeText(link);
              toast.success("Link copiado");
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-brand-600 px-2 py-1 flex items-center gap-1"
            title="Copiar link público"
          >
            <LinkIcon size={11} /> link
          </button>
        )}
        {canCreateBelow && (
          <button
            onClick={() => onSelect(node)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-2.5 py-1 flex items-center gap-1"
          >
            <Plus size={11} /> abaixo
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="ml-7 border-l border-gray-200 pl-2">
          {children.map(c => (
            <NodeCard key={c.id} node={c} descendants={descendants} depth={depth + 1}
              me={me} onCreated={onCreated} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<{
    rootName: string; rootSlug: string | null; rootRoleLabel?: string; rootRoleLevel?: number;
    iAmAdmin: boolean; descendants: Contact[]; message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createTarget, setCreateTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, redeRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/rede"),
      ]);
      if (!meRes.ok) { router.replace("/login"); return; }
      const meData = await meRes.json();
      setMe(meData.user);
      if (redeRes.ok) setData(await redeRes.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const filteredDescendants = useMemo(() => {
    if (!data || !search.trim()) return data?.descendants ?? [];
    const q = search.toLowerCase();
    return data.descendants.filter(d => d.name.toLowerCase().includes(q));
  }, [data, search]);

  // Topo da árvore: nodes que têm parentId = rootId OU parentId = null (caso admin)
  const topLevelNodes = useMemo(() => {
    if (!data) return [];
    if (data.iAmAdmin && !me?.contactId) {
      // Admin "view tudo": top-level = quem não tem parent
      return data.descendants.filter(d => !d.parentId);
    }
    return data.descendants.filter(d => d.parent && d.parent.id === me?.contactId);
  }, [data, me]);

  if (loading || !me) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;
  }

  const myLink = me.contactSlug
    ? publicLinkFor(me.contactSlug, (me.roleLevel ?? 99) <= 1 ? "coord" : "lider")
    : null;
  const myFormLink = me.contactSlug && (me.roleLevel ?? 99) <= 1
    ? publicLinkFor(me.contactSlug, "coord_form")
    : null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">MR</div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Minha Rede</h1>
              <p className="text-xs text-gray-500">
                {me.name}
                {me.isAdmin && <span className="ml-2 inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-px rounded-full text-[10px]"><ShieldCheck size={9} />admin</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me.isAdmin && (
              <a href="/admin" className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Admin
              </a>
            )}
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1.5">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {data?.message && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            {data.message}
          </div>
        )}

        {(myLink || myFormLink) && (
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-brand-600" />
              <p className="text-sm font-semibold text-gray-700">Meus links</p>
            </div>
            {myLink && <CopyableLink url={myLink} label={(me.roleLevel ?? 99) <= 1 ? "Dashboard" : "Formulário"} />}
            {myFormLink && <CopyableLink url={myFormLink} label="Formulário" />}
          </section>
        )}

        <section className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <Users size={16} className="text-gray-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{data?.rootName ?? "Minha Rede"}</p>
              <p className="text-xs text-gray-500">{data?.descendants.length ?? 0} pessoa(s) na rede</p>
            </div>
            {me.contactId && (
              <button
                onClick={() => setCreateTarget({ id: me.contactId!, name: data?.rootName ?? "você" })}
                className="text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
              >
                <Plus size={12} /> Adicionar abaixo
              </button>
            )}
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar pelo nome..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
          </div>

          <div className="p-2 max-h-[600px] overflow-y-auto">
            {search ? (
              filteredDescendants.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Nada encontrado</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredDescendants.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg group">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: c.role.bgColor, color: c.role.color }}>
                        {c.name[0]?.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400">{c.role.label}{c.parent && ` · sob ${c.parent.name}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : topLevelNodes.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Sua rede ainda está vazia. Clique em "Adicionar abaixo" pra começar.
              </p>
            ) : (
              <div className="space-y-0.5">
                {topLevelNodes.map(n => (
                  <NodeCard key={n.id} node={n} descendants={data!.descendants} depth={0}
                    me={me} onCreated={load} onSelect={(c) => setCreateTarget({ id: c.id, name: c.name })} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {createTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateTarget(null)} />
          <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Adicionar à Rede</h3>
              <button onClick={() => setCreateTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <CreateForm
              me={me}
              parentContactId={createTarget.id}
              parentName={createTarget.name}
              onSaved={load}
              onClose={() => setCreateTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
