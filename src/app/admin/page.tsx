"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, LogOut, Network, Activity, Upload, Download,
  Search, ChevronLeft, ChevronRight, Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminNetworkView } from "@/components/AdminNetworkView";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"rede" | "logins" | "import">("rede");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Minha Rede — Admin</p>
            <p className="text-[11px] text-gray-500">Painel administrativo</p>
          </div>
          <button onClick={logout}
            className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-2 rounded-lg flex items-center gap-1.5 active:bg-gray-50">
            <LogOut size={12} /> Sair
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-2 flex">
          <TabButton active={tab === "rede"} onClick={() => setTab("rede")} icon={Network} label="Rede" />
          <TabButton active={tab === "logins"} onClick={() => setTab("logins")} icon={Activity} label="Logins" />
          <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={Upload} label="Importar" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {tab === "rede"   && <AdminNetworkView />}
        {tab === "logins" && <LoginsTab />}
        {tab === "import" && <ImportTab />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
        active ? "text-brand-700 border-brand-600" : "text-gray-500 border-transparent active:text-gray-700"
      }`}>
      <Icon size={14} /> {label}
    </button>
  );
}

// ── Tab: Logins ───────────────────────────────────────────────────────────────
function LoginsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<"all" | "admin" | "member">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "50" });
      if (type !== "all") sp.set("type", type);
      if (search.trim()) sp.set("search", search.trim());
      const r = await fetch(`/api/admin/logins?${sp}`);
      if (!r.ok) return;
      const d = await r.json();
      setLogs(d.logs);
      setTotal(d.total);
    } finally { setLoading(false); }
  }, [page, type, search]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-3">
      {/* filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
        </div>
        <div className="flex gap-1">
          {[
            { v: "all" as const, l: "Todos" },
            { v: "admin" as const, l: "Admin" },
            { v: "member" as const, l: "Coord/Líder" },
          ].map(t => (
            <button key={t.v} onClick={() => { setType(t.v); setPage(1); }}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                type === t.v ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
              }`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 px-1">
        {loading ? "Carregando..." : `${total} login(s)`}
      </div>

      {/* lista */}
      <div className="space-y-2">
        {logs.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <Activity size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum login encontrado</p>
          </div>
        )}
        {logs.map(l => {
          const isAdmin = l.type === "admin";
          const role = l.contact?.role;
          return (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-200 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isAdmin ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                }`}
                  style={!isAdmin && role ? { backgroundColor: role.bgColor, color: role.color } : undefined}>
                  {isAdmin ? <ShieldCheck size={14} /> : (l.actorName[0]?.toUpperCase() ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{l.actorName}</p>
                    {isAdmin && <span className="text-[9px] uppercase tracking-wide font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-px rounded-full">Admin</span>}
                    {role && (
                      <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
                        style={{ color: role.color, backgroundColor: role.bgColor }}>
                        {role.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                    <span>{format(new Date(l.createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">{formatDistanceToNow(new Date(l.createdAt), { locale: ptBR, addSuffix: true })}</span>
                    {l.ipAddress && <>
                      <span className="text-gray-300">·</span>
                      <span className="font-mono flex items-center gap-0.5"><Globe size={9} />{l.ipAddress}</span>
                    </>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-3 py-2">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-2 text-gray-500 disabled:opacity-30 active:text-brand-600">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-gray-500">Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}
            className="p-2 text-gray-500 disabled:opacity-30 active:text-brand-600">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
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
        className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-gray-800 active:bg-gray-700 rounded-2xl">
        <Download size={15} /> Exportar CSV
      </a>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={15} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Importar CSV</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Formato: cabeçalho <code className="bg-gray-100 px-1 rounded">Nome,Link,Coordenador</code>, depois
          seção <code className="bg-gray-100 px-1 rounded">#COORDENADORES</code> com <code className="bg-gray-100 px-1 rounded">Nome,Link</code>.
        </p>
        <label className="block">
          <span className="text-xs text-gray-600">Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="block mt-1.5 text-xs w-full" />
        </label>
        <textarea value={csvText} onChange={e => setCsv(e.target.value)}
          placeholder="Ou cole o CSV aqui..." rows={6}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-600" />
        <button onClick={importNow} disabled={busy}
          className="w-full py-3 text-sm font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
          {busy ? "Importando..." : "Importar"}
        </button>
        {report && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
            {report.message}
          </div>
        )}
      </div>
    </div>
  );
}
