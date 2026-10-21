'use client';
import { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '@/lib/api';
import type { Dict, Lang } from '@/lib/i18n';
import { formatTime, locationLine, locationTone, relativeTime, statusTone } from '@/lib/format';
import type { Mould, MouldStatus, Zone } from '@/lib/types';

export function StatusBadge({ status, t }: { status: MouldStatus; t: Dict }) {
  return <span className={'status-badge ' + statusTone(status)}>{t.status[status]}</span>;
}

// "Last work: Repair by Nimal, Kasun, 21 Oct 14:05" - who did the work is always shown.
export function LastWork({ m, t, lang }: { m: Mould; t: Dict; lang: Lang }) {
  if (!m.lastWork) return null;
  return <div className="last-work">{t.work.last(t.work.types[m.lastWork.type], m.lastWork.names.join(', '), formatTime(m.lastWork.doneAt, lang))}</div>;
}

// One search result / list row: picture, Tool ID, what it makes, the bold location line, status, last move.
export function MouldCard({ m, t, lang, onOpen }: { m: Mould; t: Dict; lang: Lang; onOpen: (id: string) => void }) {
  const what = m.itemIds?.slice(0, 3).join(', ') ?? '';
  return (
    <div className="mould-card" role="button" tabIndex={0} onClick={() => onOpen(m.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(m.id); }}>
      <div className="mould-thumb">{m.thumbUrl ? <img src={assetUrl(m.thumbUrl)} alt="" loading="lazy" /> : <span>{m.toolId.slice(0, 3)}</span>}</div>
      <div className="mould-info">
        <div className="mould-head"><span className="tool-id-badge">{m.toolId}</span><StatusBadge status={m.status} t={t} /></div>
        <div className={'where-line ' + locationTone(m.location)}>{locationLine(m, t)}</div>
        {what && <div className="mould-items">{what}{(m.itemCount ?? 0) > 3 ? ' …' : ''}</div>}
        {m.lastMovedAt && <div className="mould-moved">{t.card.moved(relativeTime(m.lastMovedAt, lang), m.lastMovedBy?.name ?? '')}</div>}
        <LastWork m={m} t={t} lang={lang} />
      </div>
      {(m.serviceDue || m.openProblem) && (
        <span className="corner-tags">
          {m.openProblem && <span className="problem-tag" title={m.openProblem.text}>{t.problem.badge}</span>}
          {m.serviceDue && <span className="due-tag">{t.card.shotsDue}</span>}
        </span>
      )}
    </div>
  );
}

// Full-screen picture viewer.
export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);
  if (!src) return null;
  return <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true"><img src={src} alt="" /></div>;
}

// Zone tabs -> rows -> rack buttons with occupancy. Full or disabled racks cannot be picked.
export function RackPicker({ zones, value, onChange, preferZone, currentRackId, t }: {
  zones: Zone[]; value: string | null; onChange: (rackId: string, zone: string) => void; preferZone?: string | null; currentRackId?: string | null; t: Dict;
}) {
  const usable = zones.filter((z) => z.active);
  const [zone, setZone] = useState<string>(() => (usable.find((z) => z.code === preferZone) ?? usable[0])?.code ?? '');
  const current = usable.find((z) => z.code === zone) ?? usable[0];
  const rows = useMemo(() => {
    const map = new Map<string, Zone['racks']>();
    for (const r of current?.racks ?? []) map.set(r.row, [...(map.get(r.row) ?? []), r]);
    return [...map.entries()];
  }, [current]);
  if (!current) return null;
  return (
    <div className="rack-picker">
      <div className="tabs">
        {usable.map((z) => <button type="button" key={z.code} className={'tab' + (z.code === current.code ? ' active' : '')} onClick={() => setZone(z.code)}>{t.racks.zone(z.code)}</button>)}
      </div>
      {rows.map(([row, racks]) => (
        <div className="rack-row" key={row}>
          <div className="rack-row-label">{row}</div>
          <div className="rack-row-grid">
            {racks.map((r) => {
              const full = r.capacity != null && r.occupancy >= r.capacity && r.id !== currentRackId;
              const disabled = !r.active || full || r.id === currentRackId;
              return (
                <button type="button" key={r.id} disabled={disabled} title={r.moulds.map((m) => m.toolId).join(', ')}
                  className={'rack-pick' + (value === r.id ? ' selected' : '') + (r.occupancy ? ' used' : ' empty')}
                  onClick={() => onChange(r.id, current.code)}>
                  <b>{r.number}</b><small>{!r.active ? '×' : full ? t.racks.full : t.act.occupancy(r.occupancy, r.capacity)}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
