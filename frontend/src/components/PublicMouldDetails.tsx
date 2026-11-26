"use client";
import { useEffect, useState } from "react";
import { api, type PublicMouldDetail } from "@/utils/api";
import { I18N, type Lang } from "@/utils/i18n";
import { relativeTime } from "@/utils/format";
import Icon from "./Icon";

// Read-only mould and machine details for the public view.
export default function PublicMouldDetails({ id, lang, version }: { id: string; lang: Lang; version: number }) {
  const t = I18N[lang];
  const [mould, setMould] = useState<PublicMouldDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api.publicMould(id).then(data => { if (active) { setMould(data.mould); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id, version]);
  if (failed && !mould) return <p role="alert" className="text-sm text-ink-soft">{t.offlineError}</p>;
  if (!mould) return <p className="text-sm text-ink-soft">{t.loading}</p>;

  const row = (label: string, value: React.ReactNode) => <div className="flex justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
    <dt className="text-ink-soft text-sm">{label}</dt><dd className="text-sm font-bold text-right">{value}</dd>
  </div>;
  const section = "rounded-lg border border-line bg-surface p-3";
  const heading = "text-xs font-extrabold uppercase tracking-wide text-ink-soft mb-2 flex items-center gap-1.5 si:normal-case";

  return <div className="grid gap-3">
    <section className={section}>
      <h3 className={heading}><Icon name="mould" size={15} />{t.publicView.mouldDetails}</h3>
      <dl>
        {mould.size && row(t.detail.size, mould.size)}
        {mould.toolSet && row(t.detail.toolSet, mould.toolSet)}
        {row(t.detail.owner, mould.owner ?? t.detail.ownerNone)}
        {mould.rack && row(t.rackLayout.location, mould.rack)}
        {row(t.publicView.totalCavities, <>{mould.totalCavities || "–"}{mould.blockedCavities > 0 && <span className="ml-2 text-danger">{t.publicView.blocked(mould.blockedCavities)}</span>}</>)}
        {mould.lastMovedAt && row(t.detail.lastMoved, relativeTime(mould.lastMovedAt, lang))}
      </dl>
    </section>

    <section className={section}>
      <h3 className={heading}><Icon name="machine" size={15} />{t.publicView.machineDetails}</h3>
      <dl>
        {mould.machine
          ? <>{row(t.publicView.onMachine, mould.machine.code)}{row(t.publicView.machineName, mould.machine.name)}</>
          : row(t.publicView.onMachine, <span className="text-ink-soft font-normal">{t.publicView.notOnMachine}</span>)}
      </dl>
      <p className="text-xs text-ink-soft mt-3 mb-1">{t.detail.capableMachines}</p>
      {mould.capableMachines.length
        ? <ul className="flex flex-wrap gap-1.5">{mould.capableMachines.map(m => <li key={m.code} className={"rounded-sm border px-2 py-0.5 text-xs " + (m.code === mould.machine?.code ? "border-ink font-bold" : "border-line")}>
            {m.code}{m.name && <span className="text-ink-soft"> · {m.name}</span>}
          </li>)}</ul>
        : <p className="text-sm">{t.detail.none}</p>}
    </section>

    <section className={section}>
      <h3 className={heading}>{t.detail.items}</h3>
      {mould.items.length ? <ul className="grid gap-2">{mould.items.map(item => <li key={item.itemId} className="border-b border-line last:border-b-0 pb-2 last:pb-0">
        <div className="flex justify-between gap-2"><span className="font-bold text-sm">{item.itemId}</span>{item.cavities != null && <span className="text-xs text-ink-soft">{t.detail.cavities(item.cavities)}</span>}</div>
        {item.description && <p className="text-sm">{item.description}</p>}
        {item.material && <p className="text-xs text-ink-soft">{t.detail.material}: {item.material}</p>}
        {item.masterbatch && <p className="text-xs text-ink-soft">{t.detail.masterbatch}: {item.masterbatch}</p>}
      </li>)}</ul> : <p className="text-sm">{t.detail.noItems}</p>}
    </section>
  </div>;
}
