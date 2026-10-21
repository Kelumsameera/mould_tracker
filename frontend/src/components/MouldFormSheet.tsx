'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { RackPicker } from './MouldBits';
import { api } from '@/lib/api';
import { locationName, type Dict } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import type { Item, ItemInput, Mould, Zone } from '@/lib/types';

type ItemDraft = { id?: string; itemId: string; description: string; cavities: string; qas: string; materialId: string; materialDescription: string; masterbatchId: string; masterbatchDescription: string };
const blankItem = (): ItemDraft => ({ itemId: '', description: '', cavities: '', qas: '', materialId: '', materialDescription: '', masterbatchId: '', masterbatchDescription: '' });
const toDraft = (i: Item): ItemDraft => ({ id: i.id, itemId: i.itemId, description: i.description, cavities: i.cavities == null ? '' : String(i.cavities), qas: i.qas ?? '', materialId: i.materialId ?? '', materialDescription: i.materialDescription ?? '', masterbatchId: i.masterbatchId ?? '', masterbatchDescription: i.masterbatchDescription ?? '' });
const fromDraft = (d: ItemDraft): ItemInput => ({
  itemId: d.itemId.trim(), description: d.description.trim(), cavities: d.cavities.trim() === '' ? null : Math.max(0, Math.floor(Number(d.cavities))),
  qas: d.qas.trim() || null, materialId: d.materialId.trim() || null, materialDescription: d.materialDescription.trim() || null,
  masterbatchId: d.masterbatchId.trim() || null, masterbatchDescription: d.masterbatchDescription.trim() || null
});

export default function MouldFormSheet({ open, mould, t, onClose, onSaved, toast }: {
  open: boolean; mould: Mould | null; t: Dict; onClose: () => void; onSaved: (m: Mould, close: boolean) => void; toast: (m: string) => void;
}) {
  const editing = Boolean(mould);
  const [zones, setZones] = useState<Zone[]>([]);
  const [f, setF] = useState({ toolId: '', toolSetCount: '', size: '', owner: '', capable: '', shots: '', notes: '' });
  const [start, setStart] = useState<'MOULD_ROOM' | 'PRODUCTION_FLOOR' | 'WORKSHOP'>('MOULD_ROOM');
  const [rackId, setRackId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [newItem, setNewItem] = useState<ItemDraft>(blankItem());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.racks().then((d) => setZones(d.zones)).catch(() => {});
    setError(''); setRackId(null); setStart('MOULD_ROOM'); setNewItem(blankItem());
    setF({
      toolId: mould?.toolId ?? '', toolSetCount: mould?.toolSetCount ?? '', size: mould?.size ?? '', owner: mould?.owner ?? '',
      capable: mould?.capableMachines.join(', ') ?? '', shots: mould?.shotsToService == null ? '' : String(mould.shotsToService), notes: mould?.notes ?? ''
    });
    setItems(mould?.items?.map(toDraft) ?? []);
  }, [open, mould]);

  const fields = () => ({
    toolId: f.toolId.trim(), toolSetCount: f.toolSetCount.trim(), size: f.size.trim(), owner: f.owner || null,
    capableMachines: f.capable.split(/[,;/\s]+/).map((s) => s.trim()).filter(Boolean),
    shotsToService: f.shots.trim() === '' ? null : Math.max(0, Math.floor(Number(f.shots))), notes: f.notes
  });

  async function run<T>(work: () => Promise<T>) {
    setBusy(true); setError('');
    try { return await work(); } catch (e) { setError(errorText(e, t)); return undefined; } finally { setBusy(false); }
  }

  async function save() {
    if (!editing && items.some((i) => !i.itemId.trim())) return setError(t.form.itemIdRequired);
    const res = await run(() => editing
      ? api.updateMould(mould!.id, fields(), mould!.version)
      : api.createMould({ ...fields(), location: start, ...(start === 'MOULD_ROOM' && rackId ? { rackId } : {}), items: items.map(fromDraft) }));
    if (res) { toast(editing ? t.form.saved(res.mould.toolId) : t.form.added(res.mould.toolId)); onSaved(res.mould, true); }
  }

  // Editing: items are saved one by one so each change is recorded on its own.
  async function saveItem(d: ItemDraft) {
    if (!d.itemId.trim()) return setError(t.form.itemIdRequired);
    const res = await run(() => (d.id ? api.updateItem(mould!.id, d.id, fromDraft(d)) : api.addItem(mould!.id, fromDraft(d))));
    if (res) { toast(t.form.saved(d.itemId)); setItems(res.mould.items?.map(toDraft) ?? []); setNewItem(blankItem()); onSaved(res.mould, false); }
  }
  async function removeItem(d: ItemDraft) {
    if (!d.id || !confirm(t.form.confirmRemoveItem(d.itemId))) return;
    const res = await run(() => api.deleteItem(mould!.id, d.id!));
    if (res) { setItems(res.mould.items?.map(toDraft) ?? []); onSaved(res.mould, false); }
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
    <Sheet open={open} onClose={onClose} label={editing ? t.form.edit : t.form.add}>
      <h2 className="detail-name form-title">{editing ? t.form.edit : t.form.add}</h2>
      <fieldset disabled={busy} className="plain">
        {input('toolId', t.form.toolId, { required: true, maxLength: 100 })}
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
              {(['MOULD_ROOM', 'PRODUCTION_FLOOR', 'WORKSHOP'] as const).map((l) => (
                <button type="button" key={l} className={'quick-chip' + (start === l ? ' selected' : '')} onClick={() => setStart(l)}>{locationName(l, t)}</button>
              ))}
            </div>
            {start === 'MOULD_ROOM' && zones.length > 0 && <RackPicker zones={zones} value={rackId} preferZone={f.owner || null} t={t} onChange={(id) => setRackId(id)} />}
          </>
        )}

        <h3 className="sub-title">{t.form.items}</h3>
        {items.map((d, i) => (
          <div className="item-block" key={d.id ?? i}>
            {itemFields(d, (nd) => setItems(items.map((x, j) => (j === i ? nd : x))))}
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
        <button className="btn btn-primary" disabled={!f.toolId.trim() || (!editing && start === 'MOULD_ROOM' && !rackId)} onClick={save}>{editing ? t.form.save : t.form.create}</button>
      </fieldset>
    </Sheet>
  );
}
