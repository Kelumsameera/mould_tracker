import type { DispatchDetails as Details } from "@/utils/types";
import type { Dict, Lang } from "@/utils/i18n";
import { formatTime } from "@/utils/format";

export default function DispatchDetails({ details, translations, lang }: { details: Details; translations: Dict; lang: Lang }) {
  const text = translations.dispatch;
  const rows = [
    [text.recipientName, details.recipientName],
    [text.address, details.address],
    [text.repairDetails, details.repairDetails],
    [text.sentAt, formatTime(details.sentAt, lang)],
    ...(details.returnedAt ? [[text.returnedAt, formatTime(details.returnedAt, lang)]] : []),
  ];
  return (
    <section className="mt-3 rounded-md border border-solid border-line p-3 text-sm font-normal">
      <h4 className="font-extrabold mb-2">{text.title}</h4>
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-soft text-xs font-bold">{label}</dt>
            <dd className="m-0 whitespace-pre-wrap wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
