"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Highlight from "@/components/Highlight";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { locationLine } from "@/utils/format";
import type { Dict } from "@/utils/i18n";
import { MAX_QUERY, queryWords, readRecent, rememberSearch } from "@/utils/search";
import type { Mould, ToolType } from "@/utils/types";

// Find search box: live results (onSearch, debounced by the parent page) plus a suggestions list while typing.
// Keyboard: ↑ ↓ move, Enter opens the highlighted suggestion (or shows all results), Esc closes.
export const SEARCH_EVENT = "mt:search"; // other components can set the search text (e.g. "Did you mean …?")

type Row = { mould: Mould; kind: "mould" | "item" };

export default function SearchBox({ translations: t, placeholder, userId, toolType, onSearch, onOpenMould }: {
  translations: Dict; placeholder: string; userId: string; toolType?: ToolType;
  onSearch: (q: string) => void; onOpenMould: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Results list (debounced) and suggestions (200 ms, stale requests cancelled).
  useEffect(() => {
    const h = setTimeout(() => onSearch(text.trim()), 250);
    return () => clearTimeout(h);
  }, [text, onSearch]);
  useEffect(() => {
    if (!queryWords(text).length) { setRows([]); return; }
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const r = await api.suggest(text, toolType, ctrl.signal);
        setRows([...r.moulds.map((m) => ({ mould: m, kind: "mould" as const })), ...r.items.map((m) => ({ mould: m, kind: "item" as const }))].slice(0, 8));
        setActive(-1);
      } catch {
        /* aborted or offline: keep the previous suggestions, no flicker */
      }
    }, 200);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [text, toolType]);
  useEffect(() => {
    input.current?.focus();
    const onExternal = (e: Event) => { const q = String((e as CustomEvent).detail ?? ""); setText(q); onSearch(q); };
    window.addEventListener(SEARCH_EVENT, onExternal);
    return () => window.removeEventListener(SEARCH_EVENT, onExternal);
  }, [onSearch]);

  const showRecent = open && !text && recent.length > 0;
  const showRows = open && rows.length > 0 && Boolean(text);
  const choose = (row: Row) => { rememberSearch(userId, text); setOpen(false); onOpenMould(row.mould.id); };
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const n = rows.length;
      if (n) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showRows && active >= 0) return choose(rows[active]);
      rememberSearch(userId, text);
      setOpen(false);
      onSearch(text.trim()); // full result list
    }
  }
  const clear = () => { setText(""); onSearch(""); setRows([]); input.current?.focus(); };

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md border-[1.5px] border-solid border-line-strong bg-surface shadow-card pl-3 pr-1 text-ink-faint focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(245,184,0,.35)]">
      <Icon name="search" size={18} />
      <input
        ref={input}
        className="min-w-0 flex-1 h-10 border-0 bg-transparent px-0 py-0 text-[15px] text-ink outline-none focus-visible:shadow-none"
        type="search" inputMode="search" autoComplete="off" enterKeyHint="search" maxLength={MAX_QUERY}
        value={text} placeholder={placeholder} aria-label={placeholder}
        role="combobox" aria-expanded={showRows || showRecent} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => { setRecent(readRecent(userId)); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {text && (
        <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-0 bg-surface-3 text-ink-soft cursor-pointer" aria-label={t.search.clear} onClick={clear}>
          <Icon name="cancel" size={16} />
        </button>
      )}
      {(showRows || showRecent) && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 m-0 p-1 list-none rounded-md border border-solid border-line bg-surface text-ink shadow-card max-h-[70vh] overflow-y-auto">
          {showRecent && (
            <>
              <li className="px-2 pt-1 pb-0.5 text-xs font-extrabold text-ink-soft" role="presentation">{t.search.recent}</li>
              {recent.map((r) => (
                <li key={r} role="option" aria-selected={false}>
                  <button type="button" className="w-full text-left bg-transparent border-0 px-2 min-h-tap cursor-pointer flex items-center gap-2" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(r); onSearch(r); }}>
                    <Icon name="history" size={14} />{r}
                  </button>
                </li>
              ))}
            </>
          )}
          {showRows && rows.map((row, i) => {
            const first = i === 0 || rows[i - 1].kind !== row.kind;
            return (
              <li key={row.kind + row.mould.id} role="presentation">
                {first && <div className="px-2 pt-1.5 pb-0.5 text-xs font-extrabold text-ink-soft">{row.kind === "mould" ? t.search.suggestMoulds : t.search.suggestItems}</div>}
                <button
                  id={`${listId}-${i}`} role="option" aria-selected={i === active} type="button"
                  className={"w-full text-left border-0 rounded-sm px-2 py-1.5 min-h-tap cursor-pointer flex flex-col " + (i === active ? "bg-surface-2" : "bg-transparent")}
                  onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(row)}
                >
                  <span className="font-extrabold text-sm"><Highlight text={row.mould.toolId} query={text} /></span>
                  {row.mould.matchedItem && (
                    <span className="text-xs">
                      <Highlight text={row.mould.matchedItem.itemId} query={text} /> – <Highlight text={row.mould.matchedItem.description} query={text} />
                    </span>
                  )}
                  <span className="text-xs text-ink-soft">{locationLine(row.mould, t)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
