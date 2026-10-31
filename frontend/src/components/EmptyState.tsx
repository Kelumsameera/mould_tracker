"use client";

import Icon, { type IconName } from "./Icon";

type Props = {
  icon?: IconName;
  text: string;
};

export default function EmptyState({ icon = "empty", text }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 text-center px-5 py-8 text-ink-soft">
      <span className="size-14 rounded-full bg-surface-3 flex items-center justify-center text-ink-faint">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-md m-0 max-w-105">{text}</p>
    </div>
  );
}
