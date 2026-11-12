"use client";
import Icon, { type IconName } from "@/components/Icon";
import type { Dict } from "@/utils/i18n";

// Pictures of one item: add (gallery or phone camera), replace, remove, reorder.
// Works for saved pictures (server calls) and for pictures picked before saving (kept in form state).
export const MAX_ITEM_PICTURES = 5; // mirrors MAX_ITEM_IMAGES on the server

export type Picture = { id: string; src: string };

type Props = {
  pictures: Picture[];
  translations: Dict;
  busy?: boolean;
  label: string;
  onAdd: (file: File) => void;
  onReplace: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, step: -1 | 1) => void;
};

const iconButton =
  "size-8 inline-flex items-center justify-center rounded-sm border border-solid border-line bg-surface text-ink cursor-pointer disabled:opacity-40 disabled:cursor-default";

function FileButton({ label, icon, capture, disabled, onFile }: { label: string; icon: IconName; capture?: boolean; disabled?: boolean; onFile: (f: File) => void }) {
  return (
    <label
      className={
        "w-19 aspect-[1] rounded-md [border:1.5px_dashed_var(--ink-faint)] flex flex-col gap-1 items-center justify-center text-center text-xs font-extrabold text-ink-soft p-1 " +
        (disabled ? "opacity-45 cursor-default" : "cursor-pointer")
      }
    >
      <Icon name={icon} size={22} />
      {label}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        {...(capture ? { capture: "environment" as const } : {})}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export default function PictureStrip({ pictures, translations: t, busy, label, onAdd, onReplace, onRemove, onMove }: Props) {
  const full = pictures.length >= MAX_ITEM_PICTURES;
  return (
    <div className="mt-3">
      <div className="text-sm font-semibold text-ink">
        {t.form.pictures} <small className="text-ink-faint font-normal">· {t.form.picturesHint(MAX_ITEM_PICTURES)}</small>
      </div>
      <div className="flex gap-2 flex-wrap mt-1.5">
        {pictures.map((p, index) => (
          <div key={p.id} className="flex flex-col gap-1 items-center">
            <div className="w-19 aspect-[1] rounded-md border border-solid border-line bg-white overflow-hidden [&_img]:size-full [&_img]:object-contain">
              <img src={p.src} alt={`${label} ${index + 1}`} />
            </div>
            <div className="flex gap-0.5">
              <button type="button" className={iconButton} disabled={busy || index === 0} aria-label={t.form.moveEarlier} title={t.form.moveEarlier} onClick={() => onMove(p.id, -1)}>
                ‹
              </button>
              <label className={iconButton + (busy ? " opacity-40 cursor-default" : "")} aria-label={t.form.replacePicture} title={t.form.replacePicture}>
                <Icon name="camera" size={14} />
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) onReplace(p.id, file);
                  }}
                />
              </label>
              <button type="button" className={iconButton + " text-danger"} disabled={busy} aria-label={t.form.removePicture} title={t.form.removePicture} onClick={() => onRemove(p.id)}>
                ×
              </button>
              <button type="button" className={iconButton} disabled={busy || index === pictures.length - 1} aria-label={t.form.moveLater} title={t.form.moveLater} onClick={() => onMove(p.id, 1)}>
                ›
              </button>
            </div>
          </div>
        ))}
        {!full && (
          <>
            <FileButton label={t.form.addPicture} icon="image" disabled={busy} onFile={onAdd} />
            <FileButton label={t.form.takePhoto} icon="camera" capture disabled={busy} onFile={onAdd} />
          </>
        )}
      </div>
    </div>
  );
}
