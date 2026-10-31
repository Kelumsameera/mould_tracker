import { accountPrivacy } from "../lib/accountPrivacy.js";
import { test, describe, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { addDays, dateWindow, dayEnd, dayStart, localDate } from "../lib/dateRange.js";
import { EXPORT_CAP, buildWorkLogFilter, describeFilters } from "../lib/workLogFilter.js";
import { planProblemReport, planWorkLog } from "../lib/workLog.js";
import WorkLog from "../models/WorkLog.js";
import Item from "../models/Item.js";
import AuditLog from "../models/AuditLog.js";
import { exportWorkLogs, listWorkLogs } from "../controllers/workLogController.js";

afterEach(() => mock.restoreAll());
const TZ = "Asia/Colombo"; // UTC+05:30, no daylight saving
const oid = () => new mongoose.Types.ObjectId();
const iso = (d) => d.toISOString();

describe("date ranges are whole local days in Asia/Colombo", () => {
  test("a local day runs from 18:30Z the evening before to 18:29:59.999Z", () => {
    assert.equal(iso(dayStart("2026-10-22", TZ)), "2026-10-21T18:30:00.000Z");
    assert.equal(iso(dayEnd("2026-10-22", TZ)), "2026-10-22T18:29:59.999Z");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  test("just after local midnight it is already the next day", () => {
    const now = new Date("2026-10-22T18:45:00Z"); // 00:15 on 23 Oct in Colombo
    assert.equal(localDate(now, TZ), "2026-10-23");
    const today = dateWindow({ range: "today" }, now, TZ);
    assert.equal(iso(today.$gte), "2026-10-22T18:30:00.000Z");
    const justBefore = new Date("2026-10-22T18:29:59.999Z"); // 23:59:59.999 on 22 Oct
    assert.ok(justBefore < today.$gte);
  });
  test("last 7 days includes today and six days before; this month starts on the 1st", () => {
    const now = new Date("2026-10-22T06:00:00Z");
    const week = dateWindow({ range: "7d" }, now, TZ);
    assert.deepEqual([iso(week.$gte), iso(week.$lte)], ["2026-10-15T18:30:00.000Z", "2026-10-22T18:29:59.999Z"]);
    const month = dateWindow({ range: "month" }, now, TZ);
    assert.equal(iso(month.$gte), "2026-09-30T18:30:00.000Z");
    assert.equal(iso(dateWindow({ range: "30d" }, now, TZ).$gte), "2026-09-22T18:30:00.000Z");
  });
  test("custom from/to are whole days; all time has no window", () => {
    const w = dateWindow({ range: "custom", from: "2026-10-01", to: "2026-10-01" }, new Date(), TZ);
    assert.deepEqual([iso(w.$gte), iso(w.$lte)], ["2026-09-30T18:30:00.000Z", "2026-10-01T18:29:59.999Z"]);
    assert.equal(dateWindow({ range: "all" }), null);
    assert.equal(dateWindow({}), null);
    assert.deepEqual(Object.keys(dateWindow({ from: "2026-10-01" }, new Date(), TZ)), ["$gte"]);
  });
});

describe("report filter", () => {
  test("search covers description, parts, Tool ID, machine, people and Item IDs", () => {
    const m1 = oid();
    const f = buildWorkLogFilter({ q: "inj 3" }, { itemMouldIds: [m1] });
    const or = f.$and[0].$or;
    const fields = or.flatMap((c) => Object.keys(c));
    assert.deepEqual([...new Set(fields)].sort(), ["description", "doneBy.name", "machineCode", "mouldId", "partsUsed", "recordedBy.name", "toolId"].sort());
    assert.ok(or.some((c) => c.machineCode === "INJ-03")); // "inj 3" also matches the machine code spelling
    assert.equal(String(or.find((c) => c.mouldId).mouldId.$in[0]), String(m1));
    assert.ok(or.find((c) => c.description).description.test("Fixed leak on INJ 3 cooling"));
    assert.ok(or.find((c) => c.toolId).toolId.test("INJ3")); // spaces optional in IDs
    const special = buildWorkLogFilter({ q: "a(b" }).$and[0].$or[0].description;
    assert.ok(special.test("a(b")); // user text is escaped, never a regex
  });
  test("filters combine with AND; ids are cast for aggregate; outcome NONE means no outcome", () => {
    const uid = oid();
    const f = buildWorkLogFilter({ userId: String(uid), type: "REPAIR", machine: "inj_4", outcome: "NONE", status: "NEEDS_REPAIR", problem: "true", range: "all" });
    assert.deepEqual(f.$and.slice(1), [{ type: "REPAIR" }, { machineCode: "INJ-04" }, { outcome: null }, { statusAfter: "NEEDS_REPAIR" }, { problemReported: true }]);
    assert.ok(f.$and[0]["doneBy.userId"] instanceof mongoose.Types.ObjectId);
    assert.equal(String(f.$and[0]["doneBy.userId"]), String(uid));
    assert.deepEqual(buildWorkLogFilter({}), {});
  });
  test("the export header says what the file contains", () => {
    const rows = describeFilters({ range: "7d", q: "pin", type: "REPAIR" }, 12, new Date("2026-10-22T00:00:00Z"));
    assert.deepEqual(rows.slice(1, 3), [["Rows", "12"], ["Date range", "7d"]]);
    assert.ok(rows.some(([k, v]) => k === "Search" && v === "pin"));
    assert.ok(rows.some(([k, v]) => k === "Type" && v === "REPAIR"));
  });
});

// A stand-in for WorkLog.find(...).sort().skip().limit().lean() that records what was asked for.
function fakeFind(rows, seen) {
  return (filter) => {
    if (filter.correctsId) return { lean: async () => [] }; // "was this corrected?" lookups
    seen.filter = filter;
    const chain = {
      sort() { return chain; },
      skip(n) { seen.skip = n; return chain; },
      limit(n) { seen.limit = n; return chain; },
      lean: async () => rows
    };
    return chain;
  };
}
const row = (patch = {}) => ({
  _id: oid(), mouldId: oid(), toolId: "FLK1", type: "REPAIR", description: "Fixed pin", partsUsed: "", timeSpentMinutes: 30,
  doneBy: [{ userId: oid(), name: "Nimal", role: "mould_maker" }], recordedBy: { userId: oid(), name: "Nimal", role: "mould_maker" },
  doneAt: new Date("2026-10-21T05:00:00Z"), createdAt: new Date("2026-10-21T05:01:00Z"), location: "MACHINE", machineCode: "INJ-03",
  statusBefore: "GOOD", statusAfter: "GOOD", photos: [], ...patch
});
const response = () => ({ headers: {}, set(k, v) { this.headers[k] = v; }, json(b) { this.body = b; }, send(b) { this.body = b; } });

describe("pagination and export", () => {
  test("the list returns one page plus the total, never everything", async () => {
    const seen = {};
    mock.method(WorkLog, "countDocuments", async () => 134);
    mock.method(WorkLog, "find", fakeFind([row(), row()], seen));
    const res = response();
    await listWorkLogs({ validQuery: { page: 3, limit: 20, range: "7d" } }, res);
    assert.deepEqual([res.body.total, res.body.page, res.body.limit, seen.skip, seen.limit], [134, 3, 20, 40, 20]);
    assert.ok(seen.filter.$and[0].doneAt.$gte instanceof Date);
  });
  test("export uses exactly the report filter (search included) and explains it in the file", async () => {
    const seen = {};
    let counted;
    const m1 = oid();
    mock.method(Item, "distinct", async () => [m1]);
    mock.method(WorkLog, "countDocuments", async (f) => { counted = f; return 2; });
    mock.method(WorkLog, "find", fakeFind([row(), row({ description: "Polished, cavity 3" })], seen));
    mock.method(AuditLog, "create", async () => ({}));
    const res = response();
    await exportWorkLogs({ accountPrivacy: accountPrivacy(null), validQuery: { q: "pin", range: "7d", format: "csv" }, user: { _id: oid(), name: "Admin" } }, res);
    assert.deepEqual(seen.filter, counted);
    assert.equal(String(seen.filter.$and[1].$or.find((c) => c.mouldId).mouldId.$in[0]), String(m1));
    const lines = res.body.replace(/^﻿/, "").split("\r\n");
    assert.ok(lines.includes("Search,pin"));
    assert.ok(lines.includes("Rows,2"));
    const header = lines.findIndex((l) => l.startsWith("Done at,"));
    assert.equal(lines.length - header - 1, 2);
    assert.ok(lines.some((l) => l.includes('"Polished, cavity 3"')));
    assert.match(res.headers["Content-Disposition"], /work-log-.*\.csv/);
  });
  test("more than the cap is refused with the count, before anything is read", async () => {
    let read = false;
    mock.method(WorkLog, "countDocuments", async () => EXPORT_CAP + 1);
    mock.method(WorkLog, "find", () => { read = true; return { lean: async () => [] }; });
    await assert.rejects(exportWorkLogs({ validQuery: { range: "all", format: "xlsx" }, user: { _id: oid() } }, response()),
      (e) => e.details?.code === "EXPORT_TOO_LARGE" && e.details.total === EXPORT_CAP + 1 && e.details.cap === EXPORT_CAP);
    assert.equal(read, false);
  });
});

describe("report a problem", () => {
  const supervisor = { _id: oid(), role: "production_supervisor", name: "Saman", active: true };
  const technician = { _id: oid(), role: "mould_technician", name: "Kasun", active: true };
  const mould = (patch = {}) => ({ _id: oid(), toolId: "FLK7", status: "GOOD", location: "MACHINE", machineId: oid(), machine: { code: "INJ-05" }, totalShots: 50, ...patch });

  test("a production supervisor can report; status and location stay exactly as they were", () => {
    const m = mould();
    const plan = planProblemReport({ mould: m, user: supervisor, input: { description: "Flash on part, cavity 2" } });
    assert.deepEqual([plan.log.type, plan.log.problemReported, plan.log.statusBefore, plan.log.statusAfter, plan.log.location, plan.log.machineCode],
      ["INSPECTION", true, "GOOD", "GOOD", "MACHINE", "INJ-05"]);
    assert.deepEqual(plan.log.doneBy, [plan.log.recordedBy]);
    assert.equal(plan.log.recordedBy.name, "Saman");
    assert.equal("statusSet" in plan || "move" in plan, false); // nothing to change on the mould but the badge
    const badge = plan.openProblem("log1");
    assert.deepEqual([badge.workLogId, badge.by.name, badge.text], ["log1", "Saman", "Flash on part, cavity 2"]);
    assert.equal(new WorkLog(plan.log).validateSync(), undefined);
  });
  test("a supervisor still cannot log work, change status or move to the Workshop", () => {
    assert.throws(() => planWorkLog({ mould: mould(), user: supervisor, input: { type: "REPAIR", description: "x", outcome: "NEEDS_REPAIR", sendToWorkshop: true } }), (e) => e.details?.code === "FORBIDDEN");
  });
  test("a description is required; deleted moulds and future times are refused", () => {
    assert.throws(() => planProblemReport({ mould: mould(), user: supervisor, input: { description: " " } }), (e) => e.details?.code === "DESCRIPTION_REQUIRED");
    assert.throws(() => planProblemReport({ mould: mould({ deletedAt: new Date() }), user: supervisor, input: { description: "x" } }), (e) => e.details?.code === "MOULD_DELETED");
    assert.throws(() => planProblemReport({ mould: mould(), user: supervisor, input: { description: "x", doneAt: new Date(Date.now() + 3_600_000) } }), (e) => e.details?.code === "DONE_AT_FUTURE");
  });
  test("work logged on a mould with an open problem resolves it (a correction does not)", () => {
    const m = mould({ openProblem: { workLogId: "p1" } });
    assert.equal(planWorkLog({ mould: m, user: technician, input: { type: "MINOR_FIX", description: "Trimmed flash" } }).log.resolvesProblemId, "p1");
    assert.equal(planWorkLog({ mould: m, user: technician, input: { type: "MINOR_FIX", description: "x", correctsId: "c1" }, corrected: { _id: "c1", mouldId: m._id } }).log.resolvesProblemId, null);
    assert.equal(planWorkLog({ mould: mould(), user: technician, input: { type: "REPAIR", description: "x" } }).log.resolvesProblemId, null);
  });
});
