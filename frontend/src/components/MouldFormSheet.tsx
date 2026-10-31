"use client";
import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import RackPicker from "@/components/RackPicker";
import { api, assetUrl } from "@/utils/api";
import { shrink } from "@/utils/imageUpload";
import { locationName, type Dict } from "@/utils/i18n";
import { errorText } from "@/utils/format";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import type { Item, ItemInput, Location, Mould, ToolType, Zone } from "@/utils/types";

type ItemDraft = {
  id?: string;
  photo?: string;
  imageUrl?: string;
  itemId: string;
  description: string;
  cavities: string;
  qas: string;
  materialId: string;
  materialDescription: string;
  masterbatchId: string;
  masterbatchDescription: string;
};
const blankItem = (): ItemDraft => ({
  itemId: "",
  description: "",
  cavities: "",
  qas: "",
  materialId: "",
  materialDescription: "",
  masterbatchId: "",
  masterbatchDescription: "",
});
const toDraft = (index: Item): ItemDraft => ({
  id: index.id,
  imageUrl: assetUrl(index.images[0]?.thumbUrl),
  itemId: index.itemId,
  description: index.description,
  cavities: index.cavities == null ? "" : String(index.cavities),
  qas: index.qas ?? "",
  materialId: index.materialId ?? "",
  materialDescription: index.materialDescription ?? "",
  masterbatchId: index.masterbatchId ?? "",
  masterbatchDescription: index.masterbatchDescription ?? "",
});
const fromDraft = (itemDraft: ItemDraft): ItemInput => ({
  itemId: itemDraft.itemId.trim(),
  description: itemDraft.description.trim(),
  cavities: itemDraft.cavities.trim() === "" ? null : Math.max(0, Math.floor(Number(itemDraft.cavities))),
  qas: itemDraft.qas.trim() || null,
  materialId: itemDraft.materialId.trim() || null,
  materialDescription: itemDraft.materialDescription.trim() || null,
  masterbatchId: itemDraft.masterbatchId.trim() || null,
  masterbatchDescription: itemDraft.masterbatchDescription.trim() || null,
  ...(itemDraft.photo ? { photo: itemDraft.photo } : {}),
});

type Props = {
  open: boolean;
  mould: Mould | null;
  translations: Dict;
  onClose: () => void;
  onSaved: (mould: Mould, close: boolean) => void;
  defaultToolType?: ToolType;
};

export default function MouldFormSheet({ open, mould, translations, onClose, onSaved, defaultToolType = "INJECTION_MOULD" }: Props) {
  const { confirm } = useConfirm();
  const editing = Boolean(mould);
  // Screen state
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({
    toolId: "",
    toolSetCount: "",
    size: "",
    owner: "",
    capable: "",
    shots: "",
    notes: "",
  });
  const [toolType, setToolType] = useState<ToolType>("INJECTION_MOULD");
  const [start, setStart] = useState<Exclude<Location, "MACHINE">>("MOULD_ROOM");
  const extrusion = toolType === "EXTRUSION_DIE";
  const title = extrusion ? (editing ? translations.extrusionEdit : translations.extrusionAdd) : editing ? translations.form.edit : translations.form.add;
  const [rackId, setRackId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [newItem, setNewItem] = useState<ItemDraft>(blankItem());
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");

  // Effects: load data and update the screen
  useEffect(() => {
    if (!open) return;
    api
      .racks()
      .then((response) => setZones(response.zones))
      .catch(() => {});
    const type = mould?.toolType ?? defaultToolType;
    setToolType(type);
    setError("");
    setTried(false);
    setRackId(null);
    setStart(type === "EXTRUSION_DIE" ? "TOOL_ROOM" : "MOULD_ROOM");
    setNewItem(blankItem());
    setForm({
      toolId: mould?.toolId ?? "",
      toolSetCount: mould?.toolSetCount ?? "",
      size: mould?.size ?? "",
      owner: mould?.owner ?? "",
      capable: mould?.capableMachines.join(", ") ?? "",
      shots: mould?.shotsToService == null ? "" : String(mould.shotsToService),
      notes: mould?.notes ?? "",
    });
    setItems(mould?.items?.map(toDraft) ?? []);
  }, [open, mould, defaultToolType]);

  // Button and form actions
  function getMouldChanges() {
    const machineCodes = form.capable.split(/[,;/\s]+/);
    const capableMachines: string[] = [];
    for (const machineCode of machineCodes) {
      const trimmedCode = machineCode.trim();
      if (trimmedCode !== "") {
        capableMachines.push(trimmedCode);
      }
    }

    let shotsToService: number | null = null;
    if (form.shots.trim() !== "") {
      shotsToService = Math.max(0, Math.floor(Number(form.shots)));
    }

    return {
      toolType: toolType,
      toolId: form.toolId.trim(),
      toolSetCount: form.toolSetCount.trim(),
      size: form.size.trim(),
      owner: form.owner || null,
      capableMachines: capableMachines,
      shotsToService: shotsToService,
      notes: form.notes,
    };
  }

  // Saving is the form's own explicit step (no extra confirm); loading -> success/error toast, error also inline.
  async function saveWithFeedback<T>(work: () => Promise<T>, done: string) {
    if (busy) return undefined;
    setBusy(true);
    setError("");
    try {
      return await toast.promise(work, {
        loading: translations.feedback.working,
        success: done,
        error: (error) => errorText(error, translations),
      });
    } catch (error) {
      setError(errorText(error, translations));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function saveMould() {
    setTried(true);
    if (!form.toolId.trim() || (!editing && start === "MOULD_ROOM" && !rackId)) return; // shown at the fields
    if (!editing && items.some((index) => !index.itemId.trim())) return setError(translations.form.itemIdRequired);
    if (editing && mould) {
      const response = await saveWithFeedback(() => api.updateMould(mould.id, getMouldChanges(), mould.version), translations.form.saved(form.toolId.trim()));
      if (response) {
        onSaved(response.mould, true);
      }
      return;
    }

    let initialRackId: string | undefined;
    if (start === "MOULD_ROOM" && rackId) {
      initialRackId = rackId;
    }
    const newMould = {
      ...getMouldChanges(),
      location: start,
      rackId: initialRackId,
      items: items.map(fromDraft),
    };
    const response = await saveWithFeedback(() => api.createMould(newMould), translations.form.added(form.toolId.trim().toUpperCase()));
    if (response) {
      onSaved(response.mould, true);
    }
  }
  async function saveMouldItem(itemDraft: ItemDraft) {
    if (!itemDraft.itemId.trim()) return setError(translations.form.itemIdRequired);
    const res = await saveWithFeedback(
      () => (itemDraft.id ? api.updateItem(mould!.id, itemDraft.id, fromDraft(itemDraft)) : api.addItem(mould!.id, fromDraft(itemDraft))),
      translations.form.saved(itemDraft.itemId.trim()),
    );
    if (res) {
      setItems(res.mould.items?.map(toDraft) ?? []);
      setNewItem(blankItem());
      onSaved(res.mould, false);
    }
  }
  async function removeMouldItem(itemDraft: ItemDraft) {
    if (!itemDraft.id || busy) return;
    if (
      !(await confirm({
        title: translations.confirm.removeItemTitle,
        message: translations.confirm.removeItem(itemDraft.itemId, mould!.toolId),
        confirmText: translations.confirm.removeBtn,
        tone: "danger",
      }))
    )
      return;
    const res = await saveWithFeedback(() => api.deleteItem(mould!.id, itemDraft.id!), translations.feedback.removed);
    if (res) {
      setItems(res.mould.items?.map(toDraft) ?? []);
      onSaved(res.mould, false);
    }
  }

  async function changePhoto(id: string, file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const photo = await shrink(file);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, photo } : item)));
    } catch {
      setError(translations.errors.INVALID_PHOTO());
    } finally {
      setBusy(false);
    }
  }

  const renderTextInput = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) => (
    <>
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor={"mf-" + key}>
        {label}
      </label>
      <input
        id={"mf-" + key}
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        {...extra}
      />
    </>
  );
  const renderItemFields = (itemDraft: ItemDraft, set: (itemDraft: ItemDraft) => void) => (
    <div className="item-edit">
      <div className="grid grid-cols-2 gap-[0_var(--s3)]">
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.itemId}
          aria-label={translations.form.itemId}
          value={itemDraft.itemId}
          onChange={(event) => set({ ...itemDraft, itemId: event.target.value })}
        />
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.cavities}
          aria-label={translations.form.cavities}
          type="number"
          min={0}
          inputMode="numeric"
          value={itemDraft.cavities}
          onChange={(event) => set({ ...itemDraft, cavities: event.target.value })}
        />
      </div>
      <input
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink mt-3 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
        placeholder={translations.form.description}
        aria-label={translations.form.description}
        value={itemDraft.description}
        onChange={(event) => set({ ...itemDraft, description: event.target.value })}
      />
      <div className="grid grid-cols-2 gap-[0_var(--s3)] mt mt-3">
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.qas}
          aria-label={translations.form.qas}
          value={itemDraft.qas}
          onChange={(event) => set({ ...itemDraft, qas: event.target.value })}
        />
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.materialId}
          aria-label={translations.form.materialId}
          value={itemDraft.materialId}
          onChange={(event) => set({ ...itemDraft, materialId: event.target.value })}
        />
      </div>
      <input
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink mt-3 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
        placeholder={translations.form.materialDescription}
        aria-label={translations.form.materialDescription}
        value={itemDraft.materialDescription}
        onChange={(event) => set({ ...itemDraft, materialDescription: event.target.value })}
      />
      <div className="grid grid-cols-2 gap-[0_var(--s3)] mt mt-3">
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.masterbatchId}
          aria-label={translations.form.masterbatchId}
          value={itemDraft.masterbatchId}
          onChange={(event) => set({ ...itemDraft, masterbatchId: event.target.value })}
        />
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          placeholder={translations.form.masterbatchDescription}
          aria-label={translations.form.masterbatchDescription}
          value={itemDraft.masterbatchDescription}
          onChange={(event) => set({ ...itemDraft, masterbatchDescription: event.target.value })}
        />
      </div>
    </div>
  );

  // UI and inline Tailwind styles
  return (
    <Sheet open={open} onClose={onClose} label={title} closeLabel={translations.close}>
      <h2 className="text-xl font-extrabold m-[var(--s2)_0_var(--s4)] leading-[1.3]">{title}</h2>
      <fieldset disabled={busy} className="border-0 p-0 m-0 min-w-0">
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="mf-tool-type">
          {translations.toolType}
        </label>
        <select
          id="mf-tool-type"
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          disabled={editing}
          value={toolType}
          onChange={(event) => {
            const type = event.target.value as ToolType;
            setToolType(type);
            setRackId(null);
            setStart(type === "EXTRUSION_DIE" ? "TOOL_ROOM" : "MOULD_ROOM");
          }}
        >
          {(["INJECTION_MOULD", "EXTRUSION_DIE"] as const).map((type) => (
            <option key={type} value={type}>
              {translations.toolTypes[type]}
            </option>
          ))}
        </select>
        {renderTextInput("toolId", translations.form.toolId, {
          required: true,
          maxLength: 100,
          autoCapitalize: "characters",
          "aria-invalid": tried && !form.toolId.trim(),
        })}
        {tried && !form.toolId.trim() && (
          <p className="text-danger-ink text-sm font-bold m-[6px_2px_0] flex items-center gap-1.5" role="alert">
            <Icon name="error" size={14} />
            {translations.form.required}
          </p>
        )}
        <div className="grid grid-cols-2 gap-[0_var(--s3)]">
          <div>{renderTextInput("toolSetCount", translations.form.toolSet, { maxLength: 50 })}</div>
          <div>{renderTextInput("size", translations.form.size, { maxLength: 50 })}</div>
        </div>
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="mf-owner">
          {translations.form.owner}
        </label>
        <select
          id="mf-owner"
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          value={form.owner}
          onChange={(event) => setForm({ ...form, owner: event.target.value })}
        >
          <option value="">{translations.form.ownerNone}</option>
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.code}
            </option>
          ))}
        </select>
        {renderTextInput("capable", translations.form.capable, { placeholder: translations.form.capableHint })}
        {renderTextInput("shots", translations.form.shotsToService, {
          type: "number",
          min: 0,
          inputMode: "numeric",
        })}
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="mf-notes">
          {translations.form.notes}
        </label>
        <textarea
          id="mf-notes"
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line text-[16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-invalid:border-danger [textarea]:resize-y [textarea]:min-h-18"
          rows={2}
          maxLength={2000}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />

        {!editing && (
          <>
            <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.form.startAt}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {([extrusion ? "TOOL_ROOM" : "MOULD_ROOM", "PRODUCTION_FLOOR", "WORKSHOP"] as const).map((l) => (
                <button
                  type="button"
                  key={l}
                  className={
                    "inline-flex items-center gap-1.5 bg-surface-2 border-[1.5px] border-solid border-line rounded-pill min-h-tap px-4 py-0 text-sm font-bold text-ink cursor-pointer disabled:opacity-45 disabled:cursor-default [&_small]:font-semibold [&_small]:text-ink-faint" +
                    (start === l ? " bg-ink! border-ink! text-surface! [&_small]:text-surface/85!" : "")
                  }
                  onClick={() => setStart(l)}
                >
                  {locationName(l, translations)}
                </button>
              ))}
            </div>
            {start === "MOULD_ROOM" && zones.length > 0 && <RackPicker zones={zones} value={rackId} preferZone={form.owner || null} translations={translations} onChange={(id) => setRackId(id)} />}
            {tried && start === "MOULD_ROOM" && !rackId && (
              <p className="text-danger-ink text-sm font-bold m-[6px_2px_0] flex items-center gap-1.5" role="alert">
                <Icon name="error" size={14} />
                {translations.errors.RACK_REQUIRED()}
              </p>
            )}
          </>
        )}

        <h3 className="text-md m-[var(--s5)_0_var(--s3)]">{translations.form.items}</h3>
        {items.map((itemDraft, index) => (
          <div className="[border-top:1px_dashed_var(--line)] pt-3 mt-3" key={itemDraft.id ?? index}>
            {renderItemFields(itemDraft, (nd) => setItems(items.map((x, j) => (j === index ? nd : x))))}
            {editing && itemDraft.id && (
              <>
                <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor={"item-photo-" + itemDraft.id}>
                  {translations.work.photos}
                </label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {(itemDraft.photo || itemDraft.imageUrl) && (
                    <div className="relative w-19 aspect-[1] rounded-md border border-solid border-line bg-white p-0 overflow-hidden cursor-pointer [&_img]:size-full [&_img]:object-cover [&_span]:absolute [&_span]:top-0.5 [&_span]:right-1.5 [&_span]:font-black [&_span]:text-white [&_span]:[text-shadow:0_0_3px_#000]">
                      <img src={itemDraft.photo || itemDraft.imageUrl} alt={itemDraft.itemId} />
                    </div>
                  )}
                  <label className="w-19 aspect-[1] rounded-md [border:1.5px_dashed_var(--ink-faint)] flex flex-col gap-1 items-center justify-center text-center text-xs font-extrabold text-ink-soft cursor-pointer p-1">
                    <Icon name="camera" size={22} />
                    {translations.work.addPhoto}
                    <input
                      id={"item-photo-" + itemDraft.id}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        void changePhoto(itemDraft.id!, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {itemDraft.photo && (
                    <button
                      type="button"
                      className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                      onClick={() => setItems(items.map((item, j) => (j === index ? { ...item, photo: undefined } : item)))}
                    >
                      {translations.cancel}
                    </button>
                  )}
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              {editing && (
                <button
                  type="button"
                  className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                  onClick={() => saveMouldItem(itemDraft)}
                >
                  {translations.form.saveItem}
                </button>
              )}
              <button
                type="button"
                className="bg-transparent border-0 font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default text-danger"
                onClick={() => (editing ? removeMouldItem(itemDraft) : setItems(items.filter((_, j) => j !== index)))}
              >
                {translations.form.removeItem}
              </button>
            </div>
          </div>
        ))}
        {editing ? (
          <div className="bg-surface-2 rounded-md p-3 mt-3">
            {renderItemFields(newItem, setNewItem)}
            <button
              type="button"
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              disabled={!newItem.itemId.trim()}
              onClick={() => saveMouldItem(newItem)}
            >
              {translations.form.addItem}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
            onClick={() => setItems([...items, blankItem()])}
          >
            + {translations.form.addItem}
          </button>
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
            onClick={onClose}
          >
            <Icon name="cancel" />
            {translations.cancel}
          </button>
          <button
            className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
            disabled={busy}
            onClick={saveMould}
          >
            <Icon name={editing ? "confirm" : "add"} />
            {editing ? translations.form.save : translations.form.create}
          </button>
        </div>
      </fieldset>
    </Sheet>
  );
}
