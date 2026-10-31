import type { Location, MachineRef, Mould } from "./types";

export type MachineLayoutGroup = {
  key: string;
  machine: MachineRef | null;
  location: Location;
  moulds: Mould[];
};

const numericOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const locationOrder: Location[] = ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP", "OUT_OF_SERVICE"];
const isInjection = (code: string) => /^INJ(?:[-_\s]*\d)/i.test(code);

// Use the current mounting, never capableMachines: every mould appears exactly once.
export function groupMouldsByMachine(moulds: Mould[]): MachineLayoutGroup[] {
  const groups = new Map<string, MachineLayoutGroup>();
  for (const mould of moulds) {
    const machine = mould.location === "MACHINE" && mould.machine?.code ? mould.machine : null;
    const key = machine ? `machine:${machine.id}` : `location:${mould.location}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, machine, location: mould.location, moulds: [] };
      groups.set(key, group);
    }
    group.moulds.push(mould);
  }
  for (const group of groups.values()) {
    group.moulds.sort((a, b) => numericOrder.compare(a.toolId, b.toolId) || numericOrder.compare(a.id, b.id));
  }
  return [...groups.values()].sort((a, b) => {
    if (a.machine && b.machine) {
      return Number(isInjection(b.machine.code)) - Number(isInjection(a.machine.code)) ||
        numericOrder.compare(a.machine.code, b.machine.code) || numericOrder.compare(a.key, b.key);
    }
    if (a.machine) return -1;
    if (b.machine) return 1;
    return locationOrder.indexOf(a.location) - locationOrder.indexOf(b.location);
  });
}
