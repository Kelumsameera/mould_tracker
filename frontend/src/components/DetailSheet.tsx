"use client";
import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { api } from "@/lib/api";
import { I18N, type Lang } from "@/lib/i18n";
import { formatTime, isOverdue, matchedProduct, movementDot, movementText, overdueDays, toolMainName } from "@/lib/helpers";
import type { MachineInfo, Movement, Tool } from "@/lib/types";

const ICONS = {
  store: <path d="M3 9.5 12 4l9 5.5V19a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />,
  machine: (
    <>
      <circle cx="12" cy="12" r="3.2" stroke="#fff" strokeWidth="1.8" />
      <path d="M12 4v2.4M12 17.6V20M20 12h-2.4M6.4 12H4M17 7l-1.7 1.7M8.7 15.3 7 17M17 17l-1.7-1.7M8.7 8.7 7 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  taken: <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
};

export default function DetailSheet({
  tool,
  lang,
  query,
  highlightPid,
  threshold,
  canEdit,
  isAdmin,
  machines,
  historyKey,
  onClose,
  onAssign,
  onTakeOut,
  onReturn,
  onEdit,
  onDelete,
}: {
  tool: Tool | null;
  lang: Lang;
  query: string;
  highlightPid: string | null;
  threshold: number;
  canEdit: boolean;
  isAdmin: boolean;
  machines: MachineInfo[];
  historyKey: number;
  onClose: () => void;
  onAssign: (t: Tool, machineName: string) => Promise<void>;
  onTakeOut: (t: Tool, note: string) => Promise<void>;
  onReturn: (t: Tool) => Promise<void>;
  onEdit: (t: Tool) => void;
  onDelete: (t: Tool) => Promise<void>;
}) {
  const t = I18N[lang];
  const [machineName, setMachineName] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [busy, setBusy] = useState(false);
  const id = tool?.id;

  useEffect(() => {
    setMachineName("");
    setNote("");
  }, [id]);
  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .history(id)
      .then((d) => {
        if (live) setHistory(d.history);
      })
      .catch(() => {
        if (live) setHistory([]);
      });
    return () => {
      live = false;
    };
  }, [id, historyKey]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (!tool)
    return (
      <Sheet open={false} onClose={onClose} label="Tool">
        {null}
      </Sheet>
    );

  const mp = highlightPid ? tool.products.find((p) => p.pid === highlightPid) : matchedProduct(tool, query);
  const overdue = isOverdue(tool, threshold);
  const recents = machines.filter((m) => m.toolCode && m.id !== tool.machine?.id).slice(0, 6);
  const statusValue = tool.status === "store" ? t.store : tool.status === "taken" ? t.taken + (tool.takenNote ? ` — ${tool.takenNote}` : "") : (tool.machine?.name ?? "");

  return (
    <Sheet open onClose={onClose} label={tool.toolCode}>
      <div>
        <span className="detail-id">{tool.toolCode}</span>
        {tool.size && <span className="detail-size">{tool.size}T Machine</span>}
      </div>
      <h2 className="detail-name">{mp?.desc || toolMainName(tool) || tool.toolCode}</h2>

      <div className={"status-panel " + tool.status}>
        <div className={"status-icon " + tool.status}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {ICONS[tool.status]}
          </svg>
        </div>
        <div>
          <div className="status-title">{t.currentLocation}</div>
          <div className="status-value">
            {statusValue}
            {overdue ? ` — ${t.overdueDays(overdueDays(tool))}` : ""}
          </div>
        </div>
      </div>

      {tool.products.length > 0 && (
        <div className="products-box">
          <div className="products-title">{t.productsTitle}</div>
          {tool.products.map((p) => (
            <div key={p.pid} className={"product-row" + (mp?.pid === p.pid ? " highlight" : "")}>
              <span className="pid">{p.pid}</span>
              <span className="pdesc">{p.desc}</span>
              {p.cav > 0 && <span className="pcav">{p.cav} cav</span>}
            </div>
          ))}
        </div>
      )}

      <div className="history-box">
        <div className="history-title">{t.historyTitle}</div>
        {history === null && <div className="history-empty">…</div>}
        {history && history.length === 0 && <div className="history-empty">{t.historyEmpty}</div>}
        {history?.slice(0, 10).map((m) => (
          <div className="history-row" key={m.id}>
            <span className={"history-dot " + movementDot(m)} />
            <span className="history-text">{movementText(m, lang)}</span>
            <span className="history-time">{formatTime(m.createdAt, lang)}</span>
          </div>
        ))}
      </div>

      {canEdit && (
        <div>
          <label className="field-label">{t.assignLabel}</label>
          <input className="field-input" value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder={t.machinePh} />
          {recents.length > 0 && (
            <div className="quick-machines">
              {recents.map((m) => (
                <button type="button" key={m.id} className="quick-chip" onClick={() => setMachineName(m.name)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => onAssign(tool, machineName))}>
            {t.assignBtn}
          </button>

          <label className="field-label">{t.takenLabel}</label>
          <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.takenPh} />
          <button className="btn btn-taken" disabled={busy} onClick={() => run(() => onTakeOut(tool, note))}>
            {t.takenBtn}
          </button>

          {tool.status !== "store" && (
            <button className="btn btn-store" disabled={busy} onClick={() => run(() => onReturn(tool))}>
              {overdue ? t.storeNowBtn : t.returnBtn}
            </button>
          )}
          <button className="btn btn-outline" disabled={busy} onClick={() => onEdit(tool)}>
            {t.editBtn}
          </button>
          {isAdmin && (
            <button className="btn btn-outline danger" disabled={busy} onClick={() => run(() => onDelete(tool))}>
              {t.deleteBtn}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
