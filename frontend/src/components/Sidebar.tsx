"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PAGE_PATHS, RAIL_HIDE, RAIL_ITEM, syncDot, type PageName } from "@/utils/helpers";
import Icon, { type IconName } from "@/components/Icon";
import type { Dict, Lang } from "@/utils/i18n";
import type { User } from "@/utils/types";
import { can, canVisitPage } from "@/utils/permissions";
import { passkeyText } from "@/utils/passkeyText";
import { PwaInstallButton } from "@/providers/PwaProvider";

const RAIL_KEY = "mould-tracker-rail-expanded";

// Phone: drawer (opened from "More"). Tablet: icon rail that expands. Desktop: always-open sidebar.
type Props = {
  open: boolean;
  translations: Dict;
  lang: Lang;
  user: User;
  view: PageName;
  sync: string;
  syncText: string;
  onLogout: () => void;
  onClose: () => void;
};

export default function Sidebar({ open, translations, lang, user, view, sync, syncText, onLogout, onClose }: Props) {
  // Screen state
  const [expanded, setExpanded] = useState(false);
  // Effects: load data and update the screen
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  // Button and form actions
  function toggleRail() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    try {
      const savedValue = nextExpanded ? "1" : "0";
      localStorage.setItem(RAIL_KEY, savedValue);
    } catch {
      // The sidebar still works when browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const closeAfter = (action: () => void) => () => {
    action();
    onClose();
  };
  const mainLinks: { key: PageName; label: string; icon: IconName }[] = [
    { key: "find", label: translations.nav.find, icon: "search" },
    { key: "extrusion", label: translations.toolTypes.EXTRUSION_DIE, icon: "mould" },
    { key: "racks", label: translations.nav.racks, icon: "rack" },
    { key: "workshop", label: translations.nav.workshop, icon: "workshop" },
  ];
  const adminLinks: { key: PageName; label: string; icon: IconName }[] = [];

  if (can(user, "access.manage")) {
    adminLinks.push({ key: "access", label: translations.accessAdmin.title, icon: "admin" });
  }
  if (can(user, "moulds.manage")) {
    adminLinks.push({ key: "machines", label: translations.nav.machines, icon: "machine" });
  }
  if (can(user, "users.manage")) {
    adminLinks.push({ key: "users", label: translations.nav.users, icon: "users" });
  }
  if (can(user, "worklog.report")) {
    adminLinks.push({
      key: "workReport",
      label: translations.nav.workReport,
      icon: "report",
    });
  }
  if (can(user, "racks.manage") || can(user, "moulds.manage")) {
    adminLinks.push({
      key: "rackAdmin",
      label: translations.nav.rackAdmin,
      icon: "admin",
    });
  }
  if (can(user, "audit.view")) {
    adminLinks.push({ key: "audit", label: translations.nav.audit, icon: "audit" });
  }
  const itemBase =
    "relative no-underline flex items-center gap-3 w-full min-h-tap px-3 py-0 border-0 rounded-sm bg-transparent text-[#b9c5cd] text-[14.5px] font-medium text-left cursor-pointer whitespace-nowrap hover:bg-white/6 hover:text-white " +
    RAIL_ITEM;
  const renderNavItem = ({ key, label, icon }: { key: PageName; label: string; icon: IconName }) => (
    <Link
      key={key}
      className={
        itemBase +
        (view === key
          ? " bg-[rgba(245,184,0,.1)]! text-white! font-semibold [&_svg]:text-accent before:content-[''] before:absolute before:-left-3 before:top-[9px] before:bottom-[9px] before:w-1 before:rounded-r-[3px] before:bg-accent"
          : "")
      }
      aria-current={view === key ? "page" : undefined}
      title={label}
      aria-label={label}
      href={PAGE_PATHS[key]}
      onClick={onClose}
    >
      <Icon name={icon} size={20} />
      <span className={"overflow-hidden text-ellipsis " + RAIL_HIDE}>{label}</span>
    </Link>
  );
  const renderAccountLink = (label: string, icon: IconName, action: () => void) => (
    <button className={itemBase} onClick={closeAfter(action)} title={label} aria-label={label}>
      <Icon name={icon} size={20} />
      <span className={"overflow-hidden text-ellipsis " + RAIL_HIDE}>{label}</span>
    </button>
  );

  // UI and inline Tailwind styles
  return (
    <>
      <div
        className={
          "fixed inset-0 bg-scrim z-44 [transition:opacity_var(--fast)] md:hidden " +
          (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
      />
      <aside
        data-collapsed={expanded ? undefined : ""}
        className={
          "group/side fixed top-0 bottom-0 left-0 w-[min(296px,86vw)] bg-[linear-gradient(180deg,var(--brand)_0%,#121c23_100%)] [border-right:1px_solid_rgba(255,255,255,.04)] text-brand-ink z-45 flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-[calc(var(--s4)+var(--safe-t))_var(--s3)_calc(var(--s4)+var(--safe-b))] [transition:translate_var(--med)_var(--ease),visibility_0s_linear_var(--med),width_var(--fast)] " +
          (open ? "translate-x-0 visible [transition-delay:0s] " : "-translate-x-full invisible ") +
          "md:translate-x-0 md:visible md:px-2 md:[transition:width_var(--fast)_var(--ease)] " +
          (expanded ? "md:w-(--side-w) md:shadow-panel " : "md:w-(--rail-w) ") +
          "lg:w-(--side-w)! lg:shadow-none!"
        }
        aria-label={translations.nav.menu}
      >
        <div className="flex items-center gap-2 px-1 py-0 min-h-tap pb-3 [border-bottom:1px_solid_rgba(255,255,255,.08)]">
          <Image className="size-8 shrink-0" src="/logo.svg" alt="" width={32} height={32} />
          <div className={"min-w-0 flex-1 " + RAIL_HIDE}>
            <div className="font-sign text-[19px] font-bold tracking-[.1px] whitespace-nowrap overflow-hidden text-ellipsis">{translations.brandTitle}</div>
            <div className={"text-xs text-brand-soft flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis " + syncDot(sync)}>{syncText}</div>
          </div>
          <button
            className="w-tap h-tap shrink-0 border-0 rounded-md bg-white/10 hover:bg-white/18 text-inherit inline-flex items-center justify-center cursor-pointer md:hidden!"
            onClick={onClose}
            aria-label={translations.nav.closeMenu}
            title={translations.nav.closeMenu}
          >
            <Icon name="cancel" size={18} />
          </button>
        </div>
        <button
          className={itemBase.replace("flex items-center", "items-center") + " hidden md:flex lg:hidden mt-2"}
          onClick={toggleRail}
          aria-expanded={expanded}
          aria-label={expanded ? translations.nav.collapse : translations.nav.expand}
          title={expanded ? translations.nav.collapse : translations.nav.expand}
        >
          <Icon name={expanded ? "railClose" : "railOpen"} size={20} />
          <span className={"overflow-hidden text-ellipsis " + RAIL_HIDE}>{expanded ? translations.nav.collapse : translations.nav.expand}</span>
        </button>

        <nav className="flex flex-col gap-0.5 mx-0 my-4">
          {mainLinks.filter((link) => canVisitPage(user, link.key)).map(renderNavItem)}
          {adminLinks.length > 0 && (
            <div className={"text-[12.5px] font-semibold text-[#7f909c] [border-top:1px_solid_rgba(255,255,255,.07)] pt-3 m-[var(--s4)_var(--s3)_var(--s1)] whitespace-nowrap " + RAIL_HIDE}>
              {user.role === "system_admin" ? translations.roles.system_admin : can(user, "racks.manage") ? translations.nav.superAdmin : translations.nav.admin}
            </div>
          )}
          {adminLinks.map(renderNavItem)}
        </nav>

        <div className="mt-auto [border-top:1px_solid_rgba(255,255,255,.1)] pt-3 flex flex-col gap-0.5">
          <div className={"flex items-center gap-3 px-3 py-2 mb-1 text-sm rounded-md bg-white/4 " + RAIL_ITEM} title={user.name}>
            <Icon name="user" size={20} />
            <div className={"min-w-0 [&>*]:block [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap " + RAIL_HIDE}>
              <strong>{user.name}</strong>
              <small className="text-brand-soft">{translations.roles[user.role] ?? user.role}</small>
            </div>
          </div>
          {renderNavItem({
            key: "account",
            label: translations.nav.account,
            icon: "password",
          })}
          {renderNavItem({
            key: "passkeys",
            label: passkeyText(lang).title,
            icon: "passkey",
          })}
          <PwaInstallButton lang={lang} />
          {renderAccountLink(translations.signOut, "logout", onLogout)}
        </div>
      </aside>
    </>
  );
}
