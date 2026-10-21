'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { RackPicker } from './MouldBits';
import { api, assetUrl } from '@/lib/api';
import { shrink } from '@/lib/imageUpload';
import { locationName, type Dict } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { withToasts } from '@/lib/feedback';
import { useConfirm } from './ConfirmHost';
import Icon from './Icon';
import type { Item, ItemInput, Location, Mould, ToolType, Zone } from '@/lib/types';

type ItemDraft = { id?: string; photo?: string; imageUrl?: string; itemId: string; description: string; cavities: string; qas: string; materialId: string; materialDescription: string; masterbatchId: string; masterbatchDescription: string };
const blankItem = (): ItemDraft => ({ itemId: '', description: '', cavities: '', qas: '', materialId: '', materialDescription: '', masterbatchId: '', masterbatchDescription: '' });
const toDraft = (i: Item): ItemDraft => ({ id: i.id, imageUrl: assetUrl(i.images[0]?.thumbUrl), itemId: i.itemId, description: i.description, cavities: i.cavities == null ? '' : String(i.cavities), qas: i.qas ?? '', materialId: i.materialId ?? '', materialDescription: i.materialDescription ?? '', masterbatchId: i.masterbatchId ?? '', masterbatchDescription: i.masterbatchDescription ?? '' });
const fromDraft = (d: ItemDraft): ItemInput => ({
  itemId: d.itemId.trim(), description: d.description.trim(), cavities: d.cavities.trim() === '' ? null : Math.max(0, Math.floor(Number(d.cavities))),
  qas: d.qas.trim() || null, materialId: d.materialId.trim() || null, materialDescription: d.materialDescription.trim() || null,
  masterbatchId: d.masterbatchId.trim() || null, masterbatchDescription: d.masterbatchDescription.trim() || null,
  ...(d.photo ? { photo: d.photo } : {})
});

export default function MouldFormSheet({ open, mould, t, onClose, onSaved, defaultToolType = 'INJECTION_MOULD' }: {
  open: boolean; mould: Mould | null; t: Dict; onClose: () => void; onSaved: (m: Mould, close: boolean) => void; defaultToolType?: ToolType;
}) {
  const { confirm } = useConfirm();
  const editing = Boolean(mould);
  const [zones, setZones] = useState<Zone[]>([]);
  const [f, setF] = useState({ toolId: '', toolSetCount: '', size: '', owner: '', capable: '', shots: '', notes: '' });
  const [toolType, setToolType] = useState<ToolType>('INJECTION_MOULD');
  const [start, setStart] = useState<Exclude<Location, 'MACHINE'>>('MOULD_ROOM');
  const extrusion = toolType === 'EXTRUSION_DIE';
  const title = extrusion ? (editing ? t.extrusionEdit : t.extrusionAdd) : (editing ? t.form.edit : t.form.add);
  const [rackId, setRackId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [newItem, setNewItem] = useState<ItemDraft>(blankItem());
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.racks().then((d) => setZones(d.zones)).catch(() => {});
    const type = mould?.toolType ?? defaultToolType;
    setToolType(type);
    setError(''); setTried(false); setRackId(null); setStart(type === 'EXTRUSION_DIE' ? 'TOOL_ROOM' : 'MOULD_ROOM'); setNewItem(blankItem());
    setF({
      toolId: mould?.toolId ?? '', toolSetCount: mould?.toolSetCount ?? '', size: mould?.size ?? '', owner: mould?.owner ?? '',
      capable: mould?.capableMachines.join(', ') ?? '', shots: mould?.shotsToService == null ? '' : String(mould.shotsToService), notes: mould?.notes ?? ''
    });
    setItems(mould?.items?.map(toDraft) ?? []);
  }, [open, mould, defaultToolType]);

  const fields = () => ({
    toolType,
    toolId: f.toolId.trim(), toolSetCount: f.toolSetCount.trim(), size: f.size.trim(), owner: f.owner || null,
    capableMachines: f.capable.split(/[,;/\s]+/).map((s) => s.trim()).filter(Boolean),
    shotsToService: f.shots.trim() === '' ? null : Math.max(0, Math.floor(Number(f.shots))), notes: f.notes
  });

  // Saving is the form's own explicit step (no extra confirm); loading -> success/error toast, error also inline.
  async function run<T>(work: () => Promise<T>, done: string) {
    if (busy) return undefined;
    setBusy(true); setError('');
    try { return await withToasts(t, work, done); } catch (e) { setError(errorText(e, t)); return undefined; } finally { setBusy(false); }
  }

  async function save() {
    setTried(true);
    if (!f.toolId.trim() || (!editing && start === 'MOULD_ROOM' && !rackId)) return; // shown at the fields
    if (!editing && items.some((i) => !i.itemId.trim())) return setError(t.form.itemIdRequired);
    const res = await run(() => editing
      ? api.updateMould(mould!.id, fields(), mould!.version)
      : api.createMould({ ...fields(), location: start, ...(start === 'MOULD_ROOM' && rackId ? { rackId } : {}), items: items.map(fromDraft) }),
    editing ? t.form.saved(f.toolId.trim()) : t.form.added(f.toolId.trim().toUpperCase()));
    if (res) onSaved(res.mould, true);
  }

  // Editing: items are saved one by one so each change is recorded on its own.
  async function saveItem(d: ItemDraft) {
    if (!d.itemId.trim()) return setError(t.form.itemIdRequired);
    const res = await run(() => (d.id ? api.updateItem(mould!.id, d.id, fromDraft(d)) : api.addItem(mould!.id, fromDraft(d))), t.form.saved(d.itemId.trim()));
    if (res) { setItems(res.mould.items?.map(toDraft) ?? []); setNewItem(blankItem()); onSaved(res.mould, false); }
  }
  async function removeItem(d: ItemDraft) {
    if (!d.id || busy) return;
    if (!(await confirm({ title: t.confirm.removeItemTitle, message: t.confirm.removeItem(d.itemId, mould!.toolId), confirmText: t.confirm.removeBtn, tone: 'danger' }))) return;
    const res = await run(() => api.deleteItem(mould!.id, d.id!), t.feedback.removed);
    if (res) { setItems(res.mould.items?.map(toDraft) ?? []); onSaved(res.mould, false); }
  }

  async function changePhoto(id: string, file: File | undefined) {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const photo = await shrink(file);
      setItems((current) => current.map((item) => item.id === id ? { ...item, photo } : item));
    } catch { setError(t.errors.INVALID_PHOTO()); }
    finally { setBusy(false); }
  }

  const input = (key: keyof typeof f, label: string, extra: Record<string, unknown> = {}) => (
    <><label className="field-label" htmlFor={'mf-' + key}>{label}</label><input id={'mf-' + key} className="field-input" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...extra} /></>
  );
  const itemFields = (d: ItemDraft, set: (d: ItemDraft) => void) => (
    <div className="item-edit">
      <div className="two-col">
        <input className="field-input" placeholder={t.form.itemId} aria-label={t.form.itemId} value={d.itemId} onChange={(e) => set({ ...d, itemId: e.target.value })} />
        <input className="field-input" placeholder={t.form.cavities} aria-label={t.form.cavities} type="number" min={0} inputMode="numeric" value={d.cavities} onChange={(e) => set({ ...d, cavities: e.target.value })} />
      </div>
      <input className="field-input mt" placeholder={t.form.description} aria-label={t.form.description} value={d.description} onChange={(e) => set({ ...d, description: e.target.value })} />
      <div className="two-col mt">
        <input className="field-input" placeholder={t.form.qas} aria-label={t.form.qas} value={d.qas} onChange={(e) => set({ ...d, qas: e.target.value })} />
        <input className="field-input" placeholder={t.form.materialId} aria-label={t.form.materialId} value={d.materialId} onChange={(e) => set({ ...d, materialId: e.target.value })} />
      </div>
      <input className="field-input mt" placeholder={t.form.materialDescription} aria-label={t.form.materialDescription} value={d.materialDescription} onChange={(e) => set({ ...d, materialDescription: e.target.value })} />
      <div className="two-col mt">
        <input className="field-input" placeholder={t.form.masterbatchId} aria-label={t.form.masterbatchId} value={d.masterbatchId} onChange={(e) => set({ ...d, masterbatchId: e.target.value })} />
        <input className="field-input" placeholder={t.form.masterbatchDescription} aria-label={t.form.masterbatchDescription} value={d.masterbatchDescription} onChange={(e) => set({ ...d, masterbatchDescription: e.target.value })} />
      </div>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} label={title} closeLabel={t.close}>
      <h2 className="detail-name form-title">{title}</h2>
      <fieldset disabled={busy} className="plain">
        <label className="field-label" htmlFor="mf-tool-type">{t.toolType}</label>
        <select id="mf-tool-type" className="field-input" disabled={editing} value={toolType} onChange={e => { const type = e.target.value as ToolType; setToolType(type); setRackId(null); setStart(type === 'EXTRUSION_DIE' ? 'TOOL_ROOM' : 'MOULD_ROOM'); }}>
          {(['INJECTION_MOULD', 'EXTRUSION_DIE'] as const).map(type => <option key={type} value={type}>{t.toolTypes[type]}</option>)}
        </select>
        {input('toolId', t.form.toolId, { required: true, maxLength: 100, autoCapitalize: 'characters', 'aria-invalid': tried && !f.toolId.trim() })}
        {tried && !f.toolId.trim() && <p className="field-error" role="alert"><Icon name="error" size={14} />{t.form.required}</p>}
        <div className="two-col">
          <div>{input('toolSetCount', t.form.toolSet, { maxLength: 50 })}</div>
          <div>{input('size', t.form.size, { maxLength: 50 })}</div>
        </div>
        <label className="field-label" htmlFor="mf-owner">{t.form.owner}</label>
        <select id="mf-owner" className="field-input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
          <option value="">{t.form.ownerNone}</option>
          {zones.map((z) => <option key={z.code} value={z.code}>{z.code}</option>)}
        </select>
        {input('capable', t.form.capable, { placeholder: t.form.capableHint })}
        {input('shots', t.form.shotsToService, { type: 'number', min: 0, inputMode: 'numeric' })}
        <label className="field-label" htmlFor="mf-notes">{t.form.notes}</label>
        <textarea id="mf-notes" className="field-input" rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />

        {!editing && (
          <>
            <label className="field-label">{t.form.startAt}</label>
            <div className="quick-machines">
              {([extrusion ? 'TOOL_ROOM' : 'MOULD_ROOM', 'PRODUCTION_FLOOR', 'WORKSHOP'] as const).map((l) => (
                <button type="button" key={l} className={'quick-chip' + (start === l ? ' selected' : '')} onClick={() => setStart(l)}>{locationName(l, t)}</button>
              ))}
            </div>
            {start === 'MOULD_ROOM' && zones.length > 0 && <RackPicker zones={zones} value={rackId} preferZone={f.owner || null} t={t} onChange={(id) => setRackId(id)} />}
            {tried && start === 'MOULD_ROOM' && !rackId && <p className="field-error" role="alert"><Icon name="error" size={14} />{t.errors.RACK_REQUIRED()}</p>}
          </>
        )}

        <h3 className="sub-title">{t.form.items}</h3>
        {items.map((d, i) => (
          <div className="item-block" key={d.id ?? i}>
            {itemFields(d, (nd) => setItems(items.map((x, j) => (j === i ? nd : x))))}
            {editing && d.id && <>
              <label className="field-label" htmlFor={'item-photo-' + d.id}>{t.work.photos}</label>
              <div className="photo-row">
                {(d.photo || d.imageUrl) && <div className="photo-thumb"><img src={d.photo || d.imageUrl} alt={d.itemId} /></div>}
                <label className="photo-add"><Icon name="camera" size={22} />{t.work.addPhoto}
                  <input id={'item-photo-' + d.id} type="file" accept="image/*" hidden onChange={(e) => { void changePhoto(d.id!, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {d.photo && <button type="button" className="link-btn" onClick={() => setItems(items.map((item, j) => j === i ? { ...item, photo: undefined } : item))}>{t.cancel}</button>}
              </div>
            </>}
            <div className="prod-edit-foot">
              {editing && <button type="button" className="link-btn" onClick={() => saveItem(d)}>{t.form.saveItem}</button>}
              <button type="button" className="link-btn danger" onClick={() => (editing ? removeItem(d) : setItems(items.filter((_, j) => j !== i)))}>{t.form.removeItem}</button>
            </div>
          </div>
        ))}
        {editing ? (
          <div className="item-block new">
            {itemFields(newItem, setNewItem)}
            <button type="button" className="link-btn" disabled={!newItem.itemId.trim()} onClick={() => saveItem(newItem)}>{t.form.addItem}</button>
          </div>
        ) : <button type="button" className="link-btn" onClick={() => setItems([...items, blankItem()])}>+ {t.form.addItem}</button>}

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="link-btn" type="button" onClick={onClose}><Icon name="cancel" />{t.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}><Icon name={editing ? 'confirm' : 'add'} />{editing ? t.form.save : t.form.create}</button>
        </div>
      </fieldset>
    </Sheet>
  );
}
