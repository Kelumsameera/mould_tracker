'use client';
import { useState } from 'react';
import Sheet from './Sheet';
import { I18N, type Lang } from '@/lib/i18n';
import type { Tool, ToolInput } from '@/lib/types';

interface Row { pid: string; desc: string; cav: string }

export default function ToolFormSheet({ open, tool, lang, onClose, onSave, onError }: {
  open: boolean; tool: Tool | null; lang: Lang; onClose: () => void;
  onSave: (input: ToolInput) => Promise<void>; onError: (msg: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Tool form">
      {/* key resets the form state every time the sheet opens for a different tool */}
      <Form key={tool?.id ?? 'new'} tool={tool} lang={lang} onSave={onSave} onError={onError} />
    </Sheet>
  );
}

function Form({ tool, lang, onSave, onError }: { tool: Tool | null; lang: Lang; onSave: (i: ToolInput) => Promise<void>; onError: (m: string) => void }) {
  const t = I18N[lang];
  const [code, setCode] = useState(tool?.toolCode ?? '');
  const [size, setSize] = useState(tool?.size ?? '');
  const [rows, setRows] = useState<Row[]>(tool?.products.map((p) => ({ pid: p.pid, desc: p.desc, cav: p.cav ? String(p.cav) : '' })) ?? [{ pid: '', desc: '', cav: '' }]);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    if (!code.trim()) return onError(t.toastEnterId);
    // Completely empty rows are ignored (the product fields are optional, like in the original app).
    const filled = rows.filter((r) => r.pid.trim() || r.desc.trim() || r.cav.trim());
    if (filled.some((r) => !r.pid.trim())) return onError(t.toastEmptyPid);
    const ids = filled.map((r) => r.pid.trim().toUpperCase());
    if (new Set(ids).size !== ids.length) return onError(t.toastDupPid);

    setBusy(true);
    try {
      await onSave({
        toolCode: code.trim(),
        size: size.trim(),
        products: filled.map((r) => ({ pid: r.pid.trim(), desc: r.desc.trim(), cav: Math.max(0, Math.floor(Number(r.cav) || 0)) }))
      });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h2 className="detail-name form-title">{tool ? t.editTitle : t.addTitle}</h2>
      <label className="field-label">{t.toolIdLabel}</label>
      <input className="field-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. FLK19080" autoFocus />
      <label className="field-label">{t.sizeLabel}</label>
      <input className="field-input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 130" inputMode="numeric" />

      {rows.map((r, i) => (
        <div className="prod-edit" key={i}>
          <label className="field-label">{t.pidLabel}</label>
          <input className="field-input" value={r.pid} onChange={(e) => setRow(i, { pid: e.target.value })} placeholder="e.g. GP0001-227" />
          <label className="field-label">{t.descLabel}</label>
          <input className="field-input" value={r.desc} onChange={(e) => setRow(i, { desc: e.target.value })} placeholder="e.g. Straight Connector" />
          <div className="prod-edit-foot">
            <div>
              <label className="field-label">{t.cavLabel}</label>
              <input className="field-input cav" type="number" min={0} value={r.cav} onChange={(e) => setRow(i, { cav: e.target.value })} />
            </div>
            {rows.length > 1 && <button type="button" className="link-btn danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>{t.removeProduct}</button>}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setRows((x) => [...x, { pid: '', desc: '', cav: '' }])}>{t.addProduct}</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{tool ? t.saveBtn : t.addToolBtn}</button>
    </div>
  );
}
