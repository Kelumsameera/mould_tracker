'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
export type { ConfirmOptions } from '@/lib/confirmStore';
import { createConfirmStore, type ConfirmStore } from '@/lib/confirmStore';
import type { Dict } from '@/lib/i18n';

const ConfirmContext = createContext<ConfirmStore | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createConfirmStore);
  return <ConfirmContext.Provider value={store}>{children}</ConfirmContext.Provider>;
}

// const { confirm, ask } = useConfirm();  if (!(await confirm({ title, message, confirmText, tone }))) return;
export function useConfirm() {
  const store = useContext(ConfirmContext);
  if (!store) throw new Error('useConfirm needs <ConfirmProvider>');
  return { confirm: store.confirm, ask: store.ask };
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// The one dialog: bottom sheet on phones, centred on wider screens. Cancel left, Confirm right.
export function ConfirmHost({ t }: { t: Dict }) {
  const store = useContext(ConfirmContext)!;
  const dialog = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const closingByCode = useRef(false);

  useEffect(() => {
    if (!dialog) return;
    setText(dialog.options.initial ?? '');
    const restore = document.activeElement as HTMLElement | null;
    // The phone's back button closes the dialog instead of leaving the page.
    window.history.pushState({ confirmDialog: dialog.id }, '');
    const onPop = () => { closingByCode.current = true; store.cancel(); };
    window.addEventListener('popstate', onPop);
    // Focus: the text box if there is one, otherwise Cancel for dangerous actions, Confirm for the rest.
    requestAnimationFrame(() => {
      const el = box.current?.querySelector<HTMLElement>(dialog.options.typeToConfirm || dialog.kind === 'ask' ? 'input' : dialog.options.tone === 'danger' ? '.confirm-cancel' : '.confirm-ok');
      el?.focus();
    });
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!closingByCode.current && window.history.state?.confirmDialog === dialog.id) window.history.back();
      closingByCode.current = false;
      restore?.focus?.();
    };
  }, [dialog, store]);

  if (!dialog) return null;
  const o = dialog.options;
  const needsText = Boolean(o.typeToConfirm) || dialog.kind === 'ask';
  const ready = store.canAccept(text);

  function onKey(e: React.KeyboardEvent) {
    if (store.handleKey(e.key)) { e.preventDefault(); e.stopPropagation(); return; } // Esc closes only the dialog, not the sheet under it
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && ready) { e.preventDefault(); store.accept(text); return; }
    if (e.key !== 'Tab' || !box.current) return; // focus stays inside the dialog
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <div className="confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) store.cancel(); }}>
      <div ref={box} className={'confirm-box' + (o.tone === 'danger' ? ' danger' : '')} role="alertdialog" aria-modal="true"
        aria-labelledby={`confirm-title-${dialog.id}`} aria-describedby={`confirm-msg-${dialog.id}`} onKeyDown={onKey}>
        <h2 id={`confirm-title-${dialog.id}`} className="confirm-title">{o.title}</h2>
        <p id={`confirm-msg-${dialog.id}`} className="confirm-message">{o.message}</p>
        {o.note && <p className="confirm-note">{o.note}</p>}
        {needsText && (
          <>
            <label className="field-label" htmlFor={`confirm-input-${dialog.id}`}>{o.typeToConfirm ? (o.typeLabel ?? t.confirm.typeToConfirm(o.typeToConfirm)) : o.inputLabel}</label>
            <input id={`confirm-input-${dialog.id}`} className="field-input" autoComplete="off" maxLength={o.maxLength ?? 500} value={text}
              placeholder={o.typeToConfirm ?? ''} onChange={(e) => setText(e.target.value)} />
          </>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn btn-outline confirm-cancel" onClick={() => store.cancel()}>{o.cancelText ?? t.confirm.cancel}</button>
          <button type="button" className={'btn confirm-ok ' + (o.tone === 'danger' ? 'btn-danger' : 'btn-primary')} disabled={!ready} onClick={() => store.accept(text)}>{o.confirmText}</button>
        </div>
      </div>
    </div>
  );
}
