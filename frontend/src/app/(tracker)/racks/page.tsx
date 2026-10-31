"use client";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";

import { useEffect, useCallback, useMemo, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import Icon from "@/components/Icon";

import { api } from "@/utils/api";
import { type Dict } from "@/utils/i18n";
import { errorText } from "@/utils/format";
import { type Rack, type Zone } from "@/utils/types";

import { RACK_MINI, RACK_OFF, RACK_SELECTED, RACK_TILE, RACK_TONE, rackTone } from "@/utils/helpers";

export default function RacksPage() {
  const { translations, openMould: onOpen, refreshKey } = useApp();

  // Screen state
  const [zones, setZones] = useState<Zone[]>([]);
  const [awaitingRackMoulds, setAwaitingRackMoulds] = useState<
    { id: string; toolId: string }[]
  >([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadRacks = useCallback(async () => {
    try {
      const response = await api.racks();
      setZones(response.zones);
      setAwaitingRackMoulds(response.awaitingRack);
      setHasLoaded(true);
    } catch (error) {
      toast.error(errorText(error, translations));
    }
  }, [translations, toast]);
  // Effects: load data and update the screen
  useEffect(() => {
    loadRacks();
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadRacks();
      }
    }, 10_000);
    return () => clearInterval(refreshTimer);
  }, [loadRacks, refreshKey]);

  let visibleZones = zones;
  if (selectedZone !== "") {
    visibleZones = zones.filter((zone) => zone.code === selectedZone);
  }
  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <div className="flex gap-2 overflow-x-auto [padding:2px_2px_var(--s1)] mb-3 [scrollbar-width:none] max-w-full [&::-webkit-scrollbar]:hidden">
        <button
          className={
            "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
            (!selectedZone ? " bg-ink! border-ink! text-surface!" : "")
          }
          aria-pressed={!selectedZone}
          onClick={() => setSelectedZone("")}
        >
          <Icon name="rack" size={15} />
          {translations.racks.all}
        </button>
        {zones.map((zone) => (
          <button
            key={zone.code}
            className={
              "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
              (selectedZone === zone.code ? " bg-ink! border-ink! text-surface!" : "")
            }
            aria-pressed={selectedZone === zone.code}
            onClick={() => setSelectedZone(zone.code)}
          >
            <Icon name="mouldRoom" size={15} />
            {translations.racks.zone(zone.code)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-ink-soft mb-3 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5">
        <span>
          <span className={RACK_TILE + " " + RACK_TONE.empty + " " + RACK_MINI} />
          {translations.racks.legendEmpty}
        </span>
        <span>
          <span className={RACK_TILE + " " + RACK_TONE.used + " " + RACK_MINI} />
          {translations.racks.legendUsed}
        </span>
        <span>
          <span className={RACK_TILE + " " + RACK_TONE.full + " " + RACK_MINI} />
          {translations.racks.legendFull}
        </span>
      </div>
      {!hasLoaded && (
        <div
          className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-lg h-[220px]"
          role="status"
          aria-label={translations.loading}
        />
      )}
      {visibleZones.map((zone) => (
        <section key={zone.code} className="mb-6">
          <h2 className="text-lg font-extrabold mx-1 mt-2 mb-3 flex items-center gap-2 flex-wrap">
            <Icon name="mouldRoom" size={20} />
            {translations.mouldRoom} · {translations.racks.zone(zone.code)}
            {!zone.active && (
              <small className="text-ink-soft">
                {" "}
                ({translations.racks.inactive})
              </small>
            )}
          </h2>
          <RackRows
            racks={zone.racks}
            translations={translations}
            onPick={setSelectedRack}
            selected={selectedRack?.id}
          />
        </section>
      ))}
      {selectedRack && (
        <div className="sticky [bottom:calc(var(--nav-h)_+_var(--safe-b)_+_var(--s3))] md:bottom-4 bg-surface border-[1.5px] border-solid border-action rounded-lg p-3 mx-0 mt-3 mb-5 shadow-panel z-5">
          <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
            <Icon name="rack" size={14} />
            {translations.racks.mouldsOn(selectedRack.locationId)}
          </div>
          {!selectedRack.moulds.length ? (
            <p className="text-ink-soft">{translations.racks.noMoulds}</p>
          ) : (
            selectedRack.moulds.map((mould) => (
              <button
                key={mould.id}
                className="flex items-center gap-3 justify-between w-full border-0 [border-bottom:1px_solid_var(--line)] last:border-b-0 bg-transparent min-h-[52px] [font:inherit] text-md cursor-pointer text-ink"
                onClick={() => onOpen(mould.id)}
              >
                <b>{mould.toolId}</b>
                <StatusBadge status={mould.status} translations={translations} />
              </button>
            ))
          )}
        </div>
      )}
      {awaitingRackMoulds.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-extrabold mx-1 mt-2 mb-3 flex items-center gap-2 flex-wrap">
            <Icon name="clock" size={20} />
            {translations.racks.waiting}{" "}
            <span className="inline-block bg-surface border border-solid border-line [padding:1px_8px] rounded-sm text-xs">
              {awaitingRackMoulds.length}
            </span>
          </h2>
          <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
            {translations.racks.waitingHint}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {awaitingRackMoulds.map((mould) => (
              <button
                key={mould.id}
                className="inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint"
                onClick={() => onOpen(mould.id)}
              >
                {mould.toolId}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function RackRows({
  racks,
  translations,
  onPick,
  selected,
}: {
  racks: Rack[];
  translations: Dict;
  onPick: (rack: Rack) => void;
  selected?: string;
}) {
  const rows = useMemo(() => {
    const racksByRow = new Map<string, Rack[]>();
    for (const rack of racks) {
      const rowRacks = racksByRow.get(rack.row) ?? [];
      rowRacks.push(rack);
      racksByRow.set(rack.row, rowRacks);
    }
    return [...racksByRow.entries()];
  }, [racks]);

  function getRackSummary(rack: Rack) {
    if (!rack.active) return translations.racks.inactive;
    if (rack.occupancy === 0) return translations.racks.empty;

    const mouldIds = rack.moulds.slice(0, 2).map((mould) => mould.toolId);
    let summary = mouldIds.join(" ");
    if (rack.occupancy > 2) summary += ` +${rack.occupancy - 2}`;
    return summary;
  }
  return (
    <>
      {rows.map(([row, rowRacks]) => (
        <div className="flex gap-2 items-start mb-2" key={row}>
          <div className="w-7 shrink-0 font-black text-ink-faint min-h-14 flex items-center justify-center text-lg">
            {row}
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-5 xl:grid-cols-10 gap-1.5">
            {rowRacks.map((rack) => (
              <button
                key={rack.id}
                className={
                  RACK_TILE + " " +
                  RACK_TONE[rackTone(rack)] +
                  (rack.active ? "" : " " + RACK_OFF) +
                  (selected === rack.id ? " " + RACK_SELECTED : "")
                }
                aria-pressed={selected === rack.id}
                aria-label={`${rack.locationId} · ${rack.occupancy}`}
                onClick={() => onPick(rack)}
              >
                <b>{rack.code}</b>
                <small>{getRackSummary(rack)}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
