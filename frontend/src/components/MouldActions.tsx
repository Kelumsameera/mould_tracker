"use client";

import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import RackPicker from "@/components/RackPicker";
import { api, ApiError } from "@/utils/api";
import toast from "react-hot-toast";
import { errorText, locationLine } from "@/utils/format";
import { locationName, type Dict } from "@/utils/i18n";
import { can } from "@/utils/permissions";
import { STATUSES, type Location, type Machine, type Mould, type MouldStatus, type MoveInput, type User, type Zone } from "@/utils/types";
import { useEffect, useState } from "react";

export type MouldAction = Location | "STATUS" | "SHOTS";

export default function MouldActions({
  action,
  mould,
  user,
  translations,
  preset = {},
  onDone,
  onStale,
  onCancel,
}: {
  action: MouldAction;
  mould: Mould;
  user: User;
  translations: Dict;
  preset?: { status?: MouldStatus; remarks?: string };
  onDone: (mould: Mould) => void;
  onStale: () => void;
  onCancel: () => void;
}) {
  const { confirm } = useConfirm();
  // Screen state
  const [machines, setMachines] = useState<Machine[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [rack, setRack] = useState<{ id: string; zone: string } | null>(null);
  const [status, setStatus] = useState<MouldStatus | "">(preset.status ?? "");
  const [remarks, setRemarks] = useState(preset.remarks ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [shots, setShots] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Effects: load data and update the screen
  useEffect(() => {
    async function loadDestinations() {
      try {
        if (action === "MACHINE") {
          const response = await api.machines();
          setMachines(response.machines);
        }
        if (action === "MOULD_ROOM") {
          const response = await api.racks();
          setZones(response.zones);
        }
      } catch (error) {
        setError(errorText(error, translations));
      }
    }
    loadDestinations();
  }, [action, translations]);

  const machine = machines.find((x) => x.id === machineId);
  const needsMachineReason = Boolean(machine && !mould.capableMachines.includes(machine.code));
  const needsZoneReason = Boolean(rack && mould.owner && mould.owner !== rack.zone);
  const needsRemarks = action === "WORKSHOP" || action === "STATUS" || action === "OUT_OF_SERVICE" || mould.location === "OUT_OF_SERVICE";
  const canOverride = can(user, "machines.override");

  // Where the mould would go, in the same words as the location line ("Mould Room · FLK · A3").
  // Button and form actions
  function getDestinationLabel() {
    if (action === "MACHINE") return `${locationName("MACHINE", translations)} ${machine?.code ?? ""}`;
    if (action === "MOULD_ROOM") {
      const code = zones.find((z) => z.code === rack?.zone)?.racks.find((r) => r.id === rack?.id)?.code ?? "";
      return `${translations.mouldRoom} · ${rack?.zone} · ${code}`;
    }
    if (action === "WORKSHOP") return locationName("WORKSHOP", translations) + (status ? ` – ${translations.status[status]}` : "");
    return locationName(action as Location, translations);
  }

  async function saveMouldAction() {
    if (busy) return; // no double submit
    const override = (needsMachineReason || needsZoneReason) && reason.trim();
    if (action === "STATUS") {
      if (
        !(await confirm({
          title: translations.confirm.statusTitle,
          message: translations.confirm.status(mould.toolId, translations.status[mould.status], translations.status[status as MouldStatus]),
          confirmText: translations.confirm.statusBtn,
        }))
      )
        return;
    } else if (action !== "SHOTS") {
      if (
        !(await confirm({
          title: translations.confirm.moveTitle,
          message: translations.confirm.move(mould.toolId, locationLine(mould, translations), getDestinationLabel()),
          confirmText: translations.confirm.moveBtn,
          tone: override || action === "OUT_OF_SERVICE" ? "danger" : "default",
          note: override ? translations.confirm.overrideNote(reason.trim()) : undefined,
        }))
      )
        return;
    }
    setBusy(true);
    setError("");
    try {
      const version = mould.version;
      let savedMould: Mould;
      if (action === "STATUS") {
        const response = await toast.promise(() => api.setStatus(mould.id, status, remarks, version), {
          loading: translations.feedback.working,
          success: translations.feedback.statusChanged,
          error: (error) => errorText(error, translations),
        });
        savedMould = response.mould;
      } else if (action === "SHOTS") {
        const response = await toast.promise(() => api.recordShots(mould.id, Number(shots), version), {
          loading: translations.feedback.working,
          success: translations.feedback.shots,
          error: (error) => errorText(error, translations),
        });
        savedMould = response.mould;
      } else {
        const moveDetails: MoveInput = {
          to: action,
          version: version,
          remarks: remarks,
        };
        if (action === "OUT_OF_SERVICE") {
          moveDetails.outOfServiceDetails = { recipientName: recipientName.trim(), address: address.trim(), repairDetails: remarks.trim() };
        }
        if (action === "MACHINE" && machineId) {
          moveDetails.machineId = machineId;
        }
        if (action === "MOULD_ROOM" && rack) {
          moveDetails.rackId = rack.id;
        }
        if (action === "WORKSHOP" && mould.location !== "OUT_OF_SERVICE" && status) {
          moveDetails.status = status;
        }
        if (override) {
          moveDetails.overrideReason = reason;
        }
        const response = await toast.promise(() => api.move(mould.id, moveDetails), {
          loading: translations.feedback.working,
          success: translations.feedback.moved,
          error: (error) => errorText(error, translations),
        });
        savedMould = response.mould;
      }
      onDone(savedMould);
    } catch (error) {
      setError(errorText(error, translations)); // the form stays open with the reason
      if (error instanceof ApiError && error.code === "STALE") onStale();
    } finally {
      setBusy(false);
    }
  }

  let ready = true;
  if (action === "MACHINE") {
    ready = Boolean(machineId);
    if (needsMachineReason && reason.trim() === "") ready = false;
  } else if (action === "MOULD_ROOM") {
    ready = Boolean(rack);
    if (needsZoneReason && reason.trim() === "") ready = false;
  } else if (action === "STATUS") {
    ready = Boolean(status);
  } else if (action === "SHOTS") {
    const shotCount = Number(shots);
    ready = shotCount > 0 && Number.isInteger(shotCount);
  }
  if (needsRemarks && remarks.trim() === "") ready = false;
  if (action === "OUT_OF_SERVICE" && (!recipientName.trim() || !address.trim())) ready = false;

  const capable = machines.filter((x) => mould.capableMachines.includes(x.code));
  const others = machines.filter((x) => !mould.capableMachines.includes(x.code));
  const machineChip = (x: Machine, allowed: boolean) => {
    const occupied = x.mould && x.mould.id !== mould.id;
    return (
      <button
        type="button"
        key={x.id}
        disabled={Boolean(occupied) || !allowed || x.id === mould.machine?.id}
        className={
          "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
          (machineId === x.id ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
        }
        onClick={() => setMachineId(x.id)}
      >
        {x.code} <small>{occupied ? translations.act.occupiedBy(x.mould!.toolId) : translations.act.free}</small>
      </button>
    );
  };

  let saveButtonLabel = translations.confirm.moveBtn;
  if (action === "STATUS") {
    saveButtonLabel = translations.confirm.statusBtn;
  }
  if (action === "SHOTS") {
    saveButtonLabel = translations.act.recordShots;
  }
  if (busy) {
    saveButtonLabel = translations.act.saving;
  }

  // UI and inline Tailwind styles
  return (
    <div className="mt-3 [border-top:1px_dashed_var(--line)] pt-1">
      {action === "OUT_OF_SERVICE" && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="dispatch-name">
            {translations.dispatch.recipientName} *
          </label>
          <input
            id="dispatch-name"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            maxLength={150}
            disabled={busy}
            required
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="dispatch-address">
            {translations.dispatch.address} *
          </label>
          <textarea
            id="dispatch-address"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={3}
            maxLength={500}
            disabled={busy}
            required
          />
        </>
      )}
      {action === "MACHINE" && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.capable}</label>
          <div className="flex flex-wrap gap-2 mt-2">{capable.length ? capable.map((x) => machineChip(x, true)) : <span className="text-ink-soft">{translations.detail.none}</span>}</div>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.other}</label>
          {!canOverride && <p className="text-sm leading-normal text-ink-soft mx-0 mt-2 mb-0">{translations.act.overrideHintMachine}</p>}
          <div className="flex flex-wrap gap-2 mt-2">{others.map((x) => machineChip(x, canOverride))}</div>
          {needsMachineReason && (
            <>
              <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.override}</label>
              <p className="text-sm leading-normal text-ink-soft mx-0 mt-2 mb-0">{translations.act.overrideHintMachine}</p>
              <input
                className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
              />
            </>
          )}
        </>
      )}
      {action === "MOULD_ROOM" && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.chooseRack}</label>
          {zones.length > 0 && (
            <RackPicker zones={zones} value={rack?.id ?? null} preferZone={mould.owner} currentRackId={mould.rack?.id} translations={translations} onChange={(id, zone) => setRack({ id, zone })} />
          )}
          {needsZoneReason && (
            <>
              <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.override}</label>
              <p className="text-sm leading-normal text-ink-soft mx-0 mt-2 mb-0">{translations.act.overrideHintZone(mould.owner!, rack!.zone)}</p>
              <input
                className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
              />
            </>
          )}
        </>
      )}
      {((action === "WORKSHOP" && mould.location !== "OUT_OF_SERVICE") || action === "STATUS") && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.act.status}</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {action === "WORKSHOP" && (
              <button
                type="button"
                className={
                  "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
                  (status === "" ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
                }
                onClick={() => setStatus("")}
              >
                {translations.act.keepStatus}
              </button>
            )}
            {STATUSES.filter((s) => s !== mould.status && (action === "STATUS" || s !== "GOOD")).map((s) => (
              <button
                type="button"
                key={s}
                className={
                  "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
                  (status === s ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
                }
                onClick={() => setStatus(s)}
              >
                {translations.status[s]}
              </button>
            ))}
          </div>
        </>
      )}
      {action === "SHOTS" && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="shots">
            {translations.act.shots}
          </label>
          <input
            id="shots"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={shots}
            onChange={(event) => setShots(event.target.value)}
          />
        </>
      )}
      {action !== "SHOTS" && (
        <>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="remarks">
            {action === "OUT_OF_SERVICE" ? translations.dispatch.repairDetails : translations.act.remarks}
            {needsRemarks ? " *" : ""}
          </label>
          {needsRemarks && <p className="text-sm leading-normal text-ink-soft mx-0 mt-2 mb-0">{translations.act.remarksHint}</p>}
          <textarea
            id="remarks"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
            rows={2}
            maxLength={2000}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </>
      )}
      {error && (
        <div className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold flex gap-2 items-start" role="alert">
          {error}
        </div>
      )}
      <div className="flex gap-2 items-center mt-3 [&>button:first-child]:shrink-0 [&>button:last-child]:flex-1 [&>button:last-child]:mt-0 max-md:in-data-sheet:sticky max-md:in-data-sheet:-bottom-(--s4) max-md:in-data-sheet:bg-surface max-md:in-data-sheet:pt-3 max-md:in-data-sheet:pb-[calc(var(--s3)+var(--safe-b))] max-md:in-data-sheet:-mb-4 max-md:in-data-sheet:[border-top:1px_solid_var(--line)] max-md:in-data-sheet:z-2">
        <button
          className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
          type="button"
          onClick={onCancel}
        >
          <Icon name="cancel" />
          {translations.act.cancel}
        </button>
        <button
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
          disabled={!ready || busy}
          onClick={saveMouldAction}
        >
          {saveButtonLabel}
        </button>
      </div>
    </div>
  );
}
