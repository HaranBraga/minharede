"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NetworkBrowser } from "@/components/NetworkBrowser";
import { BottomSheet } from "@/components/BottomSheet";
import {
  Users, Network as NetworkIcon, Upload, Download, Plus, Edit2, Trash2,
  ShieldCheck, Eye, EyeOff, Search, X, KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserRow {
  id: string; name: string; username: string | null;
  isAdmin: boolean; active: boolean; contactId: string | null;
  contact?: { id: string; name: string; publicSlug: string | null; role: { label: string; color: string; bgColor: string; level: number } } | null;
}
interface ContactSearchItem {
  id: string; name: string; publicSlug: string | null;
  role: { label: string; color: string; bgColor: string; level: number };
  user: { id: string; username: string | null } | null;
}
interface Me {
  id: string; name: string; isAdmin: boolean;
  contactId: string | null; roleLevel: number | null;
  contactSlug: string | null; contactName: string | null;
}

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"rede" | "users" | "import">("rede");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user));
  }, []);

  if (!me) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;

  return (
    <div className="min-h-screen pb-16">
      <AppHeader
        subtitle="Painel administrativo"
        showAdminLink={false}
      />

      {/* Tabs (mobile-first) */}
      <div className="sticky top-[60px] z-20 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-2 flex">
          <TabButton active={tab === "rede"} onClick={() => setTab("rede")} icon={NetworkIcon} label="Rede" />
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="Usuários" />
          <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={Upload} label="Importar" />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {tab === "rede" && <NetworkBrowser me={me} />}
        {tab === "users" && <UsersTab />}
        {tab === "import" && <ImportTab />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1.5 py-3 px-2 text-xs md:text-sm font-medium border-b-2 transition-colors ${
        active ? "text-brand-700 border-brand-600" : "text-gray-500 border-transparent active:text-gray-700"
      }`}>
      <Icon size={15} /> {label}
    </button>
  );
}

// ── Tab: Usuários ─────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function del(u: UserRow) {
    if (!confirm(`Excluir usuário "${u.name}"?`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }
  async function toggleActive(u: UserRow) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    load();
  }

  return (
    <div className="space-y-3">
      <button onClick={() => { setEditing(null); setShowForm(true); }}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl py-3 text-sm">
        <Plus size={15} /> Novo usuário
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {users.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum usuário</p>}
        {users.map(u => (
          <div key={u.id} className="px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                {u.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                  {u.isAdmin && <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-px rounded-full font-semibold flex items-center gap-1"><ShieldCheck size={9} />admin</span>}
                  {!u.active && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-px rounded-full">inativo</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">@{u.username}{u.contact && ` · ${u.contact.name} (${u.contact.role.label})`}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
              <button onClick={() => { setEditing(u); setShowForm(true); }}
                className="text-[11px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 active:bg-gray-100">
                <Edit2 size={10} className="inline mr-1" />editar
              </button>
              <button onClick={() => setPwdTarget(u)}
                className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 active:bg-blue-100">
                <KeyRound size={10} className="inline mr-1" />senha
              </button>
              <button onClick={() => toggleActive(u)}
                className="text-[11px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 active:bg-gray-100">
                {u.active ? "desativar" : "ativar"}
              </button>
              <button onClick={() => del(u)}
                className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 active:bg-red-100">
                <Trash2 size={10} className="inline mr-1" />excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <UserForm initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {pwdTarget && (
        <ChangePwdForm user={pwdTarget} onClose={() => setPwdTarget(null)} />
      )}
    </div>
  );
}

function ContactPicker({ value, onChange }: { value: ContactSearchItem | null; onChange: (c: ContactSearchItem | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactSearchItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/contacts-search?q=${encodeURIComponent(q)}`)
        .then(r => r.json()).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 border border-brand-200 bg-brand-50 rounded-xl px-3 py-2">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: value.role.bgColor, color: value.role.color }}>
          {value.name[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
          <p className="text-[10px] text-gray-500">{value.role.label}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-gray-400"><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar contato..."
        className="w-full pl-9 pr-3 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {results.map(c => (
            <button key={c.id} type="button" disabled={!!c.user}
              onClick={() => { onChange(c); setOpen(false); setQ(""); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 active:bg-gray-50 text-left disabled:opacity-50">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ backgroundColor: c.role.bgColor, color: c.role.color }}>
                {c.name[0]?.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-500">{c.role.label}{c.user && ` · vinculado a @${c.user.username}`}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserForm({ initial, onClose, onSaved }: { initial: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName]     = useState(initial?.name ?? "");
  const [username, setUser] = useState(initial?.username ?? "");
  const [password, setPwd]  = useState("");
  const [showPwd, setShow]  = useState(false);
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false);
  const [active, setActive]   = useState(initial?.active ?? true);
  const [contact, setContact] = useState<ContactSearchItem | null>(
    initial?.contact ? {
      id: initial.contact.id, name: initial.contact.name, publicSlug: initial.contact.publicSlug,
      role: { ...initial.contact.role }, user: null,
    } : null
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const url = initial ? `/api/admin/users/${initial.id}` : "/api/admin/users";
      const body: any = { name, username, isAdmin, active, contactId: contact?.id ?? null };
      if (password) body.password = password;
      const r = await fetch(url, {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success(initial ? "Atualizado" : "Criado");
      onSaved();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <BottomSheet open onClose={onClose} title={initial ? "Editar Usuário" : "Novo Usuário"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
          <input required value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Usuário *</label>
          <input required value={username} onChange={e => setUser(e.target.value.toLowerCase())} autoCapitalize="none" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {initial ? "Nova senha (vazio = manter)" : "Senha *"}
          </label>
          <div className="relative">
            <input required={!initial} type={showPwd ? "text" : "password"}
              value={password} onChange={e => setPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres" className={inp + " pr-11"} />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-600" />
            <ShieldCheck size={14} className="text-amber-500" /> Admin total
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-600" />
            Ativo
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Contato vinculado <span className="text-gray-400">(define o ramo da rede)</span>
          </label>
          <ContactPicker value={contact} onChange={setContact} />
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : (initial ? "Atualizar" : "Criar")}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function ChangePwdForm({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success("Senha atualizada");
      onClose();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";

  return (
    <BottomSheet open onClose={onClose} title={`Trocar senha de ${user.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nova senha</label>
          <div className="relative">
            <input required type={show ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres" className={inp + " pr-11"} autoFocus />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Atualizar senha"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

// ── Tab: Importar/Exportar ────────────────────────────────────────────────────
function ImportTab() {
  const [csvText, setCsv] = useState("");
  const [busy, setBusy]   = useState(false);
  const [report, setReport] = useState<any>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }
  async function importNow() {
    if (!csvText.trim()) { toast.error("Cole o CSV ou suba um arquivo"); return; }
    setBusy(true); setReport(null);
    try {
      const r = await fetch("/api/leaders/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Falha"); return; }
      setReport(d);
      toast.success(d.message || "Importado");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <a href="/api/leaders/export" target="_blank" rel="noreferrer"
        className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-gray-800 active:bg-gray-700 rounded-xl">
        <Download size={15} /> Exportar CSV
      </a>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={15} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Importar CSV</h2>
        </div>
        <p className="text-xs text-gray-500">
          Formato: <code className="bg-gray-100 px-1 rounded">Nome,Link,Coordenador</code>, depois
          seção <code className="bg-gray-100 px-1 rounded">#COORDENADORES</code> com <code className="bg-gray-100 px-1 rounded">Nome,Link</code>.
        </p>
        <label className="block">
          <span className="text-xs text-gray-600">Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="block mt-1.5 text-xs" />
        </label>
        <textarea value={csvText} onChange={e => setCsv(e.target.value)}
          placeholder="Ou cole o CSV aqui..." rows={6}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-600" />
        <button onClick={importNow} disabled={busy}
          className="w-full py-3 text-sm font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
          {busy ? "Importando..." : "Importar"}
        </button>
        {report && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
            {report.message}
          </div>
        )}
      </div>
    </div>
  );
}
