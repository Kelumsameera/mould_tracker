"use client";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

import { api } from "@/utils/api";
import { type Dict } from "@/utils/i18n";
import { errorText, formatTime } from "@/utils/format";
import { type AuditEntry } from "@/utils/types";

export default function AuditPage() {
  const { translations, lang } = useApp();

  // Screen state
  const [entityType, setEntityType] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  // Effects: load data and update the screen
  useEffect(() => {
    async function loadAuditEntries() {
      try {
        const response = await api.audit({
          entityType: entityType || undefined,
          page: pageNumber,
          limit: 50,
        });
        setTotal(response.total);
        setEntries((currentEntries) => {
          if (pageNumber === 1) {
            return response.entries;
          }
          return [...currentEntries, ...response.entries];
        });
      } catch (error) {
        toast.error(errorText(error, translations));
      }
    }
    loadAuditEntries();
  }, [entityType, pageNumber, translations, toast]);
  const entityTypes = Object.keys(translations.audit.types) as (keyof Dict["audit"]["types"])[];
  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <div className="flex gap-2 overflow-x-auto [padding:2px_2px_var(--s1)] mb-3 [scrollbar-width:none] max-w-full [&::-webkit-scrollbar]:hidden">
        <button
          className={
            "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
            (!entityType ? " bg-ink! border-ink! text-surface!" : "")
          }
          onClick={() => {
            setEntityType("");
            setPageNumber(1);
          }}
        >
          {translations.audit.all}
        </button>
        {entityTypes.map((mould) => (
          <button
            key={mould}
            className={
              "shrink-0 inline-flex items-center gap-1.5 border-[1.5px] border-solid border-line bg-surface text-ink-soft rounded-pill px-4 py-0 text-sm font-extrabold cursor-pointer min-h-tap" +
              (entityType === mould ? " bg-ink! border-ink! text-surface!" : "")
            }
            onClick={() => {
              setEntityType(mould);
              setPageNumber(1);
            }}
          >
            {translations.audit.types[mould]}
          </button>
        ))}
      </div>
      <div className="text-sm font-bold text-ink-soft mx-1 mt-1 mb-3 flex items-center gap-2 flex-wrap font-sign tracking-[.1px]">
        {translations.audit.count(entries.length, total)}
      </div>
      {!entries.length && <EmptyState icon="audit" text={translations.audit.empty} />}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="bg-surface border border-solid border-line rounded-md p-3 mb-2 cursor-pointer text-sm"
          onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
        >
          <div className="flex gap-2 flex-wrap items-center [&>small]:ml-auto [&>small]:text-ink-faint">
            <b>{entry.action}</b>
            <span>{entry.entityLabel}</span>
            <small>
              {formatTime(entry.createdAt, lang)} · {entry.actor.name}
            </small>
          </div>
          {entry.reason && (
            <div className="font-medium text-ink-soft text-sm [margin-top:2px]">
              {translations.audit.reason}: {entry.reason}
            </div>
          )}
          {expandedEntryId === entry.id && (
            <div className="[&_pre]:bg-surface-2 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-auto [&_pre]:max-h-[260px] [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
              {entry.before && (
                <>
                  <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                    {translations.audit.before}
                  </div>
                  <pre>{JSON.stringify(entry.before, null, 2)}</pre>
                </>
              )}
              {entry.after && (
                <>
                  <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                    {translations.audit.after}
                  </div>
                  <pre>{JSON.stringify(entry.after, null, 2)}</pre>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {entries.length < total && (
        <button
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          {translations.audit.more}
        </button>
      )}
    </main>
  );
}
