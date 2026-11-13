import { highlightSegments } from "@/utils/search";

// Text with the parts matching the search marked (punctuation-insensitive, mapped to the original text).
export default function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, query).map((s, i) =>
        s.hit ? <mark key={i} className="bg-[rgba(245,184,0,.45)] text-inherit rounded-[2px] px-0">{s.text}</mark> : <span key={i}>{s.text}</span>
      )}
    </>
  );
}
