"use client";
import { Suspense, useEffect, useState, useCallback } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>}>
      <App />
    </Suspense>
  );
}

// ── Toast simples ─────────────────────────────────────────────────────────────
function showToast(message: string) {
  const existing = document.querySelector(".app-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "app-toast fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full z-[200] shadow-xl opacity-0 transition-opacity";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { (toast as HTMLElement).style.opacity = "1"; });
  setTimeout(() => {
    (toast as HTMLElement).style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("input");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }
  showToast("Link copiado!");
}

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Leader { id: string; name: string; link: string; coordinator: string; }
interface Coord  { id: string; name: string; link: string; }
type View =
  | { kind: "form"; lider?: string; coord?: string }
  | { kind: "admin-login" }
  | { kind: "admin-dashboard" }
  | { kind: "coord-login" }
  | { kind: "coord-dashboard"; name: string };

// ── App principal ────────────────────────────────────────────────────────────
function App() {
  const [view, setView] = useState<View | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const route = useCallback(async () => {
    const sp = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const liderParam = sp.get("lider");
    const coordParam = sp.get("coord");
    const coordFormParam = sp.get("coord_form");

    // ?coord=X → auto-login do coord (igual formelider antigo)
    if (coordParam) {
      try {
        const r = await fetch("/api/coord/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: coordParam }),
        });
        if (r.ok) {
          const d = await r.json();
          setView({ kind: "coord-dashboard", name: d.coord?.name ?? coordParam });
          setAuthChecked(true);
          return;
        }
      } catch {}
      // se falhar, cai pra form
      setView({ kind: "form" });
      setAuthChecked(true);
      return;
    }

    // Checa sessão atual
    const me = await fetch("/api/admin/me").then(r => r.json()).catch(() => null);
    const session = me?.session;

    if (hash === "#admin") {
      setView(session?.type === "admin" ? { kind: "admin-dashboard" } : { kind: "admin-login" });
      setAuthChecked(true);
      return;
    }
    if (hash === "#coordenador") {
      if (session?.type === "coord") setView({ kind: "coord-dashboard", name: session.name });
      else setView({ kind: "coord-login" });
      setAuthChecked(true);
      return;
    }

    // Form com líder ou coord pré-preenchido
    if (liderParam) { setView({ kind: "form", lider: liderParam }); setAuthChecked(true); return; }
    if (coordFormParam) { setView({ kind: "form", coord: coordFormParam }); setAuthChecked(true); return; }

    // Sem param: prioriza sessão
    if (session?.type === "admin") setView({ kind: "admin-dashboard" });
    else if (session?.type === "coord") setView({ kind: "coord-dashboard", name: session.name });
    else setView({ kind: "form" });
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    route();
    const onHash = () => route();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [route]);

  if (!authChecked || !view) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center md:p-4 md:sm:p-8 bg-gray-50">
      {view.kind === "form" && <ApoiadorForm liderParam={view.lider} coordFormParam={view.coord} />}
      {view.kind === "admin-login" && <AdminLogin onLoggedIn={() => setView({ kind: "admin-dashboard" })} />}
      {view.kind === "admin-dashboard" && <AdminDashboard onLogout={() => { window.location.hash = ""; setView({ kind: "form" }); }} />}
      {view.kind === "coord-login" && <CoordLogin onLoggedIn={(name) => setView({ kind: "coord-dashboard", name })} />}
      {view.kind === "coord-dashboard" && <CoordDashboard name={view.name} onLogout={() => {
        // Limpa ?coord=X da URL pra não ficar reentrando em loop
        if (new URLSearchParams(window.location.search).get("coord")) {
          window.history.replaceState({}, "", window.location.pathname);
        }
        window.location.hash = "";
        setView({ kind: "form" });
      }} />}
    </div>
  );
}

// ── Admin login ──────────────────────────────────────────────────────────────
function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        showToast(d.error || "Senha incorreta");
        return;
      }
      onLoggedIn();
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Acesso Administrativo</h2>
        <p className="text-gray-500 text-sm mt-1">Gerenciador de Líderes</p>
      </div>
      <form onSubmit={submit}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
          placeholder="Digite a senha..." autoFocus
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none" />
        <button disabled={busy} className="mt-6 w-full bg-[#155DFC] text-white font-semibold rounded-lg px-4 py-2 hover:bg-[#114bcf] transition-colors disabled:opacity-60">
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ── Coord login ──────────────────────────────────────────────────────────────
function CoordLogin({ onLoggedIn }: { onLoggedIn: (name: string) => void }) {
  const [name, setName] = useState("");
  const [coords, setCoords] = useState<Coord[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/coordinators").then(r => r.json()).then(d => setCoords(d.data ?? [])).catch(() => setCoords([]));
  }, []);

  async function login(useName: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/coord/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: useName }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        showToast(d.error || "Coordenador não encontrado");
        return;
      }
      const d = await r.json();
      onLoggedIn(d.coord?.name ?? useName);
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Acesso do Coordenador</h2>
        <p className="text-gray-500 text-sm mt-1">Veja os líderes da sua rede</p>
      </div>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) login(name.trim()); }}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Digite seu nome..." autoFocus
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none" />
        <button disabled={busy} className="mt-4 w-full bg-[#155DFC] text-white font-semibold rounded-lg px-4 py-2 hover:bg-[#114bcf] transition-colors disabled:opacity-60">
          Entrar
        </button>
      </form>

      {coords && coords.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 px-1">ou selecione</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {coords.map(c => (
              <button key={c.id} type="button" onClick={() => login(c.name)}
                className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors flex items-center justify-between">
                <span>{c.name}</span>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"lideres" | "coordenadores">("lideres");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [coords, setCoords]   = useState<Coord[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  // criar líder
  const [newLider, setNewLider] = useState("");
  const [newCoord, setNewCoord] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // criar coord
  const [newCoordName, setNewCoordName] = useState("");
  const [coordLinks, setCoordLinks] = useState<{ link: string; formLink: string } | null>(null);

  // edit leader
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);

  // confirm delete
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; fn: () => Promise<void> } | null>(null);

  // action sheet (mobile)
  const [actionSheet, setActionSheet] = useState<{ title: string; subtitle?: string; actions: { label: string; tone?: "default" | "primary" | "danger"; onClick: () => void }[] } | null>(null);

  const loadLeaders = useCallback(async () => {
    const r = await fetch("/api/leaders"); if (r.ok) setLeaders((await r.json()).data ?? []);
  }, []);
  const loadCoords = useCallback(async () => {
    const r = await fetch("/api/coordinators"); if (r.ok) setCoords((await r.json()).data ?? []);
  }, []);

  useEffect(() => { loadLeaders(); loadCoords(); }, [loadLeaders, loadCoords]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    onLogout();
  }

  async function createLider() {
    const lider = newLider.trim();
    if (!lider) { showToast("Informe o nome do líder."); return; }
    const r = await fetch("/api/leaders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lider, coordinator: newCoord }),
    });
    if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
    const data = await r.json();
    setGeneratedLink(data.link);
    setNewLider(""); setNewCoord("");
    loadLeaders();
  }

  async function createCoord() {
    const name = newCoordName.trim();
    if (!name) { showToast("Informe o nome do coordenador."); return; }
    const r = await fetch("/api/coordinators", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
    const data = await r.json();
    const formLink = data.link.replace(/\?coord=/, "?coord_form=");
    setCoordLinks({ link: data.link, formLink });
    setNewCoordName("");
    loadCoords();
  }

  async function deleteLeader(l: Leader) {
    setPendingDelete({
      msg: `Tem certeza que deseja excluir o líder "${l.name}"? Esta ação não pode ser desfeita.`,
      fn: async () => {
        const r = await fetch(`/api/leaders/${l.id}`, { method: "DELETE" });
        if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
        showToast("Líder excluído");
        loadLeaders();
      },
    });
  }

  async function deleteCoord(c: Coord) {
    setPendingDelete({
      msg: `Tem certeza que deseja excluir o coordenador "${c.name}"? Os líderes vinculados a ele não serão excluídos.`,
      fn: async () => {
        const r = await fetch(`/api/coordinators/${c.id}`, { method: "DELETE" });
        if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
        showToast("Coordenador excluído");
        loadCoords();
        loadLeaders();
      },
    });
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const r = await fetch("/api/leaders/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text }),
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error || "Erro"); return; }
    showToast(d.message || "Importado");
    loadLeaders(); loadCoords();
  }

  return (
    <div className="admin-dashboard max-w-3xl w-full bg-white overflow-hidden md:rounded-2xl md:shadow-xl md:p-8">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4 px-4 md:px-0 md:pt-0 pt-4">
        <h2 className="text-xl font-bold text-gray-800">Gerador de Links Exclusivos</h2>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 font-medium underline">Sair</button>
      </div>

      <div className="px-4 md:px-0">
        {/* Criar Novo Link (colapsável) */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          <button onClick={() => setOpenCreate(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </div>
              <span className="text-sm font-semibold text-gray-700">Criar Novo Link</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${openCreate ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {openCreate && (
            <div className="px-4 pb-4 pt-3 space-y-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coordenador <span className="text-gray-400 font-normal text-xs">(opcional)</span></label>
                <select value={newCoord} onChange={e => setNewCoord(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none bg-white text-gray-700">
                  <option value="">Selecionar</option>
                  {coords.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Líder</label>
                <input value={newLider} onChange={e => setNewLider(e.target.value)}
                  placeholder="Ex: mario, joaoSilva, lider01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none" />
              </div>
              <button onClick={createLider}
                className="w-full bg-[#155DFC] text-white font-semibold rounded-lg px-4 py-2 hover:bg-[#114bcf] transition-colors">
                Criar Link
              </button>
              {generatedLink && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-2">Link gerado — copie e envie ao líder</p>
                  <div className="flex flex-col md:flex-row items-center gap-2">
                    <input readOnly value={generatedLink}
                      className="flex-1 w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-sm text-gray-600 outline-none" />
                    <button onClick={() => copyToClipboard(generatedLink)}
                      className="w-full md:w-auto px-3 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex items-center border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setTab("lideres")}
              className={`px-4 py-2 text-sm font-semibold mr-1 whitespace-nowrap border-b-2 ${tab === "lideres" ? "border-[#155DFC] text-[#155DFC]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              Líderes
            </button>
            <button onClick={() => setTab("coordenadores")}
              className={`px-4 py-2 text-sm font-semibold mr-1 whitespace-nowrap border-b-2 ${tab === "coordenadores" ? "border-[#155DFC] text-[#155DFC]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              Coordenadores
            </button>
            <div className="flex-1" />
            <div className="hidden md:flex space-x-2 pb-1 flex-shrink-0 p-2 rounded-lg">
              <label className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors cursor-pointer">
                Importar CSV
                <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
              </label>
              <a href="/api/leaders/export" target="_blank" rel="noreferrer"
                className="px-3 py-1.5 bg-gray-800 text-white text-xs font-semibold rounded hover:bg-gray-700 transition-colors">
                Exportar CSV
              </a>
            </div>
          </div>

          {tab === "lideres" ? (
            <div className="pt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {leaders.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-gray-200">Nenhum líder salvo ainda.</p>}
              {leaders.map(l => (
                <div key={l.id} className="bg-white bg-opacity-60 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm px-3 py-2.5">
                  <div className="overflow-hidden flex-1 min-w-0">
                    <button
                      onClick={() => setActionSheet({
                        title: l.name, subtitle: l.link,
                        actions: [
                          { label: "Copiar Link", onClick: () => copyToClipboard(l.link) },
                          { label: "Editar", tone: "primary", onClick: () => setEditingLeader(l) },
                          { label: "Excluir", tone: "danger", onClick: () => deleteLeader(l) },
                        ],
                      })}
                      className="flex items-center flex-wrap gap-1.5 cursor-pointer select-none group text-left">
                      <span className="font-semibold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">{l.name}</span>
                      {l.coordinator && <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded ml-2 flex-shrink-0">Coord: {l.coordinator}</span>}
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                    </button>
                    <p className="text-xs text-gray-400 mt-0.5 truncate hidden md:block" title={l.link}>{l.link}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => setEditingLeader(l)} className="hidden md:inline px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100">Editar</button>
                    <button onClick={() => copyToClipboard(l.link)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200">Copiar</button>
                    <button onClick={() => deleteLeader(l)} className="hidden md:inline px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pt-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Nome do Coordenador</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input value={newCoordName} onChange={e => setNewCoordName(e.target.value)}
                    placeholder="Nome do coordenador"
                    className="md:col-span-3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none" />
                  <button onClick={createCoord}
                    className="md:col-span-1 px-4 py-2 bg-[#155DFC] text-white text-sm font-semibold rounded-lg hover:bg-[#114bcf]">
                    Criar
                  </button>
                </div>
                {coordLinks && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Link de Acesso (Dashboard)</label>
                      <div className="flex flex-col md:flex-row items-center gap-2">
                        <input readOnly value={coordLinks.link} className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 outline-none" />
                        <button onClick={() => copyToClipboard(coordLinks.link)} className="w-full md:w-auto px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium">Copiar</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Link Pessoal (Formulário)</label>
                      <div className="flex flex-col md:flex-row items-center gap-2">
                        <input readOnly value={coordLinks.formLink} className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 outline-none" />
                        <button onClick={() => copyToClipboard(coordLinks.formLink)} className="w-full md:w-auto px-3 py-2 bg-[#155DFC] text-white rounded-lg hover:bg-[#114bcf] text-sm font-medium">Copiar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {coords.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-gray-200">Nenhum coordenador cadastrado ainda.</p>}
                {coords.map(c => (
                  <div key={c.id} className="bg-white bg-opacity-60 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm px-3 py-2.5">
                    <div className="overflow-hidden flex-1 min-w-0">
                      <button onClick={() => setActionSheet({
                        title: c.name, subtitle: c.link,
                        actions: [
                          { label: "Copiar Link", onClick: () => copyToClipboard(c.link) },
                          { label: "Excluir", tone: "danger", onClick: () => deleteCoord(c) },
                        ],
                      })} className="flex items-center gap-1.5 cursor-pointer select-none group text-left">
                        <span className="font-semibold text-gray-800 text-sm group-hover:text-blue-700">{c.name}</span>
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                      </button>
                      <p className="text-xs text-gray-400 mt-0.5 truncate hidden md:block" title={c.link}>{c.link}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button onClick={() => copyToClipboard(c.link)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200">Copiar</button>
                      <button onClick={() => deleteCoord(c)} className="hidden md:inline px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal editar líder */}
      {editingLeader && (
        <EditLeaderModal leader={editingLeader} coords={coords} onClose={() => setEditingLeader(null)}
          onSaved={() => { setEditingLeader(null); loadLeaders(); }} />
      )}

      {/* Action sheet (mobile) */}
      {actionSheet && (
        <ActionSheet sheet={actionSheet} onClose={() => setActionSheet(null)} />
      )}

      {/* Confirmar exclusão */}
      {pendingDelete && (
        <ConfirmModal msg={pendingDelete.msg}
          onConfirm={async () => { await pendingDelete.fn(); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)} />
      )}
    </div>
  );
}

// ── Coord dashboard ──────────────────────────────────────────────────────────
function CoordDashboard({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [ownLink, setOwnLink] = useState("");
  const [newLider, setNewLider] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; fn: () => Promise<void> } | null>(null);
  const [actionSheet, setActionSheet] = useState<any>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/leaders/coordinator/${encodeURIComponent(name)}`);
    if (r.ok) setLeaders((await r.json()).data ?? []);
  }, [name]);

  useEffect(() => {
    const base = window.location.origin + window.location.pathname;
    setOwnLink(`${base}?coord_form=${encodeURIComponent(name)}`);
    load();
  }, [name, load]);

  async function logout() {
    await fetch("/api/coord/logout", { method: "POST" });
    onLogout();
  }

  async function createLider() {
    const lider = newLider.trim();
    if (!lider) { showToast("Informe o nome do líder."); return; }
    const r = await fetch("/api/leaders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lider, coordinator: name }),
    });
    if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
    const data = await r.json();
    setGeneratedLink(data.link);
    setNewLider("");
    load();
  }

  async function deleteLider(l: Leader) {
    setPendingDelete({
      msg: `Tem certeza que deseja excluir o líder "${l.name}"?`,
      fn: async () => {
        const r = await fetch(`/api/leaders/${l.id}`, { method: "DELETE" });
        if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
        load();
      },
    });
  }

  return (
    <div className="coord-dashboard max-w-3xl w-full bg-white overflow-hidden md:rounded-2xl md:shadow-xl md:p-8">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4 px-4 md:px-0 md:pt-0 pt-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Minha Rede de Líderes</h2>
          <p className="text-sm text-gray-500 mt-0.5">Coordenador: {name}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 font-medium underline">Sair</button>
      </div>

      <div className="px-4 md:px-0">
        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <p className="text-xs font-medium text-blue-700 mb-2">Seu link pessoal</p>
          <div className="flex flex-col md:flex-row items-center gap-2">
            <input readOnly value={ownLink} className="flex-1 w-full px-3 py-1.5 border border-blue-200 rounded-lg bg-white text-sm text-gray-600 outline-none" />
            <button onClick={() => copyToClipboard(ownLink)} className="w-full md:w-auto px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-xs font-medium">Copiar</button>
          </div>
        </div>

        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-3">Criar Link para Novo Líder</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input value={newLider} onChange={e => setNewLider(e.target.value)}
              placeholder="Nome do líder"
              className="md:col-span-3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none text-sm" />
            <button onClick={createLider}
              className="md:col-span-1 px-4 py-2 bg-[#155DFC] text-white text-sm font-semibold rounded-lg hover:bg-[#114bcf]">
              Criar
            </button>
          </div>
          {generatedLink && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-2">Link gerado</label>
              <div className="flex flex-col md:flex-row items-center gap-2">
                <input readOnly value={generatedLink} className="flex-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-600 outline-none" />
                <button onClick={() => copyToClipboard(generatedLink)} className="w-full md:w-auto px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs font-medium">Copiar</button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Meus Líderes</p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {leaders.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-gray-200">Nenhum líder encontrado para esta rede.</p>}
            {leaders.map(l => (
              <div key={l.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                <div className="overflow-hidden flex-1 min-w-0">
                  <button onClick={() => setActionSheet({
                    title: l.name, subtitle: l.link,
                    actions: [
                      { label: "Copiar Link", onClick: () => copyToClipboard(l.link) },
                      { label: "Excluir", tone: "danger" as const, onClick: () => deleteLider(l) },
                    ],
                  })} className="flex items-center gap-1.5 cursor-pointer select-none group text-left">
                    <span className="font-semibold text-gray-800 text-sm group-hover:text-blue-700">{l.name}</span>
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5 truncate hidden md:block" title={l.link}>{l.link}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => copyToClipboard(l.link)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200">Copiar</button>
                  <button onClick={() => deleteLider(l)} className="hidden md:inline px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {actionSheet && <ActionSheet sheet={actionSheet} onClose={() => setActionSheet(null)} />}
      {pendingDelete && (
        <ConfirmModal msg={pendingDelete.msg}
          onConfirm={async () => { await pendingDelete.fn(); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)} />
      )}
    </div>
  );
}

// ── Modal: editar líder ──────────────────────────────────────────────────────
function EditLeaderModal({ leader, coords, onClose, onSaved }: { leader: Leader; coords: Coord[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(leader.name);
  const [coord, setCoord] = useState(leader.coordinator || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { showToast("Nome do líder é obrigatório."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/leaders/${leader.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, coordinator: coord }),
      });
      if (!r.ok) { const d = await r.json(); showToast(d.error || "Erro"); return; }
      showToast("Salvo");
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={onClose} />
        <div className="relative inline-block bg-white rounded-xl text-left overflow-hidden shadow-xl w-full max-w-md">
          <div className="bg-white px-6 pt-6 pb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Líder</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Líder</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coordenador</label>
                <select value={coord} onChange={e => setCoord(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none bg-white">
                  <option value="">Sem coordenador</option>
                  {coords.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {coord && !coords.some(c => c.name === coord) && <option value={coord}>{coord}</option>}
                </select>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Atenção: ao alterar o nome, o link do líder será atualizado e o link anterior deixará de funcionar.</p>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-[#155DFC] rounded-lg hover:bg-[#114bcf] disabled:opacity-60">
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action Sheet (mobile bottom-sheet) ────────────────────────────────────────
function ActionSheet({ sheet, onClose }: {
  sheet: { title: string; subtitle?: string; actions: { label: string; tone?: "default" | "primary" | "danger"; onClick: () => void }[] };
  onClose: () => void;
}) {
  const toneClass = (tone?: string) =>
    tone === "danger" ? "bg-red-50 text-red-600 hover:bg-red-100" :
    tone === "primary" ? "bg-blue-50 text-blue-700 hover:bg-blue-100" :
    "bg-gray-50 text-gray-800 hover:bg-gray-100";

  return (
    <div className="fixed inset-0 z-40">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-sm bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ animation: "slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1)" }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pt-1 pb-4 border-b border-gray-100">
          <p className="font-bold text-gray-900 text-base">{sheet.title}</p>
          {sheet.subtitle && <p className="text-xs text-gray-400 mt-1 break-all leading-relaxed">{sheet.subtitle}</p>}
        </div>
        <div className="px-4 py-3 space-y-2">
          {sheet.actions.map((a, i) => (
            <button key={i} onClick={() => { onClose(); a.onClick(); }}
              className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors active:opacity-80 ${toneClass(a.tone)}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="px-4 pb-6 pt-1">
          <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmar exclusão ───────────────────────────────────────────────────────
function ConfirmModal({ msg, onConfirm, onCancel }: { msg: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={onCancel} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800">Confirmar Exclusão</h3>
          </div>
          <p className="text-sm text-gray-600 mb-6">{msg}</p>
          <div className="flex justify-end space-x-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">Excluir</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formulário do apoiador (com modal LGPD, máscaras) ─────────────────────────
const CIDADES_AC = [
  "Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba",
  "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima",
  "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre",
  "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus",
  "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri",
];

function maskPhone(v: string): string {
  const x = v.replace(/\D/g, "").match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
  if (!x) return v;
  return !x[2] ? x[1] : "(" + x[1] + ") " + x[2] + (x[3] ? "-" + x[3] : "");
}
function maskDate(v: string): string {
  const x = v.replace(/\D/g, "").match(/(\d{0,2})(\d{0,2})(\d{0,4})/);
  if (!x) return v;
  return !x[2] ? x[1] : x[1] + "/" + x[2] + (x[3] ? "/" + x[3] : "");
}
function capitalizeText(s: string): string {
  return s.replace(/(?:^|\s)[a-zà-ú]/g, m => m.toUpperCase());
}

function ApoiadorForm({ liderParam, coordFormParam }: { liderParam?: string; coordFormParam?: string }) {
  const [form, setForm] = useState({
    nome: "", data_nascimento: "", telefone: "", genero: "", genero_outro: "",
    rua: "", bairro: "", cidade: "", zona: "Urbana",
    lgpd: false,
  });
  const [coordResolvido, setCoordResolvido] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showLgpd, setShowLgpd] = useState(false);

  // Resolve coord do líder (igual formelider antigo)
  useEffect(() => {
    if (liderParam) {
      fetch(`/api/leaders/by-name/${encodeURIComponent(liderParam)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.data?.coordinator) setCoordResolvido(d.data.coordinator); })
        .catch(() => {});
    }
  }, [liderParam]);

  function setField<K extends keyof typeof form>(k: K, v: any) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors(e => ({ ...e, [k]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!form.nome || form.nome.trim().length < 3) e2.nome = "Nome é obrigatório.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.data_nascimento)) e2.data_nascimento = "Data inválida (DD/MM/AAAA).";
    if (!form.telefone || form.telefone.replace(/\D/g, "").length < 10) e2.telefone = "Telefone inválido.";
    if (!form.genero) e2.genero = "Gênero é obrigatório.";
    if (form.genero === "Outro" && !form.genero_outro.trim()) e2.genero = "Especifique o gênero.";
    if (!form.rua || form.rua.trim().length < 3) e2.rua = "Rua é obrigatória.";
    if (!form.bairro || form.bairro.trim().length < 2) e2.bairro = "Bairro é obrigatório.";
    if (!form.cidade) e2.cidade = "Cidade é obrigatória.";
    if (!form.lgpd) e2.lgpd = "Você deve aceitar a Política de Privacidade.";
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    setBusy(true);
    try {
      const generoFinal = form.genero === "Outro" ? form.genero_outro.trim() || "Outro" : form.genero;
      const payload: any = {
        nome: form.nome,
        data_nascimento: form.data_nascimento,
        telefone: form.telefone.replace(/\D/g, ""),
        genero: generoFinal,
        rua: form.rua, bairro: form.bairro, cidade: form.cidade, zona: form.zona,
        lgpd: form.lgpd ? "on" : "",
        nome_lider: liderParam || coordFormParam || "",
        nome_coordenador: coordFormParam || coordResolvido || "",
      };
      await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDone(true);
    } catch {
      showToast("Erro ao enviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm({ nome: "", data_nascimento: "", telefone: "", genero: "", genero_outro: "",
      rua: "", bairro: "", cidade: "", zona: "Urbana", lgpd: false });
    setErrors({});
    setDone(false);
  }

  const inp = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155DFC] focus:border-[#155DFC] outline-none transition-colors";
  const inpErr = "w-full px-4 py-2 border border-red-400 ring-1 ring-red-200 rounded-lg outline-none";

  if (done) {
    return (
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="pt-4 pb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-100">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Realizado!</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">Seus dados foram recebidos. Nossa equipe entrará em contato em breve.</p>
            <button onClick={reset} className="w-full bg-[#155DFC] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#114bcf]">
              Novo Cadastro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-br from-[#155DFC] to-[#0d47d9] px-6 py-7 text-center relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white opacity-5"></div>
        <div className="absolute -bottom-10 -left-6 w-36 h-36 rounded-full bg-white opacity-5"></div>
        <div className="relative">
          <div className="w-11 h-11 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Formulário de Cadastro</h1>
          <p className="text-blue-200 mt-1 text-sm">Preencha seus dados abaixo</p>
        </div>
      </div>

      <form onSubmit={submit} className="p-8 space-y-6" noValidate>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo <span className="text-red-500">*</span></label>
          <input value={form.nome} onChange={e => setField("nome", capitalizeText(e.target.value))}
            placeholder="Digite seu nome" className={errors.nome ? inpErr : inp} />
          {errors.nome && <p className="text-red-500 text-sm mt-1">{errors.nome}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento <span className="text-red-500">*</span></label>
            <input value={form.data_nascimento} onChange={e => setField("data_nascimento", maskDate(e.target.value))}
              placeholder="DD/MM/AAAA" maxLength={10} className={errors.data_nascimento ? inpErr : inp} />
            {errors.data_nascimento && <p className="text-red-500 text-sm mt-1">{errors.data_nascimento}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp) <span className="text-red-500">*</span></label>
            <input type="tel" value={form.telefone} onChange={e => setField("telefone", maskPhone(e.target.value))}
              placeholder="(00) 00000-0000" maxLength={15} className={errors.telefone ? inpErr : inp} />
            {errors.telefone && <p className="text-red-500 text-sm mt-1">{errors.telefone}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Gênero <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-6">
            {["Masculino", "Feminino", "Outro"].map(g => (
              <label key={g} className="flex items-center cursor-pointer">
                <input type="radio" name="genero" value={g} checked={form.genero === g} onChange={() => setField("genero", g)}
                  className="w-4 h-4 text-[#155DFC] focus:ring-[#155DFC]" />
                <span className="ml-2 text-sm text-gray-700 font-medium">{g}</span>
              </label>
            ))}
          </div>
          {form.genero === "Outro" && (
            <div className="mt-3">
              <input value={form.genero_outro} onChange={e => setField("genero_outro", e.target.value)}
                placeholder="Especifique..." className={inp} />
            </div>
          )}
          {errors.genero && <p className="text-red-500 text-sm mt-1">{errors.genero}</p>}
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Endereço</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rua e Número <span className="text-red-500">*</span></label>
              <input value={form.rua} onChange={e => setField("rua", capitalizeText(e.target.value))}
                placeholder="Ex: Rua das Flores, 123" className={errors.rua ? inpErr : inp} />
              {errors.rua && <p className="text-red-500 text-sm mt-1">{errors.rua}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro <span className="text-red-500">*</span></label>
                <input value={form.bairro} onChange={e => setField("bairro", capitalizeText(e.target.value))}
                  placeholder="Ex: Centro" className={errors.bairro ? inpErr : inp} />
                {errors.bairro && <p className="text-red-500 text-sm mt-1">{errors.bairro}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade (Acre) <span className="text-red-500">*</span></label>
                <select value={form.cidade} onChange={e => setField("cidade", e.target.value)}
                  className={(errors.cidade ? inpErr : inp) + " bg-white"}>
                  <option value="">Selecione a cidade</option>
                  {CIDADES_AC.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.cidade && <p className="text-red-500 text-sm mt-1">{errors.cidade}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zona de Residência <span className="text-red-500">*</span></label>
              <div className="flex space-x-6">
                {["Urbana", "Rural"].map(z => (
                  <label key={z} className="flex items-center cursor-pointer">
                    <input type="radio" name="zona" value={z} checked={form.zona === z} onChange={() => setField("zona", z)}
                      className="w-4 h-4 text-[#155DFC] focus:ring-[#155DFC]" />
                    <span className="ml-2 text-sm text-gray-700 font-medium">Zona {z}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-start">
            <div className="flex items-center h-5 mt-0.5">
              <input type="checkbox" id="lgpd" checked={form.lgpd} onChange={e => setField("lgpd", e.target.checked)}
                className="w-4 h-4 text-[#155DFC] border-gray-300 rounded focus:ring-[#155DFC] cursor-pointer" />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="lgpd" className="font-medium text-gray-900 cursor-pointer">
                Li e concordo com a <button type="button" onClick={() => setShowLgpd(true)} className="text-[#155DFC] hover:text-[#114bcf] underline">Política de Privacidade</button> <span className="text-red-500">*</span>
              </label>
              <p className="text-gray-600 mt-1">Concordo em fornecer meus dados para me contatarem com conteúdos e materiais. (Não fazemos spam).</p>
            </div>
          </div>
          {errors.lgpd && <p className="text-red-500 text-sm mt-1 ml-7">{errors.lgpd}</p>}
        </div>

        <div className="pt-4">
          <button disabled={busy}
            className="w-full flex items-center justify-center bg-[#155DFC] text-white font-semibold rounded-lg px-4 py-3 hover:bg-[#114bcf] focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
            {busy ? (
              <>
                <span>Enviando...</span>
                <svg className="animate-spin ml-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </>
            ) : "Enviar Cadastro"}
          </button>
        </div>
      </form>

      {showLgpd && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={() => setShowLgpd(false)} />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">​</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-xl leading-6 font-bold text-gray-900 mb-2">Política de Privacidade e Uso de Dados</h3>
                <div className="mt-4 text-sm text-gray-600 space-y-4 max-h-60 overflow-y-auto pr-2">
                  <p><strong>1. Coleta de Dados:</strong> Coletamos apenas os dados solicitados no formulário (Nome, Telefone, Data de Nascimento e Endereço).</p>
                  <p><strong>2. Finalidade e Contato:</strong> Os dados coletados serão utilizados para identificar você e permitir que nossa equipe entre em contato enviando conteúdos relevantes, materiais informativos e comunicações valiosas.</p>
                  <p><strong>3. Nosso Compromisso (Sem Spam):</strong> Valorizamos a sua privacidade e sua caixa de mensagens. Comprometemo-nos a não praticar &quot;spam&quot;. Suas informações são de uso exclusivo nosso e <strong>não serão vendidas ou repassadas a terceiros.</strong></p>
                  <p><strong>4. Cancelamento:</strong> Você poderá solicitar a parada das comunicações a qualquer momento quando for contatado por nossa equipe.</p>
                  <p><strong>5. Seus Direitos (LGPD):</strong> Você possui o direito de alterar, acessar ou excluir seus dados em nossa base, garantido pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100">
                <button onClick={() => { setShowLgpd(false); setField("lgpd", true); }}
                  className="w-full inline-flex justify-center rounded-md px-4 py-2 bg-[#155DFC] text-base font-medium text-white hover:bg-[#114bcf] sm:ml-3 sm:w-auto sm:text-sm">
                  Estou de acordo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
