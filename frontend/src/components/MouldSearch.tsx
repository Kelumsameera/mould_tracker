"use client";
import { useCallback, useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import Icon, { locationIcon, type IconName } from "@/components/Icon";

import { api } from "@/utils/api";
import { groupMouldsByMachine } from "@/utils/machineLayout";
import { locationName } from "@/utils/i18n";

import {
  LOCATIONS,
  type Location,
  type Mould,
  type Stats,
  type ToolType,
} from "@/utils/types";

import { useApp } from "@/components/AppLayout";
import { TONE_TEXT } from "@/utils/helpers";

type Filter = {
  location?: Location;
  needsService?: boolean;
  awaitingRack?: boolean;
  problem?: boolean;
};

type Props = {
  toolType?: ToolType;
};

export default function MouldSearch({ toolType = "INJECTION_MOULD" }: Props) {
  const { translations, lang, openMould: onOpen, refreshKey, searchQuery, onSync } = useApp();
  const isExtrusion = toolType === "EXTRUSION_DIE";
  // Screen state
  const [filter, setFilter] = useState<Filter>({});
  const [moulds, setMoulds] = useState<Mould[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadSearchResults = useCallback(async () => {
    try {
      const [mouldResult, statsResult] = await Promise.all([
        api.moulds({ q: searchQuery, ...filter, toolType }),
        api.stats(toolType),
      ]);
      setMoulds(mouldResult.moulds);
      setStats(statsResult.stats);
      onSync(true);
    } catch {
      onSync(false);
    }
  }, [searchQuery, filter, onSync, toolType]);
  // Effects: load data and update the screen
  useEffect(() => {
    loadSearchResults();
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadSearchResults();
      }
    }, 10_000);
    return () => clearInterval(refreshTimer);
  }, [loadSearchResults, refreshKey]);

  // Button and form actions
  function isFilterSelected(candidate: Filter, selectedFilter = filter) {
    return (
      selectedFilter.location === candidate.location &&
      selectedFilter.needsService === candidate.needsService &&
      selectedFilter.awaitingRack === candidate.awaitingRack &&
      selectedFilter.problem === candidate.problem
    );
  }

  function toggleFilter(nextFilter: Filter) {
    setFilter((currentFilter) => {
      if (isFilterSelected(nextFilter, currentFilter)) {
        return {};
      }
      return nextFilter;
    });
  }

  const filterButtons: {
    filter: Filter;
    label: string;
    count: number;
    tone: string;
    icon: IconName;
  }[] = [];

  if (stats) {
    for (const location of LOCATIONS) {
      const hiddenLocation = isExtrusion ? "MOULD_ROOM" : "TOOL_ROOM";
      if (location === hiddenLocation) continue;

      filterButtons.push({
        filter: { location },
        label: locationName(location, translations),
        count: stats.byLocation[location] ?? 0,
        tone: location,
        icon: locationIcon[location],
      });
    }

    filterButtons.push({
      filter: { needsService: true },
      label: translations.dash.attention,
      count: stats.needsAttention,
      tone: "attention",
      icon: "attention",
    });

    if (!isExtrusion) {
      filterButtons.push({
        filter: { awaitingRack: true },
        label: translations.dash.awaitingRack,
        count: stats.awaitingRack,
        tone: "waiting",
        icon: "rack",
      });
    }

    filterButtons.push({
      filter: { problem: true },
      label: translations.problem.filter,
      count: stats.problemsReported,
      tone: "problem",
      icon: "problem",
    });
  }

  const hasFilters = Object.keys(filter).length > 0;
  const isSearching = Boolean(searchQuery) || hasFilters;
  let resultsHeading = isExtrusion
    ? translations.toolTypes.EXTRUSION_DIE
    : translations.search.allMoulds;
  if (isSearching) {
    const formatResults = isExtrusion ? translations.extrusionResults : translations.search.results;
    resultsHeading = formatResults(moulds?.length ?? 0);
  }

  let emptyMessage = translations.search.empty;
  if (searchQuery) emptyMessage = translations.search.noMatch;
  if (isExtrusion) emptyMessage = translations.extrusionEmpty;

  const orderedMoulds = isExtrusion
    ? moulds ?? []
    : groupMouldsByMachine(moulds ?? []).flatMap(group => group.moulds);
  const renderCard = (mould: Mould) => (
    <MouldCard key={mould.id} mould={mould} translations={translations} lang={lang} onOpen={onOpen} />
  );

  // UI and inline Tailwind styles
  return (
    <>
      <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
        <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2 m-0 mb-5">
          {filterButtons.map((chip) => (
            <button
              key={chip.tone}
              className={
                "bg-surface border border-solid rounded-md px-2 py-3 text-left cursor-pointer text-inherit flex flex-col gap-0.5 min-h-[68px] [transition:border-color_var(--fast),box-shadow_var(--fast)] " +
                (isFilterSelected(chip.filter) ? "border-ink shadow-[inset_0_-3px_0_var(--accent)]" : "border-line hover:border-line-strong")
              }
              aria-pressed={isFilterSelected(chip.filter)}
              onClick={() => toggleFilter(chip.filter)}
            >
              <div
                className={
                  "text-xl font-extrabold leading-[1.1] flex items-center gap-1.5 " +
                  TONE_TEXT[chip.tone]
                }
              >
                <Icon name={chip.icon} size={18} />
                {chip.count}
              </div>
              <div className="text-xs font-extrabold text-ink-soft leading-[1.3]">
                {chip.label}
              </div>
            </button>
          ))}
        </div>
        <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
          {resultsHeading}
          {stats && !searchQuery && !hasFilters && (
            <span className="inline-block bg-surface border border-solid border-line [padding:1px_8px] rounded-sm text-xs">
              {stats.total}
            </span>
          )}
          {hasFilters && (
            <button
              className="bg-transparent border-0 text-action font-extrabold text-xs min-h-8 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default px-1.5"
              onClick={() => setFilter({})}
            >
              {translations.dash.clearFilter}
            </button>
          )}
        </div>
        {moulds === null && <SkeletonCards label={translations.loading} />}
        {moulds !== null && moulds.length === 0 && (
          <EmptyState
            icon={searchQuery ? "search" : "mould"}
            text={emptyMessage}
          />
        )}
        {moulds !== null && moulds.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4">
            {orderedMoulds.map(renderCard)}
          </div>
        )}
      </main>
    </>
  );
}
