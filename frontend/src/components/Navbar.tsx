"use client";

import Icon from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import type { Dict, Lang } from "@/utils/i18n";
import { syncDot, type PageName } from "@/utils/helpers";
import { passkeyText } from "@/utils/passkeyText";
import SearchBox from "./SearchBox";

type Props = {
  page: PageName;
  translations: Dict;
  lang: Lang;
  syncState: "syncing" | "synced" | "offline";
  onSearch: (query: string) => void;
  onLanguageChange: (language: Lang) => void;
  onOpenSidebar: () => void;
  userId: string;
  onOpenMould: (id: string) => void;
};

export default function Navbar({
  page,
  translations,
  lang,
  syncState,
  onSearch,
  onLanguageChange,
  onOpenSidebar,
  userId,
  onOpenMould,
}: Props) {
  const showSearch = page === "find" || page === "extrusion";
  const searchPlaceholder = page === "extrusion" ? translations.extrusionSearch : translations.search.placeholder;

  const titles: Record<PageName, string> = {
    find: translations.brandTitle,
    extrusion: translations.toolTypes.EXTRUSION_DIE,
    racks: translations.racks.title,
    workshop: translations.workshop.title,
    isolation: translations.isolation.title,
    catalog: translations.catalog.title,
    dashboard: translations.dashboard.title,
    workReport: translations.report.title,
    rackAdmin: translations.rackAdmin.title,
    machines: translations.nav.machines,
    access: translations.accessAdmin.title,
    audit: translations.audit.title,
    users: translations.users,
    account: translations.accountTitle,
    passkeys: passkeyText(lang).title,
  };

  // UI and inline Tailwind styles
  return (
    // Navbar height: 56px. Search field height: 40px.
    <nav
      className="sticky top-0 z-30 flex items-center gap-2 bg-brand text-brand-ink min-h-[calc(56px+var(--safe-t))] pt-[calc(6px+var(--safe-t))] pb-1.5 pl-[calc(12px+var(--safe-l))] pr-[calc(12px+var(--safe-r))] md:px-6"
      aria-label={translations.nav.menu}
    >
      <div className={showSearch ? "hidden min-w-0 lg:block lg:w-44 lg:shrink-0" : "min-w-0 flex-1"}>
        <h1 className="m-0 truncate font-sign text-[19px] font-bold tracking-[.1px]">{titles[page]}</h1>
        <div className={"flex items-center gap-1.5 text-xs text-brand-soft " + syncDot(syncState)}>
          {translations.sync[syncState]}
        </div>
      </div>

      {showSearch && (
        <SearchBox key={page} translations={translations} placeholder={searchPlaceholder} userId={userId} toolType={page === "extrusion" ? "EXTRUSION_DIE" : undefined} onSearch={onSearch} onOpenMould={onOpenMould} />
      )}

      <div className="flex shrink-0 rounded-md bg-white/10 p-0.5" role="group" aria-label={translations.nav.language}>
        <button
          type="button"
          className={"min-h-9 min-w-8 rounded-sm border-0 px-1 text-xs font-extrabold cursor-pointer " + (lang === "en" ? "bg-white text-[#18232d]" : "bg-transparent text-brand-soft")}
          aria-pressed={lang === "en"}
          onClick={() => onLanguageChange("en")}
        >EN</button>
        <button
          type="button"
          className={"min-h-9 min-w-8 rounded-sm border-0 px-1 text-xs font-extrabold cursor-pointer " + (lang === "si" ? "bg-white text-[#18232d]" : "bg-transparent text-brand-soft")}
          aria-pressed={lang === "si"}
          onClick={() => onLanguageChange("si")}
          lang="si"
        >සිං</button>
      </div>
      <ThemeToggle translations={translations} />
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-0 bg-white/10 hover:bg-white/18 text-inherit cursor-pointer md:hidden!"
        onClick={onOpenSidebar}
        aria-label={translations.nav.accountMenu}
        title={translations.nav.accountMenu}
      >
        <Icon name="user" size={20} />
      </button>
    </nav>
  );
}
