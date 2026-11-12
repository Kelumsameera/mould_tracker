// Mirrors backend/lib/search.js: case, punctuation and spacing never matter ("FLK-19066" = "flk 19066").
export const MAX_QUERY = 64;

const keep = (ch: string) => /[\p{L}\p{M}\p{N}]/u.test(ch);

export function normalize(s: string | null | undefined) {
  return String(s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]+/gu, "").replace(/\s+/g, " ").trim();
}
export const queryWords = (q: string) => normalize(q.slice(0, MAX_QUERY)).split(" ").filter(Boolean);

// Highlight query words inside the ORIGINAL text. The text is normalized character by character with a map back
// to original positions, so "GP0001-130" highlights fully for the query "gp0001130" (the dash included).
export function highlightSegments(text: string, query: string): { text: string; hit: boolean }[] {
  const original = String(text ?? "");
  const words = queryWords(query);
  if (!original || !words.length) return [{ text: original, hit: false }];
  const chars = [...original];
  let flat = "";
  const map: number[] = []; // flat index -> chars index
  chars.forEach((ch, i) => {
    if (!keep(ch)) return;
    for (const c of ch.normalize("NFKC").toLowerCase()) { flat += c; map.push(i); }
  });
  const hit = new Array(chars.length).fill(false);
  // Whole compact query first (covers "flk 19066" vs "FLK-19066"), then each word.
  for (const w of [words.join(""), ...words]) {
    let from = 0;
    for (let at = flat.indexOf(w, from); at !== -1 && w; at = flat.indexOf(w, from)) {
      const start = map[at], end = map[at + w.length - 1];
      for (let i = start; i <= end; i++) hit[i] = true; // includes ignored separators in between
      from = at + w.length;
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  chars.forEach((ch, i) => {
    const last = out[out.length - 1];
    if (last && last.hit === hit[i]) last.text += ch; else out.push({ text: ch, hit: hit[i] });
  });
  return out;
}

// Recent searches on this device (per user). Storage may be unavailable: never throw.
const RECENT_MAX = 6;
const recentKey = (userId: string) => `mt.recentSearches.${userId}`;
export function readRecent(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(userId)) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
export function rememberSearch(userId: string, q: string) {
  const text = q.trim().slice(0, MAX_QUERY);
  if (!text) return;
  try {
    const next = [text, ...readRecent(userId).filter((x) => normalize(x) !== normalize(text))].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(userId), JSON.stringify(next));
  } catch {
    /* storage blocked: recent searches are optional */
  }
}

// Client-side filter for small lists (pickers, users): every query word must appear in one of the texts,
// ignoring case, punctuation and spacing ("flk-a3" matches "FLK A3").
export function matchesQuery(texts: (string | null | undefined)[], query: string) {
  const words = queryWords(query);
  if (!words.length) return true;
  const hay = normalize(texts.join(" "));
  const compact = hay.replace(/ /g, "");
  return words.every((w) => hay.includes(w) || compact.includes(w));
}
