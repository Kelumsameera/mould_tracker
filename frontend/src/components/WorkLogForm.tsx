'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Dict } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { withToasts } from '@/lib/feedback';
import { useConfirm } from './ConfirmHost';
import Icon from './Icon';
import { shrink } from '@/lib/imageUpload';
import { WORK_TYPES, type Mould, type Person, type User, type WorkLog, type WorkOutcome, type WorkType } from '@/lib/types';

const MAX_PHOTOS = 3;

// "2026-10-21T14:05" in local time, for <input type="datetime-local">.
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function WorkLogForm({ mould, user, t, correcting, onSaved, onCancel }: {
  mould: Mould; user: User; t: Dict; correcting: WorkLog | null;
  onSaved: (warnings: string[], outcome: WorkOutcome | null, description: string) => void; onCancel: () => void;
}) {
  const { confirm } = useConfirm();
  const [workers, setWorkers] = useState<Person[]>([]);
  const [type, setType] = useState<WorkType>(correcting?.type ?? 'REPAIR');
  const [description, setDescription] = useState(correcting?.description ?? '');
  const [doneBy, setDoneBy] = useState<string[]>(correcting?.doneBy.map((p) => p.id) ?? [user.id]);
  const [when, setWhen] = useState(localInput(correcting ? new Date(correcting.doneAt) : new Date()));
  const [parts, setParts] = useState(correcting?.partsUsed ?? '');
  const [minutes, setMinutes] = useState(correcting?.timeSpentMinutes != null ? String(correcting.timeSpentMinutes) : '');
  const [shots, setShots] = useState('');
  const [outcome, setOutcome] = useState<WorkOutcome | null>(null);
  const [sendToWorkshop, setSendToWorkshop] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.workers().then((d) => setWorkers(d.workers)).catch((e) => setError(errorText(e, t))); }, [t]);

  const toggleWorker = (id: string) => setDoneBy((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id].slice(0, 5)));
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    try {
      const added = await Promise.all([...files].slice(0, MAX_PHOTOS - photos.length).map(shrink));
      setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS));
    } catch { setError(t.errors.INVALID_PHOTO()); }
  }

  const needsWork = outcome === 'NEEDS_REPAIR' || outcome === 'NEEDS_SERVICE';
  async function submit() {
    if (busy) return;
    setTried(true);
    if (!description.trim()) return; // shown under the field
    const names = people.filter((p) => doneBy.includes(p.id)).map((p) => p.name).join(', ');
    const moving = needsWork && sendToWorkshop && mould.location !== 'WORKSHOP';
    if (!(await confirm({
      title: t.confirm.workTitle, message: t.confirm.work(mould.toolId, t.work.types[type], names), confirmText: t.confirm.workBtn,
      note: [correcting && t.confirm.workCorrection, moving && t.confirm.workMove].filter(Boolean).join(' ') || undefined
    }))) return;
    setBusy(true); setError('');
    try {
      const res = await withToasts(t, () => api.createWorkLog(mould.id, {
        type, description, partsUsed: parts, doneBy, doneAt: new Date(when).toISOString(),
        timeSpentMinutes: minutes.trim() === '' ? null : Math.max(0, Math.floor(Number(minutes))),
        shots: shots.trim() === '' ? null : Math.max(0, Math.floor(Number(shots))),
        outcome, sendToWorkshop: needsWork && sendToWorkshop, photos, version: mould.version,
        ...(correcting ? { correctsId: correcting.id } : {})
      }), t.feedback.saved);
      onSaved(res.warnings, outcome, description);
    } catch (e) { setError(errorText(e, t)); }
    finally { setBusy(false); }
  }

  // Everyone named in the entry stays visible even if their account is no longer in the list.
  const people = [...workers, ...(correcting?.doneBy.filter((p) => !workers.some((w) => w.id === p.id)) ?? [])];
  return (
    <div className="action-panel">
      {correcting && <div className="warn-box">{t.work.correcting}</div>}
      <label className="field-label">{t.work.type}</label>
      <div className="quick-machines">
        {WORK_TYPES.map((w) => <button type="button" key={w} className={'quick-chip' + (type === w ? ' selected' : '')} onClick={() => setType(w)}>{t.work.types[w]}</button>)}
      </div>
      <label className="field-label" htmlFor="wl-what">{t.work.what} *</label>
      <textarea id="wl-what" className="field-input" rows={3} maxLength={2000} placeholder={t.work.whatPh} value={description} aria-invalid={tried && !description.trim()} onChange={(e) => setDescription(e.target.value)} />
      {tried && !description.trim() && <p className="field-error" role="alert"><Icon name="error" size={14} />{t.form.required}</p>}

      <label className="field-label">{t.work.who} *</label>
      <p className="passkey-note">{t.work.whoHint}</p>
      <div className="quick-machines">
        {people.map((p) => (
          <button type="button" key={p.id} className={'quick-chip' + (doneBy.includes(p.id) ? ' selected' : '')} onClick={() => toggleWorker(p.id)}>
            {p.name} <small>{t.roles[p.role]}</small>
          </button>
        ))}
      </div>

      <div className="two-col">
        <div><label className="field-label" htmlFor="wl-when">{t.work.when}</label>
          <input id="wl-when" className="field-input" type="datetime-local" max={localInput(new Date())} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="wl-min">{t.work.minutes}</label>
          <input id="wl-min" className="field-input" type="number" min={0} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
      </div>
      <label className="field-label" htmlFor="wl-parts">{t.work.parts}</label>
      <input id="wl-parts" className="field-input" maxLength={1000} value={parts} onChange={(e) => setParts(e.target.value)} />
      <label className="field-label" htmlFor="wl-shots">{t.work.shots}</label>
      <input id="wl-shots" className="field-input" type="number" min={0} inputMode="numeric" placeholder={String(mould.totalShots)} value={shots} onChange={(e) => setShots(e.target.value)} />

      <label className="field-label">{t.work.outcome}</label>
      <div className="quick-machines">
        <button type="button" className={'quick-chip' + (outcome === null ? ' selected' : '')} onClick={() => setOutcome(null)}>{t.work.outcomes.none}</button>
        {(['OK', 'NEEDS_REPAIR', 'NEEDS_SERVICE'] as const).map((o) => (
          <button type="button" key={o} className={'quick-chip' + (outcome === o ? ' selected' : '')} onClick={() => setOutcome(o)}>{t.work.outcomes[o]}</button>
        ))}
      </div>
      {needsWork && mould.location !== 'WORKSHOP' && (
        <>
          <label className="check"><input type="checkbox" checked={sendToWorkshop} onChange={(e) => setSendToWorkshop(e.target.checked)} /> {t.work.sendToWorkshop}</label>
          <p className="passkey-note">{['MOULD_ROOM', 'TOOL_ROOM'].includes(mould.location) ? t.work.roomHint(mould.location === 'TOOL_ROOM' ? t.loc.TOOL_ROOM : t.mouldRoom) : t.work.stayHint}</p>
        </>
      )}

      <label className="field-label">{t.work.photos}</label>
      <div className="photo-row">
        {photos.map((p, i) => (
          <button type="button" key={i} className="photo-thumb" aria-label={t.work.removePhoto} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><img src={p} alt="" /><span>×</span></button>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="photo-add"><Icon name="camera" size={22} />{t.work.addPhoto}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} /></label>
        )}
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-actions">
        <button className="link-btn" type="button" onClick={onCancel}><Icon name="cancel" />{t.cancel}</button>
        <button className="btn btn-primary" disabled={busy || !doneBy.length || !when} onClick={submit}><Icon name="worklog" />{busy ? t.work.saving : t.work.save}</button>
      </div>
    </div>
  );
}

// "Report a problem": anyone may send it; it never moves the mould or changes its status.
export function ProblemForm({ mould, t, onSaved, onCancel }: { mould: Mould; t: Dict; onSaved: () => void; onCancel: () => void }) {
  const { confirm } = useConfirm();
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    try { const added = await Promise.all([...files].slice(0, MAX_PHOTOS - photos.length).map(shrink)); setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS)); }
    catch { setError(t.errors.INVALID_PHOTO()); }
  }
  async function submit() {
    setTried(true);
    if (busy || !description.trim() || !(await confirm({ title: t.confirm.problemTitle, message: t.confirm.problem(mould.toolId), confirmText: t.confirm.problemBtn }))) return;
    setBusy(true); setError('');
    try { await withToasts(t, () => api.reportProblem(mould.id, { description, photos, version: mould.version }), t.feedback.reported); onSaved(); }
    catch (e) { setError(errorText(e, t)); }
    finally { setBusy(false); }
  }
  return (
    <div className="action-panel">
      <p className="passkey-note">{t.problem.hint}</p>
      <label className="field-label" htmlFor="pr-what">{t.problem.what} *</label>
      <textarea id="pr-what" className="field-input" rows={3} maxLength={2000} placeholder={t.problem.whatPh} value={description} aria-invalid={tried && !description.trim()} onChange={(e) => setDescription(e.target.value)} />
      {tried && !description.trim() && <p className="field-error" role="alert"><Icon name="error" size={14} />{t.form.required}</p>}
      <label className="field-label">{t.work.photos}</label>
      <div className="photo-row">
        {photos.map((p, i) => <button type="button" key={i} className="photo-thumb" aria-label={t.work.removePhoto} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><img src={p} alt="" /><span>×</span></button>)}
        {photos.length < MAX_PHOTOS && <label className="photo-add"><Icon name="camera" size={22} />{t.work.addPhoto}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} /></label>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-actions">
        <button className="link-btn" type="button" onClick={onCancel}><Icon name="cancel" />{t.cancel}</button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}><Icon name="send" />{busy ? t.work.saving : t.problem.save}</button>
      </div>
    </div>
  );
}
