// One-time move of this app into its own database, upgrading Tool -> Mould / Item / Movement and the roles.
//   SOURCE_MONGODB_URI = the old shared database (only ever read)
//   MONGODB_URI        = the new database for this app, e.g. .../mould_tracker
//   node migrations/upgradeMouldModel.mjs           -> dry run: reads both, writes nothing, prints counts
//   node migrations/upgradeMouldModel.mjs --apply   -> copies into the new database and upgrades it there, once
import "dotenv/config";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import User from "../models/User.js";
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Movement from "../models/Movement.js";
import Zone from "../models/Zone.js";
import Rack from "../models/Rack.js";
import AuditLog from "../models/AuditLog.js";
import MigrationRun from "../models/MigrationRun.js";
import { ensureDefaultRacks } from "../lib/racks.js";
import { LEGACY_ROLE_ALIASES, ROLES } from "../lib/permissions.js";

export const MIGRATION_NAME = "2026-10-upgrade-mould-model";

// Edit here if old users should land on different roles. The Super Admin can adjust users afterwards.
export const ROLE_MAP = { admin: "super_admin", operator: "mould_technician", viewer: "production_supervisor" };

// Old store / machine / removed-from-store states, mapped to the new locations.
// Removed-from-store tools go to the Production Floor as GOOD; real Workshop cases are fixed by hand.
const LOCATION_MAP = { store: "MOULD_ROOM", machine: "MACHINE", taken: "PRODUCTION_FLOOR" };
const MOVEMENT_TYPE_MAP = {
  created: "CREATED", edited: "EDITED", assigned: "MOVED", returned: "MOVED", taken_out: "MOVED", deleted: "DELETED"
};
// Collections copied as-is (same _id) before the upgrade; the copies also stay in the new database as a backup.
const COPIED = ["tools", "toolmovements", "machines", "users", "passkeys"];
const APP_ROLES = new Set([...ROLES, ...Object.keys(LEGACY_ROLE_ALIASES)]);

export const mapRole = (role) => ROLE_MAP[role] ?? role;

// The old users collection is shared with another app: only accounts in this app's shape are copied.
export const isAppUser = (u) => typeof u.passwordHash === "string" && APP_ROLES.has(u.role);

export function toolToMould(tool, lastMove = null) {
  const location = LOCATION_MAP[tool.status];
  if (!location) throw new Error(`Unknown status "${tool.status}" on ${tool.toolCode}`);
  const legacyNote = tool.status === "taken" ? String(tool.takenNote || "").trim() : "";
  return {
    _id: tool._id, // same id, so old history stays linked
    toolId: tool.toolCode,
    size: tool.size || "",
    status: "GOOD",
    location,
    machineId: location === "MACHINE" ? tool.machineId : null,
    rackId: null,
    awaitingRack: location === "MOULD_ROOM",
    notes: tool.notes || "",
    remarks: legacyNote,
    lastMovedAt: lastMove?.createdAt ?? tool.takenAt ?? null,
    lastMovedBy: lastMove?.performedBy ?? null,
    version: tool.version || 1,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt
  };
}

export const toolToItems = (tool) =>
  (tool.products || []).map((p, i) => ({
    mouldId: tool._id,
    itemId: p.pid,
    description: p.desc || "",
    cavities: Number.isFinite(p.cav) ? p.cav : null,
    sortOrder: i
  }));

export function mapMovement(m, machineCodes = new Map()) {
  const code = (id) => (id ? machineCodes.get(String(id)) ?? null : null);
  const type = MOVEMENT_TYPE_MAP[m.action];
  if (!type) throw new Error(`Unknown history action "${m.action}"`);
  return {
    mouldId: m.toolId,
    toolId: m.toolCode,
    type,
    fromLocation: LOCATION_MAP[m.fromStatus] ?? null,
    toLocation: LOCATION_MAP[m.toStatus] ?? null,
    fromMachineId: m.fromMachineId ?? null,
    toMachineId: m.toMachineId ?? null,
    fromMachineCode: code(m.fromMachineId),
    toMachineCode: code(m.toMachineId),
    remarks: m.note || "",
    performedBy: m.performedBy,
    legacyMovementId: m._id,
    createdAt: m.createdAt
  };
}

// Pure: decides everything from the source documents, so the dry run and --apply always agree.
export function buildPlan({ tools, toolmovements, machines, users, passkeys }) {
  const appUsers = users.filter(isAppUser);
  const userIds = new Set(appUsers.map((u) => String(u._id)));
  const toolIds = new Set(tools.map((t) => String(t._id)));
  const machineCodes = new Map(machines.map((m) => [String(m._id), m.code]));
  const sorted = [...toolmovements].sort((a, b) => a.createdAt - b.createdAt);

  const lastMoveByTool = new Map();
  for (const m of sorted) if (m.action !== "edited") lastMoveByTool.set(String(m.toolId), m);
  const moulds = tools.map((t) => toolToMould(t, lastMoveByTool.get(String(t._id))));
  for (const m of moulds) {
    const error = new Mould(m).validateSync();
    if (error) throw new Error(`Invalid mould ${m.toolId}: ${error.message}`);
  }
  const usedMachineIds = new Set(
    [...tools.map((t) => t.machineId), ...sorted.flatMap((m) => [m.fromMachineId, m.toMachineId])].filter(Boolean).map(String)
  );

  return {
    copy: {
      tools,
      toolmovements: sorted,
      machines,
      users: appUsers,
      passkeys: passkeys.filter((p) => userIds.has(String(p.userId)))
    },
    moulds,
    items: tools.flatMap(toolToItems),
    movements: sorted.map((m) => mapMovement(m, machineCodes)),
    roleChanges: appUsers
      .filter((u) => mapRole(u.role) !== u.role)
      .map((u) => ({ id: u._id, email: u.email, from: u.role, to: mapRole(u.role) })),
    skipped: {
      usersOfOtherApp: users.length - appUsers.length,
      passkeysOfOtherUsers: passkeys.length - passkeys.filter((p) => userIds.has(String(p.userId))).length
    },
    warnings: {
      movementsByUncopiedUser: sorted.filter((m) => !userIds.has(String(m.performedBy))).length,
      movementsOfDeletedTools: sorted.filter((m) => !toolIds.has(String(m.toolId))).length,
      missingMachines: [...usedMachineIds].filter((id) => !machineCodes.has(id)).length
    }
  };
}

export function summarize(plan) {
  return {
    copy: Object.fromEntries(COPIED.map((c) => [c, plan.copy[c].length])),
    skipped: plan.skipped,
    upgrade: {
      moulds: plan.moulds.length,
      byLocation: Object.fromEntries(Object.values(LOCATION_MAP).map((l) => [l, plan.moulds.filter((m) => m.location === l).length])),
      items: plan.items.length,
      movements: plan.movements.length,
      roleChanges: Object.fromEntries(Object.entries(ROLE_MAP).map(([from, to]) => [`${from} -> ${to}`, plan.roleChanges.filter((c) => c.from === from).length]))
    },
    warnings: plan.warnings
  };
}

const upsertAll = (docs) => docs.map(({ _id, ...doc }) => ({ updateOne: { filter: { _id }, update: { $setOnInsert: doc }, upsert: true } }));

async function applyPlan(target, plan) {
  // Inserts only: re-running after a crash fills gaps and never overwrites.
  for (const name of COPIED) {
    if (plan.copy[name].length) await target.db.collection(name).bulkWrite(upsertAll(plan.copy[name]));
  }
  await Promise.all([User, Mould, Item, Movement, Zone, Rack, AuditLog, MigrationRun].map((m) => m.createIndexes()));

  await Mould.bulkWrite(upsertAll(plan.moulds), { timestamps: false });
  await Item.bulkWrite(plan.items.map((i) => ({ updateOne: { filter: { mouldId: i.mouldId, itemId: i.itemId }, update: { $setOnInsert: i }, upsert: true } })));
  const done = new Set((await Movement.find({ legacyMovementId: { $ne: null } }, { legacyMovementId: 1 }).lean()).map((m) => String(m.legacyMovementId)));
  const pending = plan.movements.filter((m) => !done.has(String(m.legacyMovementId)));
  if (pending.length) await Movement.insertMany(pending, { ordered: true });

  // Roles are remapped on the copies in the new database only.
  for (const c of plan.roleChanges) {
    await User.updateOne({ _id: c.id, role: c.from }, { $set: { role: c.to } });
    await AuditLog.create({ action: "user.role_migrated", entityType: "User", entityId: c.id, entityLabel: c.email, before: { role: c.from }, after: { role: c.to } });
  }
  const racks = await ensureDefaultRacks();
  const summary = summarize(plan);
  await AuditLog.create({ action: "migration.applied", entityType: "Migration", entityLabel: MIGRATION_NAME, after: summary });
  await MigrationRun.create({ name: MIGRATION_NAME, summary: { ...summary, defaultRacks: racks.racks } });
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.SOURCE_MONGODB_URI || !process.env.MONGODB_URI) throw new Error("Set SOURCE_MONGODB_URI (old) and MONGODB_URI (new)");

  // No automatic index or collection creation, so a dry run writes nothing anywhere.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  const options = { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false };
  const source = await mongoose.createConnection(process.env.SOURCE_MONGODB_URI, options).asPromise();
  await mongoose.connect(process.env.MONGODB_URI, options);
  const target = mongoose.connection;
  try {
    const names = { source: source.db.databaseName, target: target.db.databaseName };
    if (names.source === names.target) throw new Error(`Source and target are the same database (${names.source})`);
    if (await MigrationRun.exists({ name: MIGRATION_NAME })) {
      console.log(`${MIGRATION_NAME} was already applied to ${names.target}; nothing to do.`);
      return;
    }
    const targetAlreadyHas = Object.fromEntries(
      await Promise.all(["tools", "moulds", "users"].map(async (c) => [c, await target.db.collection(c).countDocuments()]))
    );

    const read = (name) => source.db.collection(name).find().toArray();
    const data = Object.fromEntries(await Promise.all(COPIED.map(async (c) => [c, await read(c)])));
    const plan = buildPlan(data);
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...names, targetAlreadyHas, ...summarize(plan) }, null, 2));
    if (apply) {
      await applyPlan(target, plan);
      console.log("Applied.");
    }
  } finally {
    await source.close();
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
