"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppLayout";
import RackStructure from "@/components/RackStructure";
import StatusBadge from "@/components/StatusBadge";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { can } from "@/utils/permissions";
import { errorText } from "@/utils/format";
import type { Zone } from "@/utils/types";

export default function RacksPage() {
  const { translations: t, openMould, refreshKey, user } = useApp();
  const text = t.rackLayout;
  const [zones, setZones] = useState<Zone[]>([]);
  const [waiting, setWaiting] = useState<{ id: string; toolId: string }[]>([]);
  const [zoneCode, setZoneCode] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.racks();
      setZones(response.zones); setWaiting(response.awaitingRack); setLoaded(true); setError("");
    } catch (err) { setError(errorText(err, t)); }
  }, [t]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);
  const visible = zones.filter(z => !zoneCode || z.code === zoneCode);
  const racks = visible.flatMap(z => z.racks);
  const selected = racks.find(r => r.id === selectedId);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => needle ? new Set(zones.flatMap(z => z.racks).filter(r => [r.locationId, r.code, ...r.moulds.flatMap(m => [m.toolId, m.size || "", ...(m.items || []).flatMap(i => [i.itemId, i.description])])].some(value => value.toLowerCase().includes(needle))).map(r => r.id)) : undefined, [zones, needle]);
  const rows = racks.filter(r => (!matches || matches.has(r.id)) && (!selectedId || r.id === selectedId)).flatMap(r => r.moulds.map(m => ({ rack: r, mould: m })));
  const open = (id: string) => { if (can(user, "mould.view")) openMould(id); };
  return <main className="p-4 md:p-6 xl:p-8 max-w-[1680px]">
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div><h2 className="text-2xl font-extrabold">{text.title}</h2><p className="text-sm text-ink-soft mt-1">{text.format}: <b className="text-action">A - P1 - 1</b> <span className="ml-2">{text.formatHint}</span></p></div>
      <label className="text-sm font-bold">{t.rackAdmin.zone}<select className="block min-h-11 mt-1 rounded-md border border-line bg-surface px-3 text-ink" value={zoneCode} onChange={e => { setZoneCode(e.target.value); setSelectedId(null); }}><option value="">{t.racks.all}</option>{zones.map(z => <option key={z.code} value={z.code}>{z.name}</option>)}</select></label>
    </div>
    <label htmlFor="storage-search" className="block font-bold text-sm mb-1.5">{text.search}</label>
    <div className="relative mb-5"><span className="absolute left-3 top-3 text-ink-soft"><Icon name="search" /></span><input id="storage-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setSelectedId(null); }} placeholder={text.searchHint} className="w-full min-h-12 pl-10 pr-3 rounded-md border border-line bg-surface text-ink focus:outline-2 focus:outline-action" /></div>
    {error && <div role="alert" className="p-3 mb-4 bg-warn-bg text-warn-ink rounded-md">{error}<button className="ml-3 underline" onClick={() => void load()}>{t.accessAdmin.retry}</button></div>}
    {!loaded && !error && <p role="status">{t.feedback.working}</p>}
    {loaded && <div className="grid gap-5 grid-cols-1 items-start">
      <div className="min-w-0 space-y-5">
        {visible.map(zone => <section key={zone.id} className="border border-line rounded-lg bg-surface p-3 md:p-4">
          <div className="flex items-center justify-between gap-3 mb-4"><h3 className="text-lg font-extrabold">{zone.name} <span className="font-normal text-sm text-ink-soft">{zone.code}</span></h3><span className="text-sm text-ink-soft">{zone.racks.reduce((n, r) => n + r.occupancy, 0)} / {zone.racks.length} {text.positions}</span></div>
          {!zone.racks.length ? <p className="text-ink-soft">{text.noPositions}</p> : <RackStructure racks={zone.racks} translations={t} selected={selectedId} matches={matches} onPick={rack => setSelectedId(id => id === rack.id ? null : rack.id)} />}
        </section>)}
        {!visible.length && <p>{text.noPositions}</p>}
        {waiting.length > 0 && <section className="border border-line rounded-lg bg-surface p-4"><h3 className="font-extrabold mb-2">{t.racks.waiting} ({waiting.length})</h3><p className="text-sm text-ink-soft mb-3">{t.racks.waitingHint}</p><div className="flex flex-wrap gap-2">{waiting.filter(m => !needle || m.toolId.toLowerCase().includes(needle)).map(m => <button key={m.id} disabled={!can(user, "mould.view")} className="border border-line rounded-md bg-surface-2 px-3 min-h-11 font-bold" onClick={() => open(m.id)}>{m.toolId}</button>)}</div></section>}
      </div>
      <section className="min-w-0 border border-line rounded-lg overflow-hidden bg-surface">
        <div className="bg-[#063e87] text-white px-4 py-3 flex items-center justify-between gap-2"><h3 className="font-extrabold text-lg">{selected?.locationId || text.table}</h3>{selectedId && <button className="text-sm underline" onClick={() => setSelectedId(null)}>{text.showAll}</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left border-collapse"><thead className="bg-surface-2"><tr>{[text.mould, text.product, text.description, text.location, text.cavities, text.machine].map(h => <th key={h} className="p-3 border-b border-line whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
          {rows.map(({ rack, mould }) => <tr key={mould.id} className="border-b border-line last:border-0"><td className="p-3 font-bold"><button disabled={!can(user, "mould.view")} className="text-action underline text-left min-h-10" onClick={() => open(mould.id)}>{mould.toolId}</button></td><td className="p-3">{mould.items?.map(i => i.itemId).join(", ") || "—"}</td><td className="p-3 min-w-36">{mould.items?.map(i => i.description).filter(Boolean).join("; ") || "—"}</td><td className="p-3"><button className="font-extrabold text-action whitespace-nowrap" onClick={() => setSelectedId(rack.id)}>{rack.locationId}</button><div className="mt-1"><StatusBadge status={mould.status} translations={t} /></div></td><td className="p-3">{mould.items?.map(i => i.cavities ?? "—").join(", ") || "—"}</td><td className="p-3">{mould.size || mould.capableMachines?.join(", ") || "—"}</td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="p-6 text-ink-soft">{selected ? t.racks.noMoulds : text.noResults}</td></tr>}
        </tbody></table></div>
      </section>
    </div>}
  </main>;
}
