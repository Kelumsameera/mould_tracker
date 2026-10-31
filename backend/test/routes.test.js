import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { errorHandler } from "../middleware/errorMiddleware.js";

// No database in tests: queries fail fast (500) instead of waiting, which still proves the permission check passed.
mongoose.set("bufferCommands", false);
process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";

const ROLES = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "system_admin"];
const users = Object.fromEntries(ROLES.map((role) => [role, { _id: new mongoose.Types.ObjectId(), role, name: role, active: true, deletedAt: null }]));
const ALL = ROLES, ADMINS = ["super_admin", "admin"], SA = ["super_admin"];

let server, base, tables;
before(async () => {
  mock.method(User, "findById", (id) => ({ select: async () => Object.values(users).find((u) => String(u._id) === String(id)) }));
  // Let privacy setup finish so permission tests still exercise the route handler.
  mock.method(User, "find", () => ({
    sort() { return this; },
    lean: async () => [],
    then(resolve, reject) { return Promise.resolve([]).then(resolve, reject); }
  }));
  const [moulds, racks, audit, machines, usersR, worklogs] = await Promise.all(["mould", "rack", "audit", "machine", "user", "workLog"].map((n) => import(`../routes/${n}Routes.js`)));
  tables = { moulds: moulds.mouldRouteTable, racks: racks.rackRouteTable, audit: audit.auditRouteTable, machines: machines.machineRouteTable, users: usersR.userRouteTable, worklogs: worklogs.workLogRouteTable };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/moulds", moulds.default);
  app.use("/api/racks", racks.default);
  app.use("/api/audit", audit.default);
  app.use("/api/machines", machines.default);
  app.use("/api/users", usersR.default);
  app.use("/api/worklogs", worklogs.default);
  app.use(errorHandler);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { server?.close(); mock.restoreAll(); });

// Who the spec's permission table allows on each route.
const EXPECTED = {
  "moulds GET /": ALL, "moulds GET /stats": ALL, "moulds GET /:id": ALL, "moulds GET /:id/history": ALL,
  "moulds POST /": ADMINS, "moulds PATCH /:id": ADMINS, "moulds DELETE /:id": ADMINS, "moulds POST /:id/restore": ADMINS,
  "moulds POST /:id/move": ALL, // each role has some move; lib/workflow.js narrows it (tested in workflow.test.js)
  "moulds POST /:id/status": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "moulds POST /:id/shots": ALL,
  "moulds POST /:id/items": ADMINS, "moulds PATCH /:id/items/:itemId": ADMINS, "moulds DELETE /:id/items/:itemId": ADMINS,
  "racks GET /": ALL, "racks GET /:id": ALL,
  "racks POST /zones": SA, "racks PATCH /zones/:id": SA, "racks DELETE /zones/:id": SA, "racks POST /bulk": SA, "racks POST /remove-row": SA,
  "racks POST /": SA, "racks PATCH /:id": SA, "racks DELETE /:id": SA,
  "audit GET /": SA,
  "machines GET /": ALL, "machines POST /": ADMINS, "machines PATCH /:id": ADMINS,
  "users GET /access": ["system_admin"], "users PATCH /:id/access": ["system_admin"],
  "users GET /": ADMINS, "users POST /": ADMINS, "users PATCH /:id": ADMINS, "users DELETE /:id": ADMINS,
  // Work log: production supervisors view only; the report and export are for Admins.
  "moulds GET /:id/worklogs": ALL,
  "moulds POST /:id/worklogs": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "moulds POST /:id/problems": ALL, // anyone may report a problem
  "worklogs GET /workers": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "worklogs GET /summary": ADMINS, "worklogs GET /export": ADMINS, "worklogs GET /": ADMINS
};

const cookie = (u) => `access_token=${jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET)}`;
const fill = (path) => path.replace(/:\w+/g, "64b7f0c2a1b2c3d4e5f60718");

test("every route has an expected permission entry", () => {
  const keys = Object.entries(tables).flatMap(([name, table]) => table.map(([method, path]) => `${name} ${method.toUpperCase()} ${path}`));
  assert.deepEqual(keys.filter((k) => !(k in EXPECTED)), []);
  assert.deepEqual(Object.keys(EXPECTED).filter((k) => !keys.includes(k)), []);
});

test("signed-out requests are refused", async () => {
  const res = await fetch(`${base}/moulds`);
  assert.equal(res.status, 401);
});

test("each role gets exactly the routes the permission table gives it", async () => {
  const wrong = [];
  for (const [name, table] of Object.entries(tables)) {
    for (const [method, path] of table) {
      const key = `${name} ${method.toUpperCase()} ${path}`;
      for (const role of ROLES) {
        const res = await fetch(`${base}/${name}${fill(path)}`, {
          method: method.toUpperCase(),
          headers: { cookie: cookie(users[role]), ...(method === "get" ? {} : { "content-type": "application/json" }) },
          body: method === "get" ? undefined : "{}"
        });
        const allowed = role === "system_admin" || EXPECTED[key].includes(role);
        // Allowed: past the permission check (validation 400 or no-database 500), never 403 or an unmounted 404.
        if (allowed ? [403, 404].includes(res.status) : res.status !== 403) wrong.push(`${key} as ${role}: ${res.status}`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});
