"use client";
import { useEffect, type ReactNode } from "react";
import Icon from "./Icon";

// Bottom sheet on phones, wide modal on tablets, side panel on desktop (see globals.css). Esc closes it.
type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  closeLabel?: string;
};

export default function Sheet({
  open,
  onClose,
  children,
  label,
  closeLabel = "Close",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={
          "fixed inset-0 bg-scrim lg:bg-[rgba(15,25,35,.25)] z-40 [transition:opacity_var(--med)] " +
          (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
      />
      <div
        className={
          "fixed left-0 right-0 bottom-0 [max-height:calc(100dvh_-_var(--safe-t)_-_12px)] [height:calc(100dvh_-_var(--safe-t)_-_12px)] bg-surface [border-radius:var(--r-xl)_var(--r-xl)_0_0] z-41 [padding:var(--s2)_calc(var(--s4)_+_var(--safe-r))_calc(var(--s4)_+_var(--safe-b))_calc(var(--s4)_+_var(--safe-l))] overflow-y-auto [overscroll-behavior:contain] shadow-[0_-8px_40px_rgba(12,20,25,.25)] [transition:transform_var(--med)_var(--ease),visibility_0s_linear_var(--med)] " +
          // Phone: bottom sheet. Tablet: centred modal. Desktop: side panel beside the list.
          "md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-[min(680px,92vw)] md:h-auto md:max-h-[88dvh] md:rounded-xl md:p-6 md:shadow-[0_24px_60px_rgba(12,20,25,.3)] md:[transition:transform_var(--med)_var(--ease),opacity_var(--fast),visibility_0s_linear_var(--med)] " +
          "lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[min(600px,46vw)] lg:max-h-none lg:h-dvh lg:rounded-[var(--r-xl)_0_0_var(--r-xl)] lg:p-[var(--s6)_var(--s6)_var(--s8)] " +
          (open
            ? "[transform:none] visible [transition-delay:0s]! md:[transform:translate(-50%,-50%)] md:opacity-100 lg:[transform:none]"
            : "[transform:translateY(100%)] invisible md:[transform:translate(-50%,-46%)_scale(.98)] md:opacity-0 lg:[transform:translateX(100%)] lg:opacity-100")
        }
        data-sheet=""
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
      >
        <button
          className="sticky top-0 [float:right] z-3 w-tap h-tap bg-surface-3 border-0 rounded-md flex items-center justify-center text-ink-soft cursor-pointer [margin:-4px_-4px_0_var(--s2)]"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon name="cancel" size={20} />
        </button>
        <div className="md:hidden w-10 [height:5px] bg-line-strong rounded-[3px] [margin:var(--s1)_auto_var(--s4)]" />
        {open && children}
      </div>
    </>
  );
}
