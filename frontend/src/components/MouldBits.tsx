'use client';
import { useEffect, useMemo, useState } from 'react';
import Icon, { locationIcon, statusIcon, workIcon, type IconName } from './Icon';
import { assetUrl } from '@/lib/api';
import { locationName, type Dict, type Lang } from '@/lib/i18n';
import { formatTime, relativeTime, statusTone } from '@/lib/format';
import type { Mould, MouldStatus, Zone } from '@/lib/types';

// Colour and icon together, never colour alone.
export function StatusBadge({ status, t }: { status: MouldStatus; t: Dict }) {
  return <span className={'status-badge ' + statusTone(status)}><Icon name={statusIcon(status)} size={13} />{t.status[status]}</span>;
}

// Where the mould is: place icon + name, then zone and rack (or machine) as chips.
export function LocationLine({ m, t, big = false }: { m: Pick<Mould, 'location' | 'machine' | 'rack' | 'status'>; t: Dict; big?: boolean }) {
  return (
    <div className={'loc ' + m.location + (big ? ' big' : '')}>
      <span className="loc-icon"><Icon name={locationIcon[m.location]} size={big ? 22 : 16} /></span>
      <span>{locationName(m.location, t)}</span>
      {m.location === 'MOULD_ROOM' && (m.rack
        ? <><span className="loc-chip">{m.rack.zone}</span><span className="loc-chip">{m.rack.code}</span></>
        : <span className="loc-chip soft">{t.card.noRack}</span>)}
      {m.location === 'MACHINE' && m.machine && <span className="loc-chip">{m.machine.code}</span>}
      {m.location === 'WORKSHOP' && m.status !== 'GOOD' && <span className="loc-chip soft">{t.status[m.status]}</span>}
    </div>
  );
}

// "Last work: Repair by Nimal, Kasun, 21 Oct 14:05" - who did the work is always shown.
export function LastWork({ m, t, lang }: { m: Mould; t: Dict; lang: Lang }) {
  if (!m.lastWork) return null;
  return <div className="last-work"><Icon name={workIcon[m.lastWork.type]} size={13} />{t.work.last(t.work.types[m.lastWork.type], m.lastWork.names.join(', '), formatTime(m.lastWork.doneAt, lang))}</div>;
}

export function EmptyState({ icon = 'empty', text }: { icon?: IconName; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26} /></span><p>{text}</p></div>;
}

// Placeholder cards while a list loads, so the screen never goes blank.
export function SkeletonCards({ count = 6, label }: { count?: number; label: string }) {
  return (
    <div className="card-grid" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton sk-thumb" />
          <div className="sk-lines"><div className="skeleton sk-line w40" /><div className="skeleton sk-line w70" /><div className="skeleton sk-line w55" /></div>
        </div>
      ))}
    </div>
  );
}

// One search result / list row: picture, Tool ID + status, the location line, what it makes, last move/work.
export function MouldCard({ m, t, lang, onOpen }: { m: Mould; t: Dict; lang: Lang; onOpen: (id: string) => void }) {
  const what = m.itemIds?.slice(0, 3).join(', ') ?? '';
  return (
    <div className="mould-card" role="button" tabIndex={0} aria-label={m.toolId} onClick={() => onOpen(m.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(m.id); } }}>
      <div className="mould-thumb">{m.thumbUrl ? <img src={assetUrl(m.thumbUrl)} alt="" loading="lazy" decoding="async" width={72} height={72} /> : <Icon name="mould" size={26} />}</div>
      <div className="mould-info">
        <div className="mould-head"><span className="tool-id-badge">{m.toolId}</span><StatusBadge status={m.status} t={t} /></div>
        <LocationLine m={m} t={t} />
        {what && <div className="mould-items">{what}{(m.itemCount ?? 0) > 3 ? ' …' : ''}</div>}
        {m.lastMovedAt && <div className="mould-moved"><Icon name="clock" size={13} />{t.card.moved(relativeTime(m.lastMovedAt, lang), m.lastMovedBy?.name ?? '')}</div>}
        <LastWork m={m} t={t} lang={lang} />
        {(m.openProblem || m.serviceDue) && (
          <div className="card-tags">
            {m.openProblem && <span className="tag problem" title={m.openProblem.text}><Icon name="problem" size={12} />{t.problem.badge}</span>}
            {m.serviceDue && <span className="tag due"><Icon name="shots" size={12} />{t.card.shotsDue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// Full-screen picture viewer.
export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    // Captured first, so Esc closes the picture and not the sheet behind it.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [src, onClose]);
  if (!src) return null;
  return <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true"><img src={src} alt="" /></div>;
}

// empty = green, in use = teal, full = amber.
export const rackTone = (r: Zone['racks'][number], currentRackId?: string | null) =>
  r.capacity != null && r.occupancy >= r.capacity && r.id !== currentRackId ? 'full' : r.occupancy ? 'used' : 'empty';

// Zone tabs -> rows -> rack buttons with occupancy. Full or disabled racks cannot be picked. Thumb-sized tiles.
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
      <div className="tabs" role="tablist">
        {usable.map((z) => (
          <button type="button" role="tab" aria-selected={z.code === current.code} key={z.code} className={'tab' + (z.code === current.code ? ' active' : '')} onClick={() => setZone(z.code)}>
            <Icon name="mouldRoom" size={15} />{t.racks.zone(z.code)}
          </button>
        ))}
      </div>
      {rows.map(([row, racks]) => (
        <div className="rack-row" key={row}>
          <div className="rack-row-label">{row}</div>
          <div className="rack-row-grid">
            {racks.map((r) => {
              const tone = rackTone(r, currentRackId);
              const disabled = !r.active || tone === 'full' || r.id === currentRackId;
              return (
                <button type="button" key={r.id} disabled={disabled} aria-pressed={value === r.id} aria-label={`${r.locationId} · ${t.act.occupancy(r.occupancy, r.capacity)}`}
                  title={r.moulds.map((m) => m.toolId).join(', ')} className={'rack-pick ' + tone + (value === r.id ? ' selected' : '')} onClick={() => onChange(r.id, current.code)}>
                  <b>{r.number}</b><small>{!r.active ? '×' : tone === 'full' ? t.racks.full : t.act.occupancy(r.occupancy, r.capacity)}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
