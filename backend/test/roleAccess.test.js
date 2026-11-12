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
import { can, rolePermissionsFor } from "../lib/permissions.js";
import { loadRoleAccess } from "../lib/roleAccess.js";

let configs, audits;
beforeEach(() => {
  configs = new Map(); audits = [];
  mock.method(RoleAccess, "findOne", async ({ role }) => configs.get(role) ?? null);
  mock.method(RoleAccess, "find", async () => [...configs.values()]);
  mock.method(RoleAccess, "findOneAndUpdate", async ({ role }, update) => {
    configs.set(role, { role, permissions: [...update.$set.permissions] });
  });
  mock.method(RoleAccess, "deleteOne", async ({ role }) => configs.delete(role));
  mock.method(AuditLog, "create", async entry => audits.push(entry));
});
afterEach(() => mock.restoreAll());

test("role defaults inherit, custom users take priority, legacy aliases resolve, and protected access stays protected", async () => {
  configs.set("production_supervisor", { role: "production_supervisor", permissions: ["racks.manage"] });
  const user = await loadRoleAccess({ role: "viewer" });
  assert.equal(can(user, "racks.manage"), true);
  assert.equal(can(user, "moves.machine"), false);
  assert.deepEqual(rolePermissionsFor(user), ["racks.manage"]);
  user.permissionOverrides = ["moves.machine"];
  assert.equal(can(user, "racks.manage"), false);
  assert.equal(can(user, "moves.machine"), true);
  assert.equal(can({ role: "admin", rolePermissionOverrides: ["access.manage", "moves.outOfService"] }, "access.manage"), false);
  assert.equal(can({ role: "admin", rolePermissionOverrides: ["moves.outOfService"] }, "moves.outOfService"), false);
  assert.equal(can({ role: "system_admin", rolePermissionOverrides: [], permissionOverrides: [] }, "access.manage"), true);
});

test("role access API enforces authorization, persists and resets defaults, updates existing sessions and audits changes", async () => {
  const users = ["system_admin", "production_supervisor"].map(role => ({
    _id: new mongoose.Types.ObjectId(), role, name: role, active: true, deletedAt: null,
  }));
  mock.method(User, "findById", id => ({ select: async () => users.find(user => String(user._id) === String(id)) }));
  mock.method(User, "find", () => ({ sort: async () => [users[1]], lean: async () => [] }));
  process.env.JWT_SECRET = "role-access-test-secret-at-least-32-characters";
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/users", userRoutes);
  app.get("/action", requireAuth, requirePermission("racks.manage"), (req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = users.map(user => `access_token=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET)}`);
  const patch = (role, permissions, actor = 0) => fetch(`${base}/users/roles/${role}/access`, {
    method: "PATCH", headers: { cookie: cookies[actor], "content-type": "application/json" }, body: JSON.stringify({ permissions }),
  });
  const action = () => fetch(`${base}/action`, { headers: { cookie: cookies[1] } });
  try {
    assert.equal((await action()).status, 403);
    assert.equal((await patch("production_supervisor", ["racks.manage"], 1)).status, 403);
    for (const role of ["system_admin", "unknown"]) assert.equal((await patch(role, [])).status, 400);
    for (const permissions of [["access.manage"], ["moves.outOfService"], ["racks.view", "racks.view"], ["unknown"]]) {
      assert.equal((await patch("production_supervisor", permissions)).status, 400);
    }
    const saved = await patch("production_supervisor", ["racks.manage"]);
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).role.permissions, ["racks.manage"]);
    assert.equal((await action()).status, 200);
    const listing = await (await fetch(`${base}/users/access`, { headers: { cookie: cookies[0] } })).json();
    assert.equal(listing.roles.some(config => config.role === "system_admin"), false);
    assert.deepEqual(listing.users[0].permissions, ["racks.manage"]);
    // Empty is an explicit revocation, distinct from restoring built-in defaults.
    assert.equal((await patch("production_supervisor", [])).status, 200);
    assert.equal((await action()).status, 403);
    assert.equal((await patch("production_supervisor", null)).status, 200);
    assert.equal(configs.has("production_supervisor"), false);
    assert.equal(can(await loadRoleAccess(users[1]), "moves.machine"), true);
    assert.equal(audits.length, 3);
    assert.equal(audits[0].action, "role.access.updated");
  } finally { await new Promise(resolve => server.close(resolve)); }
});
