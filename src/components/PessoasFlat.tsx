"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search, MapPin, Phone, Edit2, Filter, X, Users, CheckSquare, Square,
  Link as LinkIcon, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { ContactEditForm } from "./ContactEditForm";
import { CenteredLoader } from "./Spinner";
import { BottomSheet } from "./BottomSheet";
import { displayPhone } from "@/lib/phone-display";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null;
  parentId: string | null;
  cidade?: string | null; bairro?: string | null; zona?: string | null;
  role: Role;
  _count: { children: number };
}

/**
 * Lista plana de todas as pessoas da rede (admin) com filtros por cargo,
 * cidade, vínculo (com/sem pai) e busca textual. Modo de seleção em lote
 * pra atribuir coordenador a vários líderes de uma vez.
 */
export function PessoasFlat({ canChangeRole = true }: { canChangeRole?: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<number | "all">("all");
  const [filterCidade, setFilterCidade] = useState<string>("all");
  const [filterVinculo, setFilterVinculo] = useState<"all" | "com" | "sem">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Modo seleção em lote
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/rede");
      if (r.ok) setContacts((await r.json()).contacts ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const parentName = useMemo(() => {
    const m = new Map<string, string>();
    contacts.forEach(c => m.set(c.id, c.name));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [contacts]);

  const cidades = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => { if (c.cidade) set.add(c.cidade); });
    return Array.from(set).sort();
  }, [contacts]);

  const roles = useMemo(() => {
    const map = new Map<number, Role>();
    contacts.forEach(c => { if (!map.has(c.role.level)) map.set(c.role.level, c.role); });
    return Array.from(map.values()).sort((a, b) => a.level - b.level);
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (filterRole !== "all") list = list.filter(c => c.role.level === filterRole);
    if (filterCidade !== "all") list = list.filter(c => c.cidade === filterCidade);
    if (filterVinculo === "sem") list = list.filter(c => !c.parentId);
    if (filterVinculo === "com") list = list.filter(c => !!c.parentId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.cidade ?? "").toLowerCase().includes(q) ||
        (c.bairro ?? "").toLowerCase().includes(q) ||
        (displayPhone(c.phone) ?? "").includes(q)
      );
    }
    return list.sort((a, b) => {
      if (a.role.level !== b.role.level) return a.role.level - b.role.level;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, filterRole, filterCidade, filterVinculo, search]);

  const hasActiveFilter = filterRole !== "all" || filterCidade !== "all" || filterVinculo !== "all";

  // Níveis presentes nos selecionados (pra escolher pai válido)
  const selectedLevels = useMemo(() => {
    const lv = new Set<number>();
    for (const id of selected) {
      const c = contacts.find(x => x.id === id);
      if (c) lv.add(c.role.level);
    }
    return Array.from(lv).sort();
  }, [selected, contacts]);

  // Pais possíveis: todos com nível < o menor nível dos selecionados
  const eligibleParents = useMemo(() => {
    if (selectedLevels.length === 0) return [];
    const minLevel = Math.min(...selectedLevels);
    return contacts
      .filter(c => c.role.level < minLevel)
      .sort((a, b) => {
        if (a.role.level !== b.role.level) return a.role.level - b.role.level;
        return a.name.localeCompare(b.name);
      });
  }, [contacts, selectedLevels]);

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(filtered.slice(0, 500).map(c => c.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3 sticky top-[112px] z-20">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade, bairro ou telefone..."
            className="w-full pl-10 pr-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 focus:bg-white transition-all" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              hasActiveFilter
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-gray-200 text-gray-600 active:bg-gray-50"
            }`}>
            <Filter size={12} /> Filtros {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />}
          </button>
          {hasActiveFilter && (
            <button onClick={() => { setFilterRole("all"); setFilterCidade("all"); setFilterVinculo("all"); }}
              className="text-xs text-gray-500 active:text-red-600 flex items-center gap-1">
              <X size={11} /> Limpar
            </button>
          )}
          {!selectMode ? (
            <button onClick={() => setSelectMode(true)}
              className="ml-auto text-xs font-semibold text-brand-700 active:text-brand-800 px-3 py-2 border border-brand-200 rounded-lg bg-brand-50 flex items-center gap-1">
              <CheckSquare size={12} /> Selecionar
            </button>
          ) : (
            <button onClick={exitSelectMode}
              className="ml-auto text-xs font-semibold text-gray-600 px-3 py-2 border border-gray-200 rounded-lg flex items-center gap-1">
              <X size={12} /> Sair da seleção
            </button>
          )}
          {!selectMode && (
            <span className="text-xs text-gray-500">
              {filtered.length} {filtered.length === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Cargo</label>
              <select value={String(filterRole)}
                onChange={e => setFilterRole(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="w-full px-2 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="all">Todos os cargos</option>
                {roles.map(r => (
                  <option key={r.id} value={r.level}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Cidade</label>
              <select value={filterCidade} onChange={e => setFilterCidade(e.target.value)}
                className="w-full px-2 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600">
                <option value="all">Todas as cidades</option>
                {cidades.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Vínculo</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { v: "all", label: "Todos" },
                  { v: "sem", label: "Sem coordenador" },
                  { v: "com", label: "Com coordenador" },
                ].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => setFilterVinculo(o.v as any)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border ${
                      filterVinculo === o.v
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600 active:bg-gray-50"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectMode && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-700">
              {selected.size} selecionado(s)
            </span>
            <button onClick={selectAll}
              className="text-[11px] text-brand-700 active:text-brand-800 underline">
              Selecionar visíveis ({Math.min(filtered.length, 500)})
            </button>
            {selected.size > 0 && (
              <button onClick={clearSelection}
                className="text-[11px] text-gray-500 active:text-red-600 underline">
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <CenteredLoader />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users size={22} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Nenhuma pessoa encontrada</p>
          <p className="text-xs text-gray-500 mt-1">Ajuste a busca ou os filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 500).map(c => {
            const phone = displayPhone(c.phone);
            const parent = parentName(c.parentId);
            const isSelected = selected.has(c.id);
            const onClick = selectMode ? () => toggleOne(c.id) : () => setEditingId(c.id);
            return (
              <button key={c.id} onClick={onClick}
                className={`w-full rounded-2xl border px-3 py-3 active:bg-gray-50 flex items-center gap-3 text-left transition-colors ${
                  isSelected ? "bg-brand-50 border-brand-200" : "bg-white border-gray-200"
                }`}>
                {selectMode && (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-brand-600 border-brand-600 text-white" : "border-gray-300"
                  }`}>
                    {isSelected && <CheckSquare size={12} />}
                  </div>
                )}
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ backgroundColor: c.role.bgColor, color: c.role.color }}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                    <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
                      style={{ color: c.role.color, backgroundColor: c.role.bgColor }}>
                      {c.role.label}
                    </span>
                    {!c.parentId && c.role.level > 0 && (
                      <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full bg-amber-100 text-amber-700">
                        sem vínculo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                    {phone && <span className="flex items-center gap-0.5"><Phone size={9} />{phone}</span>}
                    {c.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{c.cidade}{c.bairro ? ` · ${c.bairro}` : ""}</span>}
                    {parent && <span className="text-gray-400">sob {parent}</span>}
                  </div>
                </div>
                {!selectMode && <Edit2 size={14} className="text-gray-300 shrink-0" />}
              </button>
            );
          })}
          {filtered.length > 500 && (
            <p className="text-center text-xs text-gray-400 py-2">
              Mostrando 500 de {filtered.length}. Refine a busca pra ver mais.
            </p>
          )}
        </div>
      )}

      {/* Barra flutuante de ação em lote */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{selected.size} selecionado(s)</p>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedLevels.length > 1
                  ? "Cargos diferentes — pai será aplicado a todos"
                  : `Vincular a um pai (cargo acima)`}
              </p>
            </div>
            <button onClick={() => setShowAssignModal(true)}
              disabled={eligibleParents.length === 0}
              className="px-4 py-3 text-sm font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl flex items-center gap-2 disabled:opacity-50">
              <LinkIcon size={14} /> Atribuir
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <ContactEditForm
          contactId={editingId}
          canChangeRole={canChangeRole}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); toast.success("Atualizado"); }} />
      )}

      {showAssignModal && (
        <AssignParentModal
          selectedIds={Array.from(selected)}
          eligibleParents={eligibleParents}
          onClose={() => setShowAssignModal(false)}
          onDone={(msg) => {
            setShowAssignModal(false);
            exitSelectMode();
            load();
            toast.success(msg);
          }} />
      )}
    </div>
  );
}

// ─── Modal: escolher pai pra atribuir aos selecionados ────────────────────────

function AssignParentModal({ selectedIds, eligibleParents, onClose, onDone }: {
  selectedIds: string[];
  eligibleParents: Contact[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [parentId, setParentId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligibleParents.slice(0, 100);
    return eligibleParents.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.cidade ?? "").toLowerCase().includes(q)
    ).slice(0, 100);
  }, [eligibleParents, search]);

  async function submit() {
    if (!parentId) { toast.error("Escolha um pai"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/bulk-assign-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, parentId }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Erro"); return; }
      onDone(`${data.atualizados} vinculados a ${data.parent}`);
    } finally { setBusy(false); }
  }

  return (
    <BottomSheet open onClose={onClose} title={`Atribuir pai a ${selectedIds.length} contato(s)`}>
      <div className="space-y-3">
        {eligibleParents.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            Não há pai elegível pros contatos selecionados. Cargos misturados ou nível muito alto.
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar coordenador..."
                className="w-full pl-10 pr-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 focus:bg-white" />
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1.5 -mx-1 px-1">
              {filtered.map(p => (
                <button key={p.id} type="button" onClick={() => setParentId(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    parentId === p.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-gray-200 bg-white active:bg-gray-50"
                  }`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: p.role.bgColor, color: p.role.color }}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                      <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
                        style={{ color: p.role.color, backgroundColor: p.role.bgColor }}>
                        {p.role.label}
                      </span>
                    </div>
                    {p.cidade && (
                      <p className="text-[11px] text-gray-500 mt-0.5">{p.cidade}</p>
                    )}
                  </div>
                  {parentId === p.id && (
                    <CheckSquare size={16} className="text-brand-600 shrink-0" />
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">Nenhum pai encontrado.</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">
            Cancelar
          </button>
          <button disabled={busy || !parentId} onClick={submit}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-50">
            {busy ? "Vinculando..." : "Vincular"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
