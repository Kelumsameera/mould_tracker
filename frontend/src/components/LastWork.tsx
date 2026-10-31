"use client";

import Icon, { workIcon } from "./Icon";

import { type Dict, type Lang } from "@/utils/i18n";
import { formatTime } from "@/utils/format";
import type { Mould } from "@/utils/types";

// "Last work: Repair by Nimal, Kasun, 21 Oct 14:05" - who did the work is always shown.
type Props = { mould: Mould; translations: Dict; lang: Lang };

export default function LastWork({ mould, translations, lang }: Props) {
  if (!mould.lastWork) return null;
  return (
    <div className="text-xs font-bold text-workshop-ink flex items-center gap-1.25">
      <Icon name={workIcon[mould.lastWork.type]} size={13} />
      {translations.work.last(translations.work.types[mould.lastWork.type], mould.lastWork.names.join(", "), formatTime(mould.lastWork.doneAt, lang))}
    </div>
  );
}
