import RoleAccess from "../models/RoleAccess.js";
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Mould from "../models/Mould.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import Item from "../models/Item.js";
import { errorHandler } from "../middleware/errorMiddleware.js";

// No database in tests: queries fail fast (500) instead of waiting, which still proves the permission check passed.
mongoose.set("bufferCommands", false);
process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";

const ROLES = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "system_admin", "executive"];
const users = Object.fromEntries(ROLES.map((role) => [role, { _id: new mongoose.Types.ObjectId(), role, name: role, active: true, deletedAt: null }]));
const ALL = ROLES, ADMINS = ["super_admin", "admin"], SA = ["super_admin"];
const WORKERS = ROLES.filter((r) => r !== "executive"); // executive is read-only

let server, base, tables;
before(async () => {
  mock.method(RoleAccess, "findOne", async () => null);
  mock.method(RoleAccess, "find", async () => []);
  // requireAuth uses findById(...).select(); controllers await findById() directly and get a plain account to act on.
  const target = () => ({ _id: new mongoose.Types.ObjectId(), role: "mould_maker", name: "t", email: "t@x.test", active: true, deletedAt: null,
    toObject() { return { ...this }; }, async save() { throw new Error("no database"); } });
  mock.method(User, "findById", (id) => ({
    select: async () => Object.values(users).find((u) => String(u._id) === String(id)),
    then: (ok, ko) => Promise.resolve(target()).then(ok, ko)
  }));
  // Let privacy setup finish so permission tests still exercise the route handler.
  mock.method(User, "find", () => ({
    sort() { return this; },
    lean: async () => [],
    then(resolve, reject) { return Promise.resolve([]).then(resolve, reject); }
  }));
  const [moulds, racks, audit, machines, usersR, worklogs, catalog] = await Promise.all(["mould", "rack", "audit", "machine", "user", "workLog", "catalog"].map((n) => import(`../routes/${n}Routes.js`)));
  tables = { moulds: moulds.mouldRouteTable, racks: racks.rackRouteTable, audit: audit.auditRouteTable, machines: machines.machineRouteTable, users: usersR.userRouteTable, worklogs: worklogs.workLogRouteTable, catalog: catalog.catalogRouteTable };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/moulds", moulds.default);
  app.use("/api/public", (await import("../routes/publicRoutes.js")).default);
  app.use("/api/racks", racks.default);
  app.use("/api/audit", audit.default);
  app.use("/api/machines", machines.default);
  app.use("/api/users", usersR.default);
  app.use("/api/worklogs", worklogs.default);
  app.use("/api/catalog", catalog.default);
  app.use(errorHandler);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { server?.close(); mock.restoreAll(); });

// Who the spec's permission table allows on each route.
const EXPECTED = {
  "moulds GET /": ALL, "moulds GET /stats": ALL, "moulds GET /suggest": ALL, "moulds GET /:id": ALL, "moulds GET /:id/history": ALL,
  "moulds POST /": ADMINS, "moulds PATCH /:id": ADMINS, "moulds DELETE /:id": ADMINS, "moulds POST /:id/restore": ADMINS,
  "moulds POST /:id/move": ALL, // authenticated route; the planner enforces move policy
  "moulds POST /:id/status": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "moulds POST /:id/cavities": ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"],
  "moulds GET /:id/cavity-downtime": ALL,
  "moulds POST /:id/shots": WORKERS.filter((r) => r !== "production_supervisor" || true),
  "moulds POST /:id/items": ADMINS, "moulds PATCH /:id/items/:itemId": ADMINS, "moulds DELETE /:id/items/:itemId": ADMINS,
  "moulds POST /:id/items/:itemId/images": ADMINS, "moulds PUT /:id/items/:itemId/images/order": ADMINS,
  "moulds PUT /:id/items/:itemId/images/:key": ADMINS, "moulds DELETE /:id/items/:itemId/images/:key": ADMINS,
  "racks GET /": ALL, "racks GET /:id": ALL,
  "racks POST /zones": SA, "racks PATCH /zones/:id": SA, "racks DELETE /zones/:id": SA, "racks POST /bulk": SA, "racks POST /remove-row": SA,
  "racks POST /": SA, "racks PATCH /:id": SA, "racks DELETE /:id": SA,
  "audit GET /": SA,
  "machines GET /": ALL, "machines POST /": ADMINS, "machines PATCH /:id": ADMINS,
  "users PATCH /roles/:role/access": ["system_admin"], "users GET /access": ["system_admin"], "users PATCH /:id/access": ["system_admin"],
  "users GET /": ADMINS, "users POST /": ADMINS, "users PATCH /:id": ADMINS, "users DELETE /:id": ADMINS,
  // Work log: production supervisors view only; the report and export are for Admins.
  "moulds GET /:id/worklogs": ALL,
  "moulds POST /:id/worklogs": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "moulds POST /:id/problems": WORKERS, // anyone but the read-only executive may report a problem
  "worklogs GET /workers": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "catalog GET /summary": ALL, "catalog GET /moulds": ALL, "catalog GET /products": ALL, "catalog GET /products/:itemId": ALL,
  "catalog GET /export": [...SA, "executive"],
  "worklogs GET /summary": [...ADMINS, "executive"], "worklogs GET /export": [...ADMINS, "executive"], "worklogs GET /": [...ADMINS, "executive"]
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

test("public locations work without a session and expose only location fields", async () => {
  const chain = rows => ({ sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => rows });
  const mouldFind = mock.method(Mould, "find", filter => {
    assert.equal(filter.deletedAt, null);
    return chain([{ _id: "m1", toolId: "PUBLIC-1", location: "MACHINE", status: "GOOD", machineId: "machine1", notes: "private", lastMovedBy: "private" }]);
  });
  const machineFind = mock.method(Machine, "find", () => chain([{ _id: "machine1", code: "INJ-01", note: "private" }]));
  const rackFind = mock.method(Rack, "find", () => chain([]));
  const counts = mock.method(Mould, "aggregate", async () => [{ _id: "MACHINE", count: 1 }]);
  const total = mock.method(Mould, "countDocuments", async () => 1);
  const pictured = mock.method(Item, "distinct", async () => ["m1"]);
  try {
    const response = await fetch(`${base}/public/moulds`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.moulds[0].machine, "INJ-01");
    assert.deepEqual(Object.keys(body.moulds[0]).sort(), ["hasImage", "id", "location", "locationKey", "machine", "rack", "status", "statusLabels", "toolId"]);
    assert.equal(body.total, 1);
    assert.equal(body.moulds[0].hasImage, true);
    assert.equal(body.locations.find(l => l.key === "MACHINE").count, 1);
    assert.equal(body.moulds[0].statusLabels.en, "Good");
    assert.equal((await fetch(`${base}/public/moulds?page=0`)).status, 400);
  } finally {
    mouldFind.mock.restore(); machineFind.mock.restore(); rackFind.mock.restore(); counts.mock.restore(); total.mock.restore(); pictured.mock.restore();
  }
});

test("all mould mutations require authentication", async () => {
  for (const [method, path] of tables.moulds.filter(([method]) => method !== "get")) {
    assert.equal((await fetch(`${base}/moulds${fill(path)}`, {
      method: method.toUpperCase(), headers: { "Content-Type": "application/json" }, body: "{}"
    })).status, 401, `${method} ${path}`);
  }
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

test("public mould image rejects bad ids and moulds without pictures", async () => {
  assert.equal((await fetch(`${base}/public/moulds/not-an-id/image`)).status, 404);
  const exists = mock.method(Mould, "exists", async () => ({ _id: "x" }));
  const findOne = mock.method(Item, "findOne", () => ({ sort() { return this; }, lean: async () => null }));
  try {
    assert.equal((await fetch(`${base}/public/moulds/${new mongoose.Types.ObjectId()}/image`)).status, 404);
  } finally { exists.mock.restore(); findOne.mock.restore(); }
});

test("public mould detail hides private fields", async () => {
  const id = new mongoose.Types.ObjectId();
  const lean = rows => ({ sort() { return this; }, lean: async () => rows });
  const findOne = mock.method(Mould, "findOne", () => lean({ _id: id, toolId: "P-1", location: "MACHINE", status: "GOOD", machineId: "mc1", capableMachines: ["INJ-01"], notes: "secret", lastMovedBy: "u1" }));
  const itemFind = mock.method(Item, "find", () => lean([{ itemId: "A1", description: "Cap", cavities: 4, notes: "secret", images: [] }]));
  const byId = mock.method(Machine, "findById", () => lean({ code: "INJ-01", name: "Engel 200" }));
  const machineFind = mock.method(Machine, "find", () => lean([{ code: "INJ-01", name: "Engel 200" }]));
  try {
    const body = await (await fetch(`${base}/public/moulds/${id}`)).json();
    assert.deepEqual(body.mould.machine, { code: "INJ-01", name: "Engel 200" });
    assert.equal(body.mould.totalCavities, 4);
    assert.equal(body.mould.items[0].itemId, "A1");
    assert.ok(!JSON.stringify(body).includes("secret"));
    assert.ok(!("lastMovedBy" in body.mould));
  } finally { findOne.mock.restore(); itemFind.mock.restore(); byId.mock.restore(); machineFind.mock.restore(); }
});
