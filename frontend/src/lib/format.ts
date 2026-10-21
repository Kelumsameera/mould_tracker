import { ApiError } from './api';
import { locationName, type Dict, type Lang } from './i18n';
import type { Location, Mould, Movement, MouldStatus } from './types';

// The bold "where is it" line: "MOULD ROOM · FLK · A3", "MACHINE INJ-04", "WORKSHOP – IN REPAIR".
export function locationLine(m: Pick<Mould, 'location' | 'machine' | 'rack' | 'status'>, t: Dict): string {
  const name = locationName(m.location, t);
  switch (m.location) {
    case 'MOULD_ROOM': return m.rack ? `${name} · ${m.rack.zone} · ${m.rack.code}` : `${name} · ${t.card.noRack}`;
    case 'MACHINE': return `${name} ${m.machine?.code ?? ''}`.trim();
    case 'WORKSHOP': return m.status === 'GOOD' ? name : `${name} – ${t.status[m.status]}`;
    default: return name;
  }
}

// Where a movement went, as short text ("Machine INJ-03", "Mould Room · FLK-A3").
function placeText(loc: Location | null, machine: string | null, rack: string | null, t: Dict) {
  if (!loc) return '—';
  const name = locationName(loc, t);
  if (loc === 'MACHINE' && machine) return `${name} ${machine}`;
  if (loc === 'MOULD_ROOM' && rack) return `${name} · ${rack}`;
  return name;
}

export function movementText(m: Movement, t: Dict): string {
  switch (m.type) {
    case 'MOVED': {
      const move = t.hist.moved(placeText(m.fromLocation, m.fromMachineCode, m.fromRackLocationId, t), placeText(m.toLocation, m.toMachineCode, m.toRackLocationId, t));
      return m.fromStatus && m.toStatus && m.fromStatus !== m.toStatus ? `${move} (${t.status[m.toStatus]})` : move;
    }
    case 'STATUS_CHANGED': return t.hist.status(m.fromStatus ? t.status[m.fromStatus] : '—', m.toStatus ? t.status[m.toStatus] : '—');
    default: return t.hist[m.type];
  }
}

export const statusTone = (s: MouldStatus) => (s === 'GOOD' ? 'good' : s.startsWith('IN_') ? 'busy' : 'warn');
export const locationTone = (l: Location) => ({ MACHINE: 'machine', PRODUCTION_FLOOR: 'floor', WORKSHOP: 'workshop', MOULD_ROOM: 'room', TOOL_ROOM: 'room' })[l];

export function formatTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(lang === 'si' ? 'si-LK' : 'en-GB', { day: '2-digit', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
}

// "5 min ago" style, falling back to the date after a week.
export function relativeTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff > 7 * 86400 || diff < 0) return formatTime(iso, lang);
  const rtf = new Intl.RelativeTimeFormat(lang === 'si' ? 'si' : 'en', { numeric: 'auto' });
  if (diff < 60) return rtf.format(0, 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}

// Server error -> message in the user's language (falls back to the server's English text).
export function errorText(e: unknown, t: Dict): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t.offlineError;
    const fn = e.code ? (t.errors as Record<string, (d: Record<string, unknown>) => string>)[e.code] : undefined;
    if (fn) return fn(e.details);
  }
  return e instanceof Error ? e.message : String(e);
}
