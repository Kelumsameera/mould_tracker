"use client";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";

import { useEffect, useCallback, useState } from "react";
import EmptyState from "@/components/EmptyState";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import Icon from "@/components/Icon";

import { api } from "@/utils/api";

import { errorText } from "@/utils/format";
import { SERVICE_STATUSES, type Mould } from "@/utils/types";


export default function WorkshopPage() {
  const { translations, lang, openMould: onOpen, refreshKey } = useApp();

  // Screen state
  const [workshopMoulds, setWorkshopMoulds] = useState<Mould[]>([]);
  const [serviceDueMoulds, setServiceDueMoulds] = useState<Mould[]>([]);
  const [problemMoulds, setProblemMoulds] = useState<Mould[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadWorkshop = useCallback(async () => {
    try {
      const [workshopResult, serviceResult, problemResult] = await Promise.all([
        api.moulds({ location: "WORKSHOP" }),
        api.moulds({ needsService: true }),
        api.moulds({ problem: true }),
      ]);

      setWorkshopMoulds(workshopResult.moulds);
      setServiceDueMoulds(
        serviceResult.moulds.filter((mould) => mould.location !== "WORKSHOP"),
      );
      setProblemMoulds(problemResult.moulds);
      setLoaded(true);
    } catch (error) {
      toast.error(errorText(error, translations));
    }
  }, [translations, toast]);
  // Effects: load data and update the screen
  useEffect(() => {
    loadWorkshop();
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadWorkshop();
      }
    }, 10_000);
    return () => clearInterval(refreshTimer);
  }, [loadWorkshop, refreshKey]);

  // Button and form actions
  function getServicePriority(mould: Mould) {
    if (mould.status === "GOOD") {
      return 9;
    }
    return SERVICE_STATUSES.indexOf(mould.status);
  }

  const sortedMoulds = [...workshopMoulds];
  sortedMoulds.sort((firstMould, secondMould) => {
    const firstPriority = getServicePriority(firstMould);
    const secondPriority = getServicePriority(secondMould);
    return firstPriority - secondPriority;
  });
  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
      {!loaded && <SkeletonCards count={4} label={translations.loading} />}
      {loaded && !workshopMoulds.length && !serviceDueMoulds.length && !problemMoulds.length && (
        <EmptyState icon="good" text={translations.workshop.none} />
      )}
      {problemMoulds.length > 0 && (
        <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
          <Icon name="problem" size={16} />
          {translations.problem.filter}{" "}
          <span className="inline-block bg-surface border border-solid border-line [padding:1px_8px] rounded-sm text-xs">
            {problemMoulds.length}
          </span>
        </div>
      )}
      {problemMoulds.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
          {problemMoulds.map((mould) => (
            <MouldCard key={mould.id} mould={mould} translations={translations} lang={lang} onOpen={onOpen} />
          ))}
        </div>
      )}
      {serviceDueMoulds.length > 0 && (
        <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
          <Icon name="attention" size={16} />
          {translations.workshop.flagged}{" "}
          <span className="inline-block bg-surface border border-solid border-line [padding:1px_8px] rounded-sm text-xs">
            {serviceDueMoulds.length}
          </span>
        </div>
      )}
      {serviceDueMoulds.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
          {serviceDueMoulds.map((mould) => (
            <MouldCard key={mould.id} mould={mould} translations={translations} lang={lang} onOpen={onOpen} />
          ))}
        </div>
      )}
      {workshopMoulds.length > 0 && (
        <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
          <Icon name="workshop" size={16} />
          {translations.workshop.atWorkshop}{" "}
          <span className="inline-block bg-surface border border-solid border-line [padding:1px_8px] rounded-sm text-xs">
            {workshopMoulds.length}
          </span>
        </div>
      )}
      {sortedMoulds.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
          {sortedMoulds.map((mould) => (
            <MouldCard key={mould.id} mould={mould} translations={translations} lang={lang} onOpen={onOpen} />
          ))}
        </div>
      )}
    </main>
  );
}
