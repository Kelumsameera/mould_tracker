"use client";
import { useMemo } from "react";
import type { Rack } from "@/utils/types";
import type { Dict } from "@/utils/i18n";
import { rackTone } from "@/utils/helpers";
import { assetUrl } from "@/utils/api";

type Props = {
  racks: Rack[]; translations: Dict; selected?: string | null;
  onPick: (rack: Rack) => void; picker?: boolean; currentRackId?: string | null;
  matches?: Set<string>;
};

// The physical order is rack -> pallet/level -> numbered mould position.
export default function RackStructure({ racks, translations, selected, onPick, picker, currentRackId, matches }: Props) {
  const groups = useMemo(() => {
    const rows = [...new Set(racks.map(r => r.row))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return rows.map(row => {
      const positions = racks.filter(r => r.row === row);
      const levels = [...new Set(positions.map(r => r.pallet ?? 0))].sort((a, b) => a - b);
      return { row, levels: levels.map(level => ({ level, positions: positions.filter(r => (r.pallet ?? 0) === level).sort((a, b) => a.number - b.number) })) };
    });
  }, [racks]);
  const text = translations.rackLayout;
  return <div className="overflow-x-auto pb-3" tabIndex={0} aria-label={text.layout}>
    <div className="grid gap-3 items-start" style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, minmax(190px,1fr))`, minWidth: groups.length * 190 + Math.max(0, groups.length - 1) * 12 }}>
      {groups.map(group => <section key={group.row} className="min-w-0" aria-label={`${text.rack} ${group.row}`}>
        <h3 className="text-center text-white bg-[#063e87] rounded-t-md py-2 text-3xl font-extrabold border-b-4 border-[#f59425]">{group.row}</h3>
        <div className="border-x-[8px] border-[#155fa3] bg-surface-2 shadow-[inset_0_0_0_1px_var(--line)]">
          {group.levels.map(({ level, positions }) => <div key={level} className="border-b-[9px] border-[#ed8724] px-2 pt-2 pb-1.5">
            <div className="flex justify-between text-xs font-bold text-ink-soft mb-1.5"><span>{level ? `P${level}` : text.legacy}</span><span>{positions.reduce((n, r) => n + r.occupancy, 0)} / {positions.length}</span></div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(positions.length, 4)}, minmax(0,1fr))` }}>
              {positions.map(rack => {
                const tone = rackTone(rack, currentRackId);
                const disabled = Boolean(picker && (!rack.active || tone === "full" || rack.id === currentRackId));
                const chosen = selected === rack.id;
                const photos = rack.moulds.flatMap(mould => (mould.items || []).filter(item => item.thumbUrl));
                const preview = photos[0];
                return <button key={rack.id} type="button" disabled={disabled} onClick={() => onPick(rack)} aria-pressed={chosen}
                  aria-label={`${rack.locationId} · ${translations.act.occupancy(rack.occupancy, rack.capacity)}`}
                  title={`${rack.locationId}${rack.moulds.length ? `: ${rack.moulds.map(m => m.toolId).join(", ")}` : ""}`}
                  className={`relative flex flex-col items-center justify-center min-h-[128px] min-w-0 rounded-sm px-1 pt-2 pb-1 border-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed ${chosen ? "border-action ring-2 ring-action" : "border-line"} ${rack.occupancy ? "bg-linear-to-b from-[#d6dce0] via-[#aebac3] to-[#d2d8dc] text-[#152c3a]" : "bg-surface text-ink-soft border-dashed"} ${!rack.active || (matches && !matches.has(rack.id)) ? "opacity-35" : ""}`}>
                  {rack.occupancy > 0 && <span aria-hidden="true" className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#566d7b] bg-surface-2" />}
                  <b className="inline-block min-w-7 px-1 bg-surface text-ink rounded-sm text-xl leading-6">{rack.number}</b>
                  {preview?.thumbUrl && <span className="relative block w-full mt-1 rounded-sm bg-white/90 p-0.5">
                    <img src={assetUrl(preview.thumbUrl)} alt={preview.description || preview.itemId} width={96} height={40} loading="lazy" decoding="async" className="w-full h-10 object-contain" onError={event => { event.currentTarget.style.display = "none"; }} />
                    {photos.length > 1 && <span className="absolute right-0 top-0 rounded-sm bg-[#063e87] px-1 text-[10px] text-white">+{photos.length - 1}</span>}
                    <span className="block truncate text-[9px] leading-3 font-semibold text-[#152c3a]">{preview.itemId}</span>
                  </span>}
                  <span className="block max-w-full truncate text-[10px] leading-3 font-extrabold mt-0.5">{rack.moulds.map(m => m.toolId).join(", ") || (rack.active ? translations.racks.empty : translations.racks.inactive)}</span>
                  <span className="block max-w-full text-[10px] leading-3 truncate">{rack.code}</span>
                </button>;
              })}
            </div>
          </div>)}
        </div>
      </section>)}
    </div>
  </div>;
}
