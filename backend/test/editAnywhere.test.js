// Step 3: master data can be edited at any status/location; edits never change status/location.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planMouldEdit, MOULD_FIELDS } from "../lib/mouldEdit.js";
import { assertEditPermissions } from "../controllers/mouldController.js";
import { LOCATIONS, MOULD_STATUSES } from "../lib/mouldState.js";
import { mouldRouteTable } from "../routes/mouldRoutes.js";

const code = (fn) => { try { fn(); } catch (e) { return e.details?.code ?? e.message; } return "OK"; };
const mouldAt = (location, status, extra = {}) => ({
  toolId: "A1", toolType: "INJECTION_MOULD", location, status, version: 3,
  machineId: location === "MACHINE" ? "m1" : null, rackId: location === "MOULD_ROOM" ? "r1" : null, awaitingRack: false,
  capableMachines: ["INJ-01"], shotsToService: 1000, notes: "", ...extra
});
// Every place a mould can be, with every status (including unusual combinations already in the data).
const combos = [...LOCATIONS, "ISOLATION"].flatMap((l) => [...MOULD_STATUSES, "CONDITIONAL"].map((s) => [l, s]));

test("details, machines and shots-to-service can be edited at every location and status", () => {
  for (const [location, status] of combos) {
    const before = mouldAt(location, status);
    const { set, diff } = planMouldEdit(before, { notes: "new note", capableMachines: ["INJ-02"], shotsToService: 5, size: "L" });
    assert.deepEqual(diff.fields.sort(), ["capableMachines", "notes", "shotsToService", "size"], `${location}/${status}`);
    for (const key of ["location", "status", "machineId", "rackId", "awaitingRack"]) assert.equal(key in set, false, `${key} untouched at ${location}/${status}`);
  }
});

test("an edit can only touch master-data fields", () => {
  const { set } = planMouldEdit(mouldAt("MACHINE", "GOOD"), { notes: "x", location: "WORKSHOP", status: "IN_REPAIR", machineId: null });
  assert.deepEqual(Object.keys(set), ["notes"]);
  assert.ok(!MOULD_FIELDS.includes("location") && !MOULD_FIELDS.includes("status"));
});

test("nothing changed is reported, not saved", () => {
  assert.equal(code(() => planMouldEdit(mouldAt("WORKSHOP", "IN_REPAIR"), { notes: "" })), "NO_CHANGE");
});

test("only a tool type change is checked against where the tool is", () => {
  assert.equal(code(() => planMouldEdit(mouldAt("MOULD_ROOM", "GOOD"), { toolType: "EXTRUSION_DIE" })), "INVALID_LOCATION");
  assert.equal(code(() => planMouldEdit(mouldAt("MACHINE", "GOOD"), { toolType: "EXTRUSION_DIE" })), "OK");
  // An odd existing state does not block normal edits.
  assert.equal(code(() => planMouldEdit(mouldAt("MOULD_ROOM", "NEEDS_REPAIR"), { notes: "still editable" })), "OK");
});

test("each part of an edit needs its own permission", () => {
  const user = (permissionOverrides) => ({ role: "executive", permissionOverrides });
  const onlyMachines = user({ grant: ["mould.machines.edit"], deny: [] });
  const onlyDetails = user({ grant: ["mould.edit"], deny: [] });
  assert.equal(code(() => assertEditPermissions(onlyMachines, { capableMachines: ["X"] })), "OK");
  assert.equal(code(() => assertEditPermissions(onlyMachines, { notes: "x" })), "FORBIDDEN");
  assert.equal(code(() => assertEditPermissions(onlyDetails, { notes: "x" })), "OK");
  assert.equal(code(() => assertEditPermissions(onlyDetails, { capableMachines: ["X"], notes: "x" })), "FORBIDDEN");
  assert.equal(code(() => assertEditPermissions(user(null), { notes: "x" })), "FORBIDDEN");
});

test("routes: pictures need mould.images.manage, items mould.edit, edit route accepts either edit permission", () => {
  const perms = Object.fromEntries(mouldRouteTable.map(([m, p, perm]) => [`${m} ${p}`, perm]));
  assert.deepEqual(perms["post /:id/items/:itemId/images"], ["mould.images.manage"]);
  assert.deepEqual(perms["patch /:id/items/:itemId"], ["mould.edit"]);
  assert.deepEqual(perms["patch /:id"], ["mould.edit", "mould.machines.edit"]);
});
