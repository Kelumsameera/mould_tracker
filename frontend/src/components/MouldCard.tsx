"use client";

import Icon from "./Icon";
import { assetUrl } from "@/utils/api";
import { type Dict, type Lang } from "@/utils/i18n";
import { relativeTime } from "@/utils/format";
import type { Mould } from "@/utils/types";
import StatusBadge from "./StatusBadge";
import LocationLine from "./LocationLine";
import LastWork from "./LastWork";
import { TOOL_ID_TAG } from "@/utils/helpers";
// One search result / list row: picture, Tool ID + status, the location line, what it makes, last move/work.
type Props = {
  mould: Mould;
  translations: Dict;
  lang: Lang;
  onOpen: (id: string) => void;
};

export default function MouldCard({ mould, translations, lang, onOpen }: Props) {
  const what = mould.itemIds?.slice(0, 3).join(", ") ?? "";
  return (
    <div
      className="min-w-0 bg-surface rounded-lg px-3 py-2 flex items-start gap-2 border border-solid border-line shadow-card cursor-pointer relative overflow-hidden [transition:transform_var(--fast),border-color_var(--fast),box-shadow_var(--fast)] active:scale-[.985] [@media(hover:hover)]:hover:border-line-strong [@media(hover:hover)]:hover:shadow-panel [@media(hover:hover)]:hover:-translate-y-px"
      role="button"
      tabIndex={0}
      aria-label={mould.toolId}
      onClick={() => onOpen(mould.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(mould.id);
        }
      }}
    >
      <div className="w-13 aspect-square rounded-sm bg-white dark:bg-surface-2 dark:has-[img]:bg-white shrink-0 flex items-center justify-center overflow-hidden border border-solid border-line text-ink-faint">
        {mould.thumbUrl ? <img src={assetUrl(mould.thumbUrl)} alt="" loading="lazy" decoding="async" className="size-full object-contain" width={72} height={72} /> : <Icon name="mould" size={26} />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.75">
        <div className="flex items-center gap-2 flex-wrap pr-1">
          <span className={TOOL_ID_TAG}>{mould.toolId}</span>
          <StatusBadge status={mould.status} translations={translations} />
        </div>
        <LocationLine mould={mould} translations={translations} compact />
        {what && (
          <div className="text-xs text-ink-soft overflow-hidden text-ellipsis whitespace-nowrap">
            {what}
            {(mould.itemCount ?? 0) > 3 ? " …" : ""}
          </div>
        )}
        {mould.lastMovedAt && (
          <div className="text-xs text-ink-faint flex items-center gap-1.25">
            <Icon name="clock" size={13} />
            {translations.card.moved(relativeTime(mould.lastMovedAt, lang), mould.lastMovedBy?.name ?? "")}
          </div>
        )}
        <LastWork mould={mould} translations={translations} lang={lang} />
        {(mould.openProblem || mould.serviceDue) && (
          <div className="flex gap-1.5 flex-wrap">
            {mould.openProblem && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-danger text-white"
                title={mould.openProblem.text}
              >
                <Icon name="problem" size={12} />
                {translations.problem.badge}
              </span>
            )}
            {mould.serviceDue && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-warn-bg text-warn-ink">
                <Icon name="shots" size={12} />
                {translations.card.shotsDue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
