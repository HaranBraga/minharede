"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, LogOut, Network, KeyRound, Users, Crown,
  Search, Plus, Edit2, Trash2, Eye, EyeOff, Power, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { NetworkExplorer } from "@/components/NetworkExplorer";
import { PessoasFlat } from "@/components/PessoasFlat";
import { AdminUsersTab } from "@/components/AdminUsersTab";
import { BottomSheet } from "@/components/BottomSheet";
import { PersonFormFields, personFormToPayload, initialPersonForm, type PersonFormState } from "@/components/PersonFormFields";
import { CenteredLoader, Spinner } from "@/components/Spinner";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"rede" | "pessoas" | "users" | "admins">("rede");
  const [me, setMe] = useState<{ name: string; isSuperAdmin: boolean; adminUserId: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.session?.type === "admin") {
        setMe({
          name: d.session.name ?? "Admin",
          isSuperAdmin: d.session.isSuperAdmin === true,
          adminUserId: d.session.adminUserId ?? null,
        });
      }
    }).catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm shadow-amber-500/30">
            <ShieldCheck size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Painel Admin</p>
            <p className="text-[11px] text-gray-500 truncate">
              {me?.name ? `${me.name}${me.isSuperAdmin ? " · super" : ""}` : "Minha Rede"}
            </p>
          </div>
          <button onClick={logout}
            className="text-xs font-medium text-gray-600 bg-gray-100 active:bg-gray-200 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors">
            <LogOut size={12} /> Sair
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-3 flex gap-1 overflow-x-auto">
          <TabButton active={tab === "rede"}     onClick={() => setTab("rede")}     icon={Network}  label="Rede" />
          <TabButton active={tab === "pessoas"}  onClick={() => setTab("pessoas")}  icon={Users}    label="Pessoas" />
          <TabButton active={tab === "users"}    onClick={() => setTab("users")}    icon={KeyRound} label="Logins" />
          {me?.isSuperAdmin && (
            <TabButton active={tab === "admins"} onClick={() => setTab("admins")} icon={Crown} label="Admins" />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {tab === "rede"  && (
          <NetworkExplorer session={{
            isAdmin: true,
            contactId: null,
            name: "Admin",
            slug: null,
            roleLevel: -1,
          }} />
        )}
        {tab === "pessoas" && <PessoasFlat canChangeRole />}
        {tab === "users"   && <UsersTab />}
        {tab === "admins" && me?.isSuperAdmin && <AdminUsersTab myAdminUserId={me.adminUserId} />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
        active ? "text-brand-700 border-brand-600 bg-brand-50/50"
               : "text-gray-500 border-transparent active:bg-gray-50"
      }`}>
      <Icon size={14} /> {label}
    </button>
  );
}

// ── Tab: Logins (RedeUsers) ───────────────────────────────────────────────────

interface RedeUserRow {
  id: string; username: string; active: boolean; lastLogin: string | null; createdAt: string;
  contact: {
    id: string; name: string; publicSlug: string | null;
    role: { id: string; key: string; label: string; color: string; bgColor: string; level: number };
    parent: { id: string; name: string } | null;
  };
}

function UsersTab() {
  const [users, setUsers] = useState<RedeUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RedeUserRow | null>(null);
  const [pwdTarget, setPwdTarget] = useState<RedeUserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users");
      if (r.ok) setUsers(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(u: RedeUserRow) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    load();
  }
  async function del(u: RedeUserRow) {
    if (!confirm(`Remover login de "${u.contact.name}"?\n(O contato continua na rede, só perde a senha.)`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Login removido");
    load();
  }

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || u.contact.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 pb-20 relative">
      <button onClick={() => { setEditing(null); setShowForm(true); }}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-700 active:scale-[0.98] text-white font-semibold rounded-2xl py-3.5 text-sm shadow-lg shadow-brand-600/25 transition-transform">
        <Plus size={16} /> Novo login
      </button>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou usuário..."
          className="w-full pl-10 pr-3 py-3 text-sm bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition-all" />
      </div>

      {loading ? (
        <CenteredLoader />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-300 px-6 py-14 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound size={22} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Nenhum login criado</p>
          <p className="text-xs text-gray-500 mt-1">Toque em &quot;Novo login&quot; pra criar credenciais.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ backgroundColor: u.contact.role.bgColor, color: u.contact.role.color }}>
                  {u.contact.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{u.contact.name}</p>
                    <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
                      style={{ color: u.contact.role.color, backgroundColor: u.contact.role.bgColor }}>
                      {u.contact.role.label}
                    </span>
                    {!u.active && (
                      <span className="text-[9px] uppercase font-bold bg-gray-100 text-gray-500 px-1.5 py-px rounded-full">
                        inativo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    <span className="font-mono text-brand-700">@{u.username}</span>
                    {u.contact.parent && (
                      <span> · sob <span className="text-gray-700 font-medium">{u.contact.parent.name}</span></span>
                    )}
                  </div>
                  {u.lastLogin && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Último login {formatDistanceToNow(new Date(u.lastLogin), { locale: ptBR, addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-gray-100 divide-x divide-gray-100">
                <button onClick={() => setPwdTarget(u)}
                  className="py-2.5 text-[11px] font-medium text-blue-600 active:bg-blue-50 flex items-center justify-center gap-1">
                  <KeyRound size={11} /> Senha
                </button>
                <button onClick={() => { setEditing(u); setShowForm(true); }}
                  className="py-2.5 text-[11px] font-medium text-gray-600 active:bg-gray-50 flex items-center justify-center gap-1">
                  <Edit2 size={11} /> Editar
                </button>
                <button onClick={() => toggleActive(u)}
                  className="py-2.5 text-[11px] font-medium text-gray-600 active:bg-gray-50 flex items-center justify-center gap-1">
                  <Power size={11} /> {u.active ? "Off" : "On"}
                </button>
                <button onClick={() => del(u)}
                  className="py-2.5 text-[11px] font-medium text-red-500 active:bg-red-50 flex items-center justify-center gap-1">
                  <Trash2 size={11} /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <UserForm initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {pwdTarget && (
        <ChangePwd user={pwdTarget} onClose={() => setPwdTarget(null)} />
      )}
    </div>
  );
}

interface ParentContact {
  id: string; name: string; publicSlug: string | null;
  role: { label: string; color: string; bgColor: string; level: number };
}

function UserForm({ initial, onClose, onSaved }: {
  initial: RedeUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [active, setActive]     = useState(initial?.active ?? true);

  const [personForm, setPersonForm] = useState<PersonFormState>(initialPersonForm);
  const [roleLevel, setRoleLevel]   = useState<number>(2); // default Líder
  const [parents, setParents]       = useState<ParentContact[]>([]);
  const [parentId, setParentId]     = useState<string>("");
  const [busy, setBusy]             = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ username: string; password: string | null; name: string } | null>(null);

  // Carrega parents elegíveis ao mudar role
  useEffect(() => {
    if (isEdit) return;
    fetch(`/api/admin/parents?level=${roleLevel}`).then(r => r.json()).then(setParents).catch(() => setParents([]));
    setParentId("");
  }, [roleLevel, isEdit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        const body: any = { username, active };
        if (password) body.password = password;
        const r = await fetch(`/api/admin/users/${initial!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
        toast.success("Atualizado");
        onSaved();
      } else {
        const body: any = {
          ...personFormToPayload(personForm),
          username, password, roleLevel,
          parentId: parentId || undefined,
        };
        const r = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
        toast.success("Login criado");
        const showPassword = !password;
        setCreatedLogin({
          username: username.toLowerCase().trim(),
          password: showPassword ? "123456" : null,
          name: personForm.name,
        });
      }
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";
  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

  if (createdLogin) {
    return (
      <BottomSheet open onClose={onSaved} title="Login criado!">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{createdLogin.name}</span> foi criado com login.
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
    <BottomSheet open onClose={onClose} title={isEdit ? "Editar Login" : "Novo Login"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!isEdit && (
          <>
            <section className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Cargo</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { lv: 0, label: "Coord. Grupo" },
                  { lv: 1, label: "Coordenador" },
                  { lv: 2, label: "Líder" },
                ].map(r => (
                  <button key={r.lv} type="button" onClick={() => setRoleLevel(r.lv)}
                    className={`py-2.5 px-2 text-xs font-semibold rounded-xl border ${
                      roleLevel === r.lv
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600 active:bg-gray-50"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
              {roleLevel > 0 && parents.length > 0 && (
                <div>
                  <label className={lbl}>
                    {roleLevel === 1 ? "Coordenador de Grupo (opcional)" : "Coordenador (opcional)"}
                  </label>
                  <select value={parentId} onChange={e => setParentId(e.target.value)}
                    className={inp + " bg-white"}>
                    <option value="">— Sem vínculo —</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.role.label})</option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            <div className="border-t border-gray-100 -mx-5" />

            <section className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Pessoa</h3>
              <PersonFormFields form={personForm} setForm={setPersonForm} autoFocus={false} />
            </section>

            <div className="border-t border-gray-100 -mx-5" />
          </>
        )}

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Credenciais</h3>
          <div>
            <label className={lbl}>Usuário (login) *</label>
            <input required value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="ex: joao_silva" autoCapitalize="none"
              className={inp} />
          </div>
          <div>
            <label className={lbl}>
              {isEdit
                ? "Nova senha (vazio = manter)"
                : <>Senha <span className="text-gray-400 font-normal">(opcional — default: 123456)</span></>}
            </label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? "Mínimo 6 caracteres" : "123456"} className={inp + " pr-11"} />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {!isEdit && (
              <p className="text-[11px] text-gray-500 mt-1">
                Se vazio, a senha vira <strong>123456</strong>. O usuário pode trocar depois nas configurações.
              </p>
            )}
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-600" />
              <span className="text-gray-700">Ativo</span>
            </label>
          )}
        </section>

        <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white -mx-5 px-5 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : (isEdit ? "Atualizar" : "Criar login")}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function ChangePwd({ user, onClose }: { user: RedeUserRow; onClose: () => void }) {
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
    <BottomSheet open onClose={onClose} title={`Trocar senha — ${user.contact.name}`}>
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
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Atualizar senha"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

