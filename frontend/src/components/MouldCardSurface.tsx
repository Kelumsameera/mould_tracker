"use client";
import type { ReactNode } from "react";
import Icon from "./Icon";
import { assetUrl } from "@/utils/api";

export default function MouldCardSurface({ id, toolId, thumbUrl, onOpen, children }: {
  id: string; toolId: string; thumbUrl?: string | null; onOpen: (id: string) => void; children: ReactNode;
}) {
  return <div
    className="min-w-0 bg-surface rounded-lg px-3 py-2 flex items-start gap-2 border border-solid border-line shadow-card cursor-pointer relative overflow-hidden [transition:transform_var(--fast),border-color_var(--fast),box-shadow_var(--fast)] active:scale-[.985] [@media(hover:hover)]:hover:border-line-strong [@media(hover:hover)]:hover:shadow-panel [@media(hover:hover)]:hover:-translate-y-px"
    role="button" tabIndex={0} aria-label={toolId} onClick={() => onOpen(id)}
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(id); } }}
  >
    <div className="w-13 aspect-square rounded-sm bg-white dark:bg-surface-2 dark:has-[img]:bg-white shrink-0 flex items-center justify-center overflow-hidden border border-solid border-line text-ink-faint">
      {thumbUrl ? <img src={assetUrl(thumbUrl)} alt="" loading="lazy" decoding="async" className="size-full object-contain" width={72} height={72} onError={event => { event.currentTarget.style.display = "none"; }} /> : <Icon name="mould" size={26} />}
    </div>
    {children}
  </div>;
}
