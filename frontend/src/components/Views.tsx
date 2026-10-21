'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MouldCard, StatusBadge } from './MouldBits';
import { api } from '@/lib/api';
import { locationName, type Dict, type Lang } from '@/lib/i18n';
import { errorText, formatTime } from '@/lib/format';
import { LOCATIONS, SERVICE_STATUSES, type AuditEntry, type Location, type Mould, type Rack, type Stats, type Zone } from '@/lib/types';

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
export function FindView({ t, lang, onOpen, refreshKey, onSync }: { t: Dict; lang: Lang; onOpen: (id: string) => void; refreshKey: number; onSync: (ok: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>({});
  const [moulds, setMoulds] = useState<Mould[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const id = setTimeout(() => setQ(query.trim()), 250); return () => clearTimeout(id); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const load = useCallback(() => {
    Promise.all([api.moulds({ q, ...filter }), api.stats()])
      .then(([m, s]) => { setMoulds(m.moulds); setStats(s.stats); onSync(true); })
      .catch(() => onSync(false));
  }, [q, filter, onSync]);
  usePolling(load, refreshKey);

  const toggle = (f: Filter) => setFilter((cur) => (JSON.stringify(cur) === JSON.stringify(f) ? {} : f));
  const chips: { f: Filter; label: string; n: number; tone: string }[] = stats ? [
    ...LOCATIONS.map((l) => ({ f: { location: l }, label: locationName(l, t), n: stats.byLocation[l] ?? 0, tone: l })),
    { f: { needsService: true }, label: t.dash.attention, n: stats.needsAttention, tone: 'attention' },
    { f: { awaitingRack: true }, label: t.dash.awaitingRack, n: stats.awaitingRack, tone: 'waiting' },
    { f: { problem: true }, label: t.problem.filter, n: stats.problemsReported, tone: 'problem' }
  ] : [];

  return (
    <>
      <div className="search-wrap find">
        <div className="search-box big">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="7" stroke="#7B8794" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="#7B8794" strokeWidth="2" strokeLinecap="round" /></svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search.placeholder} aria-label={t.search.placeholder} autoComplete="off" enterKeyHint="search" />
          {query && <button className="clear-btn" aria-label={t.search.clear} onClick={() => setQuery('')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="#52606D" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>}
        </div>
      </div>
      <main>
        <div className="stats-row wrap">
          {chips.map((c) => (
            <button key={c.tone} className={'stat-chip' + (JSON.stringify(filter) === JSON.stringify(c.f) ? ' active' : '')} onClick={() => toggle(c.f)}>
              <div className="stat-count">{c.n}</div>
              <div className="stat-label"><span className={'stat-dot ' + c.tone} /><span>{c.label}</span></div>
            </button>
          ))}
        </div>
        <div className="section-label">
          {q || Object.keys(filter).length ? t.search.results(moulds?.length ?? 0) : t.search.allMoulds}
          {stats && !q && !Object.keys(filter).length && <span className="count-pill">{stats.total}</span>}
          {Object.keys(filter).length > 0 && <button className="link-btn inline" onClick={() => setFilter({})}>{t.dash.clearFilter}</button>}
        </div>
        {moulds === null ? <p className="muted">{t.loading}</p>
          : !moulds.length ? <div className="empty-state"><p>{q ? t.search.noMatch : t.search.empty}</p></div>
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
  const load = useCallback(() => {
    api.racks().then((d) => { setZones(d.zones); setWaiting(d.awaitingRack); }).catch((e) => toast(errorText(e, t)));
  }, [t, toast]);
  usePolling(load, refreshKey);

  const shown = zone ? zones.filter((z) => z.code === zone) : zones;
  return (
    <main className="single">
      <div className="tabs">
        <button className={'tab' + (!zone ? ' active' : '')} onClick={() => setZone('')}>{t.racks.all}</button>
        {zones.map((z) => <button key={z.code} className={'tab' + (zone === z.code ? ' active' : '')} onClick={() => setZone(z.code)}>{t.racks.zone(z.code)}</button>)}
      </div>
      <div className="legend"><span className="rack-tile empty mini" /> {t.racks.legendEmpty} <span className="rack-tile used mini" /> {t.racks.legendUsed}</div>
      {shown.map((z) => (
        <section key={z.code} className="zone-block">
          <h2 className="zone-title">{t.mouldRoom} · {t.racks.zone(z.code)}{!z.active && <small> ({t.racks.inactive})</small>}</h2>
          <RackRows racks={z.racks} t={t} onPick={setOpen} selected={open?.id} />
        </section>
      ))}
      {open && (
        <div className="rack-detail">
          <div className="box-title">{t.racks.mouldsOn(open.locationId)}</div>
          {!open.moulds.length ? <p className="muted">{t.racks.noMoulds}</p> : open.moulds.map((m) => (
            <button key={m.id} className="chip-row" onClick={() => onOpen(m.id)}><b>{m.toolId}</b><StatusBadge status={m.status} t={t} /></button>
          ))}
        </div>
      )}
      {waiting.length > 0 && (
        <section className="zone-block">
          <h2 className="zone-title">{t.racks.waiting} <span className="count-pill">{waiting.length}</span></h2>
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
              <button key={r.id} className={'rack-tile' + (r.occupancy ? ' used' : ' empty') + (r.active ? '' : ' off') + (selected === r.id ? ' selected' : '')} onClick={() => onPick(r)}>
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
  const load = useCallback(() => {
    Promise.all([api.moulds({ location: 'WORKSHOP' }), api.moulds({ needsService: true }), api.moulds({ problem: true })])
      .then(([a, b, c]) => { setAtShop(a.moulds); setFlagged(b.moulds.filter((m) => m.location !== 'WORKSHOP')); setProblems(c.moulds); })
      .catch((e) => toast(errorText(e, t)));
  }, [t, toast]);
  usePolling(load, refreshKey);

  const order = (m: Mould) => (m.status === 'GOOD' ? 9 : SERVICE_STATUSES.indexOf(m.status));
  const sorted = [...atShop].sort((a, b) => order(a) - order(b));
  return (
    <main>
      {!atShop.length && !flagged.length && !problems.length && <div className="empty-state"><p>{t.workshop.none}</p></div>}
      {problems.length > 0 && <div className="section-label">{t.problem.filter} <span className="count-pill">{problems.length}</span></div>}
      {problems.length > 0 && <div className="card-grid">{problems.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
      {flagged.length > 0 && <div className="section-label">{t.workshop.flagged} <span className="count-pill">{flagged.length}</span></div>}
      {flagged.length > 0 && <div className="card-grid">{flagged.map((m) => <MouldCard key={m.id} m={m} t={t} lang={lang} onOpen={onOpen} />)}</div>}
      {atShop.length > 0 && <div className="section-label">{t.workshop.atWorkshop} <span className="count-pill">{atShop.length}</span></div>}
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
      {!entries.length && <p className="muted">{t.audit.empty}</p>}
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

  async function run(work: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try { await work(); if (done) toast(done); await load(); return true; } catch (e) { toast(errorText(e, t)); return false; } finally { setBusy(false); }
  }
  const capacity = (s: string) => (s.trim() === '' ? null : Math.max(1, Math.floor(Number(s))));
  const bulkBody = (previewOnly: boolean) => ({ zone: bulk.zone, rowFrom: bulk.rowFrom, rowTo: bulk.rowTo, from: Number(bulk.from), to: Number(bulk.to), capacity: capacity(bulk.capacity), preview: previewOnly });

  return (
    <main className="single">
      {!canEdit && <div className="warn-box">{t.rackAdmin.readOnly}</div>}
      <fieldset disabled={!canEdit || busy} className="plain">
        <h2 className="zone-title">{t.rackAdmin.zones}</h2>
        {zones.map((z) => (
          <div key={z.id} className="zone-admin">
            <div className="zone-admin-head">
              <b>{z.code}</b><span>{z.name}</span>{!z.active && <span className="status-badge warn">{t.rackAdmin.disabled}</span>}
              {canEdit && <span className="row-actions">
                <button className="link-btn" onClick={() => { const name = prompt(t.rackAdmin.name, z.name); if (name) run(() => api.updateZone(z.id, { name }), t.rackAdmin.saved); }}>{t.rackAdmin.rename}</button>
                <button className="link-btn" onClick={() => { const code = prompt(t.rackAdmin.code, z.code); if (code && code !== z.code) run(() => api.updateZone(z.id, { code }), t.rackAdmin.saved); }}>{t.rackAdmin.changeCode}</button>
                <button className="link-btn" onClick={() => run(() => api.updateZone(z.id, { active: !z.active }), t.rackAdmin.saved)}>{z.active ? t.rackAdmin.disable : t.rackAdmin.enable}</button>
                <button className="link-btn danger" onClick={() => { if (confirm(t.rackAdmin.confirmZoneDelete(z.code))) run(() => api.deleteZone(z.id), t.rackAdmin.saved); }}>{t.rackAdmin.remove}</button>
              </span>}
            </div>
            {[...new Set(z.racks.map((r) => r.row))].map((row) => (
              <div className="rack-row" key={row}>
                <div className="rack-row-label">{row}</div>
                <div className="rack-row-grid wide">
                  {z.racks.filter((r) => r.row === row).map((r) => (
                    <button key={r.id} className={'rack-tile' + (r.occupancy ? ' used' : ' empty') + (r.active ? '' : ' off')} onClick={() => canEdit && setEditRack(r)}>
                      <b>{r.code}</b><small>{r.active ? (r.capacity ? `${r.occupancy}/${r.capacity}` : r.occupancy) : t.racks.inactive}</small>
                    </button>
                  ))}
                  {canEdit && <button className="link-btn danger small" onClick={() => { if (confirm(t.rackAdmin.confirmRowDelete(z.code, row))) run(() => api.removeRow(z.code, row), t.rackAdmin.saved); }}>{t.rackAdmin.removeRow(row)}</button>}
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
            <button className="btn btn-primary" onClick={async () => { if (await run(() => api.updateRack(editRack.id, { row: editRack.row, number: editRack.number, capacity: editRack.capacity, note: editRack.note, active: editRack.active }), t.rackAdmin.saved)) setEditRack(null); }}>{t.rackAdmin.save}</button>
            <button className="btn btn-outline danger" onClick={async () => { if (confirm(t.rackAdmin.confirmRackDelete(editRack.locationId)) && await run(() => api.deleteRack(editRack.id), t.rackAdmin.saved)) setEditRack(null); }}>{t.rackAdmin.remove}</button>
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
                    <button className="btn btn-primary" onClick={async () => { if (await run(() => api.bulkRacks(bulkBody(false)), t.rackAdmin.created(preview.create.length + preview.revive.length))) setPreview(null); }}>
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
              <button className="btn btn-primary" onClick={() => run(() => api.createRack({ zone: one.zone, row: one.row, number: Number(one.number), capacity: capacity(one.capacity), note: one.note }), t.rackAdmin.saved)}>{t.rackAdmin.addRack}</button>
            </div>

            <div className="action-panel">
              <div className="box-title">{t.rackAdmin.addZone}</div>
              <div className="two-col">
                <div><label className="field-label">{t.rackAdmin.code}</label><input className="field-input" maxLength={10} value={newZone.code} onChange={(e) => setNewZone({ ...newZone, code: e.target.value.toUpperCase() })} /></div>
                <div><label className="field-label">{t.rackAdmin.name}</label><input className="field-input" maxLength={100} value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" disabled={!newZone.code || !newZone.name} onClick={async () => { if (await run(() => api.createZone({ ...newZone, sortOrder: zones.length + 1 }), t.rackAdmin.saved)) setNewZone({ code: '', name: '' }); }}>{t.rackAdmin.addZone}</button>
            </div>
          </>
        )}
      </fieldset>
    </main>
  );
}

