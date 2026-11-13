// Access control (Change Pack 2): role matrix + per-user grant/deny/expiry, System Administrator rules.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import RoleAccess from "../models/RoleAccess.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import userRoutes from "../routes/userRoutes.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { ASSIGNABLE_ROLES, ROLES, can, canAssignRole, canManageUser, effectivePermissions, normalizeOverrides, permissionsFor, roleDefaults, upgradePermissions } from "../lib/permissions.js";
import { invalidateRoleAccess, loadRoleAccess } from "../lib/roleAccess.js";
import { roleAccessSchema, userAccessSchema } from "../validators/schemas.js";
import { planRoleRow, planUserOverrides } from "../scripts/migrate-permissions.mjs";
import { planSysadminSeed } from "../scripts/seed-sysadmin.mjs";
import { updateRoleAccess, updateUserAccess, updateUser, deleteUser } from "../controllers/userController.js";

const oid = () => new mongoose.Types.ObjectId();
const tomorrow = () => new Date(Date.now() + 86_400_000);
const yesterday = () => new Date(Date.now() - 86_400_000);

let configs, audits;
beforeEach(() => {
  invalidateRoleAccess();
  configs = new Map(); audits = [];
  mock.method(RoleAccess, "findOne", async ({ role }) => configs.get(role) ?? null);
  mock.method(RoleAccess, "find", async () => [...configs.values()]);
  mock.method(RoleAccess, "findOneAndUpdate", async ({ role }, update) => {
    const prev = configs.get(role);
    configs.set(role, { role, permissions: [...update.$set.permissions], version: (prev?.version ?? 0) + 1 });
  });
  mock.method(RoleAccess, "deleteOne", async ({ role }) => configs.delete(role));
  mock.method(AuditLog, "create", async (entry) => audits.push(entry));
});
afterEach(() => mock.restoreAll());

test("grant an extra permission to one user only", () => {
  const tech = { role: "mould_technician", permissionOverrides: { grant: ["rack.manage"], deny: [] } };
  assert.equal(can(tech, "rack.manage"), true);
  assert.equal(can({ role: "mould_technician" }, "rack.manage"), false);
  assert.equal(can(tech, "move.machine"), true, "role permissions stay");
});

test("deny one role permission for one user only", () => {
  const sup = { role: "production_supervisor", permissionOverrides: { grant: [], deny: ["move.machine"] } };
  assert.equal(can(sup, "move.machine"), false);
  assert.equal(can(sup, "move.floor"), true);
  assert.equal(can({ role: "production_supervisor" }, "move.machine"), true);
});

test("overrides are ignored after they expire", () => {
  const temp = (expiresAt) => ({ role: "mould_maker", permissionOverrides: { grant: ["audit.view"], deny: ["move.mouldroom"], expiresAt } });
  assert.equal(can(temp(tomorrow()), "audit.view"), true);
  assert.equal(can(temp(tomorrow()), "move.mouldroom"), false);
  assert.equal(can(temp(yesterday()), "audit.view"), false);
  assert.equal(can(temp(yesterday()), "move.mouldroom"), true);
});

test("access.manage is System Administrator only and never grantable; Out of Service stays Super Admin only", () => {
  assert.equal(can({ role: "super_admin", permissionOverrides: { grant: ["access.manage"], deny: [] } }, "access.manage"), false);
  assert.equal(can({ role: "admin", rolePermissionOverrides: ["access.manage"] }, "access.manage"), false);
  assert.equal(can({ role: "admin", permissionOverrides: { grant: ["move.outOfService"], deny: [] } }, "move.outOfService"), false);
  assert.equal(userAccessSchema.safeParse({ grant: ["access.manage"], reason: "test" }).success, false);
  assert.equal(roleAccessSchema.safeParse({ permissions: ["access.manage"], reason: "test" }).success, false);
});

test("System Administrator always has everything; overrides cannot reduce it", () => {
  const sys = { role: "system_admin", permissionOverrides: { grant: [], deny: ["mould.view", "access.manage"] }, rolePermissionOverrides: [] };
  assert.equal(can(sys, "access.manage"), true);
  assert.equal(can(sys, "mould.view"), true);
});

test("role-assignment table: who may assign which role", () => {
  const expected = {
    system_admin: ROLES,
    super_admin: ["admin", "production_supervisor", "mould_technician", "mould_maker", "executive"],
    admin: ["production_supervisor", "mould_technician", "mould_maker", "executive"],
    production_supervisor: [], mould_technician: [], mould_maker: [], executive: []
  };
  for (const actor of ROLES) for (const role of ROLES) {
    assert.equal(canAssignRole({ role: actor }, role), expected[actor].includes(role), `${actor} assigns ${role}`);
  }
  assert.deepEqual(Object.keys(ASSIGNABLE_ROLES).sort(), ["admin", "super_admin", "system_admin"]);
  const sa = { _id: oid(), role: "super_admin" };
  assert.equal(canManageUser(sa, { _id: oid(), role: "super_admin" }), false, "super admin cannot manage another super admin");
  assert.equal(canManageUser(sa, { _id: oid(), role: "admin" }, "super_admin"), false);
  assert.equal(canManageUser(sa, { _id: oid(), role: "mould_maker" }, "admin"), true);
});

test("executive is read-only by default", () => {
  const ex = { role: "executive" };
  for (const p of ["mould.view", "worklog.view", "worklog.report", "rack.view", "export.run"]) assert.equal(can(ex, p), true, p);
  for (const p of ["mould.edit", "mould.create", "move.machine", "move.floor", "move.isolation", "worklog.create", "users.manage", "settings.manage", "cavity.manage", "problem.report"]) {
    assert.equal(can(ex, p), false, p);
  }
});

test("old permission names and the old full-list override still work", () => {
  assert.deepEqual(upgradePermissions(["moulds.manage"]), ["mould.create", "mould.edit", "mould.machines.edit", "mould.images.manage", "mould.delete"]);
  const legacy = { role: "production_supervisor", permissionOverrides: ["moulds.view", "racks.manage"] };
  assert.equal(can(legacy, "rack.manage"), true);
  assert.equal(can(legacy, "move.machine"), false, "old list replaced the role permissions");
  assert.deepEqual(normalizeOverrides(["moulds.view"], ["mould.view", "rack.view"]), { grant: [], deny: ["rack.view"], expiresAt: null, reason: "" });
  assert.equal(can({ role: "admin", rolePermissionOverrides: ["workshop.work"] }, "status.change"), true);
});

test("migration plans rewrite old names and old override lists once", () => {
  assert.deepEqual(planRoleRow({ role: "admin", permissions: ["moves.machine"] }).to, ["move.machine", "move.floor"]);
  assert.equal(planRoleRow({ role: "admin", permissions: ["move.machine"] }), null);
  const plan = planUserOverrides({ _id: 1, role: "mould_maker", permissionOverrides: [...roleDefaults("mould_maker"), "audit.view"] }, null);
  assert.deepEqual([plan.to.grant, plan.to.deny], [["audit.view"], []]);
  assert.equal(planUserOverrides({ _id: 1, role: "mould_maker", permissionOverrides: plan.to }, null), null, "idempotent");
});

test("first System Administrator seed: instructions without env, promote or create", () => {
  assert.equal(planSysadminSeed({}).action, "none");
  assert.equal(planSysadminSeed({ email: "a@b.c", existing: { role: "admin" } }).action, "promote");
  assert.equal(planSysadminSeed({ email: "a@b.c", existing: { role: "system_admin" } }).action, "none");
  assert.equal(planSysadminSeed({ email: "a@b.c", password: "short" }).action, "none");
  assert.equal(planSysadminSeed({ email: "a@b.c", password: "long-enough" }).action, "create");
});

test("the last System Administrator cannot be demoted, disabled or deleted", async () => {
  const target = { _id: oid(), role: "system_admin", active: true, deletedAt: null, toObject() { return { ...this }; }, async save() { throw new Error("must not save"); } };
  target._id.equals = () => false;
  mock.method(User, "findById", async () => target);
  mock.method(User, "countDocuments", async () => 0);
  // Visible to its owner only, so act as that owner with a different session id check bypassed:
  const actor = { _id: target._id, role: "system_admin" };
  const blocked = (e) => e.status === 409 && e.details?.code === "LAST_SYSTEM_ADMIN";
  await assert.rejects(updateUser({ user: actor, params: { id: "x" }, body: { role: "admin" } }, {}), blocked);
  await assert.rejects(updateUser({ user: actor, params: { id: "x" }, body: { active: false } }, {}), blocked);
  await assert.rejects(deleteUser({ user: actor, params: { id: "x" }, body: {} }, {}), blocked);
  mock.method(User, "countDocuments", async () => 1);
  target.save = async () => target;
  const res = { json() { return this; } };
  await updateUser({ user: actor, params: { id: "x" }, body: { active: false } }, res); // another one exists: allowed
});

test("super admin and admin cannot edit access (controller and route)", async () => {
  for (const role of ["super_admin", "admin"]) {
    await assert.rejects(updateRoleAccess({ user: { role }, params: { role: "admin" }, body: { permissions: [], reason: "x" } }, {}), (e) => e.status === 403);
    await assert.rejects(updateUserAccess({ user: { role }, params: { id: "x" }, body: { grant: [], deny: [], reason: "x" } }, {}), (e) => e.status === 403);
  }
});

test("access API: matrix and user overrides take effect on the next request, are audited and invalidate the cache", async () => {
  const people = ["system_admin", "production_supervisor", "super_admin"].map((role) => ({
    _id: oid(), role, name: role, email: `${role}@x.test`, active: true, deletedAt: null, permissionOverrides: null,
    markModified() {}, toObject() { return { ...this }; }, async save() { return this; }
  }));
  const byId = (id) => people.find((u) => String(u._id) === String(id));
  // requireAuth uses findById(...).select(); the controller awaits findById(...) directly.
  mock.method(User, "findById", (id) => { const u = byId(id); return { select: async () => u, then: (ok, ko) => Promise.resolve(u).then(ok, ko) }; });
  mock.method(User, "find", () => ({ sort: async () => [people[1], people[2]], lean: async () => [], then: (ok, ko) => Promise.resolve([]).then(ok, ko) }));
  process.env.JWT_SECRET = "access-control-test-secret-at-least-32-characters";
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/users", userRoutes);
  app.get("/rack-action", requireAuth, requirePermission("rack.manage"), (req, res) => res.json({ success: true }));
  app.get("/move-action", requireAuth, requirePermission("move.machine"), (req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = (i) => `access_token=${jwt.sign({ sub: String(people[i]._id) }, process.env.JWT_SECRET)}`;
  const send = (path, body, actor = 0) => fetch(`${base}${path}`, { method: "PATCH", headers: { cookie: cookie(actor), "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = (path, actor = 1) => fetch(`${base}${path}`, { headers: { cookie: cookie(actor) } });
  try {
    // Super Admin cannot change the matrix or overrides.
    assert.equal((await send("/users/roles/production_supervisor/access", { permissions: ["rack.manage"], reason: "try" }, 2)).status, 403);
    assert.equal((await send(`/users/${people[1]._id}/access`, { grant: ["rack.manage"], reason: "try" }, 2)).status, 403);
    // A reason is required.
    assert.equal((await send("/users/roles/production_supervisor/access", { permissions: ["rack.manage"] })).status, 400);

    // Matrix change -> next request sees it (cache invalidated on save).
    assert.equal((await get("/rack-action")).status, 403);
    assert.equal((await get("/rack-action")).status, 403); // cached now
    const saved = await send("/users/roles/production_supervisor/access", { permissions: ["mould.view", "rack.manage"], reason: "night shift racks" });
    assert.equal(saved.status, 200);
    assert.equal((await get("/rack-action")).status, 200);
    assert.equal((await get("/move-action")).status, 403, "matrix replaced the role list");
    // Stale version is rejected.
    assert.equal((await send("/users/roles/production_supervisor/access", { permissions: [], version: 0, reason: "stale" })).status, 409);
    // Reset to defaults.
    assert.equal((await send("/users/roles/production_supervisor/access", { permissions: null, reason: "back to defaults" })).status, 200);
    assert.equal((await get("/move-action")).status, 200);

    // Per-user: deny one role permission, grant one extra.
    const changed = await send(`/users/${people[1]._id}/access`, { grant: ["rack.manage"], deny: ["move.machine"], expiresAt: tomorrow().toISOString(), reason: "cover for rack lead" });
    assert.equal(changed.status, 200);
    const body = await changed.json();
    assert.equal(body.user.effectivePermissions.includes("rack.manage"), true);
    assert.equal(body.user.hasAccessOverrides, true);
    assert.equal((await get("/rack-action")).status, 200);
    assert.equal((await get("/move-action")).status, 403);
    // Expiry in the past is refused; reset clears overrides.
    assert.equal((await send(`/users/${people[1]._id}/access`, { grant: ["rack.manage"], expiresAt: yesterday().toISOString(), reason: "x past" })).status, 400);
    assert.equal((await send(`/users/${people[1]._id}/access`, { grant: [], deny: [], reason: "reset now" })).status, 200);
    assert.equal(people[1].permissionOverrides, null);
    assert.equal((await get("/move-action")).status, 200);
    // System Administrator accounts cannot be restricted.
    assert.equal((await send(`/users/${people[0]._id}/access`, { deny: ["mould.view"], reason: "nope" })).status, 403);

    const listing = await (await get("/users/access", 0)).json();
    assert.equal(listing.roles.some((r) => r.role === "system_admin"), false);
    assert.ok(listing.roles.find((r) => r.role === "executive"));

    const actions = audits.map((a) => a.action);
    assert.deepEqual(actions, ["role.access.updated", "role.access.reset", "user.access.updated", "user.access.reset"]);
    assert.ok(audits.every((a) => a.reason && a.before && a.after));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("effective permissions are what /auth/me sends", () => {
  const u = { role: "executive", permissionOverrides: { grant: ["problem.report"], deny: ["export.run"] } };
  assert.deepEqual(permissionsFor(u), effectivePermissions(u));
  assert.equal(permissionsFor(u).includes("problem.report"), true);
  assert.equal(permissionsFor(u).includes("export.run"), false);
});

test("loadRoleAccess attaches the saved matrix row", async () => {
  configs.set("mould_maker", { role: "mould_maker", permissions: ["moulds.view"], version: 2 });
  const u = await loadRoleAccess({ role: "mould_maker" });
  assert.deepEqual(permissionsFor(u), ["mould.view"]);
});
