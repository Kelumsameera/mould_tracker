"use client";
import { useApp } from "@/components/AppLayout";
import { activeList } from "@/utils/runtimeConfig";

// Standard remarks (Settings > Lists > Standard remarks): tap to add one to the remarks field.
export default function RemarkTemplates({ onPick }: { onPick: (text: string) => void }) {
  const { lang } = useApp();
  const items = activeList("remarkTemplates");
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((x) => (
        <button key={x.key} type="button" className="rounded-pill border border-solid border-line bg-surface-2 px-2.5 min-h-8 text-xs font-semibold cursor-pointer" onClick={() => onPick(x.labels[lang] || x.labels.en)}>
          + {x.labels[lang] || x.labels.en}
        </button>
      ))}
    </div>
  );
}
