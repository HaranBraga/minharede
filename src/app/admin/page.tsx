"use client";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NetworkBrowser } from "@/components/NetworkBrowser";
import { Network as NetworkIcon, Upload, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminPage() {
  const [tab, setTab] = useState<"rede" | "import">("rede");

  const adminSession = { type: "admin" as const };

  return (
    <div className="min-h-screen pb-16">
      <AppHeader subtitle="Painel administrativo" showAdminLink={false} />

      <div className="sticky top-[60px] z-20 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-2 flex">
          <TabButton active={tab === "rede"} onClick={() => setTab("rede")} icon={NetworkIcon} label="Rede" />
          <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={Upload} label="Importar" />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {tab === "rede" && <NetworkBrowser session={adminSession} />}
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
          Formato: cabeçalho <code className="bg-gray-100 px-1 rounded">Nome,Link,Coordenador</code>, depois
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
