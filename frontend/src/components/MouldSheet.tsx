"use client";
import { useConfirm } from "@/components/ConfirmHost";
import Icon, { locationIcon, type IconName } from "@/components/Icon";
import LastWork from "@/components/LastWork";
import Lightbox from "@/components/Lightbox";
import DispatchDetails from "@/components/DispatchDetails";
import LocationLine from "@/components/LocationLine";
import Sheet from "@/components/Sheet";
import StatusBadge from "@/components/StatusBadge";
import WorkLogForm from "@/components/WorkLogForm";
import { api, assetUrl } from "@/utils/api";
import toast from "react-hot-toast";
import { errorText, formatTime, movementText, relativeTime } from "@/utils/format";
import { TOOL_ID_TAG } from "@/utils/helpers";

const ACTION_BTN = "min-h-14 px-3 py-2 rounded-md border-[1.5px] border-solid border-line bg-surface-2 text-ink text-sm font-extrabold cursor-pointer flex items-center justify-center gap-2 text-left leading-[1.3] [transition:border-color_var(--fast),background_var(--fast)]";
// Panel behind the location line, and history dots, per location.
const WHERE_BG: Record<string, string> = { MACHINE: "bg-machine-bg", PRODUCTION_FLOOR: "bg-floor-bg", MOULD_ROOM: "bg-room-bg", TOOL_ROOM: "bg-room-bg", WORKSHOP: "bg-workshop-bg" };
const DOT_TONE: Record<string, string> = { MACHINE: "bg-machine-bg text-machine", PRODUCTION_FLOOR: "bg-floor-bg text-floor", MOULD_ROOM: "bg-room-bg text-room", TOOL_ROOM: "bg-room-bg text-room", WORKSHOP: "bg-workshop-bg text-workshop" };
import { locationName, type Dict, type Lang } from "@/utils/i18n";
import { can, canMoveTo } from "@/utils/permissions";
import { type Mould, type MouldStatus, type Movement, type User, type WorkLog, type WorkOutcome } from "@/utils/types";
import { useCallback, useEffect, useState } from "react";
import MouldActions, { type MouldAction } from "./MouldActions";
import ProblemForm from "./ProblemForm";


type Entry =
  | { kind: "move"; at: string; movement: Movement }
  | { kind: "work"; at: string; workLog: WorkLog };

type Props = {
  id: string | null;
  user: User;
  refreshKey: number;
  translations: Dict;
  lang: Lang;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (mould: Mould) => void;
};

export default function MouldSheet({
  id,
  user,
  translations,
  lang,
  refreshKey,
  onClose,
  onChanged,
  onEdit,
}: Props) {
  // Screen state
  const [mould, setMould] = useState<Mould | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [action, setAction] = useState<MouldAction | null>(null);
  const [preset, setPreset] = useState<{
    status?: MouldStatus;
    remarks?: string;
  }>({});
  const [work, setWork] = useState<{ correcting: WorkLog | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [problemOpen, setProblemOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "move" | "work">("all");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, ask } = useConfirm();

  const loadMouldDetails = useCallback(async () => {
    if (!id) return;
    try {
      const [mouldResponse, historyResponse, workLogsResponse] = await Promise.all([
        api.mould(id),
        api.history(id),
        can(user, "worklog.view") ? api.workLogs(id) : Promise.resolve({ workLogs: [] }),
      ]);
      setMould(mouldResponse.mould);
      setHistory(historyResponse.history);
      setWorkLogs(workLogsResponse.workLogs);
    } catch (error) {
      toast.error(errorText(error, translations));
    }
  }, [id, translations, toast, user]);

  // Effects: load data and update the screen
  useEffect(() => {
    setMould(null);
    setHistory([]);
    setWorkLogs([]);
    setAction(null);
    setWork(null);
    setNotice("");
    setFilter("all");
    setProblemOpen(false);
  }, [id]);
  useEffect(() => {
    loadMouldDetails();
  }, [loadMouldDetails, refreshKey]);

  // Each action displays its own toast; this only refreshes the details.
  const handleMouldUpdated = (mould: Mould) => {
    setMould(mould);
    setAction(null);
    setPreset({});
    setNotice("");
    onChanged();
    api
      .history(mould.id)
      .then((h) => setHistory(h.history))
      .catch(() => {});
  };

  // After a work log: refresh, show any warning, and offer the Workshop move when the status could not be set in place.
  const handleWorkSaved = (
    warnings: string[],
    outcome: WorkOutcome | null,
    description: string,
  ) => {
    setWork(null);
    setNotice(warnings.map((w) => translations.work.warnings[w] ?? w).join(" "));
    onChanged();
    loadMouldDetails();
    if (
      mould &&
      warnings.includes("WORKSHOP_MOVE_REQUIRED") &&
      canMoveTo(user, mould.location, "WORKSHOP") &&
      (outcome === "NEEDS_REPAIR" || outcome === "NEEDS_SERVICE")
    ) {
      setPreset({ status: outcome, remarks: description });
      setAction("WORKSHOP");
    }
  };

  // Button and form actions
  async function deleteMould() {
    if (!mould || busy) return;
    const reason = await ask({
      title: translations.confirm.deleteMouldTitle,
      message: translations.confirm.deleteMould(mould.toolId),
      confirmText: translations.confirm.deleteBtn,
      tone: "danger",
      inputLabel: translations.confirm.reason,
      maxLength: 1000,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await toast.promise(
        () => api.deleteMould(mould.id, reason),
        {
          loading: translations.feedback.working,
          success: translations.feedback.deleted,
          error: (error) => errorText(error, translations),
        },
      );
      onChanged();
      loadMouldDetails();
    } catch {
      /* toast shows why */
    } finally {
      setBusy(false);
    }
  }
  async function restoreMould() {
    if (!mould || busy) return;
    if (
      !(await confirm({
        title: translations.confirm.restoreMouldTitle,
        message: translations.confirm.restoreMould(mould.toolId),
        confirmText: translations.confirm.restoreBtn,
      }))
    )
      return;
    setBusy(true);
    try {
      const r = await toast.promise(
        () => api.restoreMould(mould.id),
        {
          loading: translations.feedback.working,
          success: translations.feedback.restored,
          error: (error) => errorText(error, translations),
        },
      );
      handleMouldUpdated(r.mould);
    } catch {
      /* toast shows why */
    } finally {
      setBusy(false);
    }
  }

  const canLog = Boolean(mould && !mould.deletedAt && can(user, "worklog.create"));
  const canReport = Boolean(mould && !mould.deletedAt && can(user, "problem.report"));
  const problemSaved = () => {
    setProblemOpen(false);
    onChanged();
    loadMouldDetails();
  };
  // "Resolve or act": open the Workshop move with the reported problem as the remark.
  const actOnProblem = () => {
    if (!mould?.openProblem) return;
    setWork(null);
    setProblemOpen(false);
    setPreset({ status: "NEEDS_REPAIR", remarks: mould.openProblem.text });
    setAction("WORKSHOP");
  };
  const timeline: Entry[] = [];
  if (filter !== "work") {
    for (const movement of history) {
      timeline.push({ kind: "move", at: movement.createdAt, movement: movement });
    }
  }
  if (filter !== "move") {
    for (const workLog of workLogs) {
      timeline.push({ kind: "work", at: workLog.doneAt, workLog: workLog });
    }
  }
  timeline.sort((firstEntry, secondEntry) => {
    return secondEntry.at.localeCompare(firstEntry.at);
  });
  const getWorkLocation = (workLog: WorkLog) =>
    [locationName(workLog.location, translations), workLog.machineCode, workLog.rackLocationId]
      .filter(Boolean)
      .join(" ");
  const actions: { key: MouldAction; label: string }[] = [];
  const actionIcon: Record<MouldAction, IconName> = {
    MACHINE: "machine",
    PRODUCTION_FLOOR: "floor",
    MOULD_ROOM: "mouldRoom",
    TOOL_ROOM: "mouldRoom",
    WORKSHOP: "workshop",
    OUT_OF_SERVICE: "attention",
    STATUS: "busy",
    SHOTS: "shots",
  };
  if (mould && !mould.deletedAt) {
    const good = mould.status === "GOOD";
    if (good && canMoveTo(user, mould.location, "MACHINE"))
      actions.push({
        key: "MACHINE",
        label: mould.location === "MACHINE" ? translations.act.changeMachine : translations.act.mount,
      });
    if (
      good &&
      mould.location !== "PRODUCTION_FLOOR" &&
      canMoveTo(user, mould.location, "PRODUCTION_FLOOR")
    )
      actions.push({ key: "PRODUCTION_FLOOR", label: translations.act.toFloor });
    if (mould.toolType === "EXTRUSION_DIE") {
      if (
        good &&
        mould.location !== "TOOL_ROOM" &&
        canMoveTo(user, mould.location, "TOOL_ROOM")
      )
        actions.push({
          key: "TOOL_ROOM",
          label: translations.act.toMouldRoom(translations.loc.TOOL_ROOM),
        });
    } else if (good && canMoveTo(user, mould.location, "MOULD_ROOM"))
      actions.push({
        key: "MOULD_ROOM",
        label:
          mould.location === "MOULD_ROOM" && mould.rack
            ? translations.act.changeRack
            : translations.act.toMouldRoom(translations.mouldRoom),
      });
    if (mould.location !== "WORKSHOP" && canMoveTo(user, mould.location, "WORKSHOP"))
      actions.push({ key: "WORKSHOP", label: mould.location === "OUT_OF_SERVICE" ? translations.act.returnToWorkshop : translations.act.toWorkshop });
    if (canMoveTo(user, mould.location, "OUT_OF_SERVICE"))
      actions.push({ key: "OUT_OF_SERVICE", label: translations.act.outOfService });
    if (mould.location === "WORKSHOP" && can(user, "workshop.work"))
      actions.push({ key: "STATUS", label: translations.act.changeStatus });
    if (
      mould.location === "MACHINE" &&
      (can(user, "moves.machine") || can(user, "workshop.work"))
    )
      actions.push({ key: "SHOTS", label: translations.act.recordShots });
  }

  // UI and inline Tailwind styles
  return (
    <Sheet
      open={Boolean(id)}
      onClose={onClose}
      label={mould?.toolId ?? ""}
      closeLabel={translations.close}
    >
      {!mould ? (
        <div role="status" aria-label={translations.loading}>
          <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-sm h-7 mb-4 w-[40%]" />
          <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-lg h-[88px] mb-4" />
          <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-lg h-[120px]" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap pr-[52px] min-h-tap">
            <span className={TOOL_ID_TAG + " text-[17px]! px-2.5!"}>
              {mould.toolId}
            </span>
            <span className="inline-flex items-center font-extrabold text-xs text-ink-soft bg-surface-2 [padding:2px_9px] rounded-pill border border-solid border-line">
              {translations.toolTypes[mould.toolType]}
            </span>
            <StatusBadge status={mould.status} translations={translations} />
            {mould.owner && (
              <span className="inline-flex items-center font-extrabold text-xs text-ink-soft bg-surface-2 [padding:2px_9px] rounded-pill border border-solid border-line">
                {mould.owner}
              </span>
            )}
          </div>
          {mould.deletedAt && (
            <div className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold flex gap-2 items-start">
              {translations.detail.deletedBanner}
            </div>
          )}

          <div
            className={
              "rounded-lg p-4 [margin:var(--s3)_0] " +
              (WHERE_BG[mould.location] ?? "")
            }
          >
            <LocationLine mould={mould} translations={translations} big />
            {mould.outOfServiceDetails && <DispatchDetails details={mould.outOfServiceDetails} translations={translations} lang={lang} />}
            {mould.lastMovedAt && (
              <div className="text-sm text-ink-soft mt-2 flex items-center gap-1.5">
                <Icon name="clock" size={14} />
                {translations.detail.lastMoved}: {relativeTime(mould.lastMovedAt, lang)}
                {mould.lastMovedBy ? ` · ${mould.lastMovedBy.name}` : ""}
              </div>
            )}
          </div>
          {mould.lastWork && <LastWork mould={mould} translations={translations} lang={lang} />}
          {mould.openProblem && (
            <div className="bg-danger-bg [border:1.5px_solid_var(--danger-line)] rounded-lg p-3 mb-4">
              <div className="text-sm font-extrabold text-danger-ink flex items-center gap-1.5">
                <Icon name="problem" size={16} />
                {translations.problem.open(
                  mould.openProblem.by.name,
                  formatTime(mould.openProblem.at, lang),
                )}
              </div>
              <div className="text-md font-semibold [margin:var(--s1)_0_var(--s2)]">
                {mould.openProblem.text}
              </div>
              {canLog && (
                <>
                  <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                    {translations.problem.act}
                  </div>
                  <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
                    {translations.problem.actHint}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={ACTION_BTN}
                      onClick={() => {
                        setWork({ correcting: null });
                        setAction(null);
                        setProblemOpen(false);
                      }}
                    >
                      <Icon name="worklog" />
                      {translations.problem.logWork}
                    </button>
                    {mould.location !== "WORKSHOP" &&
                      canMoveTo(user, mould.location, "WORKSHOP") && (
                        <button
                          className={ACTION_BTN}
                          onClick={actOnProblem}
                        >
                          <Icon name="workshop" />
                          {translations.problem.sendToWorkshop}
                        </button>
                      )}
                  </div>
                </>
              )}
            </div>
          )}
          {mould.serviceDue && (
            <div className="bg-warn-bg text-warn-ink rounded-md p-3 text-sm font-bold mb-3 flex gap-2 items-start">
              {translations.detail.serviceDue}
            </div>
          )}
          {notice && (
            <div className="bg-warn-bg text-warn-ink rounded-md p-3 text-sm font-bold mb-3 flex gap-2 items-start">
              {notice}
            </div>
          )}

          {(actions.length > 0 || canLog || canReport) && (
            <div className="border-[1.5px] border-solid border-line rounded-lg p-3 mb-4 bg-surface">
              <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                {translations.act.title}
              </div>
              {canLog && (
                <button
                  className={
                    ACTION_BTN + " w-full mb-2 border-transparent! bg-workshop-bg! text-workshop-ink! " +
                    (work ? "border-workshop!" : "")
                  }
                  onClick={() => {
                    setWork(work ? null : { correcting: null });
                    setAction(null);
                    setProblemOpen(false);
                  }}
                >
                  <Icon name="worklog" size={20} />
                  {translations.work.log}
                </button>
              )}
              {canReport && (
                <button
                  className={
                    ACTION_BTN + " w-full mb-2 border-transparent! bg-danger-bg! text-danger-ink! " +
                    (problemOpen ? "border-danger!" : "")
                  }
                  onClick={() => {
                    setProblemOpen(!problemOpen);
                    setWork(null);
                    setAction(null);
                  }}
                >
                  <Icon name="problem" size={20} />
                  {translations.problem.report}
                </button>
              )}
              {problemOpen && (
                <ProblemForm
                  mould={mould}
                  translations={translations}
                  onSaved={problemSaved}
                  onCancel={() => setProblemOpen(false)}
                />
              )}
              {work && (
                <WorkLogForm
                  key={work.correcting?.id ?? "new"}
                  mould={mould}
                  user={user}
                  translations={translations}
                  correcting={work.correcting}
                  onSaved={handleWorkSaved}
                  onCancel={() => setWork(null)}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    className={
                      ACTION_BTN + " " +
                      (action === a.key ? "border-action! bg-action-soft! text-action-ink!" : "")
                    }
                    onClick={() => {
                      setAction(action === a.key ? null : a.key);
                      setPreset({});
                      setWork(null);
                      setProblemOpen(false);
                    }}
                  >
                    <Icon name={actionIcon[a.key]} size={20} />
                    {a.label}
                  </button>
                ))}
              </div>
              {action && (
                <MouldActions
                  key={action + (preset.status ?? "")}
                  action={action}
                  mould={mould}
                  user={user}
                  translations={translations}
                  preset={preset}
                  onDone={handleMouldUpdated}
                  onStale={loadMouldDetails}
                  onCancel={() => setAction(null)}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Fact
              label={translations.detail.shots}
              value={translations.detail.shotsOf(mould.totalShots, mould.shotsToService)}
            />
            <Fact
              label={translations.detail.capableMachines}
              value={
                mould.capableMachines.length
                  ? mould.capableMachines.join(", ")
                  : translations.detail.none
              }
            />
            <Fact
              label={translations.detail.owner}
              value={mould.owner ?? translations.detail.ownerNone}
            />
            {mould.toolSetCount && (
              <Fact label={translations.detail.toolSet} value={mould.toolSetCount} />
            )}
            {mould.size && <Fact label={translations.detail.size} value={mould.size} />}
            {mould.lastServicedAt && (
              <Fact
                label={translations.detail.lastServiced}
                value={formatTime(mould.lastServicedAt, lang)}
              />
            )}
            {mould.remarks && <Fact label={translations.detail.remarks} value={mould.remarks} />}
            {mould.notes && <Fact label={translations.detail.notes} value={mould.notes} />}
          </div>

          <div className="bg-surface-2 rounded-lg px-4 py-3 mb-4 border border-solid border-line">
            <div className="text-sm font-extrabold text-ink-soft mb-2 flex items-center gap-1.5">
              <Icon name="mould" size={16} />
              {translations.detail.items}
            </div>
            {!mould.items?.length && (
              <div className="text-ink-faint text-sm">
                {translations.detail.noItems}
              </div>
            )}
            {mould.items?.map((it) => (
              <div
                className="flex gap-3 [padding:var(--s3)_0] [border-bottom:1px_solid_var(--line)] last:border-b-0 text-sm"
                key={it.id}
              >
                {it.images[0] ? (
                  <button
                    className="w-[76px] [aspect-ratio:1] shrink-0 rounded-md border border-solid border-line bg-white p-0 overflow-hidden cursor-zoom-in [&_img]:size-full [&_img]:object-contain"
                    onClick={() => setImage(assetUrl(it.images[0].url))}
                    aria-label={translations.detail.openImage}
                  >
                    <img
                      src={assetUrl(it.images[0].thumbUrl)}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="w-[76px] [aspect-ratio:1] shrink-0 rounded-md border border-solid border-line bg-surface-3 p-0 overflow-hidden cursor-default flex items-center justify-center text-ink-faint">
                    <Icon name="image" size={22} />
                  </div>
                )}
                <div className="flex-1 min-w-0 [&_small]:text-xs">
                  <b>{it.itemId}</b>
                  {it.cavities != null && (
                    <small> · {translations.detail.cavities(it.cavities)}</small>
                  )}
                  <div>{it.description}</div>
                  {(it.materialId || it.qas) && (
                    <small className="text-ink-soft">
                      {[
                        it.qas && `${translations.detail.qas} ${it.qas}`,
                        it.materialId &&
                          `${translations.detail.material} ${it.materialId}`,
                        it.masterbatchId &&
                          `${translations.detail.masterbatch} ${it.masterbatchId}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                  {it.notes && (
                    <small className="text-ink-soft block">
                      {it.notes}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface-2 rounded-lg px-4 py-3 mb-4 border border-solid border-line [max-height:none]">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="text-sm font-extrabold text-ink-soft m-0 flex items-center gap-1.5">
                <Icon name="history" size={16} />
                {translations.detail.history}
              </div>
              <div className="ml-auto flex gap-1">
                {(["all", "move", "work"] as const).map((f) => (
                  <button
                    key={f}
                    className={
                      "border border-solid rounded-pill px-3 py-0 text-xs font-extrabold cursor-pointer min-h-9 " +
                      (filter === f ? "bg-ink border-ink text-surface" : "border-line bg-surface text-ink-soft")
                    }
                    onClick={() => setFilter(f)}
                  >
                    {f === "all"
                      ? translations.timeline.all
                      : f === "move"
                        ? translations.timeline.moves
                        : translations.timeline.work}
                  </button>
                ))}
              </div>
            </div>
            {!timeline.length && (
              <div className="text-ink-faint text-sm">
                {translations.detail.historyEmpty}
              </div>
            )}
            {timeline.map((entry) =>
              entry.kind === "move" ? (
                <div
                  className="flex items-start gap-3 [padding:var(--s3)_0] [border-bottom:1px_solid_var(--line)] last:border-b-0 text-sm"
                  key={"m" + entry.movement.id}
                >
                  <span
                    className={
                      "w-7 h-7 [border-radius:50%] shrink-0 flex items-center justify-center " +
                      ((entry.movement.toLocation && DOT_TONE[entry.movement.toLocation]) || "bg-surface-3 text-ink-soft")
                    }
                  >
                    <Icon
                      name={
                        entry.movement.type === "MOVED" && entry.movement.toLocation
                          ? locationIcon[entry.movement.toLocation]
                          : entry.movement.type === "STATUS_CHANGED"
                            ? "busy"
                            : "history"
                      }
                      size={15}
                    />
                  </span>
                  <div className="font-bold flex-1 min-w-0">
                    {movementText(entry.movement, translations)}
                    {entry.movement.outOfServiceDetails && <DispatchDetails details={entry.movement.outOfServiceDetails} translations={translations} lang={lang} />}
                    {entry.movement.remarks && entry.movement.remarks !== entry.movement.outOfServiceDetails?.repairDetails && (
                      <div className="font-medium text-ink-soft text-sm [margin-top:2px]">
                        {entry.movement.remarks}
                      </div>
                    )}
                    {entry.movement.overrideReason && (
                      <div className="font-medium text-ink-soft text-sm [margin-top:2px]">
                        {translations.hist.override}: {entry.movement.overrideReason}
                      </div>
                    )}
                    {entry.movement.by && (
                      <div className="font-semibold text-ink-faint text-xs [margin-top:2px] flex items-center gap-1.5 flex-wrap">
                        {entry.movement.by.name}
                      </div>
                    )}
                  </div>
                  <span className="text-ink-faint text-xs whitespace-nowrap">
                    {formatTime(entry.movement.createdAt, lang)}
                  </span>
                </div>
              ) : (
                <div
                  className={
                    "flex items-start gap-3 [padding:var(--s3)_0] [border-bottom:1px_solid_var(--line)] last:border-b-0 text-sm"
                  }
                  key={"w" + entry.workLog.id}
                >
                  <span className="w-7 h-7 [border-radius:50%] shrink-0 flex items-center justify-center bg-workshop-bg text-workshop">
                    <Icon
                      name={entry.workLog.problemReported ? "problem" : "worklog"}
                      size={15}
                    />
                  </span>
                  <div className="font-bold flex-1 min-w-0">
                    {!entry.workLog.problemReported && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-workshop-bg text-workshop-ink tracking-[.1px]">
                        {translations.work.types[entry.workLog.type]}
                      </span>
                    )}
                    {entry.workLog.problemReported && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-warn-bg text-warn-ink">
                        {translations.problem.reportedEntry}
                      </span>
                    )}
                    {entry.workLog.resolvesProblemId && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-action-soft text-action-ink">
                        {translations.problem.resolvesEntry}
                      </span>
                    )}
                    {entry.workLog.correctsId && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-action-soft text-action-ink">
                        {translations.work.correction}
                      </span>
                    )}
                    {entry.workLog.corrected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] tracking-[.1px] bg-warn-bg text-warn-ink">
                        {translations.work.corrected}
                      </span>
                    )}
                    <div className="font-extrabold text-sm mt-1 flex items-center gap-1.5">
                      {entry.workLog.doneBy
                        .map((person) => person.role ? `${person.name} (${translations.roles[person.role] ?? person.role})` : person.name)
                        .join(", ")}
                    </div>
                    <div className={"font-medium [margin-top:2px]" + (entry.workLog.corrected ? " line-through opacity-60" : "")}>
                      {entry.workLog.description}
                    </div>
                    {(entry.workLog.partsUsed || entry.workLog.timeSpentMinutes != null) && (
                      <div className="font-medium text-ink-soft text-sm [margin-top:2px]">
                        {[
                          entry.workLog.partsUsed,
                          entry.workLog.timeSpentMinutes != null &&
                            translations.work.minutesShort(entry.workLog.timeSpentMinutes),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    <div className="font-medium text-ink-soft text-sm [margin-top:2px]">
                      {[
                        getWorkLocation(entry.workLog),
                        entry.workLog.statusAfter !== entry.workLog.statusBefore &&
                          translations.work.statusChange(
                            translations.status[entry.workLog.statusBefore],
                            translations.status[entry.workLog.statusAfter],
                          ),
                        entry.workLog.sentToWorkshop && translations.work.movedToWorkshop,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {entry.workLog.photos.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        {entry.workLog.photos.map((ph, index) => (
                          <button
                            key={index}
                            className="relative w-14 [aspect-ratio:1] rounded-md border border-solid border-line bg-white p-0 overflow-hidden cursor-pointer [&_img]:size-full [&_img]:object-cover"
                            onClick={() => setImage(assetUrl(ph.url))}
                            aria-label={translations.detail.openImage}
                          >
                            <img
                              src={assetUrl(ph.thumbUrl)}
                              alt=""
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="font-semibold text-ink-faint text-xs [margin-top:2px] flex items-center gap-1.5 flex-wrap">
                      {translations.work.recordedBy(entry.workLog.recordedBy.name)}
                      {canLog && !entry.workLog.corrected && !entry.workLog.problemReported && (
                        <button
                          className="bg-transparent border-0 text-action font-extrabold text-xs min-h-8 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default px-1.5"
                          onClick={() => {
                            setWork({ correcting: entry.workLog });
                            setAction(null);
                          }}
                        >
                          {translations.work.correct}
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="text-ink-faint text-xs whitespace-nowrap">
                    {formatTime(entry.workLog.doneAt, lang)}
                  </span>
                </div>
              ),
            )}
          </div>

          {can(user, "moulds.manage") &&
            (mould.deletedAt ? (
              <button
                className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
                disabled={busy}
                onClick={restoreMould}
              >
                <Icon name="restore" />
                {translations.detail.restore}
              </button>
            ) : (
              <>
                <button
                  className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
                  onClick={() => onEdit(mould)}
                >
                  <Icon name="edit" />
                  {translations.detail.edit}
                </button>
                {mould.location !== "MACHINE" && (
                  <button
                    className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 text-danger"
                    disabled={busy}
                    onClick={deleteMould}
                  >
                    <Icon name="delete" />
                    {translations.detail.remove}
                  </button>
                )}
              </>
            ))}
        </>
      )}
      <Lightbox src={image} onClose={() => setImage(null)} />
    </Sheet>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-surface-2 border border-solid border-line rounded-md px-3 py-2 min-w-0">
    <span className="flex items-center gap-[5px] text-xs font-bold text-ink-soft">{label}</span>
    <b className="block text-sm mt-0.5 break-words">{value}</b>
  </div>
);

// The form for one action. Server rules decide; this only collects what the move needs.
