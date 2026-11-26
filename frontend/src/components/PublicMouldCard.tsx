"use client";
import { publicImagePath, type PublicMould } from "@/utils/api";
import { I18N, type Lang } from "@/utils/i18n";
import { TOOL_ID_TAG, TONE_TEXT } from "@/utils/helpers";
import Highlight from "./Highlight";
import Icon, { iconForLocation } from "./Icon";
import MouldCardSurface from "./MouldCardSurface";
import StatusBadge from "./StatusBadge";

export default function PublicMouldCard({ mould, lang, query, onOpen }: {
  mould: PublicMould; lang: Lang; query: string; onOpen: (id: string) => void;
}) {
  return <MouldCardSurface id={mould.id} toolId={mould.toolId} thumbUrl={mould.hasImage ? publicImagePath(mould.id) : null} onOpen={onOpen}>
    <div className="flex-1 min-w-0 flex flex-col gap-0.75">
      <div className="flex items-center gap-2 flex-wrap pr-1">
        <span className={TOOL_ID_TAG}><Highlight text={mould.toolId} query={query} /></span>
        <StatusBadge status={mould.status} translations={{ ...I18N[lang], status: { ...I18N[lang].status, [mould.status]: mould.statusLabels[lang] } }} />
      </div>
      <div className={"flex items-center gap-1.5 flex-wrap font-black uppercase text-sm leading-[1.3] si:normal-case " + (TONE_TEXT[mould.locationKey] ?? "text-ink")}>
        <Icon name={iconForLocation(mould.locationKey)} size={16} />
        <span>{mould.location[lang]}</span>
        {[mould.machine, mould.rack].filter(Boolean).map(value => <span key={value} className="inline-flex rounded-sm border-[1.5px] border-solid border-current px-2 py-px">{value}</span>)}
      </div>
    </div>
  </MouldCardSurface>;
}
