"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Upload, ArrowLeft, Plus, Edit2, Trash2, ShieldCheck, Eye, EyeOff,
  Search, X, Link as LinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserRow {
  id: string; name: string; username: string | null;
  isAdmin: boolean; active: boolean; contactId: string | null;
  contact?: { id: string; name: string; publicSlug: string | null; role: { label: string; color: string; bgColor: string } } | null;
}

interface ContactSearchItem {
  id: string; name: string; publicSlug: string | null;
  role: { label: string; color: string; bgColor: string; level: number };
  user: { id: string; username: string | null } | null;
}

function ContactPicker({ value, onChange }: { value: ContactSearchItem | null; onChange: (c: ContactSearchItem | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactSearchItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/contacts-search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(setResults)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 border border-brand-200 bg-brand-50 rounded-lg px-3 py-2">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: value.role.bgColor, color: value.role.color }}>
          {value.name[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
          <p className="text-[11px] text-gray-500">{value.role.label}{value.publicSlug && ` · ${value.publicSlug}`}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar contato pra vincular..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {results.map(c => (
            <button key={c.id} type="button"
              disabled={!!c.user}
              onClick={() => { onChange(c); setOpen(false); setQ(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{ backgroundColor: c.role.bgColor, color: c.role.color }}>
                {c.name[0]?.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-500">{c.role.label}{c.user && ` · já vinculado a @${c.user.username}`}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserForm({ initial, onSaved, onClose }: {
  initial?: UserRow & { contact?: any } | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName]     = useState(initial?.name ?? "");
  const [username, setUser] = useState(initial?.username ?? "");
  const [password, setPwd]  = useState("");
  const [showPwd, setShow]  = useState(false);
  const [isAdmin, setAdmin] = useState(initial?.isAdmin ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [contact, setContact] = useState<ContactSearchItem | null>(
    initial?.contact ? {
      id: initial.contact.id,
      name: initial.contact.name,
      publicSlug: initial.contact.publicSlug,
      role: { ...initial.contact.role, level: 0 },
      user: null,
    } : null
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = initial?.id ? `/api/admin/users/${initial.id}` : "/api/admin/users";
      const method = initial?.id ? "PUT" : "POST";
      const body: any = { name, username, isAdmin, active, contactId: contact?.id ?? null };
      if (password) body.password = password;
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success(initial?.id ? "Atualizado" : "Criado");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Usuário *</label>
          <input required value={username} onChange={e => setUser(e.target.value.toLowerCase())} autoCapitalize="none" className={inp} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {initial?.id ? "Nova senha (vazio = manter)" : "Senha *"}
        </label>
        <div className="relative">
          <input required={!initial?.id} type={showPwd ? "text" : "password"}
            value={password} onChange={e => setPwd(e.target.value)}
            placeholder="Mínimo 6 caracteres" className={inp + " pr-10"} />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isAdmin} onChange={e => setAdmin(e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-600" />
          <ShieldCheck size={13} className="text-amber-500" />
          <span>Admin</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-600" />
          <span>Ativo</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Contato vinculado <span className="text-gray-400">(define o ramo da rede)</span>
        </label>
        <ContactPicker value={contact} onChange={setContact} />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60">
          {saving ? "Salvando..." : (initial?.id ? "Atualizar" : "Criar")}
        </button>
      </div>
    </form>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [csvText, setCsv]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [report, setReport] = useState<any>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function importNow() {
    if (!csvText.trim()) { toast.error("Cole o CSV ou suba um arquivo"); return; }
    setBusy(true); setReport(null);
    try {
      const r = await fetch("/api/admin/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Falha"); return; }
      setReport(d);
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Upload size={15} className="text-brand-600" />
        <h2 className="font-semibold text-gray-900 text-sm">Importar rede do CSV</h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Formato: cabeçalho <code className="bg-gray-100 px-1 rounded">Nome,Link,Coordenador</code>, depois
        seção <code className="bg-gray-100 px-1 rounded">#COORDENADORES</code> com <code className="bg-gray-100 px-1 rounded">Nome,Link</code>.
        Compatível com export do minha-rede atual.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <input type="file" accept=".csv,text/csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="text-xs" />
        </div>
        <textarea value={csvText} onChange={e => setCsv(e.target.value)}
          placeholder="Ou cole o CSV aqui..." rows={6}
          className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-600" />
        <button onClick={importNow} disabled={busy}
          className="self-start px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60">
          {busy ? "Importando..." : "Importar"}
        </button>

        {report && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
            <p>✓ Coordenadores: {report.coordsCreated} criados, {report.coordsSkipped} já existiam</p>
            <p>✓ Líderes: {report.leadersCreated} criados, {report.leadersSkipped} já existiam</p>
            {report.errors?.length > 0 && (
              <p className="text-red-700">⚠ {report.errors.length} erro(s): {report.errors.slice(0,3).join("; ")}{report.errors.length > 3 ? "..." : ""}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "import">("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function del(u: UserRow) {
    if (!confirm(`Excluir "${u.name}"?`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído"); load();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-500">Gestão de usuários e importação da rede</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-3">
        <div className="flex gap-1 border-b border-gray-200">
          <button onClick={() => setTab("users")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "users" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Users size={14} /> Usuários
          </button>
          <button onClick={() => setTab("import")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "import" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Upload size={14} /> Importar
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {tab === "users" && (
          <>
            <div className="flex justify-end">
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-2">
                <Plus size={13} /> Novo usuário
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {users.length === 0 && <p className="py-10 text-center text-gray-400 text-sm">Nenhum usuário</p>}
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm">{u.name}</p>
                      {u.isAdmin && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1"><ShieldCheck size={9} />admin</span>}
                      {!u.active && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">inativo</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">@{u.username}{u.contact && ` · ${u.contact.name} (${u.contact.role.label})`}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 size={14} /></button>
                    <button onClick={() => del(u)} className="p-1.5 hover:bg-red-100 rounded text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "import" && <ImportPanel onDone={load} />}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">{editing ? "Editar Usuário" : "Novo Usuário"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <UserForm initial={editing} onSaved={load} onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
