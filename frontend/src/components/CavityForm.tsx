"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api, ApiError } from "@/utils/api";
import { errorText } from "@/utils/format";
import { shrink } from "@/utils/imageUpload";
import type { Dict } from "@/utils/i18n";
import type { Mould } from "@/utils/types";

const field =
  "w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)]";
const label = "block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink";

// "Run with blocked cavities": tap the closed cavities, give a reason, confirm "12 of 16 cavities active".
export default function CavityForm({ mould, translations: t, onDone, onStale, onCancel }: {
  mould: Mould; translations: Dict; onDone: (mould: Mould) => void; onStale: () => void; onCancel: () => void;
}) {
  const { confirm } = useConfirm();
  const total = mould.totalCavities ?? 0;
  const [blocked, setBlocked] = useState<number[]>(mould.blockedCavities ?? []);
  const [reason, setReason] = useState(mould.limitedRun?.reason ?? "");
  const [problemType, setProblemType] = useState(mould.limitedRun?.problemType ?? "");
  const [expectedFixBy, setExpectedFixBy] = useState(mould.limitedRun?.expectedFixBy?.slice(0, 10) ?? "");
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = total - blocked.length;
  const unchanged = [...blocked].sort((a, b) => a - b).join() === [...(mould.blockedCavities ?? [])].sort((a, b) => a - b).join();

  const toggle = (n: number) => setBlocked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)));

  async function save(restoreAll: boolean) {
    if (busy) return;
    const next = restoreAll ? [] : blocked;
    if (!restoreAll && !reason.trim()) return setError(t.cavity.reasonRequired);
    const ok = await confirm({
      title: t.cavity.confirmTitle,
      message: restoreAll ? t.cavity.confirmRestore(mould.toolId) : t.cavity.confirm(mould.toolId, total - next.length, total),
      confirmText: t.confirm.saveBtn,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        blocked: next, reason: reason.trim(), problemType: problemType.trim() || null, photo, version: mould.version,
        expectedFixBy: expectedFixBy ? new Date(expectedFixBy + "T23:59:59").toISOString() : null,
      };
      const { mould: saved } = await toast.promise(() => api.setCavities(mould.id, body), {
        loading: t.feedback.working, success: restoreAll ? t.cavity.restored : t.cavity.saved, error: (e) => errorText(e, t),
      });
      onDone(saved);
    } catch (e) {
      setError(errorText(e, t));
      if (e instanceof ApiError && e.code === "STALE") onStale();
    } finally {
      setBusy(false);
    }
  }

  if (total < 1) {
    return (
      <div className="mt-3 p-3 rounded-md bg-warn-bg text-warn-ink text-sm font-bold" role="status">
        {t.cavity.noCavities}
        <button type="button" className="block mt-2 bg-transparent border-0 text-action font-extrabold text-sm cursor-pointer p-0" onClick={onCancel}>{t.act.cancel}</button>
      </div>
    );
  }

  return (
    <div className="mt-3 [border-top:1px_dashed_var(--line)] pt-1">
      <p className="text-sm text-ink-soft mt-3">{t.cavity.hint}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 mt-3" role="group" aria-label={t.cavity.which}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const closed = blocked.includes(n);
          return (
            <button key={n} type="button" aria-pressed={closed} disabled={busy} onClick={() => toggle(n)}
              className={"min-h-11 rounded-sm border-[1.5px] border-solid font-extrabold text-sm cursor-pointer " +
                (closed ? "bg-danger text-white border-danger line-through" : "bg-surface-2 text-ink border-line")}>
              {n}
            </button>
          );
        })}
      </div>
      <p className={"mt-2 text-sm font-extrabold " + (blocked.length ? "text-warn-ink" : "text-ink-soft")} role="status">{t.cavity.summary(active, total)}</p>

      <label className={label} htmlFor="cav-reason">{t.cavity.reason} *</label>
      <textarea id="cav-reason" className={field} rows={2} maxLength={1000} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        <div>
          <label className={label} htmlFor="cav-type">{t.cavity.problemType}</label>
          <input id="cav-type" className={field} maxLength={100} value={problemType} disabled={busy} onChange={(e) => setProblemType(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="cav-fix">{t.cavity.expectedFix}</label>
          <input id="cav-fix" type="date" className={field} value={expectedFixBy} disabled={busy} onChange={(e) => setExpectedFixBy(e.target.value)} />
        </div>
      </div>
      <label className={label}>{t.cavity.photo}</label>
      <div className="flex gap-2 items-center">
        {photo && <img src={photo} alt="" className="w-19 aspect-square object-cover rounded-md border border-solid border-line" />}
        <label className="w-19 aspect-square rounded-md [border:1.5px_dashed_var(--ink-faint)] flex flex-col gap-1 items-center justify-center text-xs font-extrabold text-ink-soft cursor-pointer">
          <Icon name="camera" size={20} />
          {t.work.addPhoto}
          <input type="file" accept="image/*" capture="environment" hidden disabled={busy}
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(await shrink(f).catch(() => undefined)); }} />
        </label>
      </div>
      {error && <div className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold" role="alert">{error}</div>}
      <div className="flex flex-wrap gap-2 items-center mt-4">
        <button type="button" className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 cursor-pointer inline-flex items-center gap-1.5" onClick={onCancel}>
          <Icon name="cancel" />{t.act.cancel}
        </button>
        {(mould.blockedCavities?.length ?? 0) > 0 && (
          <button type="button" disabled={busy} className="min-h-12 px-4 rounded-md border-[1.5px] border-solid border-line bg-surface text-ink font-semibold cursor-pointer disabled:opacity-50" onClick={() => void save(true)}>
            {t.cavity.restoreAll}
          </button>
        )}
        <button type="button" disabled={busy || unchanged || !blocked.length || active < 1}
          className="flex-1 min-h-12 px-4 rounded-md border-0 bg-action text-white font-semibold cursor-pointer disabled:opacity-50" onClick={() => void save(false)}>
          {t.confirm.saveBtn}
        </button>
      </div>
    </div>
  );
}
