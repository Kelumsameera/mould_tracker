'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, MouldCard, SkeletonCards, StatusBadge, rackTone } from './MouldBits';
import Icon, { locationIcon, type IconName } from './Icon';
import { useConfirm, type ConfirmOptions } from './ConfirmHost';
import { withToasts } from '@/lib/feedback';
import { api } from '@/lib/api';
import { locationName, type Dict, type Lang } from '@/lib/i18n';
import { errorText, formatTime } from '@/lib/format';
import { LOCATIONS, SERVICE_STATUSES, type AuditEntry, type Location, type Mould, type Rack, type Stats, type ToolType, type Zone } from '@/lib/types';

const POLL_MS = 10_000;

// Re-runs `load` every POLL_MS while the page is visible, and when `key` changes.
function usePolling(load: () => void, key: unknown) {
  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load, key]);
}

type Filter = { location?: Location; needsService?: boolean; awaitingRack?: boolean; problem?: boolean };

// ---- Find a mould: one big search box, dashboard chips, results with the location line ----
export function FindView({ t, lang, onOpen, refreshKey, onSync, toolType = 'INJECTION_MOULD' }: { t: Dict; lang: Lang; onOpen: (id: string) => void; refreshKey: number; onSync: (ok: boolean) => void; toolType?: ToolType }) {
  const extrusion = toolType === 'EXTRUSION_DIE';
  const placeholder = extrusion ? t.extrusionSearch : t.search.placeholder;
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>({});
  const [moulds, setMoulds] = useState<Mould[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const id = setTimeout(() => setQ(query.trim()), 250); return () => clearTimeout(id); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const load = useCallback(() => {
    Promise.all([api.moulds({ q, ...filter, toolType }), api.stats(toolType)])
      .then(([m, s]) => { setMoulds(m.moulds); setStats(s.stats); onSync(true); })
      .catch(() => onSync(false));
  }, [q, filter, onSync, toolType]);
  usePolling(load, refreshKey);

  const toggle = (f: Filter) => setFilter((cur) => (JSON.stringify(cur) === JSON.stringify(f) ? {} : f));
  const chips: { f: Filter; label: string; n: number; tone: string; icon: IconName }[] = stats ? [
    ...LOCATIONS.filter(l => l !== (extrusion ? 'MOULD_ROOM' : 'TOOL_ROOM')).map((l) => ({ f: { location: l }, label: locationName(l, t), n: stats.byLocation[l] ?? 0, tone: l, icon: locationIcon[l] })),
    { f: { needsService: true }, label: t.dash.attention, n: stats.needsAttention, tone: 'attention', icon: 'attention' as const },
    ...(!extrusion ? [{ f: { awaitingRack: true }, label: t.dash.awaitingRack, n: stats.awaitingRack, tone: 'waiting', icon: 'rack' as const }] : []),
    { f: { problem: true }, label: t.problem.filter, n: stats.problemsReported, tone: 'problem', icon: 'problem' as const }
  ] : [];

  return (
    <>
      <div className="search-wrap find">
        <div className="search-box big">
          <Icon name="search" size={22} />
          <input ref={inputRef} type="search" inputMode="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" enterKeyHint="search" />
          {query && <button className="clear-btn" aria-label={t.search.clear} onClick={() => setQuery('')}>
            <Icon name="cancel" size={18} />
          </button>}
        </div>
      </div>
      <main>
        <div className="stats-row wrap">
          {chips.map((c) => (
            <button key={c.tone} className={'stat-chip' + (JSON.stringify(filter) === JSON.stringify(c.f) ? ' active' : '')} aria-pressed={JSON.stringify(filter) === JSON.stringify(c.f)} onClick={() => toggle(c.f)}>
              <div className={'stat-count tone-' + c.tone}><Icon name={c.icon} size={18} />{c.n}</div>
              <div className="stat-label">{c.label}</div>
            </button>
          ))}
        </div>
        <div className="section-label">
          {q || Object.keys(filter).length ? (extrusion ? t.extrusionResults : t.search.results)(moulds?.length ?? 0) : extrusion ? t.toolTypes.EXTRUSION_DIE : t.search.allMoulds}
          {stats && !q && !Object.keys(filter).length && <span className="count-pill">{stats.total}</span>}
          {Object.keys(filter).length > 0 && <button className="link-btn inline" onClick={() => setFilter({})}>{t.dash.clearFilter}</button>}
        </div>
        {moulds === null ? <SkeletonCards label={t.loading} />
          : !moulds.length ? <EmptyState icon={q ? 'search' : 'mould'} text={extrusion ? t.extrusionEmpty : q ? t.search.noMatch : t.search.empty} />
            : <div className="card-grid">{moulds.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
      </main>
    </>
  );
}

// ---- Rack view: zones -> rows -> racks, moulds per rack, empty racks highlighted ----
export function RackView({ t, onOpen, refreshKey, toast }: { t: Dict; onOpen: (id: string) => void; refreshKey: number; toast: (m: string) => void }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [waiting, setWaiting] = useState<{ id: string; toolId: string }[]>([]);
  const [zone, setZone] = useState('');
  const [open, setOpen] = useState<Rack | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => {
    api.racks().then((d) => { setZones(d.zones); setWaiting(d.awaitingRack); setLoaded(true); }).catch((e) => toast(errorText(e, t)));
  }, [t, toast]);
  usePolling(load, refreshKey);

  const shown = zone ? zones.filter((z) => z.code === zone) : zones;
  return (
    <main className="single">
      <div className="tabs">
        <button className={'tab' + (!zone ? ' active' : '')} aria-pressed={!zone} onClick={() => setZone('')}><Icon name="rack" size={15} />{t.racks.all}</button>
        {zones.map((z) => <button key={z.code} className={'tab' + (zone === z.code ? ' active' : '')} aria-pressed={zone === z.code} onClick={() => setZone(z.code)}><Icon name="mouldRoom" size={15} />{t.racks.zone(z.code)}</button>)}
      </div>
      <div className="legend">
        <span><span className="rack-tile empty mini" />{t.racks.legendEmpty}</span>
        <span><span className="rack-tile used mini" />{t.racks.legendUsed}</span>
        <span><span className="rack-tile full mini" />{t.racks.legendFull}</span>
      </div>
      {!loaded && <div className="skeleton" style={{ height: 220, borderRadius: 16 }} role="status" aria-label={t.loading} />}
      {shown.map((z) => (
        <section key={z.code} className="zone-block">
          <h2 className="zone-title"><Icon name="mouldRoom" size={20} />{t.mouldRoom} · {t.racks.zone(z.code)}{!z.active && <small className="muted"> ({t.racks.inactive})</small>}</h2>
          <RackRows racks={z.racks} t={t} onPick={setOpen} selected={open?.id} />
        </section>
      ))}
      {open && (
        <div className="rack-detail">
          <div className="box-title"><Icon name="rack" size={14} />{t.racks.mouldsOn(open.locationId)}</div>
          {!open.moulds.length ? <p className="muted">{t.racks.noMoulds}</p> : open.moulds.map((m) => (
            <button key={m.id} className="chip-row" onClick={() => onOpen(m.id)}><b>{m.toolId}</b><StatusBadge status={m.status} t={t} /></button>
          ))}
        </div>
      )}
      {waiting.length > 0 && (
        <section className="zone-block">
          <h2 className="zone-title"><Icon name="clock" size={20} />{t.racks.waiting} <span className="count-pill">{waiting.length}</span></h2>
          <p className="passkey-note">{t.racks.waitingHint}</p>
          <div className="quick-machines">{waiting.map((m) => <button key={m.id} className="quick-chip" onClick={() => onOpen(m.id)}>{m.toolId}</button>)}</div>
        </section>
      )}
    </main>
  );
}

function RackRows({ racks, t, onPick, selected }: { racks: Rack[]; t: Dict; onPick: (r: Rack) => void; selected?: string }) {
  const rows = useMemo(() => {
    const map = new Map<string, Rack[]>();
    for (const r of racks) map.set(r.row, [...(map.get(r.row) ?? []), r]);
    return [...map.entries()];
  }, [racks]);
  return (
    <>
      {rows.map(([row, list]) => (
        <div className="rack-row" key={row}>
          <div className="rack-row-label">{row}</div>
          <div className="rack-row-grid wide">
            {list.map((r) => (
              <button key={r.id} className={'rack-tile ' + rackTone(r) + (r.active ? '' : ' off') + (selected === r.id ? ' selected' : '')} aria-pressed={selected === r.id} aria-label={`${r.locationId} · ${r.occupancy}`} onClick={() => onPick(r)}>
                <b>{r.code}</b>
                <small>{!r.active ? t.racks.inactive : r.occupancy ? r.moulds.slice(0, 2).map((m) => m.toolId).join(' ') + (r.occupancy > 2 ? ` +${r.occupancy - 2}` : '') : t.racks.empty}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Workshop queue: at the Workshop, plus moulds flagged elsewhere ----
export function WorkshopView({ t, lang, onOpen, refreshKey, toast }: { t: Dict; lang: Lang; onOpen: (id: string) => void; refreshKey: number; toast: (m: string) => void }) {
  const [atShop, setAtShop] = useState<Mould[]>([]);
  const [flagged, setFlagged] = useState<Mould[]>([]);
  const [problems, setProblems] = useState<Mould[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => {
    Promise.all([api.moulds({ location: 'WORKSHOP' }), api.moulds({ needsService: true }), api.moulds({ problem: true })])
      .then(([a, b, c]) => { setAtShop(a.moulds); setFlagged(b.moulds.filter((m) => m.location !== 'WORKSHOP')); setProblems(c.moulds); setLoaded(true); })
      .catch((e) => toast(errorText(e, t)));
  }, [t, toast]);
  usePolling(load, refreshKey);

  const order = (m: Mould) => (m.status === 'GOOD' ? 9 : SERVICE_STATUSES.indexOf(m.status));
  const sorted = [...atShop].sort((a, b) => order(a) - order(b));
  return (
    <main>
      {!loaded && <SkeletonCards count={4} label={t.loading} />}
      {loaded && !atShop.length && !flagged.length && !problems.length && <EmptyState icon="good" text={t.workshop.none} />}
      {problems.length > 0 && <div className="section-label"><Icon name="problem" size={16} />{t.problem.filter} <span className="count-pill">{problems.length}</span></div>}
      {problems.length > 0 && <div className="card-grid">{problems.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
      {flagged.length > 0 && <div className="section-label"><Icon name="attention" size={16} />{t.workshop.flagged} <span className="count-pill">{flagged.length}</span></div>}
      {flagged.length > 0 && <div className="card-grid">{flagged.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
      {atShop.length > 0 && <div className="section-label"><Icon name="workshop" size={16} />{t.workshop.atWorkshop} <span className="count-pill">{atShop.length}</span></div>}
      {sorted.length > 0 && <div className="card-grid">{sorted.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
    </main>
  );
}

// ---- Audit log (Super Admin) ----
export function AuditView({ t, lang, toast }: { t: Dict; lang: Lang; toast: (m: string) => void }) {
  const [type, setType] = useState('');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    api.audit({ entityType: type || undefined, page, limit: 50 })
      .then((d) => { setTotal(d.total); setEntries((cur) => (page === 1 ? d.entries : [...cur, ...d.entries])); })
      .catch((e) => toast(errorText(e, t)));
  }, [type, page, t, toast]);
  const types = Object.keys(t.audit.types) as (keyof Dict['audit']['types'])[];
  return (
    <main className="single">
      <div className="tabs">
        <button className={'tab' + (!type ? ' active' : '')} onClick={() => { setType(''); setPage(1); }}>{t.audit.all}</button>
        {types.map((x) => <button key={x} className={'tab' + (type === x ? ' active' : '')} onClick={() => { setType(x); setPage(1); }}>{t.audit.types[x]}</button>)}
      </div>
      <div className="section-label">{t.audit.count(entries.length, total)}</div>
      {!entries.length && <EmptyState icon="audit" text={t.audit.empty} />}
      {entries.map((e) => (
        <div key={e.id} className="audit-row" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
          <div className="audit-head"><b>{e.action}</b><span>{e.entityLabel}</span><small>{formatTime(e.createdAt, lang)} · {e.actor.name}</small></div>
          {e.reason && <div className="history-note">{t.audit.reason}: {e.reason}</div>}
          {openId === e.id && (
            <div className="audit-body">
              {e.before && <><div className="box-title">{t.audit.before}</div><pre>{JSON.stringify(e.before, null, 2)}</pre></>}
              {e.after && <><div className="box-title">{t.audit.after}</div><pre>{JSON.stringify(e.after, null, 2)}</pre></>}
            </div>
          )}
        </div>
      ))}
      {entries.length < total && <button className="btn btn-outline" onClick={() => setPage(page + 1)}>{t.audit.more}</button>}
    </main>
  );
}

// ---- Rack management (Super Admin; Admin sees it read-only) ----
export function RackAdminView({ t, canEdit, toast }: { t: Dict; canEdit: boolean; toast: (m: string) => void }) {
  const { confirm, ask } = useConfirm();
  const [zones, setZones] = useState<Zone[]>([]);
  const [editRack, setEditRack] = useState<Rack | null>(null);
  const [bulk, setBulk] = useState({ zone: '', rowFrom: 'A', rowTo: 'C', from: '1', to: '10', capacity: '' });
  const [preview, setPreview] = useState<{ create: string[]; revive: string[]; existing: string[] } | null>(null);
  const [newZone, setNewZone] = useState({ code: '', name: '' });
  const [one, setOne] = useState({ zone: '', row: 'A', number: '1', capacity: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.racks().then((d) => {
    setZones(d.zones);
    setBulk((b) => (b.zone ? b : { ...b, zone: d.zones[0]?.code ?? '' }));
    setOne((o) => (o.zone ? o : { ...o, zone: d.zones[0]?.code ?? '' }));
  }).catch((e) => toast(errorText(e, t))), [t, toast]);
  useEffect(() => { load(); }, [load]);

  // Optional confirm first, then loading -> success/error toasts. Nothing runs twice while busy.
  async function run(work: () => Promise<unknown>, done?: string, ask?: ConfirmOptions) {
    if (busy || (ask && !(await confirm(ask)))) return false;
    setBusy(true);
    try {
      if (done) await withToasts(t, work, done); else await work();
      await load();
      return true;
    } catch (e) { if (!done) toast(errorText(e, t)); return false; } finally { setBusy(false); }
  }
  // Rename / new code: the dialog asks for the value itself, so it is the one confirmation.
  async function rename(z: Zone) {
    const name = await ask({ title: t.confirm.renameZoneTitle, message: t.confirm.renameZone(z.code), confirmText: t.confirm.saveBtn, inputLabel: t.confirm.newName, initial: z.name, required: true, maxLength: 100 });
    if (name && name !== z.name) run(() => api.updateZone(z.id, { name }), t.feedback.saved);
  }
  async function recode(z: Zone) {
    const code = await ask({ title: t.confirm.codeZoneTitle, message: t.confirm.codeZone(z.code), confirmText: t.confirm.saveBtn, tone: 'danger', inputLabel: t.confirm.newCode, initial: z.code, required: true, maxLength: 10 });
    if (code && code.toUpperCase() !== z.code) run(() => api.updateZone(z.id, { code: code.toUpperCase() }), t.feedback.saved);
  }
  const danger = (title: string, message: string, code: string): ConfirmOptions => ({ title, message, confirmText: t.confirm.deleteBtn, tone: 'danger', typeToConfirm: code });
  const capacity = (s: string) => (s.trim() === '' ? null : Math.max(1, Math.floor(Number(s))));
  const bulkBody = (previewOnly: boolean) => ({ zone: bulk.zone, rowFrom: bulk.rowFrom, rowTo: bulk.rowTo, from: Number(bulk.from), to: Number(bulk.to), capacity: capacity(bulk.capacity), preview: previewOnly });

  return (
    <main className="single">
      {!canEdit && <div className="warn-box">{t.rackAdmin.readOnly}</div>}
      <fieldset disabled={!canEdit || busy} className="plain">
        <h2 className="zone-title"><Icon name="mouldRoom" size={20} />{t.rackAdmin.zones}</h2>
        {zones.map((z) => (
          <div key={z.id} className="zone-admin">
            <div className="zone-admin-head">
              <b>{z.code}</b><span>{z.name}</span>{!z.active && <span className="status-badge warn">{t.rackAdmin.disabled}</span>}
              {canEdit && <span className="row-actions">
                <button className="link-btn" onClick={() => rename(z)}>{t.rackAdmin.rename}</button>
                <button className="link-btn" onClick={() => recode(z)}>{t.rackAdmin.changeCode}</button>
                <button className="link-btn" onClick={() => run(() => api.updateZone(z.id, { active: !z.active }), t.feedback.saved, z.active
                  ? { title: t.confirm.zoneDisableTitle, message: t.confirm.zoneDisable(z.code), confirmText: t.rackAdmin.disable, tone: 'danger' }
                  : { title: t.confirm.zoneEnableTitle, message: t.confirm.zoneEnable(z.code), confirmText: t.rackAdmin.enable })}>{z.active ? t.rackAdmin.disable : t.rackAdmin.enable}</button>
                <button className="link-btn danger" onClick={() => run(() => api.deleteZone(z.id), t.feedback.deleted, danger(t.confirm.zoneDeleteTitle, t.confirm.zoneDelete(z.code), z.code))}>{t.rackAdmin.remove}</button>
              </span>}
            </div>
            {[...new Set(z.racks.map((r) => r.row))].map((row) => (
              <div className="rack-row" key={row}>
                <div className="rack-row-label">{row}</div>
                <div className="rack-row-grid wide">
                  {z.racks.filter((r) => r.row === row).map((r) => (
                    <button key={r.id} className={'rack-tile ' + rackTone(r) + (r.active ? '' : ' off') + (editRack?.id === r.id ? ' selected' : '')} aria-label={r.locationId} onClick={() => canEdit && setEditRack(r)}>
                      <b>{r.code}</b><small>{r.active ? (r.capacity ? `${r.occupancy}/${r.capacity}` : r.occupancy) : t.racks.inactive}</small>
                    </button>
                  ))}
                  {canEdit && <button className="link-btn danger small" onClick={() => run(() => api.removeRow(z.code, row), t.feedback.deleted, danger(t.confirm.rowDeleteTitle, t.confirm.rowDelete(z.code, row), `${z.code}-${row}`))}>{t.rackAdmin.removeRow(row)}</button>}
                </div>
              </div>
            ))}
          </div>
        ))}

        {canEdit && editRack && (
          <div className="action-panel">
            <div className="box-title">{t.rackAdmin.editRack(editRack.locationId)}</div>
            <div className="two-col">
              <div><label className="field-label">{t.rackAdmin.row}</label><input className="field-input" value={editRack.row} maxLength={3} onChange={(e) => setEditRack({ ...editRack, row: e.target.value.toUpperCase() })} /></div>
              <div><label className="field-label">{t.rackAdmin.number}</label><input className="field-input" type="number" min={1} value={editRack.number} onChange={(e) => setEditRack({ ...editRack, number: Number(e.target.value) })} /></div>
            </div>
            <label className="field-label">{t.rackAdmin.capacity}</label>
            <input className="field-input" type="number" min={1} placeholder={t.rackAdmin.capacityHint} value={editRack.capacity ?? ''} onChange={(e) => setEditRack({ ...editRack, capacity: e.target.value === '' ? null : Number(e.target.value) })} />
            <label className="field-label">{t.rackAdmin.note}</label>
            <input className="field-input" value={editRack.note} maxLength={300} onChange={(e) => setEditRack({ ...editRack, note: e.target.value })} />
            <label className="check"><input type="checkbox" checked={editRack.active} onChange={(e) => setEditRack({ ...editRack, active: e.target.checked })} /> {t.rackAdmin.active}</label>
            <button className="btn btn-primary" onClick={async () => { if (await run(() => api.updateRack(editRack.id, { row: editRack.row, number: editRack.number, capacity: editRack.capacity, note: editRack.note, active: editRack.active }), t.feedback.saved)) setEditRack(null); }}>{t.rackAdmin.save}</button>
            <button className="btn btn-outline danger" onClick={async () => { if (await run(() => api.deleteRack(editRack.id), t.feedback.deleted, danger(t.confirm.rackDeleteTitle, t.confirm.rackDelete(editRack.locationId), editRack.locationId))) setEditRack(null); }}>{t.rackAdmin.remove}</button>
            <button className="link-btn" onClick={() => setEditRack(null)}>{t.cancel}</button>
          </div>
        )}

        {canEdit && (
          <>
            <div className="action-panel">
              <div className="box-title">{t.rackAdmin.bulk}</div>
              <label className="field-label">{t.rackAdmin.zone}</label>
              <select className="field-input" value={bulk.zone} onChange={(e) => { setBulk({ ...bulk, zone: e.target.value }); setPreview(null); }}>{zones.map((z) => <option key={z.code}>{z.code}</option>)}</select>
              <div className="two-col">
                <div><label className="field-label">{t.rackAdmin.rowFrom}</label><input className="field-input" maxLength={1} value={bulk.rowFrom} onChange={(e) => { setBulk({ ...bulk, rowFrom: e.target.value.toUpperCase() }); setPreview(null); }} /></div>
                <div><label className="field-label">{t.rackAdmin.rowTo}</label><input className="field-input" maxLength={1} value={bulk.rowTo} onChange={(e) => { setBulk({ ...bulk, rowTo: e.target.value.toUpperCase() }); setPreview(null); }} /></div>
                <div><label className="field-label">{t.rackAdmin.numFrom}</label><input className="field-input" type="number" min={1} value={bulk.from} onChange={(e) => { setBulk({ ...bulk, from: e.target.value }); setPreview(null); }} /></div>
                <div><label className="field-label">{t.rackAdmin.numTo}</label><input className="field-input" type="number" min={1} value={bulk.to} onChange={(e) => { setBulk({ ...bulk, to: e.target.value }); setPreview(null); }} /></div>
              </div>
              <label className="field-label">{t.rackAdmin.capacity}</label>
              <input className="field-input" type="number" min={1} placeholder={t.rackAdmin.capacityHint} value={bulk.capacity} onChange={(e) => setBulk({ ...bulk, capacity: e.target.value })} />
              <button className="btn btn-outline" onClick={() => run(async () => setPreview(await api.bulkRacks(bulkBody(true))))}>{t.rackAdmin.preview}</button>
              {preview && (
                <div className="preview-box">
                  <div>{t.rackAdmin.willCreate(preview.create.length)} · {t.rackAdmin.willRevive(preview.revive.length)} · {t.rackAdmin.exist(preview.existing.length)}</div>
                  <small className="muted">{[...preview.create, ...preview.revive].join(', ') || t.rackAdmin.nothingToDo}</small>
                  {preview.create.length + preview.revive.length > 0 && (
                    <button className="btn btn-primary" onClick={async () => {
                      const n = preview.create.length + preview.revive.length;
                      if (await run(() => api.bulkRacks(bulkBody(false)), t.rackAdmin.created(n), { title: t.confirm.bulkTitle, message: t.confirm.bulk(n, bulk.zone), confirmText: t.confirm.bulkBtn(n) })) setPreview(null);
                    }}>
                      {t.rackAdmin.create(preview.create.length + preview.revive.length)}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="action-panel">
              <div className="box-title">{t.rackAdmin.addRack}</div>
              <div className="two-col">
                <div><label className="field-label">{t.rackAdmin.zone}</label><select className="field-input" value={one.zone} onChange={(e) => setOne({ ...one, zone: e.target.value })}>{zones.map((z) => <option key={z.code}>{z.code}</option>)}</select></div>
                <div><label className="field-label">{t.rackAdmin.row}</label><input className="field-input" maxLength={3} value={one.row} onChange={(e) => setOne({ ...one, row: e.target.value.toUpperCase() })} /></div>
                <div><label className="field-label">{t.rackAdmin.number}</label><input className="field-input" type="number" min={1} value={one.number} onChange={(e) => setOne({ ...one, number: e.target.value })} /></div>
                <div><label className="field-label">{t.rackAdmin.capacity}</label><input className="field-input" type="number" min={1} placeholder={t.rackAdmin.unlimited} value={one.capacity} onChange={(e) => setOne({ ...one, capacity: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" onClick={() => run(() => api.createRack({ zone: one.zone, row: one.row, number: Number(one.number), capacity: capacity(one.capacity), note: one.note }), t.feedback.created)}>{t.rackAdmin.addRack}</button>
            </div>

            <div className="action-panel">
              <div className="box-title">{t.rackAdmin.addZone}</div>
              <div className="two-col">
                <div><label className="field-label">{t.rackAdmin.code}</label><input className="field-input" maxLength={10} value={newZone.code} onChange={(e) => setNewZone({ ...newZone, code: e.target.value.toUpperCase() })} /></div>
                <div><label className="field-label">{t.rackAdmin.name}</label><input className="field-input" maxLength={100} value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" disabled={!newZone.code || !newZone.name} onClick={async () => { if (await run(() => api.createZone({ ...newZone, sortOrder: zones.length + 1 }), t.feedback.created)) setNewZone({ code: '', name: '' }); }}>{t.rackAdmin.addZone}</button>
            </div>
          </>
        )}
      </fieldset>
    </main>
  );
}

