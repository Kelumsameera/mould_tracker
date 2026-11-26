"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, assetUrl, publicImagePath, type PublicMouldResult } from "@/utils/api";
import { I18N, type Lang } from "@/utils/i18n";
import { getLegacyDestination, TONE_TEXT } from "@/utils/helpers";
import type { ToolType } from "@/utils/types";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import PublicMouldCard from "@/components/PublicMouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import EmptyState from "@/components/EmptyState";
import Icon, { iconForLocation } from "@/components/Icon";
import Sheet from "@/components/Sheet";
import Lightbox from "@/components/Lightbox";

export default function HomePage() {
  return <Suspense fallback={null}><PublicHome /></Suspense>;
}

function PublicHome() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>("en");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const toolType: ToolType = params.get("toolType") === "EXTRUSION_DIE" ? "EXTRUSION_DIE" : "INJECTION_MOULD";
  const sentinel = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<string>();
  const [result, setResult] = useState<PublicMouldResult | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const closeZoom = useCallback(() => setZoomSrc(null), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const t = I18N[lang];
  const view = toolType === "EXTRUSION_DIE" ? "extrusion" : "find";
  const sync = error ? "offline" : loading ? "syncing" : "synced";
  const selected = result?.moulds.find(m => m.id === selectedId);
  const closeSelected = useCallback(() => setSelectedId(null), []);
  const search = useCallback((q: string) => { setQuery(q); setPage(1); setSelectedId(null); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mould-tracker-lang");
      if (saved === "si" || saved === "en") setLang(saved);
    } catch { /* storage unavailable */ }
    api.me().then(() => router.replace(getLegacyDestination(window.location.hash))).catch(() => {});
  }, [router]);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all(Array.from({ length: page }, (_, i) => api.publicMoulds(query, i + 1, { toolType, location }))).then(pages => {
      const last = pages[pages.length - 1];
      if (active) setResult({ ...last, moulds: pages.flatMap(p => p.moulds) });
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, page, toolType, location, refresh]);

  // Reset the list when the tool type changes (tabs, sidebar or bottom nav).
  useEffect(() => { setPage(1); setLocation(undefined); setSelectedId(null); setResult(null); }, [toolType]);

  // Load the next page when the end of the list scrolls into view.
  const canLoadMore = Boolean(result?.hasMore) && !loading && !error;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !canLoadMore) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) setPage(n => n + 1); }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore]);

  const refreshSeconds = result?.refreshSeconds;
  useEffect(() => {
    if (!refreshSeconds) return;
    const update = () => { if (document.visibilityState === "visible") setRefresh(n => n + 1); };
    const interval = setInterval(update, refreshSeconds * 1000);
    window.addEventListener("focus", update);
    return () => { clearInterval(interval); window.removeEventListener("focus", update); };
  }, [refreshSeconds]);

  function language(next: Lang) {
    setLang(next);
    try { localStorage.setItem("mould-tracker-lang", next); } catch { /* storage unavailable */ }
  }

  return <>
    <Sidebar open={navOpen} translations={t} lang={lang} user={null} view={view} sync={sync} syncText={t.sync[sync]} onLogout={() => {}} onClose={() => setNavOpen(false)} />
    <div id="app" className="relative min-h-dvh pb-[calc(var(--nav-h)+var(--safe-b)+var(--s4))] md:pb-8 md:ml-(--rail-w) lg:ml-(--side-w)">
      <Navbar key={view} publicMode page={view} translations={t} lang={lang} syncState={sync} onSearch={search} onLanguageChange={language} onOpenSidebar={() => setNavOpen(true)} userId="public" onOpenMould={setSelectedId} />
      <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-370">
        <div className="flex items-center justify-between gap-3 mb-5 rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-xs text-ink-soft">{t.publicView.hint}</p>
          <Link className="shrink-0 font-bold text-action text-sm" href="/login">{t.signIn}</Link>
        </div>
        <div role="tablist" aria-label={t.toolType} className="grid grid-cols-2 gap-1 mb-4 rounded-md border border-line bg-surface p-1">
          {(["INJECTION_MOULD", "EXTRUSION_DIE"] as const).map(type => <Link key={type} role="tab" aria-selected={toolType === type} href={type === "EXTRUSION_DIE" ? "/?toolType=EXTRUSION_DIE" : "/"} scroll={false}
            className={"min-h-tap flex items-center justify-center gap-2 rounded-sm text-sm font-bold " + (toolType === type ? "bg-action text-white" : "text-ink-soft hover:text-ink")}>
            <Icon name="mould" size={18} />{t.toolTypes[type]}
          </Link>)}
        </div>
        <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2 mb-5">
          {result?.locations.map(place => <button key={place.key} aria-pressed={location === place.key} className={"bg-surface border border-solid rounded-md px-2 py-3 text-left cursor-pointer text-inherit flex flex-col gap-0.5 min-h-17 " + (location === place.key ? "border-ink shadow-[inset_0_-3px_0_var(--accent)]" : "border-line hover:border-line-strong")} onClick={() => { setLocation(current => current === place.key ? undefined : place.key); setPage(1); setSelectedId(null); }}>
            <span className={"text-xl font-extrabold leading-[1.1] flex items-center gap-1.5 " + (TONE_TEXT[place.key] ?? "text-ink")}><Icon name={iconForLocation(place.key)} size={18} />{place.count}</span>
            <span className="text-xs font-extrabold text-ink-soft leading-[1.3]">{place.labels[lang]}</span>
          </button>)}
        </div>
        <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
          {view === "extrusion" ? t.toolTypes.EXTRUSION_DIE : t.search.allMoulds}
          {result && <span className="bg-surface border border-line px-2 rounded-sm text-xs">{result.total}</span>}
          {location && <button className="text-action text-xs" onClick={() => { setLocation(undefined); setPage(1); }}>{t.dash.clearFilter}</button>}
        </div>
        <div aria-live="polite" aria-busy={loading}>
          {error ? <p role="alert">{t.offlineError} <button onClick={() => setRefresh(n => n + 1)}>{t.reload}</button></p> : <>
            {loading && !result ? <SkeletonCards label={t.loading} /> : <>
              {!result?.moulds.length && <EmptyState icon="search" text={t.search.noMatch} />}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
                {result?.moulds.map(mould => <PublicMouldCard key={mould.id} mould={mould} lang={lang} query={query} onOpen={setSelectedId} />)}
              </div>
              <div ref={sentinel} aria-hidden="true" className="h-px" />
              {loading && result && <p className="text-center text-sm text-ink-soft py-4">{t.loading}</p>}
            </>}
          </>}
        </div>
      </main>
    </div>
    <nav className="md:hidden fixed left-0 right-0 bottom-0 z-35 grid grid-cols-3 bg-surface border-t border-line pb-(--safe-b)" aria-label={t.nav.menu}>
      <Link href="/" aria-current={view === "find" ? "page" : undefined} className="min-h-(--nav-h) flex flex-col items-center justify-center gap-1 text-xs font-bold text-action"><Icon name="search" size={22} />{t.nav.findShort}</Link>
      <Link href="/?toolType=EXTRUSION_DIE" aria-current={view === "extrusion" ? "page" : undefined} className="min-h-(--nav-h) flex flex-col items-center justify-center gap-1 text-xs font-bold text-action"><Icon name="mould" size={22} />{t.extrusionShort}</Link>
      <button className="min-h-(--nav-h) flex flex-col items-center justify-center gap-1 text-xs font-bold" onClick={() => setNavOpen(true)}><Icon name="more" size={22} />{t.nav.more}</button>
    </nav>
    <Sheet open={Boolean(selected)} onClose={closeSelected} label={selected?.toolId ?? t.brandTitle} closeLabel={t.close}>
      {selected && <div className="py-5 grid gap-4">
        <h2 className="text-2xl font-bold">{selected.toolId}</h2>
        {selected.hasImage && <button type="button" className="rounded-lg border border-line bg-white p-2 cursor-zoom-in" aria-label={t.publicView.viewPicture} title={t.publicView.viewPicture} onClick={() => setZoomSrc(assetUrl(publicImagePath(selected.id, "full")))}>
          <img src={assetUrl(publicImagePath(selected.id, "full"))} alt={selected.toolId} className="mx-auto max-h-72 w-auto object-contain" decoding="async" />
        </button>}
        <PublicMouldCard mould={selected} lang={lang} query="" onOpen={() => {}} />
        <p className="text-ink-soft">{t.publicView.hint}</p>
        <Link href="/login" className="rounded-md bg-action text-white p-3 text-center font-bold">{t.signIn}</Link>
      </div>}
    </Sheet>
    <Lightbox src={zoomSrc} onClose={closeZoom} />
  </>;
}
