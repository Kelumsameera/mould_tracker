// Forgiving search shared by every search box (Find, suggestions, Catalog, work log report).
// "FLK19066", "flk 19066", "FLK-19066", "flk_19066" all mean the same thing: punctuation and case never matter.
// Patterns are only ever built from normalized text (letters, digits, marks), never from raw user input.

export const MAX_QUERY = 64;

// Lowercase, NFKC, keep letters (incl. Sinhala with its vowel signs), digits and spaces; collapse spaces.
export function normalize(s) {
  return String(s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]+/gu, "").replace(/\s+/g, " ").trim();
}
// One id-like value as a single token ("GP0001-130" -> "gp0001130", "FLK 19066" -> "flk19066").
export const compactToken = (s) => normalize(s).replace(/ /g, "");
// Query words, length-limited.
export const queryWords = (q) => normalize(String(q ?? "").slice(0, MAX_QUERY)).split(" ").filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const uniq = (list) => [...new Set(list.filter(Boolean))];

// ---- Stored keys ----
const pinOf = (notes) => String(notes ?? "").match(/Pin:\s*([^\n/]+)/i)?.[1]?.trim() ?? null;
export function mouldSearchKey(m) {
  return uniq([compactToken(m.toolId), ...(m.capableMachines || []).map(compactToken), compactToken(m.owner)]).join(" ");
}
export function itemSearchKey(i) {
  return uniq([compactToken(i.itemId), ...normalize(i.description).split(" "), compactToken(i.materialId), compactToken(i.masterbatchId), compactToken(i.qas), compactToken(pinOf(i.notes))]).join(" ");
}

// ---- Matching (MongoDB filters) ----
// Every word must be in the key. Words contain only letters/digits/marks, and are escaped anyway.
export function keyFilter(words, field = "searchKey") {
  return words.length ? { $and: words.map((w) => ({ [field]: { $regex: escapeRegex(w) } })) } : {};
}
// Pattern for documents that have no searchKey yet (before the backfill): the compact query with optional
// separators between characters, e.g. "flk19066" matches "FLK 19066" and "FLK-19066".
export function looseRegex(words) {
  const chars = [...words.join("")].map(escapeRegex);
  // No "u" flag and no \p classes: MongoDB regex options do not accept them. A separator is anything that is not
  // a Latin letter, digit or Sinhala character.
  return chars.length ? new RegExp(chars.join("[^a-zA-Z0-9\\u0D80-\\u0DFF]*"), "i") : null;
}

// ---- Ranking ----
// 0 exact, 1 prefix, 2 substring (one token), 3 words spread over tokens; Infinity = no match.
export function rank(key, words) {
  if (!key || !words.length) return Infinity;
  const tokens = String(key).split(" ");
  const cq = words.join("");
  if (!words.every((w) => key.includes(w))) return Infinity;
  if (tokens.includes(cq)) return 0;
  if (tokens.some((t) => t.startsWith(cq))) return 1;
  if (tokens.some((t) => t.includes(cq))) return 2;
  return 3;
}

// ---- Typo fallback (only used when nothing matched) ----
const CONFUSE = { o: "0", i: "1", l: "1" };
const unconfuse = (s) => [...s].map((c) => CONFUSE[c] ?? c).join("");
export function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
// candidates: original id strings (Tool IDs, Item IDs). Returns up to `limit` close ones.
export function didYouMean(words, candidates, limit = 3) {
  const cq = words.join("");
  if (cq.length < 5) return [];
  const out = [];
  for (const original of uniq(candidates)) {
    const k = compactToken(original);
    if (k === cq) continue;
    if (unconfuse(k) === unconfuse(cq) || (k.length >= 5 && editDistanceAtMostOne(k, cq))) out.push(original);
    if (out.length >= limit) break;
  }
  return out;
}
