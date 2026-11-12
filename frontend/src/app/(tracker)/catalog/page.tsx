"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import SkeletonCards from "@/components/SkeletonCards";
import StatusBadge from "@/components/StatusBadge";
import { api, assetUrl } from "@/utils/api";
import { errorText } from "@/utils/format";
import { locationName } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import type { CatalogFilter, CatalogList, CatalogMould, CatalogProduct, CatalogProductDetail, CatalogSummary, CatalogTotals, Process } from "@/utils/types";

// Catalog & Totals: complete counts of moulds and of products (never mixed), per process. Not for finding
// where a mould is (that is Find). All counting, filtering and paging happens on the server.
type Tab = "moulds" | "products";
const FILTER_KEYS = { moulds: ["status", "owner", "machine", "material"], products: ["family", "material"] } as const;
const pill = "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-3.5 min-h-tap text-sm font-extrabold cursor-pointer";
const on = " bg-ink! border-ink! text-surface!";

export default function CatalogPage() {
  const { user, translations: t, openMould, refreshKey } = useApp();
  const c = t.catalog;
  const [process, setProcess] = useState<Process | "">("");
  const [tab, setTab] = useState<Tab>("moulds");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [list, setList] = useState<CatalogList<CatalogMould | CatalogProduct> | null>(null);
  const [rows, setRows] = useState<(CatalogMould | CatalogProduct)[]>([]);
  const [showLocation, setShowLocation] = useState(false);
  const [detail, setDetail] = useState<CatalogProductDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const seq = useRef(0);

  // Debounced search box.
  useEffect(() => { const h = setTimeout(() => { setQ(query.trim()); setPage(1); }, 300); return () => clearTimeout(h); }, [query]);

  const filter: CatalogFilter = { tab, process: process || undefined, q: q || undefined, sort: sort || undefined, ...filters };
  const filterKey = JSON.stringify(filter);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const f: CatalogFilter = { ...JSON.parse(filterKey), page };
      const [s, l] = await Promise.all([api.catalogSummary(f.process), f.tab === "moulds" ? api.catalogMoulds(f) : api.catalogProducts(f)]);
      if (mine !== seq.current) return; // a newer request is on its way
      setSummary(s.summary);
      setList(l);
      setRows((cur) => (page === 1 ? l.rows : [...cur, ...l.rows]));
    } catch (e) {
      toast.error(errorText(e, t));
    }
  }, [filterKey, page, t]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const reset = (next: () => void) => { next(); setPage(1); };
  const switchTab = (next: Tab) => reset(() => { setTab(next); setFilters({}); setSort(""); setQuery(""); setQ(""); setRows([]); setList(null); });
  const toggleFilter = (key: string, value: string | null) => reset(() => setFilters((cur) => {
    const v = value ?? "NONE";
    const next = { ...cur };
    if (next[key] === v) delete next[key]; else next[key] = v;
    return next;
  }));

  async function exportFile(format: "csv" | "xlsx") {
    setExporting(true);
    try {
      const truncated = await api.downloadCatalog(filter, format);
      if (truncated) toast(c.truncated(5000)); else toast.success(c.exported);
    } catch (e) {
      toast.error(errorText(e, t));
    } finally {
      setExporting(false);
    }
  }
  async function openProduct(itemId: string) {
    try { setDetail((await api.catalogProduct(itemId)).product); } catch (e) { toast.error(errorText(e, t)); }
  }

  const chipLabel = (key: string, value: string | null, label?: string | null) => {
    if (key === "status" && value) return t.status[value as keyof typeof t.status] ?? value;
    if (key === "process" && value) return c.processes[value] ?? value;
    if (key === "owner" && (value === null || value === "NONE")) return c.noOwner;
    return label ?? value ?? "—";
  };
  const totals = (x: CatalogTotals) => [
    [c.cards.moulds, x.moulds], [c.cards.uniqueItems, x.uniqueItems], [c.cards.perMould, c.cards.perMouldValue(x.itemsPerMouldAvg, x.itemsPerMouldMax)],
    [c.cards.multiItem, x.mouldsWithMultipleItems], [c.cards.multiMould, x.itemsInMultipleMoulds],
  ] as [string, string | number][];
  const active = Object.entries(filters);
  const main = "pt-5 pb-8 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]";

  return (
    <main className={main}>
      <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Icon name="documentation" />{c.title}</h2>
      <p className="text-sm text-ink-soft mb-4">{c.hint}</p>

      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label={c.breakdown.process}>
        {(["", "INJECTION", "EXTRUSION"] as const).map((p) => (
          <button key={p || "all"} type="button" className={pill + (process === p ? on : "")} aria-pressed={process === p} onClick={() => reset(() => setProcess(p))}>
            {p ? c.processes[p] : c.all}
          </button>
        ))}
      </div>

      {!summary ? <SkeletonCards count={2} label={t.loading} /> : (
        <section className="mb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {totals(summary.all).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-solid border-line bg-surface p-3">
                <div className="text-xs font-bold text-ink-soft">{label}</div>
                <div className="text-xl font-extrabold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          {!process && (
            <div className="grid md:grid-cols-2 gap-2 mt-2">
              {(["INJECTION", "EXTRUSION"] as const).map((p) => (
                <div key={p} className="rounded-lg bg-surface-2 p-3 text-sm">
                  <b>{c.processes[p]}</b>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-ink-soft">
                    {totals(summary[p]).map(([label, value]) => <span key={label}>{label}: <b className="text-ink tabular-nums">{value}</b></span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-2 mb-3 [border-bottom:1.5px_solid_var(--line)]" role="tablist">
        {(["moulds", "products"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} type="button" onClick={() => switchTab(x)}
            className={"px-4 min-h-tap font-extrabold text-md bg-transparent border-0 cursor-pointer -mb-[1.5px] " + (tab === x ? "[border-bottom:3px_solid_var(--ink)] text-ink" : "text-ink-soft")}>
            {c.tabs[x]} {list && tab === x && <small className="text-ink-soft">· {list.total}</small>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input type="search" value={query} maxLength={64} onChange={(e) => setQuery(e.target.value)} aria-label={tab === "moulds" ? c.search : c.searchItems} placeholder={tab === "moulds" ? c.search : c.searchItems}
          className="flex-1 min-w-[200px] min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink" />
        <select aria-label={c.sort} value={sort} onChange={(e) => reset(() => setSort(e.target.value))} className="min-h-12 px-3 rounded-sm border-[1.5px] border-solid border-line bg-surface-2 text-ink">
          {(tab === "moulds" ? ["toolId", "items", "status"] : ["itemId", "moulds"]).map((s) => <option key={s} value={s === "toolId" || s === "itemId" ? "" : s}>{c.sorts[s]}</option>)}
        </select>
        {tab === "moulds" && (
          <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} />{c.showLocation}</label>
        )}
        {user && can(user, "export.run") && (
          <>
            <button type="button" disabled={exporting} className={pill} onClick={() => void exportFile("csv")}><Icon name="export" size={16} />{c.exportCsv}</button>
            <button type="button" disabled={exporting} className={pill} onClick={() => void exportFile("xlsx")}><Icon name="export" size={16} />{c.exportXlsx}</button>
          </>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          {active.map(([k, v]) => (
            <button key={k} type="button" className={pill + on} aria-label={`${c.remove}: ${c.breakdown[k]}`} onClick={() => toggleFilter(k, v)}>
              {c.breakdown[k]}: {chipLabel(k, v)} <Icon name="cancel" size={14} />
            </button>
          ))}
          <button type="button" className="bg-transparent border-0 text-action font-extrabold text-sm cursor-pointer" onClick={() => reset(() => setFilters({}))}>{c.clearAll}</button>
        </div>
      )}

      {list && (
        <div className="flex flex-col gap-2 mb-4">
          {Object.entries(list.breakdown).filter(([k, chips]) => k !== "process" && chips.length > 0 && (FILTER_KEYS[tab] as readonly string[]).includes(k)).map(([k, chips]) => (
            <div key={k} className="flex gap-2 items-center overflow-x-auto [scrollbar-width:none] pb-1">
              <span className="shrink-0 text-xs font-extrabold text-ink-soft w-24">{c.breakdown[k]}</span>
              {chips.map((chip) => (
                <button key={String(chip.value)} type="button" className={pill + (filters[k] === (chip.value ?? "NONE") ? on : "")} onClick={() => toggleFilter(k, chip.value)}>
                  {chipLabel(k, chip.value, chip.label)} <small className="opacity-75 tabular-nums">{chip.count}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm font-bold text-ink-soft mb-2" aria-live="polite">{list ? c.shown(rows.length, list.total) : ""}</p>
      {!list && <SkeletonCards count={4} label={t.loading} />}
      {list && !rows.length && <EmptyState icon="empty" text={c.empty} />}

      {tab === "moulds" && rows.length > 0 && (
        <div className="flex flex-col gap-2 md:table md:w-full md:border-collapse text-sm">
          <div className="hidden md:table-row bg-surface-2 font-extrabold text-ink-soft">
            {[c.col.toolId, c.col.process, c.col.owner, c.col.machines, c.col.cavities, c.col.items, c.col.status, ...(showLocation ? [c.col.location] : [])].map((h) => <div key={h} className="md:table-cell p-2">{h}</div>)}
          </div>
          {(rows as CatalogMould[]).map((m) => (
            <div key={m.id} role="button" tabIndex={0} onClick={() => openMould(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMould(m.id); } }}
              className="text-left bg-surface border border-solid border-line rounded-md p-3 cursor-pointer grid grid-cols-2 gap-1 md:table-row md:rounded-none md:border-0 md:[border-top:1px_solid_var(--line)] md:p-0 hover:bg-surface-2">
              <span className="md:table-cell md:p-2 font-extrabold">{m.toolId}</span>
              <span className="md:table-cell md:p-2">{c.processes[m.process]}</span>
              <span className="md:table-cell md:p-2">{m.owner ?? "—"}</span>
              <span className="md:table-cell md:p-2 col-span-2 text-ink-soft">{m.capableMachines.join(", ") || "—"}</span>
              <span className="md:table-cell md:p-2">{c.col.cavities}: <b className="md:font-normal">{m.cavities}</b></span>
              <span className="md:table-cell md:p-2">{c.col.items}: <b>{m.itemCount}</b></span>
              <span className="md:table-cell md:p-2"><StatusBadge status={m.status} translations={t} /></span>
              {showLocation && <span className="md:table-cell md:p-2 text-ink-soft">{locationName(m.location, t)}</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "products" && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(rows as CatalogProduct[]).map((p) => (
            <button key={p.itemId} type="button" onClick={() => void openProduct(p.itemId)}
              className="text-left bg-surface border border-solid border-line rounded-md p-3 cursor-pointer flex gap-3 hover:bg-surface-2">
              <span className="w-16 aspect-square shrink-0 rounded-sm bg-white border border-solid border-line flex items-center justify-center overflow-hidden text-ink-faint">
                {p.thumbUrl ? <img src={assetUrl(p.thumbUrl)} alt="" loading="lazy" className="size-full object-contain" /> : <Icon name="image" size={20} />}
              </span>
              <span className="flex-1 min-w-0 text-sm">
                <b className="block">{p.itemId}</b>
                <span className="block text-ink-soft truncate">{p.description}</span>
                <span className="block text-xs text-ink-soft">{[p.materialId && `${c.col.material} ${p.materialId}`, p.masterbatchId && `${c.col.masterbatch} ${p.masterbatchId}`, p.qas && `${c.col.qas} ${p.qas}`].filter(Boolean).join(" · ")}</span>
                <span className="block text-xs font-bold mt-1">{c.madeBy(p.mouldCount)}: {p.moulds.map((m) => m.toolId).join(", ")}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {list && rows.length < list.total && (
        <button type="button" className="mt-4 w-full min-h-12 rounded-md border-[1.5px] border-solid border-line bg-surface font-semibold cursor-pointer" onClick={() => setPage((n) => n + 1)}>
          {c.loadMore}
        </button>
      )}

      <Sheet open={detail !== null} onClose={() => setDetail(null)} label={detail?.itemId ?? ""} closeLabel={t.close}>
        {detail && (
          <div>
            <h2 className="text-xl font-extrabold mb-1">{detail.itemId}</h2>
            <p className="text-ink-soft mb-3">{detail.description}</p>
            {detail.images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {detail.images.map((img) => <img key={img.key} src={assetUrl(img.thumbUrl)} alt="" className="w-20 aspect-square object-contain rounded-md border border-solid border-line bg-white" />)}
              </div>
            )}
            <p className="text-sm mb-3">{[detail.materialId && `${c.col.material} ${detail.materialId}`, detail.masterbatchId && `${c.col.masterbatch} ${detail.masterbatchId}`, detail.qas && `${c.col.qas} ${detail.qas}`].filter(Boolean).join(" · ")}</p>
            <h3 className="font-extrabold mb-2">{c.madeBy(detail.moulds.length)}</h3>
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {detail.moulds.map((m) => (
                <li key={m.id}>
                  <button type="button" className="w-full text-left bg-surface-2 rounded-md p-3 flex items-center gap-2 cursor-pointer border-0" onClick={() => { setDetail(null); openMould(m.id); }}>
                    <b>{m.toolId}</b><span className="text-sm text-ink-soft">{c.processes[m.process]}{m.cavities != null ? ` · ${c.col.cavities} ${m.cavities}` : ""}</span>
                    <span className="ml-auto"><StatusBadge status={m.status} translations={t} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </main>
  );
}
