"use client";
import { locationKeys, setting, statusKeys } from "@/utils/runtimeConfig";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppLayout";
import Icon, { iconForLocation, type IconName } from "@/components/Icon";
import MouldCard from "@/components/MouldCard";
import SkeletonCards from "@/components/SkeletonCards";
import { api } from "@/utils/api";
import { locationName, statusName } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import { CONDITIONAL_STATUS, LOCATIONS, STATUSES, type Mould, type Stats } from "@/utils/types";

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

  // Cards and their order per role: Settings > Dashboards (dashboard.cards); a role without a layout sees all.
  const layout = setting<Record<string, string[]>>("dashboard.cards", {});
  const cards = (user && layout[user.role]) || ["total", "limited", "isolationTooLong", "serviceDue", "workThisMonth", "byLocation", "byStatus"];
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
            {cards.map((card) => {
              if (card === "total") return <div key={card}>{tile("mould", t.dash.total, stats.total)}</div>;
              if (card === "limited") return <div key={card}>{tile("attention", t.dashboard.limited, stats.runningWithBlockedCavities ?? 0, (stats.runningWithBlockedCavities ?? 0) ? "bg-warn-bg" : "")}</div>;
              if (card === "isolationTooLong") return <div key={card}>{tile("clock", t.dashboard.isolationTooLong, stats.isolationTooLong ?? 0, (stats.isolationTooLong ?? 0) ? "bg-warn-bg" : "")}</div>;
              if (card === "serviceDue") return <div key={card}>{tile("shots", t.dashboard.serviceDue, due.length, due.length ? "bg-warn-bg" : "")}</div>;
              if (card === "workThisMonth" && workCount !== null) return <div key={card}>{tile("worklog", t.dashboard.workThisMonth, t.dashboard.entries(workCount))}</div>;
              return null;
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            {cards.includes("byLocation") && <section className="rounded-lg border border-solid border-line bg-surface p-4">
              <h3 className="text-md font-extrabold mb-2">{t.dashboard.byLocation}</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {locationKeys(LOCATIONS).filter((l) => stats.byLocation[l]).map((l) => (
                  <li key={l} className="flex items-center gap-2 text-sm">
                    <Icon name={iconForLocation(l)} size={16} /><span className="flex-1">{locationName(l, t)}</span><b className="tabular-nums">{stats.byLocation[l]}</b>
                  </li>
                ))}
              </ul>
            </section>}
            {cards.includes("byStatus") && <section className="rounded-lg border border-solid border-line bg-surface p-4">
              <h3 className="text-md font-extrabold mb-2">{t.dashboard.byStatus}</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {statusKeys([...STATUSES, CONDITIONAL_STATUS]).filter((s) => stats.byStatus[s]).map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm"><span className="flex-1">{statusName(s, t)}</span><b className="tabular-nums">{stats.byStatus[s]}</b></li>
                ))}
              </ul>
            </section>}
          </div>

          {cards.includes("limited") && section(t.dashboard.limited, limited)}
          {cards.includes("isolationTooLong") && section(t.dashboard.isolationTooLong, waiting)}
          {cards.includes("serviceDue") && section(t.dashboard.serviceDue, due)}
        </>
      )}
    </main>
  );
}
