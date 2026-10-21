'use client';
import { useEffect, type ReactNode } from 'react';
import Icon from './Icon';

// Bottom sheet on phones, wide modal on tablets, side panel on desktop (see globals.css). Esc closes it.
export default function Sheet({ open, onClose, children, label, closeLabel = 'Close' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; closeLabel?: string }) {
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
        <button className="sheet-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}><Icon name="cancel" size={20} /></button>
        <div className="sheet-handle" />
        {open && children}
      </div>
    </>
  );
}
