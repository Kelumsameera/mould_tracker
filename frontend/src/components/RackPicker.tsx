"use client";
import { useMemo, useState } from "react";
import Icon from "./Icon";

import { type Dict } from "@/utils/i18n";

import type { Zone } from "@/utils/types";
import { RACK_SELECTED, RACK_TILE, RACK_TONE, rackTone } from "@/utils/helpers";
// Zone tabs -> rows -> rack buttons with occupancy. Full or disabled racks cannot be picked. Thumb-sized tiles.
type Props = {
  zones: Zone[];
  value: string | null;
  onChange: (rackId: string, zone: string) => void;
  preferZone?: string | null;
  currentRackId?: string | null;
  translations: Dict;
};

export default function RackPicker({
  zones,
  value,
  onChange,
  preferZone,
  currentRackId,
  translations,
}: Props) {
  const usable = zones.filter((zone) => zone.active);
  const [zone, setZone] = useState<string>(
    () => (usable.find((zone) => zone.code === preferZone) ?? usable[0])?.code ?? "",
  );
  const current = usable.find((z) => z.code === zone) ?? usable[0];
  const rows = useMemo(() => {
    const map = new Map<string, Zone["racks"]>();
    for (const r of current?.racks ?? [])
      map.set(r.row, [...(map.get(r.row) ?? []), r]);
    return [...map.entries()];
  }, [current]);
  if (!current) return null;
  return (
    <div className="mt-2">
      <div
        className="flex gap-2 overflow-x-auto [padding:2px_2px_var(--s1)] mb-3 [scrollbar-width:none] max-w-full [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {usable.map((z) => (
          <button
            type="button"
            role="tab"
            aria-selected={z.code === current.code}
            key={z.code}
            className={
              "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
              (z.code === current.code ? " bg-ink! border-ink! text-surface!" : "")
            }
            onClick={() => setZone(z.code)}
          >
            <Icon name="mouldRoom" size={15} />
            {translations.racks.zone(z.code)}
          </button>
        ))}
      </div>
      {rows.map(([row, racks]) => (
        <div className="flex gap-2 items-start mb-2" key={row}>
          <div className="w-7 shrink-0 font-black text-ink-faint min-h-14 flex items-center justify-center text-lg">
            {row}
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-5 gap-1.5">
            {racks.map((r) => {
              const tone = rackTone(r, currentRackId);
              const disabled =
                !r.active || tone === "full" || r.id === currentRackId;
              return (
                <button
                  type="button"
                  key={r.id}
                  disabled={disabled}
                  aria-pressed={value === r.id}
                  aria-label={`${r.locationId} · ${translations.act.occupancy(r.occupancy, r.capacity)}`}
                  title={r.moulds.map((mould) => mould.toolId).join(", ")}
                  className={
                    RACK_TILE + " " +
                    RACK_TONE[tone] +
                    (value === r.id ? " " + RACK_SELECTED : "")
                  }
                  onClick={() => onChange(r.id, current.code)}
                >
                  <b>{r.number}</b>
                  <small>
                    {!r.active
                      ? "×"
                      : tone === "full"
                        ? translations.racks.full
                        : translations.act.occupancy(r.occupancy, r.capacity)}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
