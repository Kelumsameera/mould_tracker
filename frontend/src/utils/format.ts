import { ApiError } from "@/utils/api";
import { locationName, type Dict, type Lang } from "@/utils/i18n";
import type { Location, Mould, Movement, MouldStatus } from "@/utils/types";

// Build the location text shown on mould cards.
export function locationLine(
  mould: Pick<Mould, 'location' | 'machine' | 'rack' | 'status'>,
  text: Dict,
): string {
  const placeName = locationName(mould.location, text);

  if (mould.location === 'MOULD_ROOM') {
    if (mould.rack) {
      return `${placeName} · ${mould.rack.zone} · ${mould.rack.code}`;
    }
    return `${placeName} · ${text.card.noRack}`;
  }
  if (mould.location === 'MACHINE') {
    const machineCode = mould.machine?.code ?? '';
    return `${placeName} ${machineCode}`.trim();
  }
  if (mould.location === 'WORKSHOP' && mould.status !== 'GOOD') {
    return `${placeName} – ${text.status[mould.status]}`;
  }
  return placeName;
}

function placeText(
  location: Location | null,
  machineCode: string | null,
  rackCode: string | null,
  text: Dict,
) {
  if (!location) {
    return '—';
  }
  const placeName = locationName(location, text);
  if (location === 'MACHINE' && machineCode) {
    return `${placeName} ${machineCode}`;
  }
  if (location === 'MOULD_ROOM' && rackCode) {
    return `${placeName} · ${rackCode}`;
  }
  return placeName;
}

export function movementText(movement: Movement, text: Dict): string {
  if (movement.type === 'MOVED') {
    const previousPlace = placeText(
      movement.fromLocation,
      movement.fromMachineCode,
      movement.fromRackLocationId,
      text,
    );
    const nextPlace = placeText(
      movement.toLocation,
      movement.toMachineCode,
      movement.toRackLocationId,
      text,
    );
    const description = text.hist.moved(previousPlace, nextPlace);
    const hasStatusChange = movement.fromStatus && movement.toStatus &&
      movement.fromStatus !== movement.toStatus;

    if (hasStatusChange && movement.toStatus) {
      return `${description} (${text.status[movement.toStatus]})`;
    }
    return description;
  }

  if (movement.type === 'STATUS_CHANGED') {
    let previousStatus = '—';
    let nextStatus = '—';
    if (movement.fromStatus) {
      previousStatus = text.status[movement.fromStatus];
    }
    if (movement.toStatus) {
      nextStatus = text.status[movement.toStatus];
    }
    return text.hist.status(previousStatus, nextStatus);
  }
  return text.hist[movement.type];
}

export function statusTone(status: MouldStatus) {
  if (status === 'GOOD') return 'bg-good-bg text-good-ink';
  if (status.startsWith('IN_')) return 'bg-workshop-bg text-workshop-ink';
  return 'bg-warn-bg text-warn-ink';
}
export function locationTone(location: Location) {
  if (location === 'MACHINE') return 'machine';
  if (location === 'PRODUCTION_FLOOR') return 'floor';
  if (location === 'WORKSHOP') return 'workshop';
  if (location === 'OUT_OF_SERVICE') return 'attention';
  return 'room';
}

export function formatTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const date = new Date(iso);
  const locale = lang === 'si' ? 'si-LK' : 'en-GB';
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleString(locale, options);
}

// "5 min ago" style, falling back to the date after a week.
export function relativeTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const secondsPassed = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secondsPassed > 7 * 86400 || secondsPassed < 0) return formatTime(iso, lang);
  const relativeFormatter = new Intl.RelativeTimeFormat(lang === 'si' ? 'si' : 'en', { numeric: 'auto' });
  if (secondsPassed < 60) return relativeFormatter.format(0, 'second');
  if (secondsPassed < 3600) return relativeFormatter.format(-Math.floor(secondsPassed / 60), 'minute');
  if (secondsPassed < 86400) return relativeFormatter.format(-Math.floor(secondsPassed / 3600), 'hour');
  return relativeFormatter.format(-Math.floor(secondsPassed / 86400), 'day');
}

// Server error -> message in the user's language (falls back to the server's English text).
export function errorText(error: unknown, text: Dict): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return text.offlineError;
    }
    if (error.code) {
      const messages = text.errors as Record<string, (details: Record<string, unknown>) => string>;
      const getMessage = messages[error.code];
      if (getMessage) {
        return getMessage(error.details);
      }
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
