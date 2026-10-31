"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import type { Dict, Lang } from "@/utils/i18n";
import { syncDot, type PageName } from "@/utils/helpers";
import { passkeyText } from "@/utils/passkeyText";

type Props = {
  page: PageName;
  translations: Dict;
  lang: Lang;
  syncState: "syncing" | "synced" | "offline";
  onSearch: (query: string) => void;
  onLanguageChange: (language: Lang) => void;
  onOpenSidebar: () => void;
};

export default function Navbar({
  page,
  translations,
  lang,
  syncState,
  onSearch,
  onLanguageChange,
  onOpenSidebar,
}: Props) {
  // Screen state
  const [searchText, setSearchText] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const showSearch = page === "find" || page === "extrusion";
  let searchPlaceholder = translations.search.placeholder;
  if (page === "extrusion") {
    searchPlaceholder = translations.extrusionSearch;
  }

  // Wait until typing pauses before loading new results.
  // Effects: load data and update the screen
  useEffect(() => {
    if (!showSearch) return;
    const searchTimer = setTimeout(() => {
      onSearch(searchText.trim());
    }, 250);
    return () => clearTimeout(searchTimer);
  }, [searchText, showSearch, onSearch]);

  useEffect(() => {
    if (showSearch) {
      searchInput.current?.focus();
    }
  }, [showSearch]);

  // Button and form actions
  function clearSearch() {
    setSearchText("");
    onSearch("");
    searchInput.current?.focus();
  }

  const titles: Record<PageName, string> = {
    find: translations.brandTitle,
    extrusion: translations.toolTypes.EXTRUSION_DIE,
    racks: translations.racks.title,
    workshop: translations.workshop.title,
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
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border-[1.5px] border-solid border-line-strong bg-surface shadow-card pl-3 pr-1 text-ink-faint focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(245,184,0,.35)]">
          <Icon name="search" size={18} />
          <input
            ref={searchInput}
            className="min-w-0 flex-1 h-10 border-0 bg-transparent px-0 py-0 text-[15px] text-ink outline-none focus-visible:shadow-none"
            type="search"
            inputMode="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
          />
          {searchText && (
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-0 bg-surface-3 text-ink-soft cursor-pointer"
              aria-label={translations.search.clear}
              onClick={clearSearch}
            >
              <Icon name="cancel" size={16} />
            </button>
          )}
        </div>
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
