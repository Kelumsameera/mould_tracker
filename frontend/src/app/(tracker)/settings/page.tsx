"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api, type SettingListItem, type SettingsPayload } from "@/utils/api";
import { errorText } from "@/utils/format";
import { I18N, roleName, textEntries } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import { activeRoles } from "@/utils/runtimeConfig";
import type { Role } from "@/utils/types";

// General settings: texts / labels, thresholds & limits, master-data lists, dashboard cards. Changes apply
// at once (confirm + audit); every item shows its default and can be reset. Workflow rules live in /workflow.
type Tab = "texts" | "limits" | "lists" | "dashboards";
const input = "min-h-10 px-2 rounded-sm border-[1.5px] border-solid border-line bg-surface-2 text-ink text-sm w-full";
const btn = "min-h-9 px-3 rounded-md border-[1.5px] border-solid border-line bg-surface font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-default";
const link = "bg-transparent border-0 text-action font-extrabold text-sm cursor-pointer p-0 disabled:text-ink-faint";

export default function SettingsPage() {
  const { user, translations: t } = useApp();
  const s = t.settingsAdmin;
  const { confirm } = useConfirm();
  const editable = can(user, "settings.manage");
  const [tab, setTab] = useState<Tab>("limits");
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.settings()); } catch (e) { toast.error(errorText(e, t)); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  // Confirm, call, report, reload (the app's config bundle is refreshed on the next session refresh).
  async function change(message: string, work: () => Promise<unknown>) {
    if (!editable || !(await confirm({ title: s.title, message, confirmText: s.save }))) return false;
    setBusy(true);
    try { await work(); toast.success(s.saved); await load(); return true; }
    catch (e) { toast.error(errorText(e, t)); return false; }
    finally { setBusy(false); }
  }

  if (!data) return <main className="p-6" role="status">{t.feedback.working}</main>;
  return (
    <main className="pt-5 pb-10 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1200px]">
      <h2 className="text-lg font-extrabold mb-3 flex items-center gap-2"><Icon name="admin" />{s.title}</h2>
      {!editable && <p className="mb-3 p-3 rounded-md bg-surface-2 text-sm">{s.readOnly}</p>}
      <div className="flex gap-1 mb-4 overflow-x-auto [border-bottom:1.5px_solid_var(--line)]" role="tablist">
        {(["texts", "limits", "lists", "dashboards"] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={"shrink-0 px-3 min-h-11 bg-transparent border-0 font-extrabold cursor-pointer -mb-[1.5px] " + (tab === x ? "[border-bottom:3px_solid_var(--ink)] text-ink" : "text-ink-soft")}>{s.tabs[x]}</button>
        ))}
      </div>
      {tab === "limits" && <Limits data={data} editable={editable} busy={busy} change={change} />}
      {tab === "texts" && <Texts data={data} editable={editable} busy={busy} change={change} />}
      {tab === "lists" && <Lists data={data} editable={editable} busy={busy} change={change} />}
      {tab === "dashboards" && <Dashboards data={data} editable={editable} busy={busy} change={change} />}
    </main>
  );
}

type Props = { data: SettingsPayload; editable: boolean; busy: boolean; change: (message: string, work: () => Promise<unknown>) => Promise<boolean> };

function Limits({ data, editable, busy, change }: Props) {
  const { translations: t } = useApp();
  const s = t.settingsAdmin;
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  return (
    <div className="flex flex-col gap-2">
      {data.settings.filter((x) => x.group === "limits").map((x) => {
        const value = draft[x.key] ?? x.value;
        const invalid = x.type === "int" && (!Number.isInteger(value) || (x.min != null && (value as number) < x.min) || (x.max != null && (value as number) > x.max));
        return (
          <div key={x.key} className="rounded-lg border border-solid border-line bg-surface p-3 grid gap-2 md:grid-cols-[1fr_160px_auto] items-center">
            <div>
              <div className="font-bold text-sm">{x.key} {x.modified && <span className="ml-1 text-[11px] rounded-pill bg-warn-bg text-warn-ink px-1.5">{s.modified}</span>}</div>
              <div className="text-xs text-ink-soft">{s.affects}: {x.affects} · {s.codeDefault}: {String(x.default)}{x.min != null ? ` (${x.min}–${x.max})` : ""}</div>
            </div>
            {x.type === "bool"
              ? <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || busy} checked={Boolean(value)} onChange={(e) => setDraft({ ...draft, [x.key]: e.target.checked })} />{String(value)}</label>
              : <input className={input} type="number" disabled={!editable || busy} min={x.min ?? undefined} max={x.max ?? undefined} aria-invalid={invalid} value={String(value)} onChange={(e) => setDraft({ ...draft, [x.key]: e.target.value === "" ? "" : Number(e.target.value) })} />}
            <div className="flex gap-2">
              <button type="button" className={btn} disabled={!editable || busy || invalid || draft[x.key] === undefined || draft[x.key] === x.value}
                onClick={() => void change(s.confirmSave(x.key), () => api.putSetting(x.key, value)).then((ok) => ok && setDraft((d) => { const n = { ...d }; delete n[x.key]; return n; }))}>{s.save}</button>
              <button type="button" className={link} disabled={!editable || busy || !x.modified} onClick={() => void change(s.confirmReset(x.key), () => api.resetSetting(x.key))}>{s.reset}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Texts({ data, editable, busy, change }: Props) {
  const { translations: t } = useApp();
  const s = t.settingsAdmin;
  const [query, setQuery] = useState("");
  const [onlyMissingSi, setOnlyMissingSi] = useState(false);
  const [edits, setEdits] = useState<Record<string, { en: string; si: string }>>({});
  // Code defaults (plain strings only) side by side, EN and SI.
  const rows = useMemo(() => {
    const si = new Map(textEntries(I18N.si));
    return textEntries(I18N.en).map(([key, en]) => ({ key, en, si: si.get(key) ?? "" }));
  }, []);
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => (!q || r.key.toLowerCase().includes(q) || r.en.toLowerCase().includes(q) || r.si.toLowerCase().includes(q) || (data.texts.en[r.key] ?? "").toLowerCase().includes(q))
    && (!onlyMissingSi || !data.texts.si[r.key])).slice(0, 150);
  const exportJson = async () => {
    const r = await api.exportTexts();
    const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "text-overrides.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      await change(s.importJson, () => api.importTexts(parsed.texts ?? parsed));
    } catch { toast.error(s.invalid); }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={input + " flex-1 min-w-[220px]"} type="search" placeholder={s.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMissingSi} onChange={(e) => setOnlyMissingSi(e.target.checked)} />{s.missingSi}</label>
        <button type="button" className={btn} onClick={() => void exportJson()}><Icon name="export" size={14} />{s.exportJson}</button>
        {editable && <label className={btn + " inline-flex items-center gap-1"}><Icon name="add" size={14} />{s.importJson}<input type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importJson(f); }} /></label>}
      </div>
      {visible.map((r) => {
        const cur = edits[r.key] ?? { en: data.texts.en[r.key] ?? "", si: data.texts.si[r.key] ?? "" };
        const overridden = Boolean(data.texts.en[r.key] || data.texts.si[r.key]);
        return (
          <div key={r.key} className="rounded-md border border-solid border-line bg-surface p-2 text-sm">
            <div className="flex gap-2 items-center"><code className="text-xs">{r.key}</code>{overridden && <span className="text-[11px] rounded-pill bg-warn-bg text-warn-ink px-1.5">{s.modified}</span>}</div>
            <div className="grid gap-2 md:grid-cols-2 mt-1">
              <label className="text-xs text-ink-soft">{s.english} · {s.codeDefault}: {r.en}
                <input className={input} disabled={!editable || busy} value={cur.en} placeholder={r.en} onChange={(e) => setEdits({ ...edits, [r.key]: { ...cur, en: e.target.value } })} /></label>
              <label className="text-xs text-ink-soft" lang="si">{s.sinhala} · {s.codeDefault}: {r.si}
                <input className={input} disabled={!editable || busy} value={cur.si} placeholder={r.si} onChange={(e) => setEdits({ ...edits, [r.key]: { ...cur, si: e.target.value } })} /></label>
            </div>
            {editable && (
              <div className="flex gap-3 mt-1">
                <button type="button" className={link} disabled={busy || !edits[r.key]} onClick={() => void change(s.confirmSave(r.key), () => api.putText(r.key, cur.en, cur.si)).then((ok) => ok && setEdits((d) => { const n = { ...d }; delete n[r.key]; return n; }))}>{s.save}</button>
                <button type="button" className={link} disabled={busy || !overridden} onClick={() => void change(s.confirmReset(r.key), () => api.resetText(r.key))}>{s.reset}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Lists({ data, editable, busy, change }: Props) {
  const { translations: t } = useApp();
  const s = t.settingsAdmin;
  const [drafts, setDrafts] = useState<Record<string, SettingListItem[]>>({});
  const [newKey, setNewKey] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-4">
      {data.lists.map((l) => {
        const items = drafts[l.key] ?? l.items;
        const set = (next: SettingListItem[]) => setDrafts({ ...drafts, [l.key]: next });
        const move = (i: number, d: -1 | 1) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; set(n.map((x, j) => ({ ...x, sortOrder: (j + 1) * 10 }))); };
        return (
          <section key={l.key} className="rounded-lg border border-solid border-line bg-surface p-3">
            <h3 className="font-extrabold mb-2">{s.lists[l.key] ?? l.key} {l.modified && <span className="text-[11px] rounded-pill bg-warn-bg text-warn-ink px-1.5">{s.modified}</span>}</h3>
            {items.map((x, i) => (
              <div key={x.key} className={"grid gap-1 md:grid-cols-[140px_1fr_1fr_auto] items-center mb-1 " + (x.active === false ? "opacity-60" : "")}>
                <code className="text-xs">{x.key}</code>
                <input className={input} disabled={!editable || busy} value={x.labels.en} onChange={(e) => set(items.map((y, j) => (j === i ? { ...y, labels: { ...y.labels, en: e.target.value } } : y)))} aria-label={s.english} />
                <input className={input} disabled={!editable || busy} value={x.labels.si} onChange={(e) => set(items.map((y, j) => (j === i ? { ...y, labels: { ...y.labels, si: e.target.value } } : y)))} aria-label={s.sinhala} lang="si" />
                <div className="flex gap-2 whitespace-nowrap">
                  <button type="button" className={link} disabled={!editable || i === 0} onClick={() => move(i, -1)} aria-label={s.moveUp}>↑</button>
                  <button type="button" className={link} disabled={!editable || i === items.length - 1} onClick={() => move(i, 1)} aria-label={s.moveDown}>↓</button>
                  <button type="button" className={link} disabled={!editable} onClick={() => set(items.map((y, j) => (j === i ? { ...y, active: y.active === false } : y)))}>{x.active === false ? s.enable : s.disable}</button>
                </div>
              </div>
            ))}
            {editable && (
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <input className={input + " w-40!"} placeholder={s.listKey} value={newKey[l.key] ?? ""} onChange={(e) => setNewKey({ ...newKey, [l.key]: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />
                <button type="button" className={btn} disabled={!newKey[l.key] || items.some((x) => x.key === newKey[l.key])}
                  onClick={() => { set([...items, { key: newKey[l.key], labels: { en: newKey[l.key], si: newKey[l.key] }, active: true, sortOrder: (items.length + 1) * 10 }]); setNewKey({ ...newKey, [l.key]: "" }); }}>{s.listAdd}</button>
                <button type="button" className={btn} disabled={busy || !drafts[l.key]} onClick={() => void change(s.confirmSave(s.lists[l.key] ?? l.key), () => api.putList(l.key, items)).then((ok) => ok && setDrafts((d) => { const n = { ...d }; delete n[l.key]; return n; }))}>{s.save}</button>
                <button type="button" className={link} disabled={busy || !l.modified} onClick={() => void change(s.confirmReset(s.lists[l.key] ?? l.key), () => api.resetList(l.key))}>{s.reset}</button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Dashboards({ data, editable, busy, change }: Props) {
  const { translations: t } = useApp();
  const s = t.settingsAdmin;
  const current = (data.settings.find((x) => x.key === "dashboard.cards")?.value ?? {}) as Record<string, string[]>;
  const [layout, setLayout] = useState<Record<string, string[]>>(current);
  const roles = (activeRoles() ?? []).map((r) => r.key);
  const all = data.dashboardCards;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{s.dashboardHint}</p>
      {roles.map((role) => {
        const cards = layout[role] ?? all;
        const set = (next: string[]) => setLayout({ ...layout, [role]: next });
        return (
          <section key={role} className="rounded-lg border border-solid border-line bg-surface p-3">
            <h3 className="font-extrabold mb-2">{roleName(role as Role, t)}</h3>
            <div className="flex flex-wrap gap-2">
              {[...cards, ...all.filter((c) => !cards.includes(c))].map((c) => {
                const i = cards.indexOf(c);
                return (
                  <span key={c} className={"inline-flex items-center gap-1 rounded-pill border border-solid border-line px-2 py-1 text-xs " + (i < 0 ? "opacity-60" : "bg-surface-2")}>
                    <input type="checkbox" disabled={!editable} checked={i >= 0} onChange={(e) => set(e.target.checked ? [...cards, c] : cards.filter((x) => x !== c))} />
                    {s.cards[c] ?? c}
                    {i > 0 && <button type="button" className={link + " text-xs!"} disabled={!editable} aria-label={s.moveUp} onClick={() => { const n = [...cards]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }}>←</button>}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
      {editable && (
        <div className="flex gap-3">
          <button type="button" className={btn} disabled={busy} onClick={() => void change(s.confirmSave(s.tabs.dashboards), () => api.putSetting("dashboard.cards", layout))}>{s.save}</button>
          <button type="button" className={link} disabled={busy} onClick={() => void change(s.confirmReset(s.tabs.dashboards), () => api.resetSetting("dashboard.cards")).then((ok) => ok && setLayout({}))}>{s.reset}</button>
        </div>
      )}
    </div>
  );
}
