// Forgiving search: normalization, matching through items, ranking, typo fallback, safety.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { find } from "mingo";
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import { normalize, compactToken, queryWords, mouldSearchKey, itemSearchKey, keyFilter, looseRegex, rank, didYouMean, editDistanceAtMostOne, MAX_QUERY } from "../lib/search.js";
import { searchMoulds, itemMouldIdsFor } from "../lib/mouldSearch.js";
import { listMouldsQuery, suggestQuery } from "../validators/schemas.js";
import { planSearchKeys } from "../scripts/backfill-search-keys.mjs";

const mould = (id, toolId, extra = {}) => { const m = { _id: id, toolId, capableMachines: [], owner: null, deletedAt: null, location: "MOULD_ROOM", ...extra }; return { ...m, searchKey: mouldSearchKey(m) }; };
const item = (id, mouldId, itemId, description, extra = {}) => { const i = { _id: id, mouldId, itemId, description, deletedAt: null, ...extra }; return { ...i, searchKey: itemSearchKey(i) }; };
const MOULDS = [
  mould("m1", "FLK19066", { capableMachines: ["INJ-03"], owner: "FLK" }),
  mould("m2", "FLK19066-B"),
  mould("m3", "CCI 200"),
  mould("m4", "OLD1", { deletedAt: new Date() }),
  { _id: "m5", toolId: "FLK 77100", capableMachines: [], deletedAt: null, searchKey: null }, // not backfilled yet
  mould("m6", "LEX01D", { location: "MACHINE" })
];
const ITEMS = [
  item("i1", "m3", "GP0001-130", "OXYGEN CONNECTOR 5.0"),
  item("i2", "m2", "GP0001-130", "OXYGEN CONNECTOR 5.0"),
  item("i3", "m6", "CP0000-052", "සක්ෂන් ටියුබ් suction tubing", { notes: "Pin: LEX01P" }),
  item("i4", "m4", "GHOST-9", "on a deleted mould")
];
// Fake Mongoose: find(...).limit().lean() and distinct() evaluated by mingo with the real filters.
const fakeFind = (data) => (filter, projection) => {
  const rows = find(data, filter).all();
  const chain = { limit: (n) => { chain.n = n; return chain; }, lean: async () => rows.slice(0, chain.n ?? rows.length), sort: () => chain, n: undefined };
  void projection;
  return chain;
};
before(() => {
  mock.method(Mould, "find", fakeFind(MOULDS));
  mock.method(Item, "find", fakeFind(ITEMS));
  mock.method(Item, "distinct", async (field, filter) => [...new Set(find(ITEMS, filter).all().map((r) => r[field]))]);
  mock.method(Machine, "find", fakeFind([{ _id: "mc1", code: "INJ-03", name: "Injection 3" }]));
  mock.method(Rack, "find", fakeFind([{ _id: "r1", locationId: "FLK-A3", deletedAt: null }]));
});
after(() => mock.restoreAll());
const ids = async (q, base) => (await searchMoulds(q, base)).ranked.map((r) => r.id);

test("normalization: case, punctuation and spacing never matter", () => {
  for (const v of ["FLK19066", "flk 19066", "FLK-19066", "flk_19066", "FLK.19066", "(flk)19066!"]) assert.equal(compactToken(v), "flk19066", v);
  assert.equal(compactToken("GP0001-130"), compactToken("gp0001130"));
  assert.equal(normalize("ＦＬＫ１９０６６"), "flk19066", "full-width characters (NFKC)");
  assert.equal(normalize("සක්ෂන් ටියුබ්"), "සක්ෂන් ටියුබ්", "Sinhala letters and vowel signs stay");
  assert.deepEqual(queryWords("- _ = + ) ( * & ^ % $ # @ ! ? , : . /"), []);
  assert.equal(queryWords("x".repeat(500))[0].length, MAX_QUERY);
});

test("every spelling of a Tool ID finds the same mould first", async () => {
  for (const q of ["FLK19066", "flk 19066", "FLK-19066", "flk_19066", "Flk.19066"]) {
    const r = await ids(q);
    assert.equal(r[0], "m1", q);
    assert.ok(r.includes("m2"), "prefix match follows");
  }
});

test("an Item ID finds every mould that makes it, with the matched item reported", async () => {
  for (const q of ["GP0001-130", "gp0001130", "gp 0001 130"]) {
    const { ranked } = await searchMoulds(q);
    assert.deepEqual(ranked.map((r) => r.id).sort(), ["m2", "m3"], q);
    assert.equal(ranked[0].matchedItem.itemId, "GP0001-130");
  }
  assert.deepEqual((await itemMouldIdsFor("gp0001-130")).sort(), ["m2", "m3"]);
});

test("multi-word queries need every word; description words and decimals work", async () => {
  assert.deepEqual((await ids("oxygen connector 5.0")).sort(), ["m2", "m3"]);
  assert.deepEqual(await ids("oxygen banana"), []);
});

test("Sinhala text, Pin IDs, machines and racks are searchable", async () => {
  assert.deepEqual(await ids("ටියුබ්"), ["m6"]);
  assert.deepEqual(await ids("lex01p"), ["m6"]);
  assert.ok((await ids("inj 03")).includes("m1"), "capable machine in the key");
});

test("ranking: exact > prefix > substring", () => {
  const w = queryWords("flk19066");
  assert.equal(rank("flk19066 inj03", w), 0);
  assert.equal(rank("flk19066b", w), 1);
  assert.equal(rank("xflk19066", w), 2);
  assert.equal(rank("abc", w), Infinity);
});

test("soft-deleted moulds are never returned, also not through their items", async () => {
  assert.deepEqual(await ids("OLD1"), []);
  assert.deepEqual(await ids("ghost 9"), []);
});

test("documents without a searchKey are still found (before the backfill)", async () => {
  assert.deepEqual(await ids("flk-77100"), ["m5"]);
});

test("base filters apply to item matches too", async () => {
  assert.deepEqual(await ids("gp0001130", { location: "MACHINE" }), []);
});

test("typo fallback only when nothing matched: one edit or O/0, I/1/l confusions", async () => {
  const r = await searchMoulds("FLK19O66"); // letter O
  assert.equal(r.ranked.length, 0);
  assert.ok(r.didYouMean.includes("FLK19066"));
  assert.ok((await searchMoulds("LEXO1D")).didYouMean.includes("LEX01D"));
  assert.ok((await searchMoulds("FLK1906")).ranked.length > 0, "a real prefix match: no fallback");
  assert.equal(editDistanceAtMostOne("flk19066", "flk19067"), true);
  assert.equal(editDistanceAtMostOne("flk19066", "flk19077"), false);
  assert.deepEqual(didYouMean(queryWords("ab"), ["AB1"]), [], "short keys get no guesses");
});

test("special characters and very long input never error and give an empty result", async () => {
  for (const q of ["a(b", "*", "\\", "??", "[", "$where", "%$#@!", "x".repeat(300)]) {
    const r = await searchMoulds(q);
    assert.ok(Array.isArray(r.ranked), q);
  }
  assert.deepEqual((await searchMoulds("*&^%")).ranked, []);
  assert.equal(listMouldsQuery.parse({ q: "y".repeat(500) }).q.length, 64, "long input is cut, not rejected");
  assert.equal(suggestQuery.safeParse({ q: "a(b\\*" }).success, true);
});

test("query filters are built from normalized text only and use the indexed key", () => {
  assert.deepEqual(keyFilter(["flk19066"]), { $and: [{ searchKey: { $regex: "flk19066" } }] });
  assert.equal(String(looseRegex(["ab"])), "/a[^a-zA-Z0-9\u0D80-\u0DFF]*b/i");
  assert.equal(looseRegex(["flk", "18063"]).source.includes("\\u"), false, "MongoDB PCRE2 receives literal code points");
  assert.ok(looseRegex(["flk", "18063"]).test("FLK-18063"));
  assert.ok(looseRegex(["සිංහල"]).test("සිංහල"));
  assert.equal(looseRegex(["ab"]).test("aසිංහලb"), false, "Sinhala letters are not separators");
  assert.ok(Mould.schema.indexes().some(([k]) => k.searchKey === 1) && Item.schema.indexes().some(([k]) => k.searchKey === 1));
});

test("search keys: computed on save and by the idempotent backfill", () => {
  const m = new Mould({ toolId: "FLK-1", capableMachines: ["INJ-03"], owner: "FLK", location: "PRODUCTION_FLOOR" });
  assert.equal(mouldSearchKey(m), "flk1 inj03 flk"); // Tool ID, capable machines, owner
  const i = { _id: 1, itemId: "GP0001-130", description: "Oxygen connector", materialId: "PP-1", notes: "Pin: LEX01P", searchKey: null };
  const ops = planSearchKeys([i], itemSearchKey);
  assert.equal(ops[0].updateOne.update.$set.searchKey, "gp0001130 oxygen connector pp1 lex01p");
  assert.deepEqual(planSearchKeys([{ ...i, searchKey: ops[0].updateOne.update.$set.searchKey }], itemSearchKey), [], "second run writes nothing");
});
