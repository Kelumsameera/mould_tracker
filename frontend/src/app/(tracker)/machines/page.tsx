"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import Sheet from "@/components/Sheet";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { errorText } from "@/utils/format";
import { can } from "@/utils/permissions";
import type { Machine } from "@/utils/types";

export default function MachinesPage() {
  const { user, translations, openMould, refreshKey } = useApp();
  const allowed = can(user, "moulds.manage");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Machine | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const text = translations.machineAdmin;

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.machines(true);
      setMachines(response.machines);
    } catch (err) {
      setError(errorText(err, translations));
    } finally {
      setLoading(false);
    }
  }, [allowed, translations]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !allowed || saving || !name.trim()) return;
    setSaving(true);
    try {
      const response = await api.updateMachine(selected.id, { name: name.trim(), active });
      setMachines(current => current.map(machine => machine.id === selected.id
        ? { ...machine, name: response.machine.name, active: response.machine.active } : machine));
      toast.success(translations.feedback.saved);
      setSelected(null);
      void load();
    } catch (err) {
      toast.error(errorText(err, translations));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return null;
  const visible = machines.filter(machine =>
    [machine.code, machine.name, machine.mould?.toolId ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <h2 className="text-lg font-extrabold flex items-center gap-2 mb-3"><Icon name="machine" />{translations.nav.machines}</h2>
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="machine-search">{text.search}</label>
      <input id="machine-search" className="min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] w-full mb-4" type="search" value={query} onChange={event => setQuery(event.target.value)} />
      {loading ? <p role="status">{translations.feedback.working}</p> : error ? (
        <div role="alert"><p>{error}</p><button className="tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" onClick={() => void load()}>{text.retry}</button></div>
      ) : visible.length === 0 ? <p>{text.empty}</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map(machine => (
            <article key={machine.id} className="bg-surface border border-solid border-line rounded-lg p-4">
              <h3 className="font-extrabold text-lg">{machine.code}</h3>
              <p className="break-words">{machine.name}</p>
              <p className="text-sm my-2">{machine.active ? text.active : text.inactive}</p>
              <p className="text-sm">{text.mould}: {machine.mould ? (
                <button className="disabled:text-ink-faint disabled:cursor-default" onClick={() => openMould(machine.mould!.id)}>{machine.mould.toolId}</button>
              ) : text.free}</p>
              <button className="mt-3 tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" onClick={() => { setSelected(machine); setName(machine.name); setActive(machine.active); }}>{text.details}</button>
            </article>
          ))}
        </div>
      )}
      <Sheet open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} label={text.details} closeLabel={translations.nav.closeMenu}>
        {selected && <form onSubmit={save}>
          <h2 className="text-lg font-extrabold mb-4">{selected.code}</h2>
          <p className="text-sm mb-4">{text.codeHint}</p>
          <fieldset disabled={saving} className="border-0 p-0 m-0 min-w-0">
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="machine-name">{text.name}</label>
            <input id="machine-name" className="min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] w-full mb-4" value={name} onChange={event => setName(event.target.value)} required maxLength={150} />
            <label className="flex items-center gap-2 min-h-11">
              <input type="checkbox" checked={active} disabled={Boolean(selected.mould)} onChange={event => setActive(event.target.checked)} />{text.active}
            </label>
            <p className="text-sm my-3">{text.mould}: {selected.mould?.toolId ?? text.free}</p>
            {selected.mould && <p className="text-sm mb-3">{text.unmount}</p>}
            <button className="primary tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" type="submit" disabled={!name.trim() || (name.trim() === selected.name && active === selected.active)}>{saving ? translations.feedback.working : translations.confirm.saveBtn}</button>
          </fieldset>
        </form>}
      </Sheet>
    </main>
  );
}
