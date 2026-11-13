"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api, type ConfigProblem, type ConfigVersionMeta } from "@/utils/api";
import { errorText } from "@/utils/format";
import { can, SYSTEM_ADMIN_ONLY, type Permission } from "@/utils/permissions";
import { runtime, type ConfigLocation, type ConfigRole, type ConfigStatus, type ConfigTransition, type WorkflowConfig } from "@/utils/runtimeConfig";

// Workflow Settings: locations, statuses, roles and move rules as data. Edits go into ONE draft; nothing changes
// for anybody until it is published (with a reason). The simulator uses the server's evaluateMove.
type Tab = "locations" | "statuses" | "roles" | "rules" | "simulator" | "versions";
const TABS: Tab[] = ["locations", "statuses", "roles", "rules", "simulator", "versions"];
const input = "min-h-10 px-2 rounded-sm border-[1.5px] border-solid border-line bg-surface-2 text-ink text-sm w-full";
const btn = "min-h-10 px-3 rounded-md border-[1.5px] border-solid border-line bg-surface font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-default";
const primary = "min-h-10 px-3 rounded-md border-0 bg-action text-white font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-default";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const COLORS = ["machine", "floor", "room", "workshop", "warn", "danger", "good"];
const ICONS = ["machine", "floor", "mouldRoom", "workshop", "clock", "attention", "rack", "location", "admin", "good"];
const REQUIRES = ["remarks", "remarksWhenStatus", "dispatchDetails", "intendedDestination"];
const keyOk = (k: string) => /^[A-Z][A-Z0-9_]{1,39}$/.test(k);
const roleKeyOk = (k: string) => /^[a-z][a-z0-9_]{1,39}$/.test(k);

export default function WorkflowPage() {
  const { user, translations: t, lang } = useApp();
  const w = t.workflowAdmin;
  const { confirm } = useConfirm();
  const manage = can(user, "config.manage" as Permission);
  const [tab, setTab] = useState<Tab>("locations");
  const [published, setPublished] = useState<WorkflowConfig | null>(null);
  const [draft, setDraft] = useState<WorkflowConfig | null>(null);
  const [draftMeta, setDraftMeta] = useState<ConfigVersionMeta | null>(null);
  const [versions, setVersions] = useState<ConfigVersionMeta[]>([]);
  const [problems, setProblems] = useState<ConfigProblem[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const label = useCallback((x: { labels: { en: string; si: string } } | undefined, fallback = "") => (x ? x.labels[lang] || x.labels.en : fallback), [lang]);

  const load = useCallback(async () => {
    try {
      const bundle = runtime();
      const cfg = bundle.config ?? (await api.config()).config;
      setPublished(cfg);
      const v = await api.configVersions().catch(() => null);
      setVersions(v?.versions ?? []);
      const d = manage ? await api.configVersion("draft").catch(() => null) : null;
      setDraft(d ? { ...d.config, version: d.meta.version } : null);
      setDraftMeta(d?.meta ?? null);
      setDirty(false);
      setProblems(null);
    } catch (e) {
      toast.error(errorText(e, t));
    }
  }, [manage, t]);
  useEffect(() => { void load(); }, [load]);

  // What the screen shows/edits: the draft when there is one, else the published config (read-only until edited).
  const view = draft ?? published;
  const edit = (fn: (c: WorkflowConfig) => void) => {
    if (!manage || !view) return;
    const next = clone(view);
    fn(next);
    setDraft(next);
    setDirty(true);
  };

  async function run<T>(work: () => Promise<T>, ok?: string) {
    setBusy(true);
    try {
      const r = await work();
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      const details = (e as { details?: { problems?: ConfigProblem[] } }).details;
      if (details?.problems) setProblems(details.problems);
      toast.error(errorText(e, t));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const saveDraft = async () => {
    if (!draft) return;
    const r = await run(() => api.saveConfigDraft(draft, draftMeta?.version), w.savedOk);
    if (r) { setDraftMeta(r.meta); setProblems(r.problems); setDirty(false); }
  };
  const publish = async () => {
    if (!draftMeta || dirty || reason.trim().length < 3) return;
    if (!(await confirm({ title: w.publish, message: w.confirmPublish(draftMeta.version), confirmText: w.publish }))) return;
    if (await run(() => api.publishConfig(reason.trim(), draftMeta.version), w.publishedOk)) { setReason(""); window.location.reload(); }
  };
  const discard = async () => {
    if (!(await confirm({ title: w.discardDraft, message: w.confirmDiscard, confirmText: w.discardDraft, tone: "danger" }))) return;
    if (draftMeta) await run(() => api.discardConfigDraft(reason.trim()));
    await load();
  };

  if (!view) return <main className="p-6" role="status">{t.feedback.working}</main>;
  const locs = [...view.locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const locName = (k: string | null) => (k == null ? w.newMould : label(view.locations.find((l) => l.key === k), k));
  const ro = !manage;

  return (
    <main className="pt-5 pb-10 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1480px]">
      <h2 className="text-lg font-extrabold mb-1 flex items-center gap-2"><Icon name="admin" />{w.title}</h2>
      <p className="text-sm text-ink-soft mb-3">
        {published?.version ? w.published(published.version) : w.builtIn}
        {draftMeta && <> · <b>{w.draft(draftMeta.version)}</b></>}
        {dirty && <> · <span className="text-warn-ink font-bold">{w.unsaved}</span></>}
      </p>
      {ro && <p className="mb-3 p-3 rounded-md bg-surface-2 text-sm">{w.readOnly}</p>}
      {manage && !draft && <p className="mb-3 text-sm text-ink-soft">{w.noDraft}</p>}

      {manage && draft && (
        <section className="mb-4 p-3 rounded-lg border border-solid border-line bg-surface flex flex-wrap gap-2 items-end">
          <button type="button" className={btn} disabled={busy || !dirty} onClick={() => void saveDraft()}>{w.saveDraft}</button>
          <button type="button" className={btn} disabled={busy} onClick={() => void discard()}>{w.discardDraft}</button>
          <label className="flex-1 min-w-[220px] text-sm font-semibold">{w.reason}
            <input className={input} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={w.reasonHint} />
          </label>
          <button type="button" className={primary} disabled={busy || dirty || !draftMeta || reason.trim().length < 3} onClick={() => void publish()}>{w.publish}</button>
        </section>
      )}
      {problems && (
        <section className={"mb-4 p-3 rounded-md text-sm " + (problems.length ? "bg-danger-bg text-danger-ink" : "bg-good-bg text-good-ink")} role="status">
          <b>{problems.length ? w.problems : w.noProblems}</b>
          {problems.length > 0 && <ul className="m-0 mt-1 pl-5">{problems.map((p, i) => <li key={i}>{p.message}</li>)}</ul>}
        </section>
      )}

      <div className="flex gap-1 mb-4 overflow-x-auto [border-bottom:1.5px_solid_var(--line)]" role="tablist">
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={"shrink-0 px-3 min-h-11 bg-transparent border-0 font-extrabold cursor-pointer -mb-[1.5px] " + (tab === x ? "[border-bottom:3px_solid_var(--ink)] text-ink" : "text-ink-soft")}>{w.tabs[x]}</button>
        ))}
      </div>

      {tab === "locations" && <LocationsTab view={view} locs={locs} ro={ro} edit={edit} w={w} />}
      {tab === "statuses" && <StatusesTab view={view} locs={locs} ro={ro} edit={edit} w={w} locName={locName} />}
      {tab === "roles" && <RolesTab view={view} ro={ro} edit={edit} w={w} permissionLabel={(p) => (t.accessAdmin.labels as Record<string, string>)[p] ?? p} />}
      {tab === "rules" && <RulesTab view={view} locs={locs} ro={ro} edit={edit} w={w} locName={locName} />}
      {tab === "simulator" && <SimulatorTab view={view} manage={manage} hasDraft={Boolean(draftMeta)} w={w} locName={locName} statusName={(k) => label(view.statuses.find((s) => s.key === k), k)} />}
      {tab === "versions" && <VersionsTab versions={versions} manage={manage} busy={busy} w={w} reload={load} run={run} confirm={confirm} reason={reason} />}
    </main>
  );
}

type W = ReturnType<typeof useApp>["translations"]["workflowAdmin"];
type Edit = (fn: (c: WorkflowConfig) => void) => void;

function Labels({ value, ro, onChange, w }: { value: { en: string; si: string }; ro: boolean; onChange: (v: { en: string; si: string }) => void; w: W }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      <input className={input} aria-label={w.labelEn} placeholder={w.labelEn} disabled={ro} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
      <input className={input} aria-label={w.labelSi} placeholder={w.labelSi} disabled={ro} value={value.si} onChange={(e) => onChange({ ...value, si: e.target.value })} lang="si" />
    </div>
  );
}
function Check({ checked, ro, label, onChange }: { checked: boolean; ro: boolean; label: string; onChange: (v: boolean) => void }) {
  return <label className="inline-flex items-center gap-1.5 text-xs font-semibold mr-3"><input type="checkbox" disabled={ro} checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function LocationsTab({ view, locs, ro, edit, w }: { view: WorkflowConfig; locs: ConfigLocation[]; ro: boolean; edit: Edit; w: W }) {
  const [newKey, setNewKey] = useState("");
  const upd = (key: string, patch: Partial<ConfigLocation>) => edit((c) => Object.assign(c.locations.find((l) => l.key === key)!, patch));
  const add = () => edit((c) => {
    const key = newKey.trim().toUpperCase();
    const permission = "move." + key.toLowerCase();
    c.locations.push({ key, labels: { en: key, si: key }, kind: "simple", active: true, sortOrder: (locs.at(-1)?.sortOrder ?? 0) + 10, permission, icon: "location", color: "room", statusChange: false, allowNewMoulds: false });
    // New place: no moves yet (edit them in Workflow rules); GOOD may be there.
    for (const from of [null, ...c.locations.map((l) => l.key)]) c.transitions.push({ from, to: key, allowed: false, via: null, permissions: [[permission]], requires: [] });
    for (const l of c.locations) if (l.key !== key) c.transitions.push({ from: key, to: l.key, allowed: false, via: null, permissions: [[l.permission ?? "move." + l.key.toLowerCase()]], requires: [] });
    for (const s of c.statuses) if (s.isGood && Array.isArray(s.allowedLocations)) s.allowedLocations.push(key);
    setNewKey("");
  });
  return (
    <div className="flex flex-col gap-2">
      {locs.map((l) => (
        <div key={l.key} className={"rounded-lg border border-solid border-line bg-surface p-3 " + (l.active === false ? "opacity-60" : "")}>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <b className="font-mono text-sm">{l.key}</b>
            <span className="text-xs text-ink-soft">{w.permission}: <code>{l.permission}</code></span>
            <span className="ml-auto"><Check ro={ro} checked={l.active !== false} label={w.active} onChange={(v) => upd(l.key, { active: v })} /></span>
          </div>
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]">
            <Labels ro={ro} value={l.labels} w={w} onChange={(labels) => upd(l.key, { labels })} />
            <select className={input} aria-label={w.kind} disabled={ro} value={l.kind} onChange={(e) => upd(l.key, { kind: e.target.value as ConfigLocation["kind"] })}>
              {Object.entries(w.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className={input} aria-label={w.icon} disabled={ro} value={l.icon ?? ""} onChange={(e) => upd(l.key, { icon: e.target.value })}>{ICONS.map((i) => <option key={i}>{i}</option>)}</select>
            <select className={input} aria-label={w.color} disabled={ro} value={l.color ?? ""} onChange={(e) => upd(l.key, { color: e.target.value })}>{COLORS.map((i) => <option key={i}>{i}</option>)}</select>
            <input className={input} type="number" min={0} aria-label={w.order} title={w.order} disabled={ro} value={l.sortOrder ?? 0} onChange={(e) => upd(l.key, { sortOrder: Number(e.target.value) })} />
            {l.kind === "transit"
              ? <input className={input} type="number" min={1} aria-label={w.maxWait} title={w.maxWait} disabled={ro} value={l.maxWaitHours ?? 24} onChange={(e) => upd(l.key, { maxWaitHours: Number(e.target.value) })} />
              : <input className={input} type="number" min={0} aria-label={w.capacity} title={w.capacity} disabled={ro} value={l.capacity ?? ""} onChange={(e) => upd(l.key, { capacity: e.target.value === "" ? null : Number(e.target.value) })} />}
          </div>
          <div className="mt-2">
            <Check ro={ro} checked={Boolean(l.statusChange)} label={w.statusChange} onChange={(v) => upd(l.key, { statusChange: v })} />
            <Check ro={ro} checked={Boolean(l.allowNewMoulds)} label={w.allowNewMoulds} onChange={(v) => upd(l.key, { allowNewMoulds: v })} />
            <Check ro={ro} checked={Boolean(l.acceptsStatus)} label={w.acceptsStatus} onChange={(v) => upd(l.key, { acceptsStatus: v })} />
            {l.storage && <span className="text-xs text-ink-soft">{w.storage}: {(l.toolTypes || []).join(", ")}</span>}
            {l.external && <span className="text-xs text-ink-soft ml-2">{w.external}</span>}
          </div>
        </div>
      ))}
      {!ro && (
        <div className="flex gap-2 items-end">
          <label className="text-sm font-semibold">{w.key}<input className={input} value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} placeholder="CALIBRATION_ROOM" title={w.keyHint} /></label>
          <button type="button" className={btn} disabled={!keyOk(newKey) || view.locations.some((l) => l.key === newKey)} onClick={add}><Icon name="add" size={16} />{w.add}</button>
        </div>
      )}
    </div>
  );
}

function KeyChips({ all, value, ro, onChange, anyLabel, name }: { all: string[]; value: string[] | "any"; ro: boolean; onChange: (v: string[] | "any") => void; anyLabel: string; name: (k: string) => string }) {
  const list = value === "any" ? all : value;
  return (
    <div className="flex flex-wrap gap-1">
      <label className="inline-flex items-center gap-1 text-xs font-bold mr-2"><input type="checkbox" disabled={ro} checked={value === "any"} onChange={(e) => onChange(e.target.checked ? "any" : [...all])} />{anyLabel}</label>
      {value !== "any" && all.map((k) => (
        <label key={k} className="inline-flex items-center gap-1 text-xs rounded-pill bg-surface-2 px-2 py-0.5">
          <input type="checkbox" disabled={ro} checked={list.includes(k)} onChange={(e) => onChange(e.target.checked ? [...list, k] : list.filter((x) => x !== k))} />{name(k)}
        </label>
      ))}
    </div>
  );
}

function StatusesTab({ view, locs, ro, edit, w, locName }: { view: WorkflowConfig; locs: ConfigLocation[]; ro: boolean; edit: Edit; w: W; locName: (k: string | null) => string }) {
  const [newKey, setNewKey] = useState("");
  const upd = (key: string, patch: Partial<ConfigStatus>) => edit((c) => Object.assign(c.statuses.find((s) => s.key === key)!, patch));
  const keys = locs.map((l) => l.key);
  return (
    <div className="flex flex-col gap-2">
      {view.statuses.map((s) => (
        <div key={s.key} className={"rounded-lg border border-solid border-line bg-surface p-3 " + (s.active === false ? "opacity-60" : "")}>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <b className="font-mono text-sm">{s.key}</b>
            <select className={input + " w-auto!"} aria-label={w.color} disabled={ro} value={s.color ?? ""} onChange={(e) => upd(s.key, { color: e.target.value })}>{COLORS.map((i) => <option key={i}>{i}</option>)}</select>
            <span className="ml-auto"><Check ro={ro || s.key === "GOOD"} checked={s.active !== false} label={w.active} onChange={(v) => upd(s.key, { active: v })} /></span>
          </div>
          <Labels ro={ro} value={s.labels} w={w} onChange={(labels) => upd(s.key, { labels })} />
          <div className="grid grid-cols-2 gap-1 mt-1">
            <input className={input} placeholder={w.hintEn} disabled={ro} value={s.hint?.en ?? ""} onChange={(e) => upd(s.key, { hint: { en: e.target.value, si: s.hint?.si ?? "" } })} />
            <input className={input} placeholder={w.hintSi} disabled={ro} value={s.hint?.si ?? ""} onChange={(e) => upd(s.key, { hint: { en: s.hint?.en ?? "", si: e.target.value } })} />
          </div>
          <div className="mt-2 text-xs font-bold text-ink-soft">{w.allowedAt}</div>
          <KeyChips all={keys} value={s.allowedLocations} ro={ro} anyLabel={w.anywhere} name={locName} onChange={(v) => upd(s.key, { allowedLocations: v })} />
          <div className="mt-2 text-xs font-bold text-ink-soft">{w.moveTo}</div>
          <KeyChips all={keys} value={s.moveTo} ro={ro} anyLabel={w.anywhere} name={locName} onChange={(v) => upd(s.key, { moveTo: v })} />
          <div className="mt-2">
            {Object.entries(w.statusFlags).map(([flag, text]) => (
              <Check key={flag} ro={ro || (s.key === "GOOD" && flag === "isGood")} checked={Boolean((s as unknown as Record<string, unknown>)[flag])} label={text} onChange={(v) => upd(s.key, { [flag]: v } as Partial<ConfigStatus>)} />
            ))}
          </div>
        </div>
      ))}
      {!ro && (
        <div className="flex gap-2 items-end">
          <label className="text-sm font-semibold">{w.key}<input className={input} value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} placeholder="CALIBRATING" title={w.keyHint} /></label>
          <button type="button" className={btn} disabled={!keyOk(newKey) || view.statuses.some((s) => s.key === newKey)}
            onClick={() => { edit((c) => c.statuses.push({ key: newKey, labels: { en: newKey, si: newKey }, active: true, color: "warn", sortOrder: (c.statuses.length + 1) * 10, allowedLocations: [], moveTo: [] })); setNewKey(""); }}>
            <Icon name="add" size={16} />{w.add}
          </button>
        </div>
      )}
    </div>
  );
}

function RolesTab({ view, ro, edit, w, permissionLabel }: { view: WorkflowConfig; ro: boolean; edit: Edit; w: W; permissionLabel: (p: string) => string }) {
  const [newKey, setNewKey] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const perms = runtime().permissions.filter((p) => !SYSTEM_ADMIN_ONLY.has(p));
  const allPerms = [...new Set([...perms, ...view.locations.map((l) => l.permission).filter(Boolean) as string[]])];
  const upd = (key: string, patch: Partial<ConfigRole>) => edit((c) => Object.assign(c.roles.find((r) => r.key === key)!, patch));
  return (
    <div className="flex flex-col gap-2">
      {view.roles.map((r) => (
        <div key={r.key} className={"rounded-lg border border-solid border-line bg-surface p-3 " + (r.active === false ? "opacity-60" : "")}>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <b className="font-mono text-sm">{r.key}</b>
            <span className="text-xs rounded-pill bg-surface-2 px-2">{r.builtIn ? w.builtInRole : w.customRole}</span>
            {r.locked && <span className="text-xs text-ink-soft">{w.lockedRole}</span>}
            <span className="ml-auto"><Check ro={ro || Boolean(r.locked)} checked={r.active !== false} label={w.active} onChange={(v) => upd(r.key, { active: v })} /></span>
          </div>
          <Labels ro={ro} value={r.labels} w={w} onChange={(labels) => upd(r.key, { labels })} />
          {!r.locked && (
            <button type="button" className="mt-2 bg-transparent border-0 text-action font-extrabold text-sm cursor-pointer p-0" onClick={() => setOpen(open === r.key ? null : r.key)}>
              {w.permissions} ({r.permissions?.length ?? 0}) · {w.assignable} ({r.assignable?.length ?? 0})
            </button>
          )}
          {open === r.key && !r.locked && (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-bold text-ink-soft mb-1">{w.permissions}</div>
                {allPerms.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ro} checked={(r.permissions || []).includes(p)}
                    onChange={(e) => upd(r.key, { permissions: e.target.checked ? [...(r.permissions || []), p] : (r.permissions || []).filter((x) => x !== p) })} />{permissionLabel(p)} <code className="text-xs text-ink-faint">{p}</code></label>
                ))}
              </div>
              <div>
                <div className="text-xs font-bold text-ink-soft mb-1">{w.assignable}</div>
                {view.roles.filter((x) => x.key !== "system_admin").map((x) => (
                  <label key={x.key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ro} checked={(r.assignable || []).includes(x.key)}
                    onChange={(e) => upd(r.key, { assignable: e.target.checked ? [...(r.assignable || []), x.key] : (r.assignable || []).filter((k) => k !== x.key) })} />{x.labels.en}</label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {!ro && (
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm font-semibold">{w.key}<input className={input} value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase())} placeholder="quality_inspector" /></label>
          <label className="text-sm font-semibold">{w.copyFrom}
            <select className={input} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}><option value="">—</option>{view.roles.filter((r) => !r.locked).map((r) => <option key={r.key} value={r.key}>{r.labels.en}</option>)}</select>
          </label>
          <button type="button" className={btn} disabled={!roleKeyOk(newKey) || view.roles.some((r) => r.key === newKey)}
            onClick={() => { edit((c) => c.roles.push({ key: newKey, labels: { en: newKey, si: newKey }, builtIn: false, active: true, sortOrder: (c.roles.length + 1) * 10, permissions: [...(c.roles.find((r) => r.key === copyFrom)?.permissions ?? [])], assignable: [] })); setNewKey(""); }}>
            <Icon name="add" size={16} />{w.add}
          </button>
        </div>
      )}
    </div>
  );
}

function RulesTab({ view, locs, ro, edit, w, locName }: { view: WorkflowConfig; locs: ConfigLocation[]; ro: boolean; edit: Edit; w: W; locName: (k: string | null) => string }) {
  const [cell, setCell] = useState<{ from: string | null; to: string } | null>(null);
  const find = (c: WorkflowConfig, from: string | null, to: string) => c.transitions.find((x) => (x.from ?? null) === from && x.to === to);
  const describe = (t?: ConfigTransition) => (!t || t.allowed === false ? w.cell.off : t.via ? w.cell.via(locName(t.via)) : w.cell.direct);
  const upd = (patch: Partial<ConfigTransition>) => cell && edit((c) => {
    let tr = find(c, cell.from, cell.to);
    if (!tr) { tr = { from: cell.from, to: cell.to, allowed: false, via: null, permissions: [], requires: [] }; c.transitions.push(tr); }
    Object.assign(tr, patch);
  });
  const current = cell ? find(view, cell.from, cell.to) : undefined;
  const fromKeys: (string | null)[] = [null, ...locs.map((l) => l.key)];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="overflow-auto border border-solid border-line rounded-lg">
        <p className="text-xs text-ink-soft p-2 m-0">{w.rulesHint}</p>
        <table className="text-xs border-collapse min-w-full">
          <thead><tr className="bg-surface-2"><th className="p-1.5 sticky left-0 bg-surface-2" />{locs.map((l) => <th key={l.key} className="p-1.5 font-extrabold">{locName(l.key)}</th>)}</tr></thead>
          <tbody>
            {fromKeys.map((from) => (
              <tr key={String(from)} className="[border-top:1px_solid_var(--line)]">
                <th className="p-1.5 text-left sticky left-0 bg-surface font-extrabold whitespace-nowrap">{locName(from)}</th>
                {locs.map((l) => {
                  const tr = find(view, from, l.key);
                  const on = tr && tr.allowed !== false;
                  return (
                    <td key={l.key} className="p-0.5 text-center">
                      <button type="button" onClick={() => setCell({ from, to: l.key })} aria-label={w.summary(locName(from), locName(l.key), describe(tr))}
                        className={"w-full min-h-8 px-1 rounded-sm border border-solid cursor-pointer " + (cell?.from === from && cell?.to === l.key ? "border-ink " : "border-transparent ") + (on ? (tr?.via ? "bg-warn-bg" : "bg-good-bg") : "bg-surface-2 text-ink-faint")}>
                        {describe(tr)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cell && (
        <aside className="rounded-lg border border-solid border-line bg-surface p-3 text-sm flex flex-col gap-2">
          <b>{w.summary(locName(cell.from), locName(cell.to), describe(current))}</b>
          <Check ro={ro} checked={Boolean(current && current.allowed !== false)} label={w.allowed} onChange={(v) => upd({ allowed: v })} />
          <label className="font-semibold">{w.via}
            <select className={input} disabled={ro} value={current?.via ?? ""} onChange={(e) => upd({ via: e.target.value || null })}>
              <option value="">{w.none}</option>{locs.filter((l) => l.key !== cell.to && l.key !== cell.from).map((l) => <option key={l.key} value={l.key}>{locName(l.key)}</option>)}
            </select>
          </label>
          <div className="font-semibold">{w.requires}</div>
          {REQUIRES.map((r) => <Check key={r} ro={ro} checked={(current?.requires || []).includes(r)} label={w.requirement[r]}
            onChange={(v) => upd({ requires: v ? [...(current?.requires || []), r] : (current?.requires || []).filter((x) => x !== r) })} />)}
          <div className="font-semibold">{w.groups}</div>
          {(current?.permissions || []).map((g, i) => (
            <input key={i} className={input} disabled={ro} value={g.join(", ")}
              onChange={(e) => upd({ permissions: (current?.permissions || []).map((x, j) => (j === i ? e.target.value.split(/[,\s]+/).filter(Boolean) : x)).filter((x) => x.length) })} />
          ))}
          {!ro && <button type="button" className={btn} onClick={() => upd({ permissions: [...(current?.permissions || []), [locs.find((l) => l.key === cell.to)?.permission ?? ""]] })}>{w.addGroup}</button>}
        </aside>
      )}
    </div>
  );
}

function SimulatorTab({ view, manage, hasDraft, w, locName, statusName }: { view: WorkflowConfig; manage: boolean; hasDraft: boolean; w: W; locName: (k: string | null) => string; statusName: (k: string) => string }) {
  const [location, setLocation] = useState(view.locations[0]?.key ?? "");
  const [status, setStatus] = useState("GOOD");
  const [to, setTo] = useState(view.locations[1]?.key ?? "");
  const [useDraft, setUseDraft] = useState(false);
  const [role, setRole] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.simulateMove>> | null>(null);
  const [error, setError] = useState("");
  const { translations: t } = useApp();
  const runSim = async () => {
    setError("");
    try {
      setResult(await api.simulateMove({ mould: { location, status }, to, draft: useDraft || undefined, role: role || undefined }));
    } catch (e) { setError(errorText(e, t)); }
  };
  return (
    <div className="max-w-[720px] flex flex-col gap-2">
      <p className="text-sm text-ink-soft">{w.sim.orFake}</p>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm font-semibold">{w.sim.location}<select className={input} value={location} onChange={(e) => setLocation(e.target.value)}>{view.locations.map((l) => <option key={l.key} value={l.key}>{locName(l.key)}</option>)}</select></label>
        <label className="text-sm font-semibold">{w.sim.status}<select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>{view.statuses.map((s) => <option key={s.key} value={s.key}>{statusName(s.key)}</option>)}</select></label>
        <label className="text-sm font-semibold">{w.sim.to}<select className={input} value={to} onChange={(e) => setTo(e.target.value)}>{view.locations.map((l) => <option key={l.key} value={l.key}>{locName(l.key)}</option>)}</select></label>
      </div>
      {manage && (
        <div className="flex flex-wrap gap-3 items-end">
          {hasDraft && <Check ro={false} checked={useDraft} label={w.sim.draft} onChange={setUseDraft} />}
          <label className="text-sm font-semibold">{w.sim.role}<select className={input} value={role} onChange={(e) => setRole(e.target.value)}><option value="">—</option>{view.roles.map((r) => <option key={r.key} value={r.key}>{r.labels.en}</option>)}</select></label>
        </div>
      )}
      <button type="button" className={primary + " self-start"} onClick={() => void runSim()}>{w.sim.run}</button>
      {error && <p className="text-danger-ink text-sm" role="alert">{error}</p>}
      {result && (
        <section className={"rounded-md p-3 text-sm " + (result.verdict.ok ? "bg-good-bg text-good-ink" : "bg-danger-bg text-danger-ink")} aria-live="polite">
          <b>{result.verdict.ok ? w.sim.allowed : w.sim.blocked}</b>
          <div>{w.sim.path}: {result.verdict.path.map((k) => locName(k)).join(" → ")}</div>
          {result.verdict.requiredFields.length > 0 && <div>{w.sim.required}: {result.verdict.requiredFields.join(", ")}</div>}
          {result.verdict.errors.map((e, i) => <div key={i}>{e.message} <code className="text-xs">({e.code})</code></div>)}
          {result.verdict.permissionGroups.length > 0 && <div>{w.sim.permissions}: {result.verdict.permissionGroups.map((g) => g.join(" / ")).join(" + ")}</div>}
        </section>
      )}
    </div>
  );
}

function VersionsTab({ versions, manage, busy, w, reload, run, confirm, reason }: {
  versions: ConfigVersionMeta[]; manage: boolean; busy: boolean; w: W; reload: () => Promise<void>; reason: string;
  run: <T>(work: () => Promise<T>, ok?: string) => Promise<T | undefined>; confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const [diffFor, setDiffFor] = useState<number | null>(null);
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null);
  const showDiff = async (v: ConfigVersionMeta) => {
    setDiffFor(v.version);
    const r = await api.configDiff(v.basedOn ? String(v.basedOn) : "builtin", v.state === "draft" ? "draft" : String(v.version)).catch(() => null);
    setDiff(r?.diff ?? null);
  };
  const rollback = async (v: number) => {
    if (reason.trim().length < 3) return toast.error(w.reasonHint);
    if (!(await confirm({ title: w.versions.rollback, message: w.confirmRollback(v), confirmText: w.versions.rollback, tone: "danger" }))) return;
    if (await run(() => api.rollbackConfig(v, reason.trim()), w.publishedOk)) window.location.reload();
  };
  const exportJson = async () => {
    const r = await run(() => api.exportConfig());
    if (!r) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `workflow-config-v${r.version}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importJson = async (file: File) => {
    if (reason.trim().length < 3) return toast.error(w.reasonHint);
    if (!(await confirm({ title: w.versions.importJson, message: w.confirmImport, confirmText: w.versions.importJson }))) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (await run(() => api.importConfig(parsed.config ?? parsed, reason.trim()), w.savedOk)) await reload();
    } catch { toast.error(w.problems); }
  };
  const summary = useMemo(() => diff && Object.entries(diff).map(([section, v]) => {
    const x = v as { added?: string[]; removed?: string[]; changed?: { key: string }[] } | string[];
    if (Array.isArray(x)) return `${section}: ${x.join(", ")}`;
    return `${section}: ${[x.added?.length ? `${w.versions.added} ${x.added.join(", ")}` : "", x.removed?.length ? `${w.versions.removed} ${x.removed.join(", ")}` : "", x.changed?.length ? `${w.versions.changed} ${x.changed.map((c) => c.key).join(", ")}` : ""].filter(Boolean).join(" · ")}`;
  }), [diff, w]);
  return (
    <div className="flex flex-col gap-2">
      {manage && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={busy} onClick={() => void exportJson()}><Icon name="export" size={16} />{w.versions.exportJson}</button>
          <label className={btn + " inline-flex items-center gap-1"}><Icon name="add" size={16} />{w.versions.importJson}
            <input type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importJson(f); }} />
          </label>
        </div>
      )}
      <table className="text-sm border-collapse w-full">
        <thead><tr className="bg-surface-2 text-left"><th className="p-2">{w.versions.version}</th><th className="p-2">{w.versions.state}</th><th className="p-2">{w.versions.reason}</th><th className="p-2">{w.versions.when}</th><th className="p-2" /></tr></thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version} className="[border-top:1px_solid_var(--line)] align-top">
              <td className="p-2 font-bold">v{v.version}</td>
              <td className="p-2">{w.versions.states[v.state]}</td>
              <td className="p-2">{v.reason}</td>
              <td className="p-2 text-ink-soft">{(v.publishedAt ?? v.updatedAt ?? v.createdAt ?? "").slice(0, 16).replace("T", " ")}</td>
              <td className="p-2 whitespace-nowrap">
                <button type="button" className="bg-transparent border-0 text-action font-extrabold cursor-pointer" onClick={() => void showDiff(v)}>{w.versions.changes}</button>
                {manage && v.state === "archived" && <button type="button" className="bg-transparent border-0 text-danger font-extrabold cursor-pointer ml-2" disabled={busy} onClick={() => void rollback(v.version)}>{w.versions.rollback}</button>}
                {diffFor === v.version && <div className="text-xs mt-1 whitespace-normal">{summary?.length ? summary.map((l) => <div key={l}>{l}</div>) : w.versions.noChanges}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
