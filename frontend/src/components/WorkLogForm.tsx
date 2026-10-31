"use client";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import toast from "react-hot-toast";
import { errorText } from "@/utils/format";
import type { Dict } from "@/utils/i18n";
import { shrink } from "@/utils/imageUpload";
import { WORK_TYPES, type Mould, type Person, type User, type WorkLog, type WorkOutcome, type WorkType, } from "@/utils/types";
import { useEffect, useState } from "react";

const MAX_PHOTOS = 3;

// "2026-10-21T14:05" in local time, for <input type="datetime-local">.
const formatDateForInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

type Props = {
  mould: Mould;
  user: User;
  translations: Dict;
  correcting: WorkLog | null;
  onSaved: (
    warnings: string[],
    outcome: WorkOutcome | null,
    description: string,
  ) => void;
  onCancel: () => void;
};

export default function WorkLogForm({
  mould,
  user,
  translations,
  correcting,
  onSaved,
  onCancel,
}: Props) {
  const { confirm } = useConfirm();
  // Screen state
  const [workers, setWorkers] = useState<Person[]>([]);
  const [type, setType] = useState<WorkType>(correcting?.type ?? "REPAIR");
  const [description, setDescription] = useState(correcting?.description ?? "");
  const [doneBy, setDoneBy] = useState<string[]>(
    correcting?.doneBy.filter((person): person is Person => person.id !== null).map((person) => person.id) ?? [user.id],
  );
  const [when, setWhen] = useState(
    formatDateForInput(correcting ? new Date(correcting.doneAt) : new Date()),
  );
  const [parts, setParts] = useState(correcting?.partsUsed ?? "");
  const [minutes, setMinutes] = useState(
    correcting?.timeSpentMinutes != null
      ? String(correcting.timeSpentMinutes)
      : "",
  );
  const [shots, setShots] = useState("");
  const [outcome, setOutcome] = useState<WorkOutcome | null>(null);
  const [sendToWorkshop, setSendToWorkshop] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");

  // Effects: load data and update the screen
  useEffect(() => {
    async function loadWorkers() {
      try {
        const response = await api.workers();
        setWorkers(response.workers);
      } catch (error) {
        setError(errorText(error, translations));
      }
    }
    loadWorkers();
  }, [translations]);

  // Button and form actions
  function toggleWorker(workerId: string) {
    setDoneBy((selectedWorkerIds) => {
      const isSelected = selectedWorkerIds.includes(workerId);
      if (isSelected) {
        // Keep at least one worker selected.
        if (selectedWorkerIds.length === 1) return selectedWorkerIds;
        return selectedWorkerIds.filter((selectedId) => selectedId !== workerId);
      }
      const nextWorkerIds = [...selectedWorkerIds, workerId];
      return nextWorkerIds.slice(0, 5);
    });
  }
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    try {
      const added = await Promise.all(
        [...files].slice(0, MAX_PHOTOS - photos.length).map(shrink),
      );
      setPhotos((currentPhotos) => [...currentPhotos, ...added].slice(0, MAX_PHOTOS));
    } catch {
      setError(translations.errors.INVALID_PHOTO());
    }
  }

  const needsWork = outcome === "NEEDS_REPAIR" || outcome === "NEEDS_SERVICE";
  async function saveWorkLog() {
    if (busy) return;
    setTried(true);
    if (!description.trim()) return; // shown under the field
    const names = people
      .filter((person) => doneBy.includes(person.id))
      .map((person) => person.name)
      .join(", ");
    const moving = needsWork && sendToWorkshop && mould.location !== "WORKSHOP";
    if (
      !(await confirm({
        title: translations.confirm.workTitle,
        message: translations.confirm.work(mould.toolId, translations.work.types[type], names),
        confirmText: translations.confirm.workBtn,
        note:
          [correcting && translations.confirm.workCorrection, moving && translations.confirm.workMove]
            .filter(Boolean)
            .join(" ") || undefined,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await toast.promise(
        () =>
          api.createWorkLog(mould.id, {
            type,
            description,
            partsUsed: parts,
            doneBy,
            doneAt: new Date(when).toISOString(),
            timeSpentMinutes:
              minutes.trim() === ""
                ? null
                : Math.max(0, Math.floor(Number(minutes))),
            shots:
              shots.trim() === ""
                ? null
                : Math.max(0, Math.floor(Number(shots))),
            outcome,
            sendToWorkshop: needsWork && sendToWorkshop,
            photos,
            version: mould.version,
            ...(correcting ? { correctsId: correcting.id } : {}),
          }),
        {
          loading: translations.feedback.working,
          success: translations.feedback.saved,
          error: (error) => errorText(error, translations),
        },
      );
      onSaved(res.warnings, outcome, description);
    } catch (error) {
      setError(errorText(error, translations));
    } finally {
      setBusy(false);
    }
  }

  // Everyone named in the entry stays visible even if their account is no longer in the list.
  const people = [
    ...workers,
    ...(correcting?.doneBy.filter((person): person is Person => person.id !== null).filter((person) => !workers.some((w) => w.id === person.id)) ??
      []),
  ];
  // UI and inline Tailwind styles
  return (
    <div className="mt-3 [border-top:1px_dashed_var(--line)] pt-1">
      {correcting && (
        <div className="bg-warn-bg text-warn-ink rounded-md p-3 text-sm font-bold mb-3 flex gap-2 items-start">
          {translations.work.correcting}
        </div>
      )}
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.work.type}</label>
      <div className="flex flex-wrap gap-2 mt-2">
        {WORK_TYPES.map((w) => (
          <button
            type="button"
            key={w}
            className={
              "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
              (type === w ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
            }
            onClick={() => setType(w)}
          >
            {translations.work.types[w]}
          </button>
        ))}
      </div>
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wl-what">
        {translations.work.what} *
      </label>
      <textarea
        id="wl-what"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        rows={3}
        maxLength={2000}
        placeholder={translations.work.whatPh}
        value={description}
        aria-invalid={tried && !description.trim()}
        onChange={(event) => setDescription(event.target.value)}
      />
      {tried && !description.trim() && (
        <p
          className="text-danger-ink text-sm font-bold [margin:6px_2px_0] flex items-center gap-1.5"
          role="alert"
        >
          <Icon name="error" size={14} />
          {translations.form.required}
        </p>
      )}

      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.work.who} *</label>
      <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
        {translations.work.whoHint}
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        {people.map((person) => (
          <button
            type="button"
            key={person.id}
            className={
              "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
              (doneBy.includes(person.id) ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
            }
            onClick={() => toggleWorker(person.id)}
          >
            {person.name} <small>{translations.roles[person.role]}</small>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 [gap:0_var(--s3)]">
        <div>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wl-when">
            {translations.work.when}
          </label>
          <input
            id="wl-when"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="datetime-local"
            max={formatDateForInput(new Date())}
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </div>
        <div>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wl-min">
            {translations.work.minutes}
          </label>
          <input
            id="wl-min"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="number"
            min={0}
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
      </div>
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wl-parts">
        {translations.work.parts}
      </label>
      <input
        id="wl-parts"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        maxLength={1000}
        value={parts}
        onChange={(event) => setParts(event.target.value)}
      />
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="wl-shots">
        {translations.work.shots}
      </label>
      <input
        id="wl-shots"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={String(mould.totalShots)}
        value={shots}
        onChange={(event) => setShots(event.target.value)}
      />

      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.work.outcome}</label>
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          type="button"
          className={
            "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
            (outcome === null ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
          }
          onClick={() => setOutcome(null)}
        >
          {translations.work.outcomes.none}
        </button>
        {(["OK", "NEEDS_REPAIR", "NEEDS_SERVICE"] as const).map((o) => (
          <button
            type="button"
            key={o}
            className={
              "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
              (outcome === o ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
            }
            onClick={() => setOutcome(o)}
          >
            {translations.work.outcomes[o]}
          </button>
        ))}
      </div>
      {needsWork && mould.location !== "WORKSHOP" && (
        <>
          <label className="flex items-center gap-2 [margin:var(--s3)_2px] text-md font-bold min-h-tap [&_input]:size-[22px] [&_input]:accent-action">
            <input
              type="checkbox"
              checked={sendToWorkshop}
              onChange={(event) => setSendToWorkshop(event.target.checked)}
            />{" "}
            {translations.work.sendToWorkshop}
          </label>
          <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
            {["MOULD_ROOM", "TOOL_ROOM"].includes(mould.location)
              ? translations.work.roomHint(
                  mould.location === "TOOL_ROOM"
                    ? translations.loc.TOOL_ROOM
                    : translations.mouldRoom,
                )
              : translations.work.stayHint}
          </p>
        </>
      )}

      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.work.photos}</label>
      <div className="flex gap-2 flex-wrap mt-1">
        {photos.map((photoUrl, index) => (
          <button
            type="button"
            key={index}
            className="relative w-[76px] [aspect-ratio:1] rounded-md border border-solid border-line bg-white p-0 overflow-hidden cursor-pointer [&_img]:size-full [&_img]:object-cover [&_span]:absolute [&_span]:top-0.5 [&_span]:right-1.5 [&_span]:font-black [&_span]:text-white [&_span]:[text-shadow:0_0_3px_#000]"
            aria-label={translations.work.removePhoto}
            onClick={() => setPhotos(photos.filter((_, j) => j !== index))}
          >
            <img src={photoUrl} alt="" />
            <span>×</span>
          </button>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="w-[76px] [aspect-ratio:1] rounded-md [border:1.5px_dashed_var(--ink-faint)] flex flex-col gap-1 items-center justify-center text-center text-xs font-extrabold text-ink-soft cursor-pointer p-1">
            <Icon name="camera" size={22} />
            {translations.work.addPhoto}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {error && (
        <div
          className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold flex gap-2 items-start"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="flex gap-2 items-center mt-3 [&>button:first-child]:shrink-0 [&>button:last-child]:flex-1 [&>button:last-child]:mt-0 max-md:in-data-[sheet]:sticky max-md:in-data-[sheet]:bottom-[calc(-1*var(--s4))] max-md:in-data-[sheet]:bg-surface max-md:in-data-[sheet]:pt-3 max-md:in-data-[sheet]:pb-[calc(var(--s3)+var(--safe-b))] max-md:in-data-[sheet]:-mb-4 max-md:in-data-[sheet]:[border-top:1px_solid_var(--line)] max-md:in-data-[sheet]:z-2">
        <button
          className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
          type="button"
          onClick={onCancel}
        >
          <Icon name="cancel" />
          {translations.cancel}
        </button>
        <button
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
          disabled={busy || !doneBy.length || !when}
          onClick={saveWorkLog}
        >
          <Icon name="worklog" />
          {busy ? translations.work.saving : translations.work.save}
        </button>
      </div>
    </div>
  );
}

// "Report a problem": anyone may send it; it never moves the mould or changes its status.
