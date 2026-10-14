"use client";
import { useEffect } from "react";
import { I18N, type Lang } from "@/lib/i18n";
import type { User } from "@/lib/types";
import Image from "next/image";
import { passkeyText } from '@/lib/passkeyText';
import { PwaInstallButton } from './PwaProvider';

export type NavFilter = null | "store" | "machine" | "taken" | "overdue";
type Counts = { store: number; machine: number; taken: number; overdue: number };

export default function Sidebar({
  open,
  lang,
  user,
  filter,
  counts,
  total,
  sync,
  syncText,
  onFilter,
  onLang,
  onPassword,
  onPasskeys,
  onUsers,
  onLogout,
  onClose,
}: {
  open: boolean;
  lang: Lang;
  user: User;
  filter: NavFilter;
  counts: Counts;
  total: number;
  sync: string;
  syncText: string;
  onFilter: (f: NavFilter) => void;
  onLang: (l: Lang) => void;
  onPassword: () => void;
  onPasskeys: () => void;
  onUsers: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const t = I18N[lang];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items: { key: NavFilter; label: string; n: number; dot: string }[] = [
    { key: null, label: t.allTools, n: total, dot: "all" },
    { key: "store", label: t.statStore, n: counts.store, dot: "store" },
    { key: "machine", label: t.statMachine, n: counts.machine, dot: "machine" },
    { key: "taken", label: t.statTaken, n: counts.taken, dot: "taken" },
    { key: "overdue", label: t.statOverdue, n: counts.overdue, dot: "overdue" },
  ];
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <>
      <div className={"nav-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"sidebar" + (open ? " open" : "")} aria-label="Navigation">
        <div className="side-brand">
          <Image className="brand-icon" src="/logo.svg" alt="" width={32} height={32} />
          <div>
            <div className="brand-title">{t.brandTitle}</div>
            <div className={"brand-sub sync " + sync}>{syncText}</div>
          </div>
          <button className="side-close" onClick={onClose} aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="side-nav">
          {items.map((it) => (
            <button key={it.dot} className={"side-item" + (filter === it.key ? " active" : "")} aria-current={filter === it.key ? "page" : undefined} onClick={act(() => onFilter(it.key))}>
              <span className={"stat-dot " + it.dot} />
              <span>{it.label}</span>
              <span className="side-count">{it.n}</span>
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <div className="lang-toggle dark side-lang">
            <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")}>
              EN
            </button>
            <button className={"lang-btn" + (lang === "si" ? " active" : "")} onClick={() => onLang("si")}>
              සිං
            </button>
          </div>
          <button className="side-link" onClick={act(onPassword)}>
            {t.changePassword}
          </button>
          <button className="side-link" onClick={act(onPasskeys)}>{passkeyText(lang).title}</button>
          <PwaInstallButton lang={lang} />
          {user.role === "admin" && (
            <button className="side-link" onClick={act(onUsers)}>
              {t.users}
            </button>
          )}
          <button className="side-link" onClick={act(onLogout)}>
            {t.signOut}
          </button>
        </div>
      </aside>
    </>
  );
}
