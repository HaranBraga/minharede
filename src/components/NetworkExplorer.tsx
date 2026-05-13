"use client";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Plus, Search, Trash2, Edit2, Phone, MapPin, ChevronRight, Home, Users,
  Link as LinkIcon, Copy, Globe, Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { BottomSheet } from "./BottomSheet";
import { ContactEditForm } from "./ContactEditForm";
import { PersonFormFields, personFormToPayload, initialPersonForm, type PersonFormState } from "./PersonFormFields";
import { displayPhone } from "@/lib/phone-display";
import { CenteredLoader } from "./Spinner";

interface Role { id: string; key: string; label: string; color: string; bgColor: string; level: number; }
interface Contact {
  id: string; name: string; phone: string; publicSlug: string | null; parentId: string | null;
  cidade?: string | null;
  role: Role;
  _count: { children: number };
}

/**
 * Sessão unificada — funciona tanto pra member (member dashboard) quanto
 * pra admin (admin dashboard).
 *
 * - isAdmin=true + contactId=null → admin vê toda a rede (raiz = top-level)
 * - isAdmin=false + contactId=X   → member vê a rede dele (raiz = X)
 */
export interface ExplorerSession {
  isAdmin: boolean;
  contactId: string | null;
  name: string;
  slug: string | null;
  roleLevel: number;        // -1 pra admin (criar tudo)
  roleLabel?: string;
  roleColor?: string;
  roleBgColor?: string;
}

const LEVEL_LABEL_SG: Record<number, string> = {
  0: "Coordenador de Grupo", 1: "Coordenador", 2: "Líder", 3: "Apoiador",
};
const LEVEL_LABEL_PL: Record<number, string> = {
  0: "Coordenadores de Grupo", 1: "Coordenadores", 2: "Líderes", 3: "Apoiadores",
};

export function NetworkExplorer({ session }: { session: ExplorerSession }) {
  // useSearchParams precisa estar dentro de <Suspense> pro Next 14 prerender.
  return (
    <Suspense fallback={<CenteredLoader />}>
      <NetworkExplorerInner session={session} />
    </Suspense>
  );
}

function NetworkExplorerInner({ session }: { session: ExplorerSession }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Estado de navegação inteiramente derivado da URL pra que o botão
  // "voltar" do navegador desfaça cada passo (drill in, abrir categoria,
  // alternar direct-only) em ordem reversa.
  //
  // Query params:
  //  - p:  stack de contactIds separados por vírgula (caminho da rede)
  //  - c:  level de cargo aberto em modo lista (0..3); ausente = cards
  //  - cd: "1" quando o modo lista filtra só diretos
  const path: string[] = useMemo(() => {
    const raw = searchParams.get("p");
    if (raw) return raw.split(",").filter(Boolean);
    return session.contactId ? [session.contactId] : [];
  }, [searchParams, session.contactId]);

  const currentId: string | null = path[path.length - 1] ?? null;

  const category: number | null = useMemo(() => {
    const raw = searchParams.get("c");
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const categoryDirectOnly = searchParams.get("cd") === "1";

  /** Atualiza URL preservando params que não foram mexidos. */
  const writeState = useCallback((next: {
    path?: string[];
    category?: number | null;
    directOnly?: boolean;
  }) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.path !== undefined) {
      if (next.path.length === 0) sp.delete("p");
      else sp.set("p", next.path.join(","));
    }
    if (next.category !== undefined) {
      if (next.category === null) sp.delete("c");
      else sp.set("c", String(next.category));
    }
    if (next.directOnly !== undefined) {
      if (next.directOnly) sp.set("cd", "1");
      else sp.delete("cd");
    }
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, router, pathname]);

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/rede");
      if (r.ok) setContacts((await r.json()).contacts ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Carrega todos os cargos pra exibir cards mesmo quando vazios (ex: coord-grupo
  // que ainda não tem ninguém na rede)
  useEffect(() => {
    fetch("/api/roles").then(r => r.json()).then((data: Role[]) => {
      if (Array.isArray(data)) setAllRoles(data);
    }).catch(() => {});
  }, []);

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach(c => m.set(c.id, c));
    return m;
  }, [contacts]);

  // Contato sendo visualizado
  const currentContact: { id: string | null; name: string; slug: string | null; role: Role | null; level: number } = useMemo(() => {
    if (currentId === null) {
      return { id: null, name: "Toda a rede", slug: null, role: null, level: -1 };
    }
    if (currentId === session.contactId) {
      return { id: session.contactId, name: session.name, slug: session.slug, role: null, level: session.roleLevel };
    }
    const c = contactById.get(currentId);
    if (c) return { id: c.id, name: c.name, slug: c.publicSlug, role: c.role, level: c.role.level };
    return { id: currentId, name: "?", slug: null, role: null, level: 99 };
  }, [currentId, session, contactById]);

  // Map parentId → children pra facilitar BFS.
  // Ignora auto-referência (parentId === id) pra evitar loops infinitos
  // caso o banco tenha um contato apontando pra si mesmo.
  const childrenByParent = useMemo(() => {
    const m = new Map<string | null, Contact[]>();
    for (const c of contacts) {
      if (c.parentId === c.id) continue;
      const k = c.parentId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [contacts]);

  // Filhos diretos do nó atual (ordenados por cargo, depois nome)
  const allChildren = useMemo(() => {
    return [...(childrenByParent.get(currentId) ?? [])]
      .sort((a, b) => {
        if (a.role.level !== b.role.level) return a.role.level - b.role.level;
        return a.name.localeCompare(b.name);
      });
  }, [childrenByParent, currentId]);

  // Tamanho da rede (descendentes recursivos) por contato — usado nos cards
  // de líder/coord pra mostrar quantos estão na rede de cada um.
  const networkSizeById = useMemo(() => {
    const sizes = new Map<string, number>();
    const computing = new Set<string>();
    function getSize(id: string): number {
      const cached = sizes.get(id);
      if (cached !== undefined) return cached;
      // Ciclo detectado (A→B→A): trata como folha pra não estourar a stack.
      if (computing.has(id)) return 0;
      computing.add(id);
      const kids = childrenByParent.get(id) ?? [];
      let total = 0;
      for (const k of kids) total += 1 + getSize(k.id);
      computing.delete(id);
      sizes.set(id, total);
      return total;
    }
    for (const c of contacts) getSize(c.id);
    return sizes;
  }, [contacts, childrenByParent]);

  // TODOS os descendentes recursivos do nó atual (não inclui o próprio)
  const allDescendants = useMemo(() => {
    const out: Contact[] = [];
    const visited = new Set<string>();
    const stack: (string | null)[] = [currentId];
    while (stack.length) {
      const id = stack.pop()!;
      const kids = childrenByParent.get(id) ?? [];
      for (const k of kids) {
        if (visited.has(k.id)) continue;
        visited.add(k.id);
        out.push(k);
        stack.push(k.id);
      }
    }
    return out;
  }, [childrenByParent, currentId]);

  // Categorias por cargo, com TOTAL recursivo (rede toda abaixo do nó).
  // Na view admin (raiz), garante que todos os 4 cargos apareçam mesmo
  // zerados — assim o card "Coordenadores de Grupo" sempre é visível.
  const categories = useMemo(() => {
    const map = new Map<number, { level: number; role: Role; total: number }>();
    for (const c of allDescendants) {
      const g = map.get(c.role.level);
      if (g) g.total++;
      else map.set(c.role.level, { level: c.role.level, role: c.role, total: 1 });
    }
    if (currentId === null && allRoles.length > 0) {
      for (const r of allRoles) {
        if (!map.has(r.level)) {
          map.set(r.level, { level: r.level, role: r, total: 0 });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.level - b.level);
  }, [allDescendants, currentId, allRoles]);

  // Quando uma categoria está selecionada, lista descendentes (ou só
  // filhos diretos, quando categoryDirectOnly) daquele cargo
  const categoryItems = useMemo(() => {
    if (category === null) return [];
    const source = categoryDirectOnly ? allChildren : allDescendants;
    let list = source.filter(c => c.role.level === category);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.cidade ?? "").toLowerCase().includes(q)
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allDescendants, allChildren, category, categoryDirectOnly, search]);

  // Apoiadores DIRETOS do nó atual (parent === currentId). Card aparece só
  // quando o nó visualizado é coord ou coord-grupo (níveis 0 e 1).
  const directApoiadores = useMemo(() => {
    if (currentContact.level !== 0 && currentContact.level !== 1) return null;
    const apoiadorLv = 3;
    const directs = allChildren.filter(c => c.role.level === apoiadorLv);
    if (directs.length === 0) return null;
    return { level: apoiadorLv, role: directs[0].role, count: directs.length };
  }, [allChildren, currentContact.level]);

  // Total descendentes recursivo (já computado em allDescendants)
  const descendantCount = allDescendants.length;

  // Cargos que o user pode criar abaixo do contato atual
  const availableLevels = useMemo(() => {
    const minByCurrent = currentContact.level + 1;
    const minBySession = session.roleLevel + 1;
    const min = Math.max(minByCurrent, minBySession);
    return [0, 1, 2, 3].filter(lv => lv >= Math.max(0, min));
  }, [currentContact.level, session.roleLevel]);
  const canCreateHere = availableLevels.length > 0;

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const items: { id: string | null; name: string; isRoot: boolean }[] = [];
    if (session.isAdmin) {
      items.push({ id: null, name: "Toda a rede", isRoot: true });
    }
    path.forEach(id => {
      if (id === session.contactId) {
        items.push({ id, name: session.isAdmin ? (contactById.get(id)?.name ?? "?") : "Você", isRoot: !session.isAdmin });
      } else {
        const c = contactById.get(id);
        items.push({ id, name: c?.name ?? "?", isRoot: false });
      }
    });
    return items;
  }, [path, contactById, session]);

  function navigateTo(id: string | null) {
    setSearch("");
    // Navegar pra outro nó sempre limpa o modo categoria (passa a mostrar os cards)
    if (id === null) { writeState({ path: [], category: null, directOnly: false }); return; }
    const idx = path.indexOf(id);
    if (idx >= 0) { writeState({ path: path.slice(0, idx + 1), category: null, directOnly: false }); return; }
    writeState({ path: [...path, id], category: null, directOnly: false });
  }
  function navigateUp() {
    if (path.length > 0) writeState({ path: path.slice(0, -1), category: null, directOnly: false });
  }

  const [exporting, setExporting] = useState(false);

  async function exportToPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as any).default ?? autoTableMod;

      // Lista plana com profundidade, percorrendo a hierarquia a partir do nó atual.
      // Guard de ciclo: se um id já apareceu na cadeia de ancestrais, não revisita.
      const seen = new Set<string>();
      function buildList(parentId: string | null, depth: number): { c: Contact; d: number }[] {
        const out: { c: Contact; d: number }[] = [];
        const kids = [...(childrenByParent.get(parentId) ?? [])].sort((a, b) => {
          if (a.role.level !== b.role.level) return a.role.level - b.role.level;
          return a.name.localeCompare(b.name);
        });
        for (const k of kids) {
          if (seen.has(k.id)) continue;
          seen.add(k.id);
          out.push({ c: k, d: depth });
          out.push(...buildList(k.id, depth + 1));
        }
        return out;
      }
      const flat = buildList(currentId, 0);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const title = currentId === null ? "Toda a rede" : `Rede de ${currentContact.name}`;
      const subtitle = currentId === null
        ? "Visão de administrador"
        : (LEVEL_LABEL_SG[currentContact.level] ?? "");
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const totalStr = `${flat.length.toLocaleString("pt-BR")} ${flat.length === 1 ? "pessoa" : "pessoas"} na rede · Exportado em ${dateStr}`;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      if (subtitle) doc.text(subtitle, 14, 24);
      doc.text(totalStr, 14, subtitle ? 29 : 24);

      if (flat.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(150);
        doc.text("Rede vazia.", 14, 45);
      } else {
        const rows = flat.map(({ c, d }) => [
          "  ".repeat(d) + c.name,
          c.role.label,
          displayPhone(c.phone) ?? "",
          c.cidade ?? "",
        ]);
        autoTable(doc, {
          startY: subtitle ? 35 : 30,
          head: [["Nome", "Cargo", "Telefone", "Cidade"]],
          body: rows,
          styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 80, font: "courier" }, // Nome em monoespaçada pra indentação aparecer
            1: { cellWidth: 35 },
            2: { cellWidth: 32 },
            3: { cellWidth: "auto" },
          },
          margin: { top: 14, left: 14, right: 14, bottom: 14 },
        });
      }

      const safeName = (currentContact.name || "todos")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().replace(/^_|_$/g, "");
      const isoDate = new Date().toISOString().split("T")[0];
      doc.save(`rede_${safeName}_${isoDate}.pdf`);
      toast.success("PDF gerado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  }

  async function deleteContact(c: Contact) {
    if (!confirm(`Excluir "${c.name}"?${c.role.level < 3 ? "\nDescendentes ficam desvinculados." : ""}`)) return;
    const r = await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-4 pb-24 relative">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {breadcrumb.map((b, i) => (
          <div key={b.id ?? "root"} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
            <button onClick={() => navigateTo(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${
                i === breadcrumb.length - 1
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
              }`}>
              {b.isRoot && (b.id === null ? <Globe size={11} /> : <Home size={11} />)}
              {b.name}
            </button>
          </div>
        ))}
      </nav>

      {/* Header do nó atual */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {currentId === null ? (
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Globe size={22} />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
              style={{
                backgroundColor: currentContact.role?.bgColor ?? session.roleBgColor ?? "#e0e7ff",
                color:           currentContact.role?.color   ?? session.roleColor   ?? "#4f46e5",
              }}>
              {currentContact.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base truncate">{currentContact.name}</p>
            <p className="text-xs text-gray-500">
              {currentId === null ? "Visão de administrador" : (LEVEL_LABEL_SG[currentContact.level] ?? "—")}
              {currentId !== session.contactId && currentId !== null && <span> · da sua rede</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {currentId !== null && (
              <button onClick={exportToPdf} disabled={exporting || loading}
                className="text-xs text-gray-600 active:text-brand-700 px-2 py-1 border border-gray-200 rounded-lg flex items-center gap-1 disabled:opacity-50"
                title="Exportar rede em PDF">
                <Download size={12} />
                {exporting ? "Gerando..." : "PDF"}
              </button>
            )}
            {path.length > (session.isAdmin ? 0 : 1) && (
              <button onClick={navigateUp}
                className="text-xs text-gray-500 active:text-gray-800 px-2 py-1 border border-gray-200 rounded-lg">
                ← voltar
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1">
              <Users size={10} />
              {currentId === null ? "Total cadastrados" : "Total na rede"}
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{descendantCount.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* Link público pra apoiador se cadastrar */}
        {currentContact.level >= 0 && currentContact.level <= 2 && currentContact.slug && (() => {
          const kind = currentContact.level <= 1 ? "coord_form" : "lider";
          const url  = `${typeof window !== "undefined" ? window.location.origin : ""}/?${kind}=${encodeURIComponent(currentContact.slug)}`;
          return (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <LinkIcon size={10} />Link pra apoiador se cadastrar
              </p>
              <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
                <input readOnly value={url}
                  className="flex-1 bg-transparent text-xs text-gray-700 outline-none truncate select-all" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}
                  className="text-xs font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-lg px-3 py-2 flex items-center gap-1 shrink-0">
                  <Copy size={12} /> Copiar
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                Cadastros via esse link entram automaticamente sob <strong>{currentContact.name}</strong>.
              </p>
            </div>
          );
        })()}
      </section>

      {/* === MODO CATEGORIA: lista filtrada por cargo === */}
      {category !== null ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => writeState({ category: null, directOnly: false })}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 active:text-brand-700">
              <ChevronRight size={14} className="rotate-180" />
              {LEVEL_LABEL_PL[category]}
              {categoryDirectOnly && <span className="text-[11px] text-brand-600">· diretos</span>}
            </button>
            <span className="text-xs text-gray-400">
              {categoryItems.length} {categoryItems.length === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>

          {categoryItems.length > 5 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Buscar em ${LEVEL_LABEL_PL[category]?.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>
          )}

          {loading ? (
            <CenteredLoader />
          ) : categoryItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nada encontrado.</p>
          ) : (
            <div className="space-y-2">
              {categoryItems.map(c => (
                <ChildRow key={c.id} contact={c}
                  networkSize={networkSizeById.get(c.id) ?? 0}
                  onOpen={() => navigateTo(c.id)}
                  onEdit={() => setEditingId(c.id)}
                  onDelete={() => deleteContact(c)} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* === MODO RAIZ: cards de categoria + ações === */
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              {currentId === null ? "Top da rede" : `Rede de ${currentContact.name}`}
            </h2>
          </div>

          {loading ? (
            <CenteredLoader />
          ) : categories.length === 0 ? (
            <EmptyState
              availableLevels={availableLevels}
              canCreate={canCreateHere}
              onCreate={() => setShowCreate(true)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <CategoryCard key={cat.level}
                  level={cat.level}
                  role={cat.role}
                  count={cat.total}
                  onClick={() => writeState({ category: cat.level, directOnly: false })} />
              ))}
              {directApoiadores && (
                <CategoryCard key="direct-apoiadores"
                  level={directApoiadores.level}
                  role={directApoiadores.role}
                  count={directApoiadores.count}
                  labelOverride="Apoiadores diretos"
                  onClick={() => writeState({ category: directApoiadores.level, directOnly: true })} />
              )}
            </div>
          )}
        </>
      )}

      {canCreateHere && allChildren.length > 0 && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 active:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center z-30 transition-transform active:scale-95">
          <Plus size={24} />
        </button>
      )}

      {showCreate && (
        <CreateBelow
          parentId={currentId}
          parentName={currentContact.name}
          availableLevels={availableLevels}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }} />
      )}

      {editingId && (
        <ContactEditForm
          contactId={editingId}
          canChangeRole={session.isAdmin || session.roleLevel <= 1}
          canCreateLogin={session.isAdmin}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); }} />
      )}
    </div>
  );
}

/** Detecta se uma cor hex é muito clara pra ser usada como texto em fundo branco. */
function isLightColor(hex: string): boolean {
  const c = (hex ?? "").replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Luminância perceptual (ITU-R BT.601)
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

function CategoryCard({ level, role, count, onClick, labelOverride }: {
  level: number;
  role: Role;
  count: number;
  onClick: () => void;
  labelOverride?: string;
}) {
  // Se role.color é muito clara (ex: branco), usa bgColor pro texto do label
  // garantir contraste no fundo branco do card.
  const labelColor = isLightColor(role.color) ? role.bgColor : role.color;
  return (
    <button onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl p-4 text-left active:scale-[0.98] active:bg-gray-50 transition-transform overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8"
        style={{ backgroundColor: labelColor }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: role.bgColor, color: role.color }}>
          <Users size={18} />
        </div>
        <p className="text-3xl font-bold text-gray-900 leading-none">{count.toLocaleString("pt-BR")}</p>
        <p className="text-[11px] uppercase tracking-wide font-semibold mt-1.5"
          style={{ color: labelColor }}>
          {labelOverride ?? LEVEL_LABEL_PL[level] ?? role.label}
        </p>
        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          Ver lista <ChevronRight size={10} />
        </p>
      </div>
    </button>
  );
}

function ChildRow({ contact, networkSize, onOpen, onEdit, onDelete }: {
  contact: Contact;
  networkSize: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const phoneShown = displayPhone(contact.phone);
  const isApoiad = contact.role.level >= 3;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={onOpen} disabled={isApoiad}
        className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-gray-50 disabled:cursor-default disabled:active:bg-white">
        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ backgroundColor: contact.role.bgColor, color: contact.role.color }}>
          {contact.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-px rounded-full"
              style={{ color: contact.role.color, backgroundColor: contact.role.bgColor }}>
              {contact.role.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            {!isApoiad && networkSize > 0 && (
              <span className="font-semibold text-brand-600">
                {networkSize.toLocaleString("pt-BR")} na rede
              </span>
            )}
            {phoneShown && <span className="flex items-center gap-0.5"><Phone size={9} />{phoneShown}</span>}
            {contact.cidade && <span className="flex items-center gap-0.5"><MapPin size={9} />{contact.cidade}</span>}
          </div>
        </div>
        {!isApoiad && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
      </button>
      <div className="flex border-t border-gray-100 divide-x divide-gray-100">
        <button onClick={onEdit}
          className="flex-1 py-2 text-xs font-medium text-gray-600 active:text-brand-700 active:bg-brand-50 flex items-center justify-center gap-1.5">
          <Edit2 size={12} /> Editar
        </button>
        <button onClick={onDelete}
          className="flex-1 py-2 text-xs font-medium text-red-500 active:text-red-700 active:bg-red-50 flex items-center justify-center gap-1.5">
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </div>
  );
}

function EmptyState({ availableLevels, canCreate, onCreate }: {
  availableLevels: number[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  const labels = availableLevels.map(lv => LEVEL_LABEL_SG[lv]?.toLowerCase() ?? "pessoa");
  const desc = labels.length === 0 ? "pessoa"
    : labels.length === 1 ? labels[0]
    : labels.slice(0, -1).join(", ") + " ou " + labels[labels.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Users size={26} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">Rede vazia</p>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        {canCreate ? `Adicione ${desc} abaixo.` : "Você não tem permissão pra adicionar nesse nível."}
      </p>
      {canCreate && (
        <button onClick={onCreate}
          className="inline-flex items-center gap-1.5 bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm">
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  );
}

function CreateBelow({ parentId, parentName, availableLevels, onClose, onSaved }: {
  parentId: string | null;
  parentName: string;
  availableLevels: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PersonFormState>(initialPersonForm);
  const [selectedLevel, setSelectedLevel] = useState<number>(
    availableLevels.length > 0 ? availableLevels[availableLevels.length - 1] : 3
  );
  const [busy, setBusy] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ username: string; password: string | null; name: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.phone.length < 10) return;
    setBusy(true);
    try {
      let endpoint = "/api/apoiadores";
      const payload: any = personFormToPayload(form);
      if (selectedLevel <= 1) endpoint = "/api/coordinators";
      else if (selectedLevel === 2) {
        endpoint = "/api/leaders";
        if (parentId) payload.coordinator = parentName;
      } else if (parentId) {
        payload.parentId = parentId;
      }
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.error || "Erro"); return; }
      const data = await r.json();
      toast.success("Adicionado");
      if (data.login?.username) {
        setCreatedLogin({
          username: data.login.username,
          password: data.login.defaultPassword,
          name: form.name,
        });
      } else {
        onSaved();
      }
    } finally { setBusy(false); }
  }

  if (createdLogin) {
    return (
      <BottomSheet open onClose={onSaved} title="Login criado!">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{createdLogin.name}</span> foi adicionado(a) com login automático.
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
    <BottomSheet open onClose={onClose} title="Adicionar à rede">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-2">
          Abaixo de <span className="font-semibold text-gray-700">{parentName}</span>
        </p>

        {availableLevels.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo *</label>
            <div className="grid grid-cols-2 gap-2">
              {availableLevels.map(lv => (
                <button key={lv} type="button" onClick={() => setSelectedLevel(lv)}
                  className={`py-2.5 px-3 text-sm font-semibold rounded-xl border transition-colors ${
                    selectedLevel === lv
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 active:bg-gray-50"
                  }`}>
                  {LEVEL_LABEL_SG[lv]}
                </button>
              ))}
            </div>
          </div>
        )}

        <PersonFormFields form={form} setForm={setForm}
          alwaysExpanded={selectedLevel === 3} />

        <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white -mx-5 px-5 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : `Adicionar ${LEVEL_LABEL_SG[selectedLevel] ?? ""}`}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
