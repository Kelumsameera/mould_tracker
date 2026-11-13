"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { duration, formatTime } from "@/utils/format";
import type { Dict, Lang } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import type { DowntimePeriod, Mould, User } from "@/utils/types";

// Per-mould cavity downtime: which cavities were closed, when, why and who decided. Hidden when never blocked.
export default function CavityDowntime({ mould, user, translations: t, lang, refreshKey }: { mould: Mould; user: User; translations: Dict; lang: Lang; refreshKey?: unknown }) {
  const [periods, setPeriods] = useState<DowntimePeriod[]>([]);
  useEffect(() => {
    let live = true;
    api.cavityDowntime(mould.id).then((r) => live && setPeriods(r.periods)).catch(() => {});
    return () => { live = false; };
  }, [mould.id, mould.version, refreshKey]);
  if (!periods.length) return null;
  const canExport = can(user, "export.run") || can(user, "worklog.report");
  return (
    <div className="bg-surface-2 rounded-lg px-4 py-3 mb-4 border border-solid border-line">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-sm font-extrabold text-ink-soft flex items-center gap-1.5"><Icon name="attention" size={16} />{t.cavity.downtime}</div>
        {canExport && (
          <a className="ml-auto text-action font-extrabold text-sm inline-flex items-center gap-1" href={api.cavityDowntimeCsvUrl(mould.id)} download>
            <Icon name="export" size={14} />CSV
          </a>
        )}
      </div>
      <ul className="list-none m-0 p-0 text-sm flex flex-col gap-2">
        {periods.map((p) => (
          <li key={p.from} className="[border-top:1px_solid_var(--line)] pt-2 first:border-t-0 first:pt-0">
            <b>{formatTime(p.from, lang)} → {p.to ? formatTime(p.to, lang) : t.cavity.open}</b>
            <span className="text-ink-soft"> · {duration(((p.to ? new Date(p.to) : new Date()).getTime() - new Date(p.from).getTime()) / 60000, t)}</span>
            <div>{t.cavity.which}: {p.cavities.join(", ")}</div>
            <div className="text-ink-soft">{p.reason}{p.by ? ` · ${p.by}` : ""}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
