"use client";
import { useApp } from "@/components/AppLayout";
import { can } from "@/utils/permissions";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import RackStructure from "@/components/RackStructure";
import { useConfirm, type ConfirmOptions } from "@/components/ConfirmHost";
import toast from "react-hot-toast";
import { api } from "@/utils/api";

import { errorText } from "@/utils/format";
import { type Rack, type Zone } from "@/utils/types";

export default function RackAdminPage() {
  const { translations, user } = useApp();
  const canEdit = can(user, "rack.manage");

  const { confirm, ask } = useConfirm();
  // Screen state
  const [zones, setZones] = useState<Zone[]>([]);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [bulkForm, setBulkForm] = useState({
    zone: "",
    rowFrom: "A",
    rowTo: "C",
    from: "1",
    to: "4",
    palletFrom: "1",
    palletTo: "3",
    capacity: "1",
  });
  const [bulkPreview, setBulkPreview] = useState<{
    create: string[];
    revive: string[];
    existing: string[];
  } | null>(null);
  const [newZone, setNewZone] = useState({ code: "", name: "" });
  const [newRack, setNewRack] = useState({
    zone: "",
    row: "A",
    number: "1",
    pallet: "1",
    capacity: "1",
    note: "",
  });
  const [isBusy, setIsBusy] = useState(false);

  const loadRacks = useCallback(async () => {
    try {
      const response = await api.racks();
      setZones(response.zones);
      const defaultZone = response.zones[0]?.code ?? "";

      setBulkForm((currentForm) => {
        if (currentForm.zone) return currentForm;
        return { ...currentForm, zone: defaultZone };
      });
      setNewRack((currentForm) => {
        if (currentForm.zone) return currentForm;
        return { ...currentForm, zone: defaultZone };
      });
    } catch (error) {
      toast.error(errorText(error, translations));
    }
  }, [translations, toast]);
  // Effects: load data and update the screen
  useEffect(() => {
    loadRacks();
  }, [loadRacks]);

  // Optional confirm first, then loading -> success/error toasts. Nothing runs twice while busy.
  // Button and form actions
  async function runRackAction(
    saveChanges: () => Promise<unknown>,
    successMessage?: string,
    ask?: ConfirmOptions,
  ) {
    if (isBusy) return false;
    if (ask) {
      const isConfirmed = await confirm(ask);
      if (!isConfirmed) return false;
    }
    setIsBusy(true);
    try {
      if (successMessage) {
        await toast.promise(
          saveChanges,
          {
            loading: translations.feedback.working,
            success: successMessage,
            error: (error) => errorText(error, translations),
          },
        );
      } else {
        await saveChanges();
      }
      await loadRacks();
      return true;
    } catch (error) {
      if (!successMessage) toast.error(errorText(error, translations));
      return false;
    } finally {
      setIsBusy(false);
    }
  }
  // Rename / new code: the dialog asks for the value itself, so it is the one confirmation.
  async function renameZone(zone: Zone) {
    const name = await ask({
      title: translations.confirm.renameZoneTitle,
      message: translations.confirm.renameZone(zone.code),
      confirmText: translations.confirm.saveBtn,
      inputLabel: translations.confirm.newName,
      initial: zone.name,
      required: true,
      maxLength: 100,
    });
    if (name && name !== zone.name)
      runRackAction(() => api.updateZone(zone.id, { name }), translations.feedback.saved);
  }
  async function changeZoneCode(zone: Zone) {
    const code = await ask({
      title: translations.confirm.codeZoneTitle,
      message: translations.confirm.codeZone(zone.code),
      confirmText: translations.confirm.saveBtn,
      tone: "danger",
      inputLabel: translations.confirm.newCode,
      initial: zone.code,
      required: true,
      maxLength: 10,
    });
    if (code && code.toUpperCase() !== zone.code)
      runRackAction(
        () => api.updateZone(zone.id, { code: code.toUpperCase() }),
        translations.feedback.saved,
      );
  }
  const getDeleteConfirmation = (
    title: string,
    message: string,
    code: string,
  ): ConfirmOptions => ({
    title,
    message,
    confirmText: translations.confirm.deleteBtn,
    tone: "danger",
    typeToConfirm: code,
  });
  function parseCapacity(value: string) {
    if (value.trim() === "") {
      return null;
    }
    const capacityNumber = Number(value);
    return Math.max(1, Math.floor(capacityNumber));
  }
  const getBulkRequest = (previewOnly: boolean) => ({
    zone: bulkForm.zone,
    rowFrom: bulkForm.rowFrom,
    rowTo: bulkForm.rowTo,
    from: Number(bulkForm.from),
    to: Number(bulkForm.to),
    palletFrom: Number(bulkForm.palletFrom),
    palletTo: Number(bulkForm.palletTo),
    capacity: parseCapacity(bulkForm.capacity),
    preview: previewOnly,
  });

  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      {!canEdit && (
        <div className="bg-warn-bg text-warn-ink rounded-md p-3 text-sm font-bold mb-3 flex gap-2 items-start">
          {translations.rackAdmin.readOnly}
        </div>
      )}
      <fieldset disabled={!canEdit || isBusy} className="border-0 p-0 m-0 min-w-0">
        <h2 className="text-lg font-extrabold mx-1 mt-2 mb-3 flex items-center gap-2 flex-wrap">
          <Icon name="mouldRoom" size={20} />
          {translations.rackAdmin.zones}
        </h2>
        {zones.map((z) => (
          <div
            key={z.id}
            className="bg-surface border border-solid border-line rounded-lg p-3 mb-4"
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <b>{z.code}</b>
              <span>{z.name}</span>
              {!z.active && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-[.1px] px-2 py-0.5 rounded-[4px] whitespace-nowrap leading-[1.6] bg-warn-bg text-warn-ink">
                  {translations.rackAdmin.disabled}
                </span>
              )}
              {canEdit && (
                <span className="ml-auto flex flex-wrap">
                  <button
                    className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                    onClick={() => renameZone(z)}
                  >
                    {translations.rackAdmin.rename}
                  </button>
                  <button
                    className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                    onClick={() => changeZoneCode(z)}
                  >
                    {translations.rackAdmin.changeCode}
                  </button>
                  <button
                    className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                    onClick={() =>
                      runRackAction(
                        () => api.updateZone(z.id, { active: !z.active }),
                        translations.feedback.saved,
                        z.active
                          ? {
                              title: translations.confirm.zoneDisableTitle,
                              message: translations.confirm.zoneDisable(z.code),
                              confirmText: translations.rackAdmin.disable,
                              tone: "danger",
                            }
                          : {
                              title: translations.confirm.zoneEnableTitle,
                              message: translations.confirm.zoneEnable(z.code),
                              confirmText: translations.rackAdmin.enable,
                            },
                      )
                    }
                  >
                    {z.active ? translations.rackAdmin.disable : translations.rackAdmin.enable}
                  </button>
                  <button
                    className="bg-transparent border-0 font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default text-danger"
                    onClick={() =>
                      runRackAction(
                        () => api.deleteZone(z.id),
                        translations.feedback.deleted,
                        getDeleteConfirmation(
                          translations.confirm.zoneDeleteTitle,
                          translations.confirm.zoneDelete(z.code),
                          z.code,
                        ),
                      )
                    }
                  >
                    {translations.rackAdmin.remove}
                  </button>
                </span>
              )}
            </div>
            <RackStructure racks={z.racks} translations={translations} selected={editingRack?.id} onPick={rack => { if (canEdit) setEditingRack(rack); }} />
            {canEdit && <div className="flex flex-wrap gap-2">{[...new Set(z.racks.map(rack => rack.row))].map(row => <button key={row} className="text-danger text-sm min-h-11 px-2 font-bold" onClick={() => runRackAction(() => api.removeRow(z.code, row), translations.feedback.deleted, getDeleteConfirmation(translations.confirm.rowDeleteTitle, translations.confirm.rowDelete(z.code, row), `${z.code}-${row}`))}>{translations.rackAdmin.removeRow(row)}</button>)}</div>}
          </div>
        ))}

        {canEdit && editingRack && (
          <div className="bg-surface border border-solid border-line rounded-lg p-4 my-4 shadow-card">
            <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
              {translations.rackAdmin.editRack(editingRack.locationId)}
            </div>
            <div className="grid grid-cols-2 [gap:0_var(--s3)]">
              <div>
                <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackLayout.rack}</label>
                <input
                  className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                  value={editingRack.row}
                  maxLength={3}
                  onChange={(event) =>
                    setEditingRack({
                      ...editingRack,
                      row: event.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              {editingRack.pallet != null && <label className="block mt-4 text-sm font-semibold">{translations.rackLayout.pallet}<input type="number" min={1} max={99} value={editingRack.pallet} onChange={event => setEditingRack({ ...editingRack, pallet: Number(event.target.value) })} className="block w-full min-h-12 border border-line rounded-sm bg-surface-2 p-3 text-ink" /></label>}
              <div>
                <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackLayout.position}</label>
                <input
                  className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                  type="number"
                  min={1}
                  value={editingRack.number}
                  onChange={(event) =>
                    setEditingRack({
                      ...editingRack,
                      number: Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.capacity}</label>
            <input
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              type="number"
              min={1}
              placeholder={translations.rackAdmin.capacityHint}
              value={editingRack.capacity ?? ""} disabled={editingRack.pallet != null}
              onChange={(event) =>
                setEditingRack({
                  ...editingRack,
                  capacity:
                    event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.note}</label>
            <input
              className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
              value={editingRack.note}
              maxLength={300}
              onChange={(event) =>
                setEditingRack({ ...editingRack, note: event.target.value })
              }
            />
            <label className="flex items-center gap-2 [margin:var(--s3)_2px] text-md font-bold min-h-tap [&_input]:size-[22px] [&_input]:accent-action">
              <input
                type="checkbox"
                checked={editingRack.active}
                onChange={(event) =>
                  setEditingRack({ ...editingRack, active: event.target.checked })
                }
              />{" "}
              {translations.rackAdmin.active}
            </label>
            <button
              className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
              onClick={async () => {
                if (
                  await runRackAction(
                    () =>
                      api.updateRack(editingRack.id, {
                        row: editingRack.row,
                        pallet: editingRack.pallet ?? undefined,
                        number: editingRack.number,
                        capacity: editingRack.capacity,
                        note: editingRack.note,
                        active: editingRack.active,
                      }),
                    translations.feedback.saved,
                  )
                )
                  setEditingRack(null);
              }}
            >
              {translations.rackAdmin.save}
            </button>
            <button
              className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 text-danger"
              onClick={async () => {
                if (
                  await runRackAction(
                    () => api.deleteRack(editingRack.id),
                    translations.feedback.deleted,
                    getDeleteConfirmation(
                      translations.confirm.rackDeleteTitle,
                      translations.confirm.rackDelete(editingRack.locationId),
                      editingRack.locationId,
                    ),
                  )
                )
                  setEditingRack(null);
              }}
            >
              {translations.rackAdmin.remove}
            </button>
            <button
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              onClick={() => setEditingRack(null)}
            >
              {translations.cancel}
            </button>
          </div>
        )}

        {canEdit && (
          <>
            <div className="bg-surface border border-solid border-line rounded-lg p-4 my-4 shadow-card">
              <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                {translations.rackAdmin.bulk}
              </div>
              <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.zone}</label>
              <select
                className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                value={bulkForm.zone}
                onChange={(event) => {
                  setBulkForm({ ...bulkForm, zone: event.target.value });
                  setBulkPreview(null);
                }}
              >
                {zones.map((zone) => (
                  <option key={zone.code}>{zone.code}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 [gap:0_var(--s3)]">
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.rowFrom}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    maxLength={1}
                    value={bulkForm.rowFrom}
                    onChange={(event) => {
                      setBulkForm({
                        ...bulkForm,
                        rowFrom: event.target.value.toUpperCase(),
                      });
                      setBulkPreview(null);
                    }}
                  />
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.rowTo}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    maxLength={1}
                    value={bulkForm.rowTo}
                    onChange={(event) => {
                      setBulkForm({
                        ...bulkForm,
                        rowTo: event.target.value.toUpperCase(),
                      });
                      setBulkPreview(null);
                    }}
                  />
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.numFrom}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    type="number"
                    min={1}
                    value={bulkForm.from}
                    onChange={(event) => {
                      setBulkForm({ ...bulkForm, from: event.target.value });
                      setBulkPreview(null);
                    }}
                  />
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.numTo}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    type="number"
                    min={1}
                    value={bulkForm.to}
                    onChange={(event) => {
                      setBulkForm({ ...bulkForm, to: event.target.value });
                      setBulkPreview(null);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">{(["palletFrom", "palletTo"] as const).map(field => <label key={field} className="block mt-4 text-sm font-semibold">{translations.rackLayout[field]}<input type="number" min={1} max={99} value={bulkForm[field]} onChange={event => { setBulkForm({ ...bulkForm, [field]: event.target.value }); setBulkPreview(null); }} className="block w-full min-h-12 border border-line rounded-sm bg-surface-2 p-3 text-ink" /></label>)}</div>
              <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.capacity}</label>
              <input
                className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                type="number"
                min={1}
                placeholder={translations.rackAdmin.capacityHint}
                value={bulkForm.capacity} disabled
                onChange={(event) =>
                  setBulkForm({ ...bulkForm, capacity: event.target.value })
                }
              />
              <button
                className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface text-ink-soft border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
                onClick={() =>
                  runRackAction(async () =>
                    setBulkPreview(await api.bulkRacks(getBulkRequest(true))),
                  )
                }
              >
                {translations.rackAdmin.preview}
              </button>
              {bulkPreview && (
                <div className="bg-surface-2 rounded-md p-3 mt-3 text-sm font-bold [&_small]:block [&_small]:mt-1.5 [&_small]:font-medium [&_small]:max-h-[90px] [&_small]:overflow-auto">
                  <div>
                    {translations.rackAdmin.willCreate(bulkPreview.create.length)} ·{" "}
                    {translations.rackAdmin.willRevive(bulkPreview.revive.length)} ·{" "}
                    {translations.rackAdmin.exist(bulkPreview.existing.length)}
                  </div>
                  <small className="text-ink-soft">
                    {[...bulkPreview.create, ...bulkPreview.revive].join(
                      ", ",
                    ) || translations.rackAdmin.nothingToDo}
                  </small>
                  {bulkPreview.create.length + bulkPreview.revive.length >
                    0 && (
                    <button
                      className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
                      onClick={async () => {
                        const n =
                          bulkPreview.create.length + bulkPreview.revive.length;
                        if (
                          await runRackAction(
                            () => api.bulkRacks(getBulkRequest(false)),
                            translations.rackAdmin.created(n),
                            {
                              title: translations.confirm.bulkTitle,
                              message: translations.confirm.bulk(n, bulkForm.zone),
                              confirmText: translations.confirm.bulkBtn(n),
                            },
                          )
                        )
                          setBulkPreview(null);
                      }}
                    >
                      {translations.rackAdmin.create(
                        bulkPreview.create.length + bulkPreview.revive.length,
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-surface border border-solid border-line rounded-lg p-4 my-4 shadow-card">
              <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                {translations.rackAdmin.addRack}
              </div>
              <div className="grid grid-cols-2 [gap:0_var(--s3)]">
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.zone}</label>
                  <select
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    value={newRack.zone}
                    onChange={(event) =>
                      setNewRack({ ...newRack, zone: event.target.value })
                    }
                  >
                    {zones.map((zone) => (
                      <option key={zone.code}>{zone.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackLayout.rack}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    maxLength={3}
                    value={newRack.row}
                    onChange={(event) =>
                      setNewRack({
                        ...newRack,
                        row: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <label className="block mt-4 text-sm font-semibold">{translations.rackLayout.pallet}<input type="number" min={1} max={99} value={newRack.pallet} onChange={event => setNewRack({ ...newRack, pallet: event.target.value })} className="block w-full min-h-12 border border-line rounded-sm bg-surface-2 p-3 text-ink" /></label>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackLayout.position}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    type="number"
                    min={1}
                    value={newRack.number}
                    onChange={(event) =>
                      setNewRack({ ...newRack, number: event.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.capacity}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    type="number"
                    min={1}
                    placeholder={translations.rackAdmin.unlimited}
                    value={newRack.capacity} disabled
                    onChange={(event) =>
                      setNewRack({ ...newRack, capacity: event.target.value })
                    }
                  />
                </div>
              </div>
              <button
                className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
                onClick={() =>
                  runRackAction(
                    () =>
                      api.createRack({
                        zone: newRack.zone,
                        row: newRack.row,
                        pallet: Number(newRack.pallet),
                        number: Number(newRack.number),
                        capacity: parseCapacity(newRack.capacity),
                        note: newRack.note,
                      }),
                    translations.feedback.created,
                  )
                }
              >
                {translations.rackAdmin.addRack}
              </button>
            </div>

            <div className="bg-surface border border-solid border-line rounded-lg p-4 my-4 shadow-card">
              <div className="text-ink-soft mb-2 flex items-center gap-1.5 font-sign text-sm font-bold tracking-[.1px]">
                {translations.rackAdmin.addZone}
              </div>
              <div className="grid grid-cols-2 [gap:0_var(--s3)]">
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.code}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    maxLength={10}
                    value={newZone.code}
                    onChange={(event) =>
                      setNewZone({
                        ...newZone,
                        code: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.rackAdmin.name}</label>
                  <input
                    className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
                    maxLength={100}
                    value={newZone.name}
                    onChange={(event) =>
                      setNewZone({ ...newZone, name: event.target.value })
                    }
                  />
                </div>
              </div>
              <button
                className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
                disabled={!newZone.code || !newZone.name}
                onClick={async () => {
                  if (
                    await runRackAction(
                      () =>
                        api.createZone({
                          ...newZone,
                          sortOrder: zones.length + 1,
                        }),
                      translations.feedback.created,
                    )
                  )
                    setNewZone({ code: "", name: "" });
                }}
              >
                {translations.rackAdmin.addZone}
              </button>
            </div>
          </>
        )}
      </fieldset>
    </main>
  );
}
