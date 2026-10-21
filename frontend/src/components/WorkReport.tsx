'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { locationName, type Dict, type Lang } from '@/lib/i18n';
import { errorText, formatTime } from '@/lib/format';
import { withToasts } from '@/lib/feedback';
import { useConfirm } from './ConfirmHost';
import Icon, { workIcon } from './Icon';
import { EmptyState, SkeletonCards } from './MouldBits';
import { STATUSES, WORK_TYPES, type DateRange, type Machine, type Person, type WorkFilter, type WorkLog, type WorkSummary, type WorkType } from '@/lib/types';

const PAGE = 20;
const EXPORT_CAP = 5000; // same limit as the server
const RANGES: DateRange[] = ['today', '7d', '30d', 'month', 'all', 'custom'];
const DEFAULT: WorkFilter = { range: '7d' };
type Filters = Omit<WorkFilter, 'page' | 'limit'>;
const storageKey = (userId: string) => `mould-tracker-report:${userId}`;

function loadSaved(userId: string): Filters {
  try { const v = JSON.parse(localStorage.getItem(storageKey(userId)) || 'null'); return v && typeof v === 'object' ? { ...DEFAULT, ...v } : DEFAULT; }
  catch { return DEFAULT; }
}

// Marks the search words in a piece of text.
function highlight(text: string, q: string | undefined): ReactNode {
  const needle = q?.trim();
  if (!needle || !text) return text;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

// Work log report (Super Admin / Admin). The server pages, searches, filters and counts; nothing is loaded all at once.
export default function WorkReport({ t, lang, userId, onOpen, toast }: { t: Dict; lang: Lang; userId: string; onOpen: (mouldId: string) => void; toast: (m: string) => void }) {
  const { confirm } = useConfirm();
  const [f, setF] = useState<Filters>(DEFAULT);
  const [searchText, setSearchText] = useState('');
  const [toolText, setToolText] = useState('');
  const [workers, setWorkers] = useState<Person[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<WorkSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  // Last filters per user on this device.
  useEffect(() => {
    const saved = loadSaved(userId);
    setF(saved); setSearchText(saved.q ?? ''); setToolText(saved.toolId ?? '');
    api.workers().then((d) => setWorkers(d.workers)).catch(() => {});
    api.machines().then((d) => setMachines(d.machines)).catch(() => {});
  }, [userId]);
  useEffect(() => { try { localStorage.setItem(storageKey(userId), JSON.stringify(f)); } catch { /* storage unavailable */ } }, [f, userId]);

  useEffect(() => { const id = setTimeout(() => setF((c) => ({ ...c, q: searchText.trim() || undefined })), 400); return () => clearTimeout(id); }, [searchText]);
  useEffect(() => { const id = setTimeout(() => setF((c) => ({ ...c, toolId: toolText.trim() || undefined })), 400); return () => clearTimeout(id); }, [toolText]);

  const key = JSON.stringify(f);
  useEffect(() => { setPage(1); }, [key]);
  useEffect(() => {
    const query = JSON.parse(key) as Filters;
    if (query.range === 'custom' && !query.from && !query.to) query.range = 'all';
    setLoading(true);
    api.workReport({ ...query, page, limit: PAGE })
      .then((d) => { setTotal(d.total); setLogs((cur) => (page === 1 ? d.workLogs : [...cur, ...d.workLogs])); })
      .catch((e) => toast(errorText(e, t)))
      .finally(() => setLoading(false));
    if (page === 1) api.workSummary(query).then(setSummary).catch(() => setSummary(null)); // follows the same filters and dates
  }, [key, page, t, toast]);

  const set = (patch: Partial<Filters>) => setF((c) => ({ ...c, ...patch }));
  const clearAll = () => { setSearchText(''); setToolText(''); setF(DEFAULT); };
  async function download(format: 'csv' | 'xlsx') {
    if (exporting || !total || total > EXPORT_CAP) return;
    if (!(await confirm({ title: t.confirm.exportTitle, message: t.confirm.export(total, format === 'xlsx' ? 'Excel' : 'CSV'), confirmText: t.confirm.exportBtn }))) return;
    setExporting(true);
    try { await withToasts(t, () => api.downloadWorkLogs(f, format), t.feedback.exported, t.report.exporting); } catch { /* the toast shows why */ } finally { setExporting(false); }
  }

  const rangeLabel = f.range === 'custom' ? [f.from || '…', f.to || '…'].join(' – ') : t.report.ranges[f.range ?? '7d'];
  const person = (id?: string) => workers.find((w) => w.id === id)?.name ?? id;
  const active = useMemo(() => {
    const chips: { key: keyof Filters; label: string; clear: () => void }[] = [];
    const add = (key: keyof Filters, label: string, clear?: () => void) => chips.push({ key, label, clear: clear ?? (() => set({ [key]: undefined })) });
    if (f.q) add('q', `“${f.q}”`, () => setSearchText(''));
    if (f.toolId) add('toolId', `${t.report.mould}: ${f.toolId}`, () => setToolText(''));
    if (f.userId) add('userId', `${t.report.person}: ${person(f.userId)}`);
    if (f.type) add('type', t.work.types[f.type]);
    if (f.machine) add('machine', f.machine);
    if (f.outcome) add('outcome', f.outcome === 'NONE' ? t.report.noOutcome : t.work.outcomes[f.outcome]);
    if (f.status) add('status', `${t.report.status}: ${t.status[f.status]}`);
    if (f.problem) add('problem', t.report.problemOnly);
    return chips;
  }, [f, workers, t]);
  const shownTypes: WorkType[] = ['REPAIR', 'SERVICE', 'MINOR_FIX'];
  const tooMany = total > EXPORT_CAP;

  return (
    <main className="single">
      <div className="search-box">
        <Icon name="search" size={20} />
        <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t.report.search} aria-label={t.report.search} enterKeyHint="search" />
        {searchText && <button className="clear-btn" aria-label={t.search.clear} onClick={() => setSearchText('')}><Icon name="cancel" size={18} /></button>}
      </div>

      <div className="tabs date-chips" role="group" aria-label={t.report.from}>
        {RANGES.map((r) => <button key={r} className={'tab' + (f.range === r ? ' active' : '')} aria-pressed={f.range === r} onClick={() => set({ range: r })}>{r === 'custom' ? <Icon name="clock" size={15} /> : null}{t.report.ranges[r]}</button>)}
      </div>
      {f.range === 'custom' && (
        <div className="two-col">
          <div><label className="field-label" htmlFor="wr-from">{t.report.from}</label><input id="wr-from" className="field-input" type="date" value={f.from ?? ''} max={f.to} onChange={(e) => set({ from: e.target.value || undefined })} /></div>
          <div><label className="field-label" htmlFor="wr-to">{t.report.to}</label><input id="wr-to" className="field-input" type="date" value={f.to ?? ''} min={f.from} onChange={(e) => set({ to: e.target.value || undefined })} /></div>
        </div>
      )}

      <details className="more-filters">
        <summary><Icon name="filters" size={16} />{t.report.moreFilters}</summary>
        <div className="report-filters">
          <div><label className="field-label" htmlFor="wr-tool">{t.report.mould}</label><input id="wr-tool" className="field-input" value={toolText} onChange={(e) => setToolText(e.target.value)} /></div>
          <div><label className="field-label" htmlFor="wr-person">{t.report.person}</label>
            <select id="wr-person" className="field-input" value={f.userId ?? ''} onChange={(e) => set({ userId: e.target.value || undefined })}>
              <option value="">{t.report.anyone}</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></div>
          <div><label className="field-label" htmlFor="wr-type">{t.report.type}</label>
            <select id="wr-type" className="field-input" value={f.type ?? ''} onChange={(e) => set({ type: (e.target.value || undefined) as WorkType | undefined })}>
              <option value="">{t.report.anyType}</option>
              {WORK_TYPES.map((w) => <option key={w} value={w}>{t.work.types[w]}</option>)}
            </select></div>
          <div><label className="field-label" htmlFor="wr-machine">{t.report.machine}</label>
            <select id="wr-machine" className="field-input" value={f.machine ?? ''} onChange={(e) => set({ machine: e.target.value || undefined })}>
              <option value="">—</option>
              {machines.map((m) => <option key={m.id} value={m.code}>{m.code}</option>)}
            </select></div>
          <div><label className="field-label" htmlFor="wr-outcome">{t.report.outcome}</label>
            <select id="wr-outcome" className="field-input" value={f.outcome ?? ''} onChange={(e) => set({ outcome: (e.target.value || undefined) as Filters['outcome'] })}>
              <option value="">{t.report.anyOutcome}</option>
              {(['OK', 'NEEDS_REPAIR', 'NEEDS_SERVICE'] as const).map((o) => <option key={o} value={o}>{t.work.outcomes[o]}</option>)}
              <option value="NONE">{t.report.noOutcome}</option>
            </select></div>
          <div><label className="field-label" htmlFor="wr-status">{t.report.status}</label>
            <select id="wr-status" className="field-input" value={f.status ?? ''} onChange={(e) => set({ status: (e.target.value || undefined) as Filters['status'] })}>
              <option value="">{t.report.anyStatus}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
            </select></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.problem === 'true'} onChange={(e) => set({ problem: e.target.checked ? 'true' : undefined })} /> {t.report.problemOnly}</label>
      </details>

      {active.length > 0 && (
        <div className="filter-chips">
          {active.map((c) => <span key={c.key} className="filter-chip">{c.label}<button aria-label={`${t.report.remove}: ${c.label}`} title={t.report.remove} onClick={c.clear}><Icon name="cancel" size={14} /></button></span>)}
          <button className="link-btn inline" onClick={clearAll}>{t.report.clearAll}</button>
        </div>
      )}

      <div className="report-actions">
        <span className="section-label flat">{t.report.showing(logs.length, total, rangeLabel)}</span>
        <span className="spacer" />
        <button className="btn btn-outline small" disabled={exporting || !total || tooMany} onClick={() => download('csv')}><Icon name="export" size={16} />{exporting ? t.report.exporting : total ? `${t.report.exportCsv} (${total})` : t.report.exportNone}</button>
        <button className="btn btn-outline small" disabled={exporting || !total || tooMany} onClick={() => download('xlsx')}><Icon name="export" size={16} />{exporting ? t.report.exporting : total ? `${t.report.exportXlsx} (${total})` : t.report.exportNone}</button>
      </div>
      {tooMany && <div className="export-note">{t.report.exportCap(total, EXPORT_CAP)}</div>}

      {summary && summary.people.length > 0 && (
        <section className="report-block">
          <h2 className="zone-title">{t.report.perPerson} · {rangeLabel}</h2>
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr><th>{t.report.person_}</th>{shownTypes.map((w) => <th key={w}>{t.work.types[w]}</th>)}<th>{t.report.total}</th><th>{t.report.minutes}</th></tr></thead>
              <tbody>
                {summary.people.map((p) => (
                  <tr key={p.userId} className={f.userId === p.userId ? 'active' : ''} onClick={() => set({ userId: f.userId === p.userId ? undefined : p.userId })}>
                    <td className="cell-main"><b>{p.name}</b><small className="block muted">{t.roles[p.role] ?? p.role}</small></td>
                    {shownTypes.map((w) => <td key={w} data-label={t.work.types[w]}>{p.byType[w] ?? 0}</td>)}
                    <td data-label={t.report.total}><b>{p.total}</b></td><td data-label={t.report.minutes}>{p.minutes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {summary && summary.moulds.length > 0 && (
        <section className="report-block">
          <h2 className="zone-title">{t.report.repeat}</h2>
          <div className="quick-machines">{summary.moulds.map((m) => <button key={m.mouldId} className="quick-chip" onClick={() => onOpen(m.mouldId)}>{m.toolId} <small>× {m.count}</small></button>)}</div>
        </section>
      )}

      {!logs.length && loading && <SkeletonCards count={3} label={t.loading} />}
      {!logs.length && !loading && <EmptyState icon="worklog" text={t.report.none} />}
      {logs.length > 0 && (
        // A table on wider screens; on phones each row becomes a stacked card (see .report-table in globals.css).
        <div className="table-wrap">
          <table className="report-table">
            <thead><tr><th>{t.work.when}</th><th>{t.report.mould}</th><th>{t.report.type}</th><th>{t.work.who}</th><th>{t.work.what}</th><th>{t.report.location}</th></tr></thead>
            <tbody>
              {logs.map((w) => (
                <tr key={w.id} className={w.corrected ? 'corrected' : ''} tabIndex={0} onClick={() => onOpen(w.mouldId)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(w.mouldId); }}>
                  <td data-label={t.work.when}>{formatTime(w.doneAt, lang)}</td>
                  <td data-label={t.report.mould}><span className="tool-id-badge">{highlight(w.toolId, f.q)}</span></td>
                  <td data-label={t.report.type}>
                    <span className="card-tags">
                      {w.problemReported ? <span className="work-badge warn"><Icon name="problem" size={12} />{t.problem.reportedEntry}</span> : <span className="work-badge"><Icon name={workIcon[w.type]} size={12} />{t.work.types[w.type]}</span>}
                      {w.resolvesProblemId && <span className="work-badge soft">{t.problem.resolvesEntry}</span>}
                      {w.correctsId && <span className="work-badge soft">{t.work.correction}</span>}
                      {w.corrected && <span className="work-badge warn">{t.work.corrected}</span>}
                    </span>
                  </td>
                  <td data-label={t.work.who}><b>{w.doneBy.map((p, i) => <span key={p.id}>{i ? ', ' : ''}{highlight(p.name, f.q)}</span>)}</b>
                    {w.recordedBy.id !== w.doneBy[0]?.id && <small className="block muted">{t.work.recordedBy(w.recordedBy.name)}</small>}</td>
                  <td className="cell-main"><div className="work-desc">{highlight(w.description, f.q)}</div>
                    {(w.partsUsed || w.timeSpentMinutes != null) && <small className="muted">{w.partsUsed && highlight(w.partsUsed, f.q)}{w.partsUsed && w.timeSpentMinutes != null ? ' · ' : ''}{w.timeSpentMinutes != null && t.work.minutesShort(w.timeSpentMinutes)}</small>}</td>
                  <td data-label={t.report.location}>{highlight([locationName(w.location, t), w.machineCode, w.rackLocationId].filter(Boolean).join(' '), f.q)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs.length < total && <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page + 1)}>{loading ? t.loading : t.report.more}</button>}
    </main>
  );
}
