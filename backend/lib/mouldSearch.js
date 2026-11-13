// Search moulds the forgiving way (lib/search.js), used by Find, live suggestions and the work log report.
// One result per mould. A match through an item (Item ID / description) reports that item.
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import { compactToken, didYouMean, keyFilter, looseRegex, queryWords, rank } from "./search.js";
import { setting } from "./settings.js";

const CANDIDATE_LIMIT = 300;

// Matches a document by its searchKey, or (not backfilled yet) by its raw fields with a separator-tolerant pattern.
function keyOrLegacy(words, legacyFields) {
  const loose = looseRegex(words);
  return { $or: [keyFilter(words), { searchKey: null, $or: legacyFields.map((f) => ({ [f]: loose })) }] };
}

// -> { ranked: [{ id, score, matchedItem }], words, didYouMean: [] }
export async function searchMoulds(q, baseFilter = {}, { limit = CANDIDATE_LIMIT, suggest = true } = {}) {
  const words = queryWords(q);
  if (!words.length) return { ranked: [], words, didYouMean: [] };
  const live = { deletedAt: null, ...baseFilter };
  const loose = looseRegex(words);
  const [moulds, items, machines, racks] = await Promise.all([
    Mould.find({ ...live, ...keyOrLegacy(words, ["toolId", "notes"]) }, { toolId: 1, searchKey: 1 }).limit(CANDIDATE_LIMIT).lean(),
    Item.find({ deletedAt: null, ...keyOrLegacy(words, ["itemId", "description"]) }, { mouldId: 1, itemId: 1, description: 1, searchKey: 1 }).limit(CANDIDATE_LIMIT).lean(),
    Machine.find({ $or: [{ code: loose }, { name: loose }] }, { _id: 1 }).limit(50).lean(),
    Rack.find({ deletedAt: null, locationId: loose }, { _id: 1 }).limit(100).lean()
  ]);
  const byId = new Map();
  const consider = (id, score, matchedItem = null) => {
    const k = String(id);
    const cur = byId.get(k);
    if (!cur || score < cur.score) byId.set(k, { id: k, score, matchedItem: matchedItem ?? cur?.matchedItem ?? null });
  };
  const legacyScore = (text) => rank(compactToken(text), [words.join("")]);
  for (const m of moulds) consider(m._id, Math.min(rank(m.searchKey, words), m.searchKey ? Infinity : legacyScore(m.toolId), 3));
  // Item matches rank right after an equally good Tool ID match.
  for (const it of items) consider(it.mouldId, Math.min(rank(it.searchKey, words), it.searchKey ? Infinity : legacyScore(it.itemId), 3) + 0.5, { itemId: it.itemId, description: it.description || "" });
  // Moulds on a matching machine or rack (location searches like "INJ-03", "FLK A3").
  if (machines.length || racks.length) {
    const placed = await Mould.find({ ...live, $or: [{ machineId: { $in: machines.map((m) => m._id) } }, { rackId: { $in: racks.map((r) => r._id) } }] }, { _id: 1 }).limit(CANDIDATE_LIMIT).lean();
    for (const m of placed) consider(m._id, 2.5);
  }
  // Item-only matches still have to satisfy the base filter (location, status, …) and be live.
  const itemOnly = [...byId.keys()].filter((id) => !moulds.some((m) => String(m._id) === id));
  if (itemOnly.length) {
    const ok = new Set((await Mould.find({ ...live, _id: { $in: itemOnly } }, { _id: 1 }).lean()).map((m) => String(m._id)));
    for (const id of itemOnly) if (!ok.has(id)) byId.delete(id);
  }
  const ranked = [...byId.values()].sort((a, b) => a.score - b.score).slice(0, limit);
  let suggestions = [];
  if (!ranked.length && suggest && setting("search.typoTolerance") !== false) {
    // Typo fallback: compare against Tool IDs and Item IDs only (small projection).
    const [allMoulds, allItems] = await Promise.all([
      Mould.find(live, { toolId: 1 }).limit(5000).lean(),
      Item.find({ deletedAt: null }, { itemId: 1 }).limit(10000).lean()
    ]);
    suggestions = didYouMean(words, [...allMoulds.map((m) => m.toolId), ...allItems.map((i) => i.itemId)]);
  }
  return { ranked, words, didYouMean: suggestions };
}

// Moulds whose items match (work log report search).
export async function itemMouldIdsFor(q) {
  const words = queryWords(q);
  return words.length ? Item.distinct("mouldId", { deletedAt: null, ...keyOrLegacy(words, ["itemId", "description"]) }) : [];
}
