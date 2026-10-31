"use client";
import { useApp } from "@/components/AppLayout";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/utils/api";
import { locationName } from "@/utils/i18n";
import { errorText, formatTime } from "@/utils/format";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmHost";
import Icon, { workIcon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import SkeletonCards from "@/components/SkeletonCards";
import { TOOL_ID_TAG } from "@/utils/helpers";

// Report tables: a table on wide screens; on phones each row is a stacked card with labelled cells.
const REPORT_TABLE = [
  "w-full [border-collapse:collapse] text-sm",
  "[&_th]:text-left [&_th]:text-xs [&_th]:text-ink-soft [&_th]:px-3 [&_th]:py-2 [&_th]:[border-bottom:1px_solid_var(--line)] [&_th]:whitespace-nowrap [&_th]:bg-surface-2",
  "[&_td]:p-3 [&_td]:[border-bottom:1px_solid_var(--line)] [&_td]:align-top [&_tr:last-child>td]:border-b-0",
  "[&_tbody_tr]:cursor-pointer [&_tbody_tr:hover>td]:bg-surface-2",
  "max-md:block max-md:[&_thead]:hidden max-md:[&_tbody]:block max-md:[&_tr]:block max-md:[&_tr]:w-full max-md:[&_tr]:[border-bottom:1px_solid_var(--line)] max-md:[&_tr]:py-2",
  "max-md:[&_td]:flex max-md:[&_td]:w-full max-md:[&_td]:justify-between max-md:[&_td]:gap-3 max-md:[&_td]:border-0! max-md:[&_td]:px-3 max-md:[&_td]:py-1",
  "max-md:[&_td[data-label]::before]:content-[attr(data-label)] max-md:[&_td[data-label]::before]:font-bold max-md:[&_td[data-label]::before]:text-ink-soft max-md:[&_td[data-label]::before]:text-xs",
].join(" ");
import {
  STATUSES,
  WORK_TYPES,
  type DateRange,
  type Machine,
  type Person,
  type WorkFilter,
  type WorkLog,
  type WorkSummary,
  type WorkType,
} from "@/utils/types";

const PAGE = 20;
const EXPORT_CAP = 5000; // same limit as the server
const RANGES: DateRange[] = ["today", "7d", "30d", "month", "all", "custom"];
const DEFAULT: WorkFilter = { range: "7d" };
type Filters = Omit<WorkFilter, "page" | "limit">;
const storageKey = (userId: string) => `mould-tracker-report:${userId}`;

function loadSaved(userId: string): Filters {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(userId)) || "null");
    return v && typeof v === "object" ? { ...DEFAULT, ...v } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

// Marks the search words in a piece of text.
function highlight(text: string, q: string | undefined): ReactNode {
  const needle = q?.trim();
  if (!needle || !text) return text;
  const parts = text.split(
    new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
  );
  return parts.map((textPart, index) => {
    const isSearchMatch = index % 2 === 1;
    if (isSearchMatch) {
      return <mark key={index}>{textPart}</mark>;
    }
    return textPart;
  });
}

// Work log report (Super Admin / Admin). The server pages, searches, filters and counts; nothing is loaded all at once.

export default function WorkReportPage() {
  const { translations, lang, user, openMould: onOpen } = useApp();
  const userId = user.id;

  const { confirm } = useConfirm();
  // Screen state
  const [filters, setFilters] = useState<Filters>(DEFAULT);
  const [searchText, setSearchText] = useState("");
  const [toolText, setToolText] = useState("");
  const [workers, setWorkers] = useState<Person[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<WorkSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  // Last filters per user on this device.
  // Effects: load data and update the screen
  useEffect(() => {
    const saved = loadSaved(userId);
    setFilters(saved);
    setSearchText(saved.q ?? "");
    setToolText(saved.toolId ?? "");
    api
      .workers()
      .then((response) => setWorkers(response.workers))
      .catch(() => {});
    api
      .machines()
      .then((response) => setMachines(response.machines))
      .catch(() => {});
  }, [userId]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(filters));
    } catch {
      /* storage unavailable */
    }
  }, [filters, userId]);

  useEffect(() => {
    const id = setTimeout(
      () => setFilters((c) => ({ ...c, q: searchText.trim() || undefined })),
      400,
    );
    return () => clearTimeout(id);
  }, [searchText]);
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((c) => ({ ...c, toolId: toolText.trim() || undefined })),
      400,
    );
    return () => clearTimeout(id);
  }, [toolText]);

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPageNumber(1);
  }, [filterKey]);
  useEffect(() => {
    const query = JSON.parse(filterKey) as Filters;
    if (query.range === "custom" && !query.from && !query.to)
      query.range = "all";
    setLoading(true);
    async function loadWorkLogs() {
      try {
        const response = await api.workReport({ ...query, page: pageNumber, limit: PAGE });
        setTotal(response.total);
        setWorkLogs((currentWorkLogs) => {
          if (pageNumber === 1) {
            return response.workLogs;
          }
          return [...currentWorkLogs, ...response.workLogs];
        });
      } catch (error) {
        toast.error(errorText(error, translations));
      } finally {
        setLoading(false);
      }
    }
    async function loadSummary() {
      try {
        const response = await api.workSummary(query);
        setSummary(response);
      } catch {
        setSummary(null);
      }
    }
    loadWorkLogs();
    if (pageNumber === 1) {
      loadSummary();
    }
  }, [filterKey, pageNumber, translations, toast]);

  const updateFilters = (patch: Partial<Filters>) =>
    setFilters((c) => ({ ...c, ...patch }));
  const clearFilters = () => {
    setSearchText("");
    setToolText("");
    setFilters(DEFAULT);
  };
  // Button and form actions
  async function download(format: "csv" | "xlsx") {
    if (exporting || !total || total > EXPORT_CAP) return;
    if (
      !(await confirm({
        title: translations.confirm.exportTitle,
        message: translations.confirm.export(total, format === "xlsx" ? "Excel" : "CSV"),
        confirmText: translations.confirm.exportBtn,
      }))
    )
      return;
    setExporting(true);
    try {
      await toast.promise(
        () => api.downloadWorkLogs(filters, format),
        {
          loading: translations.report.exporting,
          success: translations.feedback.exported,
          error: (error) => errorText(error, translations),
        },
      );
    } catch {
      /* the toast shows why */
    } finally {
      setExporting(false);
    }
  }

  const rangeLabel =
    filters.range === "custom"
      ? [filters.from || "…", filters.to || "…"].join(" – ")
      : translations.report.ranges[filters.range ?? "7d"];
  const person = (id?: string) => workers.find((w) => w.id === id)?.name ?? id;
  const active = useMemo(() => {
    const chips: { key: keyof Filters; label: string; clear: () => void }[] =
      [];
    const add = (filterKey: keyof Filters, label: string, clear?: () => void) =>
      chips.push({
        key: filterKey,
        label,
        clear: clear ?? (() => updateFilters({ [filterKey]: undefined })),
      });
    if (filters.q) add("q", `“${filters.q}”`, () => setSearchText(""));
    if (filters.toolId)
      add("toolId", `${translations.report.mould}: ${filters.toolId}`, () =>
        setToolText(""),
      );
    if (filters.userId)
      add("userId", `${translations.report.person}: ${person(filters.userId)}`);
    if (filters.type) add("type", translations.work.types[filters.type]);
    if (filters.machine) add("machine", filters.machine);
    if (filters.outcome)
      add(
        "outcome",
        filters.outcome === "NONE"
          ? translations.report.noOutcome
          : translations.work.outcomes[filters.outcome],
      );
    if (filters.status)
      add("status", `${translations.report.status}: ${translations.status[filters.status]}`);
    if (filters.problem) add("problem", translations.report.problemOnly);
    return chips;
  }, [filters, workers, translations]);
  const shownTypes: WorkType[] = ["REPAIR", "SERVICE", "MINOR_FIX"];
  const tooMany = total > EXPORT_CAP;

  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <div className="bg-surface rounded-md shadow-card flex items-center gap-2 [padding:4px_6px_4px_var(--s4)] border-[1.5px] border-solid border-line-strong text-ink-faint max-w-[760px] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(245,184,0,.35)]">
        <Icon name="search" size={20} />
        <input
          type="search"
          className="border-0 outline-none flex-1 text-md min-h-tap px-1 py-0 text-ink bg-transparent min-w-0 focus-visible:shadow-none"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={translations.report.search}
          aria-label={translations.report.search}
          enterKeyHint="search"
        />
        {searchText && (
          <button
            className="bg-surface-3 text-ink-soft border-0 rounded-sm w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label={translations.search.clear}
            onClick={() => setSearchText("")}
          >
            <Icon name="cancel" size={18} />
          </button>
        )}
      </div>

      <div
        className="flex gap-2 overflow-x-auto [padding:2px_2px_var(--s1)] mb-3 [scrollbar-width:none] max-w-full [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={translations.report.from}
      >
        {RANGES.map((r) => (
          <button
            key={r}
            className={
              "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
              (filters.range === r ? " bg-ink! border-ink! text-surface!" : "")
            }
            aria-pressed={filters.range === r}
            onClick={() => updateFilters({ range: r })}
          >
            {r === "custom" ? <Icon name="clock" size={15} /> : null}
            {translations.report.ranges[r]}
          </button>
        ))}
      </div>
      {filters.range === "custom" && (
        <div className="grid grid-cols-2 [gap:0_var(--s3)]">
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-from">
              {translations.report.from}
            </label>
            <input
              id="wr-from"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(event) =>
                updateFilters({ from: event.target.value || undefined })
              }
            />
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-to">
              {translations.report.to}
            </label>
            <input
              id="wr-to"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(event) =>
                updateFilters({ to: event.target.value || undefined })
              }
            />
          </div>
        </div>
      )}

      <details className="[&>summary]:cursor-pointer [&>summary]:font-extrabold [&>summary]:text-sm [&>summary]:text-action [&>summary]:min-h-tap [&>summary]:flex [&>summary]:items-center [&>summary]:gap-1.5 [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
        <summary>
          <Icon name="filters" size={16} />
          {translations.report.moreFilters}
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-3 [gap:0_var(--s3)]">
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-tool">
              {translations.report.mould}
            </label>
            <input
              id="wr-tool"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={toolText}
              onChange={(event) => setToolText(event.target.value)}
            />
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-person">
              {translations.report.person}
            </label>
            <select
              id="wr-person"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={filters.userId ?? ""}
              onChange={(event) =>
                updateFilters({ userId: event.target.value || undefined })
              }
            >
              <option value="">{translations.report.anyone}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-type">
              {translations.report.type}
            </label>
            <select
              id="wr-type"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={filters.type ?? ""}
              onChange={(event) =>
                updateFilters({
                  type: (event.target.value || undefined) as WorkType | undefined,
                })
              }
            >
              <option value="">{translations.report.anyType}</option>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {translations.work.types[w]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-machine">
              {translations.report.machine}
            </label>
            <select
              id="wr-machine"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={filters.machine ?? ""}
              onChange={(event) =>
                updateFilters({ machine: event.target.value || undefined })
              }
            >
              <option value="">—</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.code}>
                  {machine.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-outcome">
              {translations.report.outcome}
            </label>
            <select
              id="wr-outcome"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={filters.outcome ?? ""}
              onChange={(event) =>
                updateFilters({
                  outcome: (event.target.value || undefined) as Filters["outcome"],
                })
              }
            >
              <option value="">{translations.report.anyOutcome}</option>
              {(["OK", "NEEDS_REPAIR", "NEEDS_SERVICE"] as const).map((o) => (
                <option key={o} value={o}>
                  {translations.work.outcomes[o]}
                </option>
              ))}
              <option value="NONE">{translations.report.noOutcome}</option>
            </select>
          </div>
          <div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wr-status">
              {translations.report.status}
            </label>
            <select
              id="wr-status"
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={filters.status ?? ""}
              onChange={(event) =>
                updateFilters({
                  status: (event.target.value || undefined) as Filters["status"],
                })
              }
            >
              <option value="">{translations.report.anyStatus}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {translations.status[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 [margin:var(--s3)_2px] text-md font-bold min-h-tap [&_input]:size-[22px] [&_input]:accent-action">
          <input
            type="checkbox"
            checked={filters.problem === "true"}
            onChange={(event) =>
              updateFilters({ problem: event.target.checked ? "true" : undefined })
            }
          />{" "}
          {translations.report.problemOnly}
        </label>
      </details>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5 [margin:var(--s1)_0_var(--s3)] items-center">
          {active.map((c) => (
            <span
              key={c.key}
              className="[&_button]:border-0 [&_button]:bg-action [&_button]:text-white [&_button]:size-7 [&_button]:rounded-full [&_button]:cursor-pointer [&_button]:flex [&_button]:items-center [&_button]:justify-center inline-flex items-center gap-1.5 [border:1px_solid_var(--action)] bg-action-soft text-action-ink rounded-pill [padding:4px_4px_4px_12px] text-xs font-extrabold min-h-9"
            >
              {c.label}
              <button
                aria-label={`${translations.report.remove}: ${c.label}`}
                title={translations.report.remove}
                onClick={c.clear}
              >
                <Icon name="cancel" size={14} />
              </button>
            </span>
          ))}
          <button
            className="bg-transparent border-0 text-action font-extrabold text-xs min-h-8 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default px-1.5"
            onClick={clearFilters}
          >
            {translations.report.clearAll}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 [margin:var(--s3)_0_var(--s4)] flex-wrap">
        <span className="text-sm font-bold text-ink-soft flex items-center gap-2 flex-wrap font-sign tracking-[.1px] m-0">
          {translations.report.showing(workLogs.length, total, rangeLabel)}
        </span>
        <span className="flex-1" />
        <button
          className="w-auto min-h-tap px-4 py-0 rounded-md border-0 text-sm font-semibold cursor-pointer mt-0 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
          disabled={exporting || !total || tooMany}
          onClick={() => download("csv")}
        >
          <Icon name="export" size={16} />
          {exporting
            ? translations.report.exporting
            : total
              ? `${translations.report.exportCsv} (${total})`
              : translations.report.exportNone}
        </button>
        <button
          className="w-auto min-h-tap px-4 py-0 rounded-md border-0 text-sm font-semibold cursor-pointer mt-0 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
          disabled={exporting || !total || tooMany}
          onClick={() => download("xlsx")}
        >
          <Icon name="export" size={16} />
          {exporting
            ? translations.report.exporting
            : total
              ? `${translations.report.exportXlsx} (${total})`
              : translations.report.exportNone}
        </button>
      </div>
      {tooMany && (
        <div className="text-sm text-warn-ink bg-warn-bg rounded-md px-3 py-2 [margin:calc(-1_*_var(--s2))_0_var(--s4)]">
          {translations.report.exportCap(total, EXPORT_CAP)}
        </div>
      )}

      {summary && summary.people.length > 0 && (
        <section className="mb-5">
          <h2 className="text-lg font-extrabold mx-1 mt-2 mb-3 flex items-center gap-2 flex-wrap">
            {translations.report.perPerson} · {rangeLabel}
          </h2>
          <div className="border border-solid border-line rounded-lg bg-surface overflow-hidden">
            <table className={REPORT_TABLE}>
              <thead>
                <tr>
                  <th>{translations.report.person_}</th>
                  {shownTypes.map((w) => (
                    <th key={w}>{translations.work.types[w]}</th>
                  ))}
                  <th>{translations.report.total}</th>
                  <th>{translations.report.minutes}</th>
                </tr>
              </thead>
              <tbody>
                {summary.people.map((person) => (
                  <tr
                    key={person.userId}
                    className={filters.userId === person.userId ? "[&>td]:bg-action-soft!" : ""}
                    onClick={() =>
                      updateFilters({
                        userId:
                          filters.userId === person.userId ? undefined : person.userId,
                      })
                    }
                  >
                    <td className="max-md:block!">
                      <b>{person.name}</b>
                      <small className="block text-ink-soft">
                        {translations.roles[person.role] ?? person.role}
                      </small>
                    </td>
                    {shownTypes.map((w) => (
                      <td key={w} data-label={translations.work.types[w]}>
                        {person.byType[w] ?? 0}
                      </td>
                    ))}
                    <td data-label={translations.report.total}>
                      <b>{person.total}</b>
                    </td>
                    <td data-label={translations.report.minutes}>{person.minutes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {summary && summary.moulds.length > 0 && (
        <section className="mb-5">
          <h2 className="text-lg font-extrabold mx-1 mt-2 mb-3 flex items-center gap-2 flex-wrap">
            {translations.report.repeat}
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {summary.moulds.map((m) => (
              <button
                key={m.mouldId}
                className="inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint"
                onClick={() => onOpen(m.mouldId)}
              >
                {m.toolId} <small>× {m.count}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {!workLogs.length && loading && (
        <SkeletonCards count={3} label={translations.loading} />
      )}
      {!workLogs.length && !loading && (
        <EmptyState icon="worklog" text={translations.report.none} />
      )}
      {workLogs.length > 0 && (
        // A table on wider screens; on phones each row becomes a stacked card (see REPORT_TABLE).
        <div className="border border-solid border-line rounded-lg bg-surface overflow-hidden">
          <table className={REPORT_TABLE}>
            <thead>
              <tr>
                <th>{translations.work.when}</th>
                <th>{translations.report.mould}</th>
                <th>{translations.report.type}</th>
                <th>{translations.work.who}</th>
                <th>{translations.work.what}</th>
                <th>{translations.report.location}</th>
              </tr>
            </thead>
            <tbody>
              {workLogs.map((workLog) => (
                <tr
                  key={workLog.id}
                  tabIndex={0}
                  onClick={() => onOpen(workLog.mouldId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpen(workLog.mouldId);
                  }}
                >
                  <td data-label={translations.work.when}>{formatTime(workLog.doneAt, lang)}</td>
                  <td data-label={translations.report.mould}>
                    <span className={TOOL_ID_TAG}>
                      {highlight(workLog.toolId, filters.q)}
                    </span>
                  </td>
                  <td data-label={translations.report.type}>
                    <span className="flex gap-1.5 flex-wrap">
                      {workLog.problemReported ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-warn-bg text-warn-ink">
                          <Icon name="problem" size={12} />
                          {translations.problem.reportedEntry}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-workshop-bg text-workshop-ink tracking-[.1px]">
                          <Icon name={workIcon[workLog.type]} size={12} />
                          {translations.work.types[workLog.type]}
                        </span>
                      )}
                      {workLog.resolvesProblemId && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-action-soft text-action-ink">
                          {translations.problem.resolvesEntry}
                        </span>
                      )}
                      {workLog.correctsId && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-action-soft text-action-ink">
                          {translations.work.correction}
                        </span>
                      )}
                      {workLog.corrected && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-warn-bg text-warn-ink">
                          {translations.work.corrected}
                        </span>
                      )}
                    </span>
                  </td>
                  <td data-label={translations.work.who}>
                    <b>
                      {workLog.doneBy.map((person, index) => (
                        <span key={person.id ?? `private-${index}`}>
                          {index ? ", " : ""}
                          {highlight(person.name, filters.q)}
                        </span>
                      ))}
                    </b>
                    {workLog.recordedBy.id !== workLog.doneBy[0]?.id && (
                      <small className="block text-ink-soft">
                        {translations.work.recordedBy(workLog.recordedBy.name)}
                      </small>
                    )}
                  </td>
                  <td className="max-md:block!">
                    <div className={"font-medium [margin-top:2px]" + (workLog.corrected ? " line-through opacity-60" : "")}>
                      {highlight(workLog.description, filters.q)}
                    </div>
                    {(workLog.partsUsed || workLog.timeSpentMinutes != null) && (
                      <small className="text-ink-soft">
                        {workLog.partsUsed && highlight(workLog.partsUsed, filters.q)}
                        {workLog.partsUsed && workLog.timeSpentMinutes != null ? " · " : ""}
                        {workLog.timeSpentMinutes != null &&
                          translations.work.minutesShort(workLog.timeSpentMinutes)}
                      </small>
                    )}
                  </td>
                  <td data-label={translations.report.location}>
                    {highlight(
                      [
                        locationName(workLog.location, translations),
                        workLog.machineCode,
                        workLog.rackLocationId,
                      ]
                        .filter(Boolean)
                        .join(" "),
                      filters.q,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {workLogs.length < total && (
        <button
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
          disabled={loading}
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          {loading ? translations.loading : translations.report.more}
        </button>
      )}
    </main>
  );
}
