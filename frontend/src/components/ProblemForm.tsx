"use client";

import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import toast from "react-hot-toast";
import { errorText } from "@/utils/format";
import type { Dict } from "@/utils/i18n";
import { shrink } from "@/utils/imageUpload";
import { type Mould } from "@/utils/types";
import { useState } from "react";

const MAX_PHOTOS = 3;

export default function ProblemForm({
  mould,
  translations,
  onSaved,
  onCancel,
}: {
  mould: Mould;
  translations: Dict;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { confirm } = useConfirm();
  // Screen state
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  // Button and form actions
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
  async function reportProblem() {
    setTried(true);
    if (busy || description.trim() === "") {
      return;
    }
    const isConfirmed = await confirm({
      title: translations.confirm.problemTitle,
      message: translations.confirm.problem(mould.toolId),
      confirmText: translations.confirm.problemBtn,
    });
    if (!isConfirmed) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await toast.promise(
        () =>
          api.reportProblem(mould.id, {
            description,
            photos,
            version: mould.version,
          }),
        {
          loading: translations.feedback.working,
          success: translations.feedback.reported,
          error: (error) => errorText(error, translations),
        },
      );
      onSaved();
    } catch (error) {
      setError(errorText(error, translations));
    } finally {
      setBusy(false);
    }
  }
  // UI and inline Tailwind styles
  return (
    <div className="mt-3 [border-top:1px_dashed_var(--line)] pt-1">
      <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
        {translations.problem.hint}
      </p>
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="pr-what">
        {translations.problem.what} *
      </label>
      <textarea
        id="pr-what"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        rows={3}
        maxLength={2000}
        placeholder={translations.problem.whatPh}
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
          disabled={busy}
          onClick={reportProblem}
        >
          <Icon name="send" />
          {busy ? translations.work.saving : translations.problem.save}
        </button>
      </div>
    </div>
  );
}
