"use client";
import Icon from "@/components/Icon";
import { since } from "@/utils/format";
import type { Dict } from "@/utils/i18n";
import type { AlertLevel, Mould } from "@/utils/types";

const TONE: Record<"amber" | "red", string> = {
  amber: "bg-warn-bg text-warn-ink",
  red: "bg-danger text-white",
};
const badge = "inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6]";

// Never-silent badges shared by cards, the detail sheet and machine lists.
export function hasAlertBadges(mould: Mould) {
  return Boolean(mould.isolation?.level || mould.blockedCavities?.length);
}

export default function AlertBadges({ mould, translations: t }: { mould: Mould; translations: Dict }) {
  const isolationLevel: AlertLevel = mould.isolation?.level ?? null;
  const blocked = mould.blockedCavities?.length ?? 0;
  const total = mould.totalCavities ?? 0;
  return (
    <>
      {isolationLevel && (
        <span className={`${badge} ${TONE[isolationLevel]}`} title={t.isolation.tooLong}>
          <Icon name="clock" size={12} />
          {t.isolation.tooLong} · {since(mould.isolation!.since, t)}
        </span>
      )}
      {blocked > 0 && (
        <span className={`${badge} ${TONE[mould.limitedRun?.level ?? "amber"]}`} title={mould.limitedRun?.reason}>
          <Icon name="attention" size={12} />
          {t.cavity.badge(Math.max(0, total - blocked), total, mould.limitedRun ? since(mould.limitedRun.since, t) : "")}
        </span>
      )}
    </>
  );
}
