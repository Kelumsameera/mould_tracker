"use client";

import Highlight from "@/components/Highlight";
import AlertBadges, { hasAlertBadges } from "@/components/AlertBadges";
import Icon from "./Icon";
import MouldCardSurface from "./MouldCardSurface";
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
  query?: string; // current search, for highlighting
};

export default function MouldCard({ mould, translations, lang, onOpen, query }: Props) {
  const what = mould.itemIds?.slice(0, 3).join(", ") ?? "";
  return (
    <MouldCardSurface id={mould.id} toolId={mould.toolId} thumbUrl={mould.thumbUrl} onOpen={onOpen}>
      <div className="flex-1 min-w-0 flex flex-col gap-0.75">
        <div className="flex items-center gap-2 flex-wrap pr-1">
          <span className={TOOL_ID_TAG}><Highlight text={mould.toolId} query={query} /></span>
          <StatusBadge status={mould.status} translations={translations} />
        </div>
        <LocationLine mould={mould} translations={translations} compact />
        {mould.matchedItem && (
          <div className="text-xs text-ink overflow-hidden text-ellipsis whitespace-nowrap">
            {translations.search.matchedItem}: <b><Highlight text={mould.matchedItem.itemId} query={query} /></b> – <Highlight text={mould.matchedItem.description} query={query} />
          </div>
        )}
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
        {(mould.openProblem || mould.serviceDue || mould.serviceSoon || hasAlertBadges(mould)) && (
          <div className="flex gap-1.5 flex-wrap">
            <AlertBadges mould={mould} translations={translations} />
            {mould.openProblem && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-danger text-white"
                title={mould.openProblem.text}
              >
                <Icon name="problem" size={12} />
                {translations.problem.badge}
              </span>
            )}
            {mould.serviceSoon && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-surface-2 text-warn-ink">
                <Icon name="shots" size={12} />
                {translations.card.shotsSoon}
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
    </MouldCardSurface>
  );
}
