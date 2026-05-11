"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Search, MapPin, Phone, Edit2, Filter, X, Users } from "lucide-react";
import toast from "react-hot-toast";
import { ContactEditForm } from "./ContactEditForm";
import { CenteredLoader } from "./Spinner";
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
 * cidade e busca textual por nome/telefone/cidade. Click → abre edição.
 */
export function PessoasFlat({ canChangeRole = true }: { canChangeRole?: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<number | "all">("all");
  const [filterCidade, setFilterCidade] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
  }, [contacts, filterRole, filterCidade, search]);

  const hasActiveFilter = filterRole !== "all" || filterCidade !== "all";

  return (
    <div className="space-y-3 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3 sticky top-[112px] z-20">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade, bairro ou telefone..."
            className="w-full pl-10 pr-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 focus:bg-white transition-all" />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              hasActiveFilter
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-gray-200 text-gray-600 active:bg-gray-50"
            }`}>
            <Filter size={12} /> Filtros {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />}
          </button>
          {hasActiveFilter && (
            <button onClick={() => { setFilterRole("all"); setFilterCidade("all"); }}
              className="text-xs text-gray-500 active:text-red-600 flex items-center gap-1">
              <X size={11} /> Limpar
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {filtered.length} {filtered.length === 1 ? "pessoa" : "pessoas"}
          </span>
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
          {filtered.slice(0, 200).map(c => {
            const phone = displayPhone(c.phone);
            const parent = parentName(c.parentId);
            return (
              <button key={c.id} onClick={() => setEditingId(c.id)}
                className="w-full bg-white rounded-2xl border border-gray-200 px-3 py-3 active:bg-gray-50 flex items-center gap-3 text-left">
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
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                    {phone && <span className="flex items-center gap-0.5"><Phone size={9} />{phone}</span>}
                    {c.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{c.cidade}{c.bairro ? ` · ${c.bairro}` : ""}</span>}
                    {parent && <span className="text-gray-400">sob {parent}</span>}
                  </div>
                </div>
                <Edit2 size={14} className="text-gray-300 shrink-0" />
              </button>
            );
          })}
          {filtered.length > 200 && (
            <p className="text-center text-xs text-gray-400 py-2">
              Mostrando 200 de {filtered.length}. Refine a busca pra ver mais.
            </p>
          )}
        </div>
      )}

      {editingId && (
        <ContactEditForm
          contactId={editingId}
          canChangeRole={canChangeRole}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); toast.success("Atualizado"); }} />
      )}
    </div>
  );
}
