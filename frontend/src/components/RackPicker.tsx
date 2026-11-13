"use client";
import { useState } from "react";
import RackStructure from "./RackStructure";
import type { Dict } from "@/utils/i18n";
import type { Zone } from "@/utils/types";

type Props = {
  zones: Zone[]; value: string | null; onChange: (rackId: string, zone: string) => void;
  preferZone?: string | null; currentRackId?: string | null; translations: Dict;
};

export default function RackPicker({ zones, value, onChange, preferZone, currentRackId, translations }: Props) {
  const usable = zones.filter(zone => zone.active);
  const [zone, setZone] = useState(() => (usable.find(zone => zone.code === preferZone) ?? usable[0])?.code ?? "");
  const current = usable.find(z => z.code === zone) ?? usable[0];
  if (!current) return null;
  return <div className="mt-2">
    <div className="flex gap-2 overflow-x-auto mb-3" role="tablist" aria-label={translations.rackAdmin.zone}>
      {usable.map(z => <button type="button" role="tab" key={z.code} aria-selected={z.code === current.code} onClick={() => setZone(z.code)} className={`shrink-0 min-h-11 px-4 rounded-md border border-line font-bold ${z.code === current.code ? "bg-ink text-surface" : "bg-surface text-ink"}`}>{translations.racks.zone(z.code)}</button>)}
    </div>
    <RackStructure racks={current.racks} translations={translations} selected={value} currentRackId={currentRackId} picker onPick={rack => onChange(rack.id, current.code)} />
  </div>;
}
