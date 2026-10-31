"use client";

import Icon, { locationIcon } from "./Icon";

import { locationName, type Dict } from "@/utils/i18n";

import type { Mould } from "@/utils/types";

// Where the mould is: place icon + name, then zone and rack (or machine) as chips.
type Props = {
  mould: Pick<Mould, "location" | "machine" | "rack" | "status">;
  translations: Dict;
  big?: boolean;
  compact?: boolean;
};

// Text colour and icon tile per location.
const LOC_TONE: Record<string, { text: string; icon: string }> = {
  MACHINE: { text: "text-machine-ink", icon: "bg-machine-bg text-machine" },
  PRODUCTION_FLOOR: { text: "text-floor-ink", icon: "bg-floor-bg text-floor" },
  MOULD_ROOM: { text: "text-room-ink", icon: "bg-room-bg text-room" },
  TOOL_ROOM: { text: "text-room-ink", icon: "bg-room-bg text-room" },
  WORKSHOP: { text: "text-workshop-ink", icon: "bg-workshop-bg text-workshop" },
  OUT_OF_SERVICE: { text: "text-danger", icon: "" },
};

export default function LocationLine({ mould, translations, big = false, compact = false }: Props) {
  const tone = LOC_TONE[mould.location] ?? { text: "", icon: "" };
  const size = big ? "text-xl" : compact ? "text-sm" : "text-md";
  const icon = big ? "size-10 rounded-md" : compact ? "size-[22px] rounded-sm" : "size-7 rounded-sm";
  const chip = "inline-flex items-center rounded-sm [border:1.5px_solid_currentColor] leading-normal " + (big ? "text-md px-2.5 py-0.5" : "text-sm p-[1px_8px]");
  const softChip = chip + " font-bold border-dashed! normal-case opacity-85";
  return (
    <div className={"flex items-center gap-1.5 flex-wrap font-black uppercase tracking-[.2px] leading-[1.3] si:normal-case si:tracking-normal " + size + " " + tone.text}>
      <span className={"inline-flex items-center justify-center " + icon + " " + tone.icon}>
        <Icon name={locationIcon[mould.location]} size={big ? 22 : 16} />
      </span>
      <span>{locationName(mould.location, translations)}</span>
      {mould.location === "MOULD_ROOM" &&
        (mould.rack ? (
          <>
            <span className={chip + " font-black"}>{mould.rack.zone}</span>
            <span className={chip + " font-black"}>{mould.rack.code}</span>
          </>
        ) : (
          <span className={softChip}>{translations.card.noRack}</span>
        ))}
      {mould.location === "MACHINE" && mould.machine && <span className={chip + " font-black"}>{mould.machine.code}</span>}
      {mould.location === "WORKSHOP" && mould.status !== "GOOD" && <span className={softChip}>{translations.status[mould.status]}</span>}
    </div>
  );
}
