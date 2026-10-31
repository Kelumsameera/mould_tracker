"use client";

import Icon, { statusIcon } from "./Icon";

import { type Dict } from "@/utils/i18n";
import { statusTone } from "@/utils/format";
import type { MouldStatus } from "@/utils/types";

// Colour and icon together, never colour alone.
type Props = { status: MouldStatus; translations: Dict };

export default function StatusBadge({ status, translations }: Props) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] " +
        statusTone(status)
      }
    >
      <Icon name={statusIcon(status)} size={13} />
      {translations.status[status]}
    </span>
  );
}
