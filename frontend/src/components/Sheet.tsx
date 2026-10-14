'use client';
import { useEffect, type ReactNode } from 'react';

export default function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={'sheet-backdrop' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'sheet' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label={label} aria-hidden={!open}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <div className="sheet-handle" />
        {open && children}
      </div>
    </>
  );
}
