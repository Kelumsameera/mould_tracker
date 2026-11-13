"use client";
import { refreshMs } from "@/utils/runtimeConfig";
import toast from "react-hot-toast";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppLayout";
import EmptyState from "@/components/EmptyState";
import Icon, { iconForLocation } from "@/components/Icon";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import { api } from "@/utils/api";
import { errorText } from "@/utils/format";
import { locationName } from "@/utils/i18n";
import { configLocation } from "@/utils/runtimeConfig";
import type { Location, Mould } from "@/utils/types";

// Generic screen for any location (used for places added in Workflow Settings): every mould there, refreshed.
export default function PlacePage() {
  const { translations: t, lang, openMould, refreshKey } = useApp();
  const key = (useSearchParams().get("key") || "") as Location;
  const [moulds, setMoulds] = useState<Mould[] | null>(null);
  const load = useCallback(async () => {
    if (!key) return;
    try {
      setMoulds((await api.moulds({ location: key })).moulds);
    } catch (e) {
      toast.error(errorText(e, t));
    }
  }, [key, t]);
  useEffect(() => {
    setMoulds(null);
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), refreshMs());
    return () => clearInterval(timer);
  }, [load, refreshKey]);
  const loc = configLocation(key);
  return (
    <main className="pt-5 pb-8 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
      <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Icon name={iconForLocation(key)} />{locationName(key, t)}</h2>
      {loc?.maxWaitHours ? <p className="text-sm text-ink-soft mb-3">{t.place.maxWait(loc.maxWaitHours)}</p> : null}
      {moulds === null && <SkeletonCards count={4} label={t.loading} />}
      {moulds?.length === 0 && <EmptyState icon="empty" text={t.place.empty} />}
      {moulds && moulds.length > 0 && (
        <>
          <p className="text-sm font-bold text-ink-soft mb-2" aria-live="polite">{t.search.results(moulds.length)}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
            {moulds.map((m) => <MouldCard key={m.id} mould={m} translations={t} lang={lang} onOpen={openMould} />)}
          </div>
        </>
      )}
    </main>
  );
}
