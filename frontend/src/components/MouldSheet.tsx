'use client';
import { useCallback, useEffect, useState } from 'react';
import Sheet from './Sheet';
import { LastWork, Lightbox, RackPicker, StatusBadge } from './MouldBits';
import WorkLogForm, { ProblemForm } from './WorkLogForm';
import { api, ApiError, assetUrl } from '@/lib/api';
import { locationName, type Dict, type Lang } from '@/lib/i18n';
import { errorText, formatTime, locationLine, locationTone, movementText, relativeTime } from '@/lib/format';
import { can, canMoveTo } from '@/lib/permissions';
import { STATUSES, type Location, type Machine, type Mould, type MouldStatus, type Movement, type User, type WorkLog, type WorkOutcome, type Zone } from '@/lib/types';

type Action = 'MACHINE' | 'PRODUCTION_FLOOR' | 'MOULD_ROOM' | 'WORKSHOP' | 'STATUS' | 'SHOTS';
type Entry = { kind: 'move'; at: string; m: Movement } | { kind: 'work'; at: string; w: WorkLog };

export default function MouldSheet({ id, user, t, lang, refreshKey, onClose, onChanged, onEdit, toast }: {
  id: string | null; user: User; refreshKey: number; t: Dict; lang: Lang; onClose: () => void; onChanged: () => void; onEdit: (m: Mould) => void; toast: (m: string) => void;
}) {
  const [mould, setMould] = useState<Mould | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [preset, setPreset] = useState<{ status?: MouldStatus; remarks?: string }>({});
  const [work, setWork] = useState<{ correcting: WorkLog | null } | null>(null);
  const [notice, setNotice] = useState('');
  const [problemOpen, setProblemOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'move' | 'work'>('all');
  const [image, setImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [m, h, w] = await Promise.all([api.mould(id), api.history(id), api.workLogs(id)]);
      setMould(m.mould);
      setHistory(h.history);
      setWorkLogs(w.workLogs);
    } catch (e) { toast(errorText(e, t)); }
  }, [id, t, toast]);

  useEffect(() => { setMould(null); setHistory([]); setWorkLogs([]); setAction(null); setWork(null); setNotice(''); setFilter('all'); setProblemOpen(false); }, [id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const updated = (m: Mould, message: string) => { setMould(m); setAction(null); setPreset({}); setNotice(''); toast(message); onChanged(); api.history(m.id).then((h) => setHistory(h.history)).catch(() => {}); };

  // After a work log: refresh, show any warning, and offer the Workshop move when the status could not be set in place.
  const workSaved = (warnings: string[], outcome: WorkOutcome | null, description: string) => {
    setWork(null);
    toast(t.work.saved(mould?.toolId ?? ''));
    setNotice(warnings.map((w) => t.work.warnings[w] ?? w).join(' '));
    onChanged();
    load();
    if (mould && warnings.includes('WORKSHOP_MOVE_REQUIRED') && canMoveTo(user, mould.location, 'WORKSHOP') && (outcome === 'NEEDS_REPAIR' || outcome === 'NEEDS_SERVICE')) {
      setPreset({ status: outcome, remarks: description });
      setAction('WORKSHOP');
    }
  };

  async function remove() {
    if (!mould || !confirm(t.detail.confirmDelete(mould.toolId))) return;
    const reason = prompt(t.detail.deleteReason) ?? '';
    try { await api.deleteMould(mould.id, reason); toast(t.detail.deleted(mould.toolId)); onChanged(); load(); } catch (e) { toast(errorText(e, t)); }
  }
  async function restore() {
    if (!mould) return;
    try { const r = await api.restoreMould(mould.id); updated(r.mould, t.detail.restored(mould.toolId)); } catch (e) { toast(errorText(e, t)); }
  }

  const m = mould;
  const canLog = Boolean(m && !m.deletedAt && can(user, 'worklog.create'));
  const canReport = Boolean(m && !m.deletedAt && can(user, 'problem.report'));
  const problemSaved = () => { setProblemOpen(false); toast(t.problem.saved(m?.toolId ?? '')); onChanged(); load(); };
  // "Resolve or act": open the Workshop move with the reported problem as the remark.
  const actOnProblem = () => {
    if (!m?.openProblem) return;
    setWork(null); setProblemOpen(false);
    setPreset({ status: 'NEEDS_REPAIR', remarks: m.openProblem.text });
    setAction('WORKSHOP');
  };
  const timeline: Entry[] = [
    ...(filter !== 'work' ? history.map((h) => ({ kind: 'move' as const, at: h.createdAt, m: h })) : []),
    ...(filter !== 'move' ? workLogs.map((w) => ({ kind: 'work' as const, at: w.doneAt, w })) : [])
  ].sort((a, b) => b.at.localeCompare(a.at));
  const workPlace = (w: WorkLog) => [locationName(w.location, t), w.machineCode, w.rackLocationId].filter(Boolean).join(' ');
  const actions: { key: Action; label: string }[] = [];
  if (m && !m.deletedAt) {
    const good = m.status === 'GOOD';
    if (good && canMoveTo(user, m.location, 'MACHINE')) actions.push({ key: 'MACHINE', label: m.location === 'MACHINE' ? t.act.changeMachine : t.act.mount });
    if (good && m.location !== 'PRODUCTION_FLOOR' && canMoveTo(user, m.location, 'PRODUCTION_FLOOR')) actions.push({ key: 'PRODUCTION_FLOOR', label: t.act.toFloor });
    if (good && canMoveTo(user, m.location, 'MOULD_ROOM')) actions.push({ key: 'MOULD_ROOM', label: m.location === 'MOULD_ROOM' && m.rack ? t.act.changeRack : t.act.toMouldRoom(t.mouldRoom) });
    if (m.location !== 'WORKSHOP' && canMoveTo(user, m.location, 'WORKSHOP')) actions.push({ key: 'WORKSHOP', label: t.act.toWorkshop });
    if (m.location === 'WORKSHOP' && can(user, 'workshop.work')) actions.push({ key: 'STATUS', label: t.act.changeStatus });
    if (m.location === 'MACHINE' && (can(user, 'moves.machine') || can(user, 'workshop.work'))) actions.push({ key: 'SHOTS', label: t.act.recordShots });
  }

  return (
    <Sheet open={Boolean(id)} onClose={onClose} label={m?.toolId ?? ''}>
      {!m ? <p className="muted">{t.loading}</p> : (
        <>
          <div className="detail-top">
            <span className="detail-id">{m.toolId}</span>
            <StatusBadge status={m.status} t={t} />
            {m.owner && <span className="detail-size">{m.owner}</span>}
          </div>
          {m.deletedAt && <div className="form-error">{t.detail.deletedBanner}</div>}

          <div className={'where-panel ' + locationTone(m.location)}>
            <div className="where-big">{locationLine(m, t)}</div>
            {m.lastMovedAt && <div className="where-sub">{t.detail.lastMoved}: {relativeTime(m.lastMovedAt, lang)}{m.lastMovedBy ? ` · ${m.lastMovedBy.name}` : ''}</div>}
          </div>
          {m.lastWork && <LastWork m={m} t={t} lang={lang} />}
          {m.openProblem && (
            <div className="problem-box">
              <div className="problem-title">{t.problem.open(m.openProblem.by.name, formatTime(m.openProblem.at, lang))}</div>
              <div className="problem-text">{m.openProblem.text}</div>
              {canLog && (
                <>
                  <div className="box-title">{t.problem.act}</div>
                  <p className="passkey-note">{t.problem.actHint}</p>
                  <div className="action-grid">
                    <button className="action-btn" onClick={() => { setWork({ correcting: null }); setAction(null); setProblemOpen(false); }}>{t.problem.logWork}</button>
                    {m.location !== 'WORKSHOP' && canMoveTo(user, m.location, 'WORKSHOP') && <button className="action-btn" onClick={actOnProblem}>{t.problem.sendToWorkshop}</button>}
                  </div>
                </>
              )}
            </div>
          )}
          {m.serviceDue && <div className="warn-box">{t.detail.serviceDue}</div>}
          {notice && <div className="warn-box">{notice}</div>}

          {(actions.length > 0 || canLog || canReport) && (
            <div className="action-box">
              <div className="box-title">{t.act.title}</div>
              {canLog && <button className={'action-btn wide' + (work ? ' active' : '')} onClick={() => { setWork(work ? null : { correcting: null }); setAction(null); setProblemOpen(false); }}>{t.work.log}</button>}
              {canReport && <button className={'action-btn wide problem' + (problemOpen ? ' active' : '')} onClick={() => { setProblemOpen(!problemOpen); setWork(null); setAction(null); }}>{t.problem.report}</button>}
              {problemOpen && <ProblemForm mould={m} t={t} onSaved={problemSaved} onCancel={() => setProblemOpen(false)} />}
              {work && <WorkLogForm key={work.correcting?.id ?? 'new'} mould={m} user={user} t={t} correcting={work.correcting} onSaved={workSaved} onCancel={() => setWork(null)} />}
              <div className="action-grid">
                {actions.map((a) => <button key={a.key} className={'action-btn' + (action === a.key ? ' active' : '')} onClick={() => { setAction(action === a.key ? null : a.key); setPreset({}); setWork(null); setProblemOpen(false); }}>{a.label}</button>)}
              </div>
              {action && <ActionPanel key={action + (preset.status ?? '')} action={action} mould={m} user={user} t={t} preset={preset} onDone={updated} onStale={load} onCancel={() => setAction(null)} toast={toast} />}
            </div>
          )}

          <div className="facts">
            <Fact label={t.detail.shots} value={t.detail.shotsOf(m.totalShots, m.shotsToService)} />
            <Fact label={t.detail.capableMachines} value={m.capableMachines.length ? m.capableMachines.join(', ') : t.detail.none} />
            <Fact label={t.detail.owner} value={m.owner ?? t.detail.ownerNone} />
            {m.toolSetCount && <Fact label={t.detail.toolSet} value={m.toolSetCount} />}
            {m.size && <Fact label={t.detail.size} value={m.size} />}
            {m.lastServicedAt && <Fact label={t.detail.lastServiced} value={formatTime(m.lastServicedAt, lang)} />}
            {m.remarks && <Fact label={t.detail.remarks} value={m.remarks} />}
            {m.notes && <Fact label={t.detail.notes} value={m.notes} />}
          </div>

          <div className="products-box">
            <div className="products-title">{t.detail.items}</div>
            {!m.items?.length && <div className="history-empty">{t.detail.noItems}</div>}
            {m.items?.map((it) => (
              <div className="item-row" key={it.id}>
                {it.images[0] ? (
                  <button className="item-thumb" onClick={() => setImage(assetUrl(it.images[0].url))} aria-label={t.detail.openImage}><img src={assetUrl(it.images[0].thumbUrl)} alt="" loading="lazy" /></button>
                ) : <div className="item-thumb none" />}
                <div className="item-text">
                  <b>{it.itemId}</b>{it.cavities != null && <small> · {t.detail.cavities(it.cavities)}</small>}
                  <div>{it.description}</div>
                  {(it.materialId || it.qas) && <small className="muted">{[it.qas && `${t.detail.qas} ${it.qas}`, it.materialId && `${t.detail.material} ${it.materialId}`, it.masterbatchId && `${t.detail.masterbatch} ${it.masterbatchId}`].filter(Boolean).join(' · ')}</small>}
                  {it.notes && <small className="muted block">{it.notes}</small>}
                </div>
              </div>
            ))}
          </div>

          <div className="history-box">
            <div className="history-head">
              <div className="history-title">{t.detail.history}</div>
              <div className="mini-tabs">
                {(['all', 'move', 'work'] as const).map((f) => (
                  <button key={f} className={'mini-tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
                    {f === 'all' ? t.timeline.all : f === 'move' ? t.timeline.moves : t.timeline.work}
                  </button>
                ))}
              </div>
            </div>
            {!timeline.length && <div className="history-empty">{t.detail.historyEmpty}</div>}
            {timeline.map((e) => e.kind === 'move' ? (
              <div className="history-row" key={'m' + e.m.id}>
                <span className={'history-dot ' + (e.m.toLocation ? locationTone(e.m.toLocation) : 'room')} />
                <div className="history-text">
                  {movementText(e.m, t)}
                  {e.m.remarks && <div className="history-note">{e.m.remarks}</div>}
                  {e.m.overrideReason && <div className="history-note">{t.hist.override}: {e.m.overrideReason}</div>}
                  {e.m.by && <div className="history-by">{e.m.by.name}</div>}
                </div>
                <span className="history-time">{formatTime(e.m.createdAt, lang)}</span>
              </div>
            ) : (
              <div className={'history-row work' + (e.w.corrected ? ' corrected' : '')} key={'w' + e.w.id}>
                <span className="history-dot work" />
                <div className="history-text">
                  {!e.w.problemReported && <span className="work-badge">{t.work.types[e.w.type]}</span>}
                  {e.w.problemReported && <span className="work-badge warn">{t.problem.reportedEntry}</span>}
                  {e.w.resolvesProblemId && <span className="work-badge soft">{t.problem.resolvesEntry}</span>}
                  {e.w.correctsId && <span className="work-badge soft">{t.work.correction}</span>}
                  {e.w.corrected && <span className="work-badge warn">{t.work.corrected}</span>}
                  <div className="work-who">{e.w.doneBy.map((p) => `${p.name} (${t.roles[p.role] ?? p.role})`).join(', ')}</div>
                  <div className="work-desc">{e.w.description}</div>
                  {(e.w.partsUsed || e.w.timeSpentMinutes != null) && <div className="history-note">{[e.w.partsUsed, e.w.timeSpentMinutes != null && t.work.minutesShort(e.w.timeSpentMinutes)].filter(Boolean).join(' · ')}</div>}
                  <div className="history-note">{[workPlace(e.w), e.w.statusAfter !== e.w.statusBefore && t.work.statusChange(t.status[e.w.statusBefore], t.status[e.w.statusAfter]), e.w.sentToWorkshop && t.work.movedToWorkshop].filter(Boolean).join(' · ')}</div>
                  {e.w.photos.length > 0 && <div className="photo-row small">{e.w.photos.map((ph, i) => <button key={i} className="photo-thumb" onClick={() => setImage(assetUrl(ph.url))} aria-label={t.detail.openImage}><img src={assetUrl(ph.thumbUrl)} alt="" loading="lazy" /></button>)}</div>}
                  <div className="history-by">{t.work.recordedBy(e.w.recordedBy.name)}{canLog && !e.w.corrected && !e.w.problemReported && <button className="link-btn inline" onClick={() => { setWork({ correcting: e.w }); setAction(null); }}>{t.work.correct}</button>}</div>
                </div>
                <span className="history-time">{formatTime(e.w.doneAt, lang)}</span>
              </div>
            ))}
          </div>

          {can(user, 'moulds.manage') && (
            m.deletedAt ? <button className="btn btn-outline" onClick={restore}>{t.detail.restore}</button> : (
              <>
                <button className="btn btn-outline" onClick={() => onEdit(m)}>{t.detail.edit}</button>
                {m.location !== 'MACHINE' && <button className="btn btn-outline danger" onClick={remove}>{t.detail.remove}</button>}
              </>
            )
          )}
        </>
      )}
      <Lightbox src={image} onClose={() => setImage(null)} />
    </Sheet>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => <div className="fact"><span>{label}</span><b>{value}</b></div>;

// The form for one action. Server rules decide; this only collects what the move needs.
function ActionPanel({ action, mould, user, t, preset = {}, onDone, onStale, onCancel, toast }: {
  action: Action; mould: Mould; user: User; t: Dict; preset?: { status?: MouldStatus; remarks?: string };
  onDone: (m: Mould, msg: string) => void; onStale: () => void; onCancel: () => void; toast: (m: string) => void;
}) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [rack, setRack] = useState<{ id: string; zone: string } | null>(null);
  const [status, setStatus] = useState<MouldStatus | ''>(preset.status ?? '');
  const [remarks, setRemarks] = useState(preset.remarks ?? '');
  const [reason, setReason] = useState('');
  const [shots, setShots] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (action === 'MACHINE') api.machines().then((d) => setMachines(d.machines)).catch((e) => setError(errorText(e, t)));
    if (action === 'MOULD_ROOM') api.racks().then((d) => setZones(d.zones)).catch((e) => setError(errorText(e, t)));
  }, [action, t]);

  const machine = machines.find((x) => x.id === machineId);
  const needsMachineReason = Boolean(machine && !mould.capableMachines.includes(machine.code));
  const needsZoneReason = Boolean(rack && mould.owner && mould.owner !== rack.zone);
  const needsRemarks = action === 'WORKSHOP' || action === 'STATUS';
  const canOverride = can(user, 'machines.override');

  async function submit() {
    setBusy(true); setError('');
    try {
      const v = mould.version;
      let res: { mould: Mould };
      let msg: string;
      if (action === 'STATUS') {
        res = await api.setStatus(mould.id, status, remarks, v);
        msg = t.act.statusChanged(mould.toolId, t.status[status as MouldStatus]);
      } else if (action === 'SHOTS') {
        res = await api.recordShots(mould.id, Number(shots), v);
        msg = t.act.shotsRecorded(mould.toolId, Number(shots));
      } else {
        res = await api.move(mould.id, {
          to: action as Location, version: v, remarks,
          ...(action === 'MACHINE' ? { machineId: machineId ?? undefined } : {}),
          ...(action === 'MOULD_ROOM' ? { rackId: rack?.id } : {}),
          ...(action === 'WORKSHOP' && status ? { status } : {}),
          ...((needsMachineReason || needsZoneReason) && reason ? { overrideReason: reason } : {})
        });
        msg = t.act.moved(mould.toolId, locationLine(res.mould, t));
      }
      onDone(res.mould, msg);
    } catch (e) {
      setError(errorText(e, t));
      if (e instanceof ApiError && e.code === 'STALE') { toast(errorText(e, t)); onStale(); }
    } finally { setBusy(false); }
  }

  const ready =
    (action === 'MACHINE' ? Boolean(machineId) && (!needsMachineReason || reason.trim()) :
      action === 'MOULD_ROOM' ? Boolean(rack) && (!needsZoneReason || reason.trim()) :
        action === 'STATUS' ? Boolean(status) :
          action === 'SHOTS' ? Number(shots) > 0 && Number.isInteger(Number(shots)) : true) && (!needsRemarks || remarks.trim());

  const capable = machines.filter((x) => mould.capableMachines.includes(x.code));
  const others = machines.filter((x) => !mould.capableMachines.includes(x.code));
  const machineChip = (x: Machine, allowed: boolean) => {
    const occupied = x.mould && x.mould.id !== mould.id;
    return (
      <button type="button" key={x.id} disabled={Boolean(occupied) || !allowed || x.id === mould.machine?.id} className={'quick-chip' + (machineId === x.id ? ' selected' : '')} onClick={() => setMachineId(x.id)}>
        {x.code} <small>{occupied ? t.act.occupiedBy(x.mould!.toolId) : t.act.free}</small>
      </button>
    );
  };

  return (
    <div className="action-panel">
      {action === 'MACHINE' && (
        <>
          <label className="field-label">{t.act.capable}</label>
          <div className="quick-machines">{capable.length ? capable.map((x) => machineChip(x, true)) : <span className="muted">{t.detail.none}</span>}</div>
          <label className="field-label">{t.act.other}</label>
          {!canOverride && <p className="passkey-note">{t.act.overrideHintMachine}</p>}
          <div className="quick-machines">{others.map((x) => machineChip(x, canOverride))}</div>
          {needsMachineReason && <><label className="field-label">{t.act.override}</label><p className="passkey-note">{t.act.overrideHintMachine}</p><input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></>}
        </>
      )}
      {action === 'MOULD_ROOM' && (
        <>
          <label className="field-label">{t.act.chooseRack}</label>
          {zones.length > 0 && <RackPicker zones={zones} value={rack?.id ?? null} preferZone={mould.owner} currentRackId={mould.rack?.id} t={t} onChange={(id, zone) => setRack({ id, zone })} />}
          {needsZoneReason && <><label className="field-label">{t.act.override}</label><p className="passkey-note">{t.act.overrideHintZone(mould.owner!, rack!.zone)}</p><input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></>}
        </>
      )}
      {(action === 'WORKSHOP' || action === 'STATUS') && (
        <>
          <label className="field-label">{t.act.status}</label>
          <div className="quick-machines">
            {action === 'WORKSHOP' && <button type="button" className={'quick-chip' + (status === '' ? ' selected' : '')} onClick={() => setStatus('')}>{t.act.keepStatus}</button>}
            {STATUSES.filter((s) => s !== mould.status && (action === 'STATUS' || s !== 'GOOD')).map((s) => (
              <button type="button" key={s} className={'quick-chip' + (status === s ? ' selected' : '')} onClick={() => setStatus(s)}>{t.status[s]}</button>
            ))}
          </div>
        </>
      )}
      {action === 'SHOTS' && (
        <>
          <label className="field-label" htmlFor="shots">{t.act.shots}</label>
          <input id="shots" className="field-input" type="number" inputMode="numeric" min={1} step={1} value={shots} onChange={(e) => setShots(e.target.value)} />
        </>
      )}
      {action !== 'SHOTS' && (
        <>
          <label className="field-label" htmlFor="remarks">{t.act.remarks}{needsRemarks ? ' *' : ''}</label>
          {needsRemarks && <p className="passkey-note">{t.act.remarksHint}</p>}
          <textarea id="remarks" className="field-input" rows={2} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>{busy ? t.act.saving : t.act.confirm}</button>
      <button className="link-btn" type="button" onClick={onCancel}>{t.act.cancel}</button>
    </div>
  );
}
