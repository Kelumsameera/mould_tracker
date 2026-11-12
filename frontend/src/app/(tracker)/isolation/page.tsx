"use client";
import toast from "react-hot-toast";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppLayout";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import { api } from "@/utils/api";
import { errorText } from "@/utils/format";
import { locationName } from "@/utils/i18n";
import type { Mould } from "@/utils/types";

// Isolation Area: everything waiting between the Production Floor, the Mould Room and the Workshop, longest wait first.
export default function IsolationPage() {
  const { translations: t, lang, openMould, refreshKey } = useApp();
  const [moulds, setMoulds] = useState<Mould[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { moulds } = await api.moulds({ location: "ISOLATION" });
      setMoulds([...moulds].sort((a, b) => (a.isolation?.since ?? "").localeCompare(b.isolation?.since ?? "")));
    } catch (error) {
      toast.error(errorText(error, t));
    }
  }, [t]);
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const tooLong = moulds?.filter((m) => m.isolation?.level).length ?? 0;
  return (
    <main className="pt-5 pb-8 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
      <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Icon name="clock" />{t.isolation.title}</h2>
      <p className="text-sm text-ink-soft mb-4">{t.isolation.hint}</p>
      {moulds === null && <SkeletonCards count={4} label={t.loading} />}
      {moulds?.length === 0 && <EmptyState icon="good" text={t.isolation.empty} />}
      {tooLong > 0 && (
        <p className="mb-3 p-3 rounded-md bg-warn-bg text-warn-ink text-sm font-bold flex gap-2 items-center" role="status">
          <Icon name="attention" size={16} />{t.isolation.tooLongCount(tooLong)}
        </p>
      )}
      {moulds && moulds.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
          {moulds.map((mould) => (
            <div key={mould.id} className="flex flex-col gap-1.5">
              <MouldCard mould={mould} translations={t} lang={lang} onOpen={openMould} />
              <div className="flex items-center justify-between gap-2 px-1 text-sm">
                <span className="text-ink-soft">
                  {t.isolation.plannedFor}: <b>{mould.isolation?.intendedDestination ? locationName(mould.isolation.intendedDestination, t) : t.isolation.notDecided}</b>
                </span>
                <button type="button" className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5" onClick={() => openMould(mould.id)}>
                  <Icon name="move" size={16} />{t.isolation.moveOn}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
