"use client";
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const BOTTOM_ITEM = "no-underline min-h-(--nav-h) border-0 bg-transparent flex flex-col items-center justify-center gap-[3px] text-[11px] font-extrabold cursor-pointer px-0.5 py-1.5 [&>span]:max-w-full [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap ";
import { PAGE_PATHS, getPageName, type PageName } from "@/utils/helpers";
import { api, ApiError } from "@/utils/api";
import { I18N, type Dict, type Lang } from "@/utils/i18n";
import { can, canVisitPage } from "@/utils/permissions";
import type { Mould, User } from "@/utils/types";
import Sidebar from "@/components/Sidebar";
import MouldSheet from "@/components/MouldSheet";
import MouldFormSheet from "@/components/MouldFormSheet";
import { ConfirmHost } from "@/components/ConfirmHost";
import Icon, { type IconName } from "@/components/Icon";
import Navbar from "@/components/Navbar";

export type AppState = {
  user: User;
  setUser: (user: User) => void;
  translations: Dict;
  lang: Lang;
  refreshKey: number;
  searchQuery: string;
  openMould: (id: string) => void;
  onSync: (synced: boolean) => void;
};

export const AppContext = createContext<AppState | null>(null);

export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("useApp must be used inside the app layout");
  return app;
}

const LANG_KEY = "mould-tracker-lang";
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = getPageName(pathname);
  const mouldId = searchParams.get("mould");
  // Screen state
  const [lang, setLang] = useState<Lang>("en");
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [formFor, setFormFor] = useState<Mould | null | "new">(null);
  const translations = I18N[lang];

  // Effects: load data and update the screen
  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (l === "en" || l === "si") setLang(l);
    } catch {
      /* storage unavailable */
    }
    async function loadSession() {
      try {
        const response = await api.me();
        setUser(response.user);
      } catch {
        // Show the login form when no session is available.
      } finally {
        setBooting(false);
      }
    }
    loadSession();
  }, []);

  // The signed-in user's saved language wins over this device's last choice.
  useEffect(() => {
    if (user?.language) setLang(user.language);
  }, [user?.language]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Button and form actions
  async function changeLang(language: Lang) {
    setLang(language);
    try {
      localStorage.setItem(LANG_KEY, language);
    } catch {
      // Language still changes when device storage is unavailable.
    }
    if (user && user.language !== language) {
      try {
        const response = await api.setLanguage(language);
        setUser(response.user);
      } catch {
        // Keep the selected language for this visit.
      }
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* signed out anyway */
    }
    setUser(null);
    setFormFor(null);
  }

  const onSync = useCallback((ok: boolean) => setSynced(ok), []);
  const changed = useCallback(() => setRefreshKey((k) => k + 1), []);
  const openMould = useCallback(
    (id: string) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set("mould", id);
      router.push(pathname + "?" + query.toString(), { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function closeMould() {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("mould");
    const suffix = query.toString();
    router.push(pathname + (suffix ? "?" + suffix : ""), { scroll: false });
  }

  useEffect(() => {
    setNavOpen(false);
    setFormFor(null);
    setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    if (booting || user) return;
    let destination = pathname;
    const query = searchParams.toString();
    if (query) destination += "?" + query;
    router.replace("/login?next=" + encodeURIComponent(destination));
  }, [booting, user, pathname, searchParams, router]);

  const allowed = user ? canVisitPage(user, view) : true;
  useEffect(() => {
    if (user && !allowed) router.replace(canVisitPage(user, "find") ? PAGE_PATHS.find : PAGE_PATHS.account);
  }, [user, allowed, router]);

  // A 401 anywhere means the session ended.
  useEffect(() => {
    if (!user) return;
    const refreshSession = () => {
      api.me().then(response => setUser(response.user)).catch((error) => {
        if (error instanceof ApiError && error.status === 401) setUser(null);
      });
    };
    const id = setInterval(refreshSession, 60_000);
    window.addEventListener("focus", refreshSession);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refreshSession);
    };
  }, [user]);

  if (booting || !allowed)
    return (
      <div className="min-h-dvh grid place-items-center text-ink-faint">
        …
      </div>
    );
  if (!user) {
    return <div className="min-h-dvh grid place-items-center">…</div>;
  }

  const bottomLinks = ([
    ["find", translations.nav.findShort, "search"],
    ["extrusion", translations.extrusionShort, "mould"],
    ["racks", translations.nav.racksShort, "rack"],
    ["workshop", translations.nav.workshopShort, "workshop"],
  ] as [PageName, string, IconName][]).filter(([page]) => canVisitPage(user, page));

  let syncState: "syncing" | "synced" | "offline" = "syncing";
  if (synced === true) syncState = "synced";
  if (synced === false) syncState = "offline";
  // UI and inline Tailwind styles
  return (
    <AppContext.Provider
      value={{ user, setUser, translations, lang, refreshKey, searchQuery, openMould, onSync }}
    >
      <Sidebar
        open={navOpen}
        translations={translations}
        lang={lang}
        user={user}
        view={view}
        sync={syncState}
        syncText={translations.sync[syncState]}
        onLogout={logout}
        onClose={() => setNavOpen(false)}
      />
      <div id="app" className="relative min-h-dvh pb-[calc(var(--nav-h)+var(--safe-b)+var(--s4))] md:pb-8 md:ml-(--rail-w) lg:ml-(--side-w)">
        <Navbar
          key={view}
          page={view}
          translations={translations}
          lang={lang}
          syncState={syncState}
          onSearch={setSearchQuery}
          onLanguageChange={changeLang}
          onOpenSidebar={() => setNavOpen(true)}
        />

        {children}

        {(view === "find" || view === "extrusion") &&
          can(user, "moulds.manage") && (
            <button
              className="fixed right-[calc(var(--s4)+var(--safe-r))] bottom-[calc(var(--nav-h)+var(--safe-b)+var(--s4))] md:right-6 md:bottom-6 bg-action text-white border-0 w-14.5 h-14.5 rounded-[18px] [box-shadow:0_12px_24px_rgba(36,107,117,.34)] flex items-center justify-center cursor-pointer z-20"
              onClick={() => setFormFor("new")}
              aria-label={view === "extrusion" ? translations.extrusionAdd : translations.form.add}
              title={view === "extrusion" ? translations.extrusionAdd : translations.form.add}
            >
              <Icon name="add" size={26} />
            </button>
          )}
      </div>

      {/* Phone: main screens one thumb away; "More" opens the menu with admin screens and account. */}
      <nav
        className="md:hidden fixed left-0 right-0 bottom-0 z-35 grid grid-cols-[repeat(5,1fr)] bg-surface [border-top:1px_solid_var(--line)] p-[0_var(--safe-r)_var(--safe-b)_var(--safe-l)] [box-shadow:0_-6px_20px_rgba(0,0,0,.06)]"
        style={{ gridTemplateColumns: `repeat(${bottomLinks.length + 1}, 1fr)` }}
        aria-label={translations.nav.menu}
      >
        {bottomLinks.map(([v, label, icon]) => (
          <Link
            key={v}
            className={BOTTOM_ITEM + (view === v ? "text-action [&_svg]:-translate-y-px" : "text-ink-faint")}
            aria-current={view === v ? "page" : undefined}
            href={PAGE_PATHS[v]}
          >
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          className={
            [
              "workReport",
              "rackAdmin",
              "machines",
              "access",
              "audit",
              "users",
              "account",
              "passkeys",
            ].includes(view)
              ? BOTTOM_ITEM + "text-action [&_svg]:-translate-y-px"
              : BOTTOM_ITEM + "text-ink-faint"
          }
          onClick={() => setNavOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="more" size={22} />
          <span>{translations.nav.more}</span>
        </button>
      </nav>

      <MouldSheet
        id={can(user, "moulds.view") ? mouldId : null}
        user={user}
        translations={translations}
        lang={lang}
        refreshKey={refreshKey}
        onClose={closeMould}
        onChanged={changed}
        onEdit={(mould) => setFormFor(mould)}
      />
      {can(user, "moulds.manage") && (
        <MouldFormSheet
          open={formFor !== null}
          mould={formFor === "new" ? null : formFor}
          defaultToolType={
            view === "extrusion" ? "EXTRUSION_DIE" : "INJECTION_MOULD"
          }
          translations={translations}
          onClose={() => setFormFor(null)}
          onSaved={(mould, close) => {
            changed();
            if (close) {
              setFormFor(null);
              openMould(mould.id);
            }
          }}
        />
      )}
      <ConfirmHost translations={translations} />

    </AppContext.Provider>
  );
}
