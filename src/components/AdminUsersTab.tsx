"use client";
import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Power, KeyRound, Crown, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { CenteredLoader } from "./Spinner";

interface AdminUserRow {
  id: string;
  username: string;
  name: string;
  isSuperAdmin: boolean;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
}

/**
 * Gerenciamento de usuários admin do minha-rede. Visível só pra super-admin.
 * Cada user pode logar via username+senha na /admin/login. ADMIN_PASSWORD
 * env continua valendo como fallback master.
 */
export function AdminUsersTab({ myAdminUserId }: { myAdminUserId: string | null }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/admin-users");
      if (r.ok) setUsers(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(u: AdminUserRow) {
    const r = await fetch(`/api/admin/admin-users/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    load();
  }
  async function del(u: AdminUserRow) {
    if (!confirm(`Excluir admin "${u.name}" (@${u.username})?`)) return;
    const r = await fetch(`/api/admin/admin-users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Admin excluído");
    load();
  }

  return (
    <div className="space-y-4 pb-20 relative">
      <button onClick={() => { setEditing(null); setShowForm(true); }}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-500 active:scale-[0.98] text-white font-semibold rounded-2xl py-3.5 text-sm shadow-lg shadow-amber-500/25 transition-transform">
        <Plus size={16} /> Novo admin
      </button>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <p className="font-semibold flex items-center gap-1"><ShieldCheck size={12} /> Sobre admins</p>
        <p className="mt-1 leading-relaxed">
          Cada admin pode logar com usuário e senha na tela de admin. A senha master
          (do .env) continua valendo. <strong>Super-admin</strong> pode gerenciar outros admins.
        </p>
      </div>

      {loading ? (
        <CenteredLoader />
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={22} className="text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Nenhum admin cadastrado</p>
          <p className="text-xs text-gray-500 mt-1">Toque em &quot;Novo admin&quot; pra criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  u.isSuperAdmin ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
                }`}>
                  {u.isSuperAdmin ? <Crown size={18} /> : u.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                    {u.isSuperAdmin && (
                      <span className="text-[9px] uppercase font-bold tracking-wide px-1.5 py-px rounded-full bg-amber-100 text-amber-700">
                        super
                      </span>
                    )}
                    {!u.active && (
                      <span className="text-[9px] uppercase font-bold bg-gray-100 text-gray-500 px-1.5 py-px rounded-full">
                        inativo
                      </span>
                    )}
                    {u.id === myAdminUserId && (
                      <span className="text-[9px] uppercase font-bold bg-brand-100 text-brand-700 px-1.5 py-px rounded-full">
                        você
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    <span className="font-mono text-amber-700">@{u.username}</span>
                  </p>
                  {u.lastLogin && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Último login {formatDistanceToNow(new Date(u.lastLogin), { locale: ptBR, addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-gray-100 divide-x divide-gray-100">
                <button onClick={() => { setEditing(u); setShowForm(true); }}
                  className="py-2.5 text-[11px] font-medium text-gray-600 active:bg-gray-50 flex items-center justify-center gap-1">
                  <Edit2 size={11} /> Editar
                </button>
                <button onClick={() => toggleActive(u)} disabled={u.id === myAdminUserId}
                  className="py-2.5 text-[11px] font-medium text-gray-600 active:bg-gray-50 flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  <Power size={11} /> {u.active ? "Off" : "On"}
                </button>
                <button onClick={() => del(u)} disabled={u.id === myAdminUserId}
                  className="py-2.5 text-[11px] font-medium text-red-500 active:bg-red-50 flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  <Trash2 size={11} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AdminUserForm initial={editing} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

function AdminUserForm({ initial, onClose, onSaved }: {
  initial: AdminUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initial?.isSuperAdmin ?? false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: any = { username, name, isSuperAdmin };
      if (password) body.password = password;
      const url = isEdit ? `/api/admin/admin-users/${initial!.id}` : "/api/admin/admin-users";
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      toast.success(isEdit ? "Admin atualizado" : "Admin criado");
      onSaved();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-500";
  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

  return (
    <BottomSheet open onClose={onClose} title={isEdit ? "Editar admin" : "Novo admin"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={lbl}>Nome *</label>
          <input required value={name} onChange={e => setName(e.target.value)}
            placeholder="Ex: João Silva" className={inp} />
        </div>
        <div>
          <label className={lbl}>Usuário (login) *</label>
          <input required value={username} autoCapitalize="none"
            onChange={e => setUsername(e.target.value.toLowerCase())}
            placeholder="joao.silva" className={inp} />
          <p className="text-[11px] text-gray-500 mt-1">3-32 chars: a-z, 0-9, ponto, traço, underline.</p>
        </div>
        <div>
          <label className={lbl}>
            {isEdit
              ? "Nova senha (vazio = manter)"
              : <>Senha * <span className="text-gray-400 font-normal">(mínimo 6 chars)</span></>}
          </label>
          <div className="relative">
            <input type={showPwd ? "text" : "password"} required={!isEdit}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder={isEdit ? "Deixe vazio pra não trocar" : "Mínimo 6 caracteres"}
              className={inp + " pr-11"} />
            <button type="button" onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border ${
          isSuperAdmin ? "border-amber-300 bg-amber-50" : "border-gray-200"
        }`}>
          <input type="checkbox" checked={isSuperAdmin}
            onChange={e => setIsSuperAdmin(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Crown size={13} className="text-amber-600" /> Super-admin
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Pode criar, editar e excluir outros admins. Admins normais não podem.
            </p>
          </div>
        </label>

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">
            Cancelar
          </button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-gradient-to-br from-amber-500 to-orange-500 active:scale-[0.98] rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : (isEdit ? "Atualizar" : "Criar admin")}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
