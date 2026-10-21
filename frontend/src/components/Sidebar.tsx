"use client";
import { useEffect } from "react";
import Image from "next/image";
import type { Dict, Lang } from "@/lib/i18n";
import type { User } from "@/lib/types";
import { can } from "@/lib/permissions";
import { passkeyText } from "@/lib/passkeyText";
import { PwaInstallButton } from "./PwaProvider";

export type View = "find" | "racks" | "workshop" | "workReport" | "rackAdmin" | "audit";

export default function Sidebar({ open, t, lang, user, view, sync, syncText, onView, onLang, onAccount, onPasskeys, onUsers, onLogout, onClose }: {
  open: boolean; t: Dict; lang: Lang; user: User; view: View; sync: string; syncText: string;
  onView: (v: View) => void; onLang: (l: Lang) => void; onAccount: () => void; onPasskeys: () => void; onUsers: () => void; onLogout: () => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const act = (fn: () => void) => () => { fn(); onClose(); };
  const main: { key: View; label: string }[] = [
    { key: "find", label: t.nav.find },
    { key: "racks", label: t.nav.racks },
    { key: "workshop", label: t.nav.workshop }
  ];
  const admin: { key: View | "users"; label: string }[] = [
    ...(can(user, "users.manage") ? [{ key: "users" as const, label: t.nav.users }] : []),
    ...(can(user, "worklog.report") ? [{ key: "workReport" as const, label: t.nav.workReport }] : []),
    ...(can(user, "racks.manage") || can(user, "moulds.manage") ? [{ key: "rackAdmin" as const, label: t.nav.rackAdmin }] : []),
    ...(can(user, "audit.view") ? [{ key: "audit" as const, label: t.nav.audit }] : [])
  ];
  const item = (key: View | "users", label: string) => (
    <button key={key} className={"side-item" + (view === key ? " active" : "")} aria-current={view === key ? "page" : undefined}
      onClick={act(() => (key === "users" ? onUsers() : onView(key)))}>
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <div className={"nav-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"sidebar" + (open ? " open" : "")} aria-label={t.nav.menu}>
        <div className="side-brand">
          <Image className="brand-icon" src="/logo.svg" alt="" width={32} height={32} />
          <div>
            <div className="brand-title">{t.brandTitle}</div>
            <div className={"brand-sub sync " + sync}>{syncText}</div>
          </div>
          <button className="side-close" onClick={onClose} aria-label={t.nav.closeMenu}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <nav className="side-nav">
          {main.map((m) => item(m.key, m.label))}
          {admin.length > 0 && <div className="side-heading">{can(user, "racks.manage") ? t.nav.superAdmin : t.nav.admin}</div>}
          {admin.map((m) => item(m.key, m.label))}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <strong>{user.name}</strong>
            <small>{t.roles[user.role] ?? user.role}</small>
          </div>
          <div className="lang-toggle dark side-lang">
            <button className={"lang-btn" + (lang === "en" ? " active" : "")} onClick={() => onLang("en")}>EN</button>
            <button className={"lang-btn" + (lang === "si" ? " active" : "")} onClick={() => onLang("si")}>සිං</button>
          </div>
          <button className="side-link" onClick={act(onAccount)}>{t.nav.account}</button>
          <button className="side-link" onClick={act(onPasskeys)}>{passkeyText(lang).title}</button>
          <PwaInstallButton lang={lang} />
          <button className="side-link" onClick={act(onLogout)}>{t.signOut}</button>
        </div>
      </aside>
    </>
  );
}
