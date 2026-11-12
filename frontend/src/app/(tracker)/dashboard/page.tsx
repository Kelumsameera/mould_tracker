"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppLayout";
import Icon, { locationIcon, type IconName } from "@/components/Icon";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import { api } from "@/utils/api";
import { locationName } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import { LOCATIONS, STATUSES, type Mould, type Stats } from "@/utils/types";

// Management view (Executive landing page; read-only). Built only from existing queries:
// mould stats, the limited-run / isolation lists, service-due flag and this month's work log count.
export default function DashboardPage() {
  const { user, translations: t, lang, openMould, refreshKey, onSync } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [limited, setLimited] = useState<Mould[]>([]);
  const [waiting, setWaiting] = useState<Mould[]>([]);
  const [due, setDue] = useState<Mould[]>([]);
  const [workCount, setWorkCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, l, iso, svc] = await Promise.all([
        api.stats(), api.moulds({ limited: true }), api.moulds({ location: "ISOLATION" }), api.moulds({ needsService: true }),
      ]);
      setStats(s.stats);
      setLimited(l.moulds);
      setWaiting(iso.moulds.filter((m) => m.isolation?.level));
      setDue(svc.moulds.filter((m) => m.serviceDue));
      if (user && can(user, "worklog.report")) setWorkCount((await api.workReport({ range: "month", limit: 1 })).total);
      onSync(true);
    } catch {
      onSync(false);
    }
  }, [user, onSync]);
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const tile = (icon: IconName, label: string, value: number | string, tone = "") => (
    <div className={"rounded-lg border border-solid border-line bg-surface p-4 flex flex-col gap-1 " + tone}>
      <span className="text-sm font-bold text-ink-soft flex items-center gap-1.5"><Icon name={icon} size={16} />{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
  const section = (title: string, list: Mould[]) => list.length > 0 && (
    <section className="mt-6">
      <h3 className="text-md font-extrabold mb-2">{title} <small className="text-ink-soft font-semibold">· {list.length}</small></h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.slice(0, 12).map((m) => <MouldCard key={m.id} mould={m} translations={t} lang={lang} onOpen={openMould} />)}
      </div>
    </section>
  );

  return (
    <main className="pt-5 pb-8 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
      <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Icon name="report" />{t.dashboard.title}</h2>
      <p className="text-sm text-ink-soft mb-4">{t.dashboard.hint}</p>
      {!stats ? <SkeletonCards count={4} label={t.loading} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tile("mould", t.dash.total, stats.total)}
            {tile("attention", t.dashboard.limited, stats.runningWithBlockedCavities ?? 0, (stats.runningWithBlockedCavities ?? 0) ? "bg-warn-bg" : "")}
            {tile("clock", t.dashboard.isolationTooLong, stats.isolationTooLong ?? 0, (stats.isolationTooLong ?? 0) ? "bg-warn-bg" : "")}
            {tile("shots", t.dashboard.serviceDue, due.length, due.length ? "bg-warn-bg" : "")}
            {workCount !== null && tile("worklog", t.dashboard.workThisMonth, t.dashboard.entries(workCount))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <section className="rounded-lg border border-solid border-line bg-surface p-4">
              <h3 className="text-md font-extrabold mb-2">{t.dashboard.byLocation}</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {LOCATIONS.filter((l) => stats.byLocation[l]).map((l) => (
                  <li key={l} className="flex items-center gap-2 text-sm">
                    <Icon name={locationIcon[l]} size={16} /><span className="flex-1">{locationName(l, t)}</span><b className="tabular-nums">{stats.byLocation[l]}</b>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-solid border-line bg-surface p-4">
              <h3 className="text-md font-extrabold mb-2">{t.dashboard.byStatus}</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {[...STATUSES, "RUNNING_LIMITED" as const].filter((s) => stats.byStatus[s]).map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm"><span className="flex-1">{t.status[s]}</span><b className="tabular-nums">{stats.byStatus[s]}</b></li>
                ))}
              </ul>
            </section>
          </div>

          {section(t.dashboard.limited, limited)}
          {section(t.dashboard.isolationTooLong, waiting)}
          {section(t.dashboard.serviceDue, due)}
        </>
      )}
    </main>
  );
}
