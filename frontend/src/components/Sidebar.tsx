"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Icon, { type IconName } from "./Icon";
import type { Dict, Lang } from "@/lib/i18n";
import type { User } from "@/lib/types";
import { can } from "@/lib/permissions";
import { passkeyText } from "@/lib/passkeyText";
import { PwaInstallButton } from "./PwaProvider";

export type View = "find" | "extrusion" | "racks" | "workshop" | "workReport" | "rackAdmin" | "audit";
const RAIL_KEY = "mould-tracker-rail-expanded";

// Phone: drawer (opened from "More"). Tablet: icon rail that expands. Desktop: always-open sidebar.
export default function Sidebar({ open, t, lang, user, view, sync, syncText, onView, onAccount, onPasskeys, onUsers, onLogout, onClose }: {
  open: boolean; t: Dict; lang: Lang; user: User; view: View; sync: string; syncText: string;
  onView: (v: View) => void; onAccount: () => void; onPasskeys: () => void; onUsers: () => void; onLogout: () => void; onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { try { setExpanded(localStorage.getItem(RAIL_KEY) === "1"); } catch { /* storage unavailable */ } }, []);
  const toggleRail = () => setExpanded((e) => { try { localStorage.setItem(RAIL_KEY, e ? "0" : "1"); } catch { /* storage unavailable */ } return !e; });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const act = (fn: () => void) => () => { fn(); onClose(); };
  const main: { key: View; label: string; icon: IconName }[] = [
    { key: "find", label: t.nav.find, icon: "search" },
    { key: "extrusion", label: t.toolTypes.EXTRUSION_DIE, icon: "mould" },
    { key: "racks", label: t.nav.racks, icon: "rack" },
    { key: "workshop", label: t.nav.workshop, icon: "workshop" }
  ];
  const admin: { key: View | "users"; label: string; icon: IconName }[] = [
    ...(can(user, "users.manage") ? [{ key: "users" as const, label: t.nav.users, icon: "users" as const }] : []),
    ...(can(user, "worklog.report") ? [{ key: "workReport" as const, label: t.nav.workReport, icon: "report" as const }] : []),
    ...(can(user, "racks.manage") || can(user, "moulds.manage") ? [{ key: "rackAdmin" as const, label: t.nav.rackAdmin, icon: "admin" as const }] : []),
    ...(can(user, "audit.view") ? [{ key: "audit" as const, label: t.nav.audit, icon: "audit" as const }] : [])
  ];
  const item = ({ key, label, icon }: { key: View | "users"; label: string; icon: IconName }) => (
    <button key={key} className={"side-item" + (view === key ? " active" : "")} aria-current={view === key ? "page" : undefined} title={label} aria-label={label}
      onClick={act(() => (key === "users" ? onUsers() : onView(key)))}>
      <Icon name={icon} size={20} /><span className="side-label">{label}</span>
    </button>
  );
  const link = (label: string, icon: IconName, fn: () => void) => (
    <button className="side-link" onClick={act(fn)} title={label} aria-label={label}><Icon name={icon} size={20} /><span className="side-label">{label}</span></button>
  );

  return (
    <>
      <div className={"nav-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"sidebar" + (open ? " open" : "") + (expanded ? " expanded" : "")} aria-label={t.nav.menu}>
        <div className="side-brand">
          <Image className="brand-icon" src="/logo.svg" alt="" width={32} height={32} />
          <div className="side-names">
            <div className="brand-title">{t.brandTitle}</div>
            <div className={"brand-sub sync " + sync}>{syncText}</div>
          </div>
          <button className="icon-btn side-close phone-only" onClick={onClose} aria-label={t.nav.closeMenu} title={t.nav.closeMenu}><Icon name="cancel" size={18} /></button>
        </div>
        <button className="side-link rail-toggle" onClick={toggleRail} aria-expanded={expanded} aria-label={expanded ? t.nav.collapse : t.nav.expand} title={expanded ? t.nav.collapse : t.nav.expand}>
          <Icon name={expanded ? "railClose" : "railOpen"} size={20} /><span className="side-label">{expanded ? t.nav.collapse : t.nav.expand}</span>
        </button>

        <nav className="side-nav">
          {main.map(item)}
          {admin.length > 0 && <div className="side-heading">{can(user, "racks.manage") ? t.nav.superAdmin : t.nav.admin}</div>}
          {admin.map(item)}
        </nav>

        <div className="side-foot">
          <div className="side-user" title={user.name}>
            <Icon name="user" size={20} />
            <div><strong>{user.name}</strong><small>{t.roles[user.role] ?? user.role}</small></div>
          </div>
          {link(t.nav.account, "password", onAccount)}
          {link(passkeyText(lang).title, "passkey", onPasskeys)}
          <PwaInstallButton lang={lang} />
          {link(t.signOut, "logout", onLogout)}
        </div>
      </aside>
    </>
  );
}
