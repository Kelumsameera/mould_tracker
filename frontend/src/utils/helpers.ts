import type { Rack } from "@/utils/types";

export function rackTone(rack: Rack, currentRackId?: string | null) {
  const isCurrentRack = rack.id === currentRackId;
  const isAtCapacity = rack.capacity != null && rack.occupancy >= rack.capacity;

  if (isAtCapacity && !isCurrentRack) return "full";
  if (rack.occupancy > 0) return "used";
  return "empty";
}

// Rack tiles (rack view, rack picker, rack management): number on top, occupancy below.
export const RACK_TILE =
  "rounded-md border-[1.5px] border-solid border-line bg-surface min-h-14 px-1 py-1.5 flex flex-col items-center justify-center gap-px cursor-pointer text-ink [font:inherit] min-w-0 [transition:transform_var(--fast),box-shadow_var(--fast)] [&_b]:text-md [&_small]:text-[10.5px] [&_small]:text-ink-soft [&_small]:text-center [&_small]:leading-[1.25] [&_small]:max-w-full [&_small]:overflow-hidden [&_small]:text-ellipsis [&_small]:whitespace-nowrap disabled:opacity-45 disabled:border-dashed disabled:cursor-default";
export const RACK_TONE: Record<string, string> = {
  empty: "bg-good-bg! border-good-line!",
  used: "bg-room-bg! border-transparent!",
  full: "bg-amber-bg! border-amber-line!",
};
export const RACK_OFF = "opacity-45 border-dashed! cursor-default";
export const RACK_SELECTED = "border-action! shadow-focus scale-[1.03]";
// Small legend swatch.
export const RACK_MINI = "inline-block size-4 min-h-0! p-0! rounded-[5px]!";

// The Tool ID set like a stamped steel tag.
export const TOOL_ID_TAG = "font-sign font-bold text-[15px] tracking-[.5px] text-white bg-brand-2 dark:bg-[#e8edf1] dark:text-[#15212b] pt-0.5 pb-px px-2 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_0_-2px_0_rgba(0,0,0,.25)]";

// Text colour per location / filter tone.
export const TONE_TEXT: Record<string, string> = {
  MACHINE: "text-machine",
  PRODUCTION_FLOOR: "text-floor",
  MOULD_ROOM: "text-room",
  TOOL_ROOM: "text-room",
  WORKSHOP: "text-workshop",
  OUT_OF_SERVICE: "text-danger",
  attention: "text-warn",
  waiting: "text-ink-faint",
  problem: "text-danger",
};

// Status dot before the "Live / Offline" text.
export function syncDot(state: string) {
  const colour = state === "synced" ? "before:bg-[#3fbf7f]" : state === "offline" ? "before:bg-[#e5604f]" : "before:bg-brand-soft";
  return `before:content-[''] before:size-[7px] before:rounded-full before:shrink-0 ${colour}`;
}

// Tablet icon rail (Sidebar sets data-collapsed): hide text, centre icons. Desktop always shows the full sidebar.
export const RAIL_HIDE = "md:max-lg:group-data-[collapsed]/side:hidden";
export const RAIL_ITEM = "md:max-lg:group-data-[collapsed]/side:justify-center md:max-lg:group-data-[collapsed]/side:px-0";

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'mould-tracker-theme';
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  if (prefersDark) {
    return 'dark';
  }
  return 'light';
}

export const PAGE_PATHS = {
  find: "/find",
  extrusion: "/extrusion",
  racks: "/racks",
  workshop: "/workshop",
  workReport: "/work-report",
  rackAdmin: "/rack-admin",
  machines: "/machines",
  access: "/access",
  audit: "/audit",
  users: "/users",
  account: "/account",
  passkeys: "/passkeys",
} as const;

export type PageName = keyof typeof PAGE_PATHS;

export function getPageName(pathname: string): PageName {
  for (const name of Object.keys(PAGE_PATHS) as PageName[]) {
    if (PAGE_PATHS[name] === pathname) return name;
  }
  return "find";
}

// Keep bookmarks and QR links made before pages had their own URLs working.
export function getLegacyDestination(hash: string) {
  const linkParts = hash.split("/");
  const pageName = linkParts[1];
  const section = linkParts[2];
  const mouldId = linkParts[3];

  let page: PageName = "find";
  if (Object.hasOwn(PAGE_PATHS, pageName)) {
    page = pageName as PageName;
  }
  const path = PAGE_PATHS[page];
  if (section === "m" && mouldId) {
    return `${path}?mould=${encodeURIComponent(mouldId)}`;
  }
  return path;
}
