// One place for every icon, all from one family (Lucide via react-icons/lu, named imports only),
// so the same meaning always gets the same picture and a swap is one line.
import type { IconType } from "react-icons";
import {
  LuArchiveRestore,
  LuArrowRightLeft,
  LuBox,
  LuCamera,
  LuChartBar,
  LuCheck,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuClipboardList,
  LuClock,
  LuCog,
  LuDownload,
  LuEllipsis,
  LuFactory,
  LuFingerprint,
  LuFlag,
  LuHammer,
  LuHistory,
  LuImage,
  LuInbox,
  LuKeyRound,
  LuLanguages,
  LuLayoutGrid,
  LuLogOut,
  LuMapPin,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPencil,
  LuPlus,
  LuScrollText,
  LuSearch,
  LuSend,
  LuShieldCheck,
  LuSlidersHorizontal,
  LuSmartphone,
  LuTimer,
  LuTrash2,
  LuTriangleAlert,
  LuUser,
  LuUsers,
  LuWarehouse,
  LuWrench,
  LuX,
  LuSun,
  LuMoon,
} from "react-icons/lu";
import type { Location, MouldStatus, WorkType } from "@/utils/types";

export const ICONS = {
  sun: LuSun,
  moon: LuMoon,
  search: LuSearch,
  mould: LuBox,
  machine: LuCog,
  floor: LuFactory,
  workshop: LuWrench,
  mouldRoom: LuWarehouse,
  rack: LuLayoutGrid,
  good: LuCircleCheck,
  attention: LuTriangleAlert,
  busy: LuHammer,
  history: LuHistory,
  clock: LuClock,
  camera: LuCamera,
  image: LuImage,
  user: LuUser,
  users: LuUsers,
  language: LuLanguages,
  logout: LuLogOut,
  report: LuChartBar,
  export: LuDownload,
  add: LuPlus,
  edit: LuPencil,
  delete: LuTrash2,
  confirm: LuCheck,
  cancel: LuX,
  more: LuEllipsis,
  move: LuArrowRightLeft,
  audit: LuScrollText,
  worklog: LuClipboardList,
  passkey: LuFingerprint,
  password: LuKeyRound,
  install: LuSmartphone,
  location: LuMapPin,
  problem: LuFlag,
  error: LuCircleAlert,
  restore: LuArchiveRestore,
  filters: LuSlidersHorizontal,
  empty: LuInbox,
  shots: LuTimer,
  admin: LuShieldCheck,
  send: LuSend,
  chevron: LuChevronRight,
  railClose: LuPanelLeftClose,
  railOpen: LuPanelLeftOpen,
} satisfies Record<string, IconType>;

export type IconName = keyof typeof ICONS;

// Decorative by default (hidden from screen readers). Pass `label` when the icon stands alone.
type Props = {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
};

export default function Icon({ name, size = 18, label, className }: Props) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      className={
        "icon shrink-0 align-middle" +
        (className ? ` ${className}` : "")
      }
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
    />
  );
}

export const locationIcon: Record<Location, IconName> = {
  MACHINE: "machine",
  PRODUCTION_FLOOR: "floor",
  WORKSHOP: "workshop",
  OUT_OF_SERVICE: "attention",
  MOULD_ROOM: "mouldRoom",
  TOOL_ROOM: "mouldRoom",
};
export const statusIcon = (s: MouldStatus): IconName =>
  s === "GOOD" ? "good" : s.startsWith("IN_") ? "busy" : "attention";
export const workIcon: Record<WorkType, IconName> = {
  REPAIR: "workshop",
  SERVICE: "shots",
  MINOR_FIX: "edit",
  INSPECTION: "search",
  CLEANING: "confirm",
  OTHER: "worklog",
};
