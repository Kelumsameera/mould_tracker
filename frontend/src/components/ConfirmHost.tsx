"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
export type { ConfirmOptions } from "@/utils/confirmStore";
import { createConfirmStore, type ConfirmStore } from "@/utils/confirmStore";
import type { Dict } from "@/utils/i18n";

const ConfirmContext = createContext<ConfirmStore | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createConfirmStore);
  return <ConfirmContext.Provider value={store}>{children}</ConfirmContext.Provider>;
}

// const { confirm, ask } = useConfirm();  if (!(await confirm({ title, message, confirmText, tone }))) return;
export function useConfirm() {
  const store = useContext(ConfirmContext);
  if (!store) throw new Error("useConfirm needs <ConfirmProvider>");
  return { confirm: store.confirm, ask: store.ask };
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// The one dialog: bottom sheet on phones, centred on wider screens. Cancel left, Confirm right.
export function ConfirmHost({ translations }: { translations: Dict }) {
  const store = useContext(ConfirmContext)!;
  const dialog = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const closingByCode = useRef(false);

  useEffect(() => {
    if (!dialog) return;
    setText(dialog.options.initial ?? "");
    const restore = document.activeElement as HTMLElement | null;
    // The phone's back button closes the dialog instead of leaving the page.
    window.history.pushState({ confirmDialog: dialog.id }, "");
    const onPop = () => {
      closingByCode.current = true;
      store.cancel();
    };
    window.addEventListener("popstate", onPop);
    // Focus: the text box if there is one, otherwise Cancel for dangerous actions, Confirm for the rest.
    requestAnimationFrame(() => {
      const el = box.current?.querySelector<HTMLElement>(dialog.options.typeToConfirm || dialog.kind === "ask" ? "input" : dialog.options.tone === "danger" ? ".confirm-cancel" : ".confirm-ok");
      el?.focus();
    });
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closingByCode.current && window.history.state?.confirmDialog === dialog.id) window.history.back();
      closingByCode.current = false;
      restore?.focus?.();
    };
  }, [dialog, store]);

  if (!dialog) return null;
  const o = dialog.options;
  const needsText = Boolean(o.typeToConfirm) || dialog.kind === "ask";
  const ready = store.canAccept(text);

  function onKey(event: React.KeyboardEvent) {
    if (store.handleKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    } // Esc closes only the dialog, not the sheet under it
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT" && ready) {
      event.preventDefault();
      store.accept(text);
      return;
    }
    if (event.key !== "Tab" || !box.current) return; // focus stays inside the dialog
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-scrim z-80 flex items-end justify-center min-[600px]:items-center min-[600px]:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) store.cancel();
      }}
    >
      <div
        ref={box}
        className={
          "w-full max-w-130 bg-surface rounded-[var(--r-xl)_var(--r-xl)_0_0] p-[var(--s5)_var(--s5)_calc(var(--s5)+var(--safe-b))] shadow-panel max-h-[90dvh] overflow-y-auto min-[600px]:rounded-xl min-[600px]:p-6 motion-safe:animate-rise" +
          (o.tone === "danger" ? " [border-top:5px_solid_var(--danger)]" : "")
        }
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`confirm-title-${dialog.id}`}
        aria-describedby={`confirm-msg-${dialog.id}`}
        onKeyDown={onKey}
      >
        <h2 id={`confirm-title-${dialog.id}`} className={"text-lg m-0 mb-2 flex items-center gap-2" + (o.tone === "danger" ? " text-danger-ink" : "")}>
          {o.title}
        </h2>
        <p id={`confirm-msg-${dialog.id}`} className="text-md m-0 font-semibold [word-break:break-word]">
          {o.message}
        </p>
        {o.note && <p className={"text-sm mx-0 mt-2 mb-0 " + (o.tone === "danger" ? "text-danger-ink font-bold" : "text-ink-soft")}>{o.note}</p>}
        {needsText && (
          <>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor={`confirm-input-${dialog.id}`}>
              {o.typeToConfirm ? (o.typeLabel ?? translations.confirm.typeToConfirm(o.typeToConfirm)) : o.inputLabel}
            </label>
            <input
              id={`confirm-input-${dialog.id}`}
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
              autoComplete="off"
              maxLength={o.maxLength ?? 500}
              value={text}
              placeholder={o.typeToConfirm ?? ""}
              onChange={(event) => setText(event.target.value)}
            />
          </>
        )}
        <div className="grid grid-cols-[1fr_1fr] gap-3 mt-5 [&>button]:mt-0 [&>button]:min-h-13">
          <button
            type="button"
            className="w-full min-h-12 px-4 py-3 rounded-md text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line confirm-cancel tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
            onClick={() => store.cancel()}
          >
            {o.cancelText ?? translations.confirm.cancel}
          </button>
          <button
            type="button"
            className={
              "w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] confirm-ok tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 " +
              (o.tone === "danger" ? "bg-danger text-white" : "bg-action text-white active:bg-action-dark")
            }
            disabled={!ready}
            onClick={() => store.accept(text)}
          >
            {o.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
