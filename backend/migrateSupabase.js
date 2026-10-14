import "dotenv/config";

import mongoose from "mongoose";

import Tool from "./models/Tool.js";
import Machine from "./models/Machine.js";
import ToolMovement from "./models/ToolMovement.js";
import User from "./models/User.js";

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const SUPABASE_URL = process.env.SUPABASE_URL || "https://rhozytrrwjvliffigfvy.supabase.co";

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

const CLOUD_TABLE = "tool_records";

const PAGE_SIZE = 1000;

const MIGRATION_NOTE = "[MIGRATED_FROM_SUPABASE]";

/*
|--------------------------------------------------------------------------
| Supabase Request
|--------------------------------------------------------------------------
|
| Important:
| sb_publishable_... keys are sent through the `apikey` header.
| Do NOT send them as Authorization: Bearer.
|
*/

async function supabaseRequest(path) {
  if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY is missing from .env");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",

    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  return response.json();
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeCav(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const match = String(value).match(/\d+(\.\d+)?/);

  if (match) {
    return Number(match[0]);
  }

  return 0;
}

function getCavNote(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return "";
  }

  const text = String(value).trim();

  if (!text) {
    return "";
  }

  const numeric = text.match(/^\d+(\.\d+)?$/);

  if (numeric) {
    return "";
  }

  return text;
}

/*
|--------------------------------------------------------------------------
| Product normalization
|--------------------------------------------------------------------------
*/

function normalizeProducts(products) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .filter(Boolean)
    .map((product) => {
      const rawCav = product.cav;

      const normalized = {
        pid: String(product.pid || "")
          .trim()
          .toUpperCase(),

        desc: String(product.desc || "").trim(),

        cav: normalizeCav(rawCav),
      };

      /*
       * If your Product schema has cavNote,
       * preserve non-numeric legacy values.
       */
      if (getCavNote(rawCav)) {
        normalized.cavNote = getCavNote(rawCav);
      }

      return normalized;
    })
    .filter((product) => product.pid);
}

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
|
| Old system:
|
| store
| machine -> status contains machine name
| taken   -> locationType = taken
|
*/

function normalizeStatus(tool) {
  if (tool.status === "store") {
    return "store";
  }

  if (tool.locationType === "taken") {
    return "taken";
  }

  return "machine";
}

/*
|--------------------------------------------------------------------------
| Machine name
|--------------------------------------------------------------------------
*/

function getMachineName(tool) {
  if (normalizeStatus(tool) !== "machine") {
    return null;
  }

  const name = String(tool.status || "").trim();

  return name || null;
}

/*
|--------------------------------------------------------------------------
| Taken note
|--------------------------------------------------------------------------
*/

function getTakenNote(tool) {
  if (normalizeStatus(tool) !== "taken") {
    return "";
  }

  return String(tool.status || "").trim();
}

/*
|--------------------------------------------------------------------------
| Taken date
|--------------------------------------------------------------------------
*/

function getTakenAt(tool) {
  if (normalizeStatus(tool) !== "taken") {
    return null;
  }

  if (!tool.takenAt) {
    return null;
  }

  const date = new Date(Number(tool.takenAt));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/*
|--------------------------------------------------------------------------
| History normalization
|--------------------------------------------------------------------------
*/

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(Boolean)
    .map((item) => {
      let at = new Date();

      if (item.at) {
        const parsed = new Date(Number(item.at));

        if (!Number.isNaN(parsed.getTime())) {
          at = parsed;
        }
      }

      return {
        at,

        toType: item.toType || null,

        toLabel: item.toLabel ? String(item.toLabel).trim() : null,

        note: item.note ? String(item.note) : "",
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/*
|--------------------------------------------------------------------------
| Machine code
|--------------------------------------------------------------------------
*/

function makeMachineCode(name) {
  return String(name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

/*
|--------------------------------------------------------------------------
| Load all Supabase tools
|--------------------------------------------------------------------------
|
| PostgREST can limit large responses.
| Therefore use offset pagination.
|
*/

async function loadSupabaseTools() {
  console.log("Reading Supabase data...");

  const allRows = [];

  let offset = 0;

  while (true) {
    const path = `${CLOUD_TABLE}` + `?select=id,payload,updated_at` + `&order=id.asc` + `&limit=${PAGE_SIZE}` + `&offset=${offset}`;

    const rows = await supabaseRequest(path);

    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    console.log(`  Supabase batch: ${rows.length} rows`);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  console.log(`Supabase rows found: ${allRows.length}`);

  return allRows.map((row) => row?.payload).filter(Boolean);
}

/*
|--------------------------------------------------------------------------
| Migration User
|--------------------------------------------------------------------------
*/

async function getMigrationUserId() {
  const admin = await User.findOne({
    email: "admin@example.com",
  });

  if (!admin) {
    throw new Error("Migration admin user not found. Run npm run seed first.");
  }

  return admin._id;
}

/*
|--------------------------------------------------------------------------
| Get / Create Machine
|--------------------------------------------------------------------------
*/

async function getOrCreateMachine(name) {
  if (!name) {
    return null;
  }

  const cleanName = String(name).trim();

  if (!cleanName) {
    return null;
  }

  const code = makeMachineCode(cleanName);

  if (!code) {
    return null;
  }

  const machine = await Machine.findOneAndUpdate(
    { code },

    {
      $set: {
        name: cleanName,
        active: true,
      },
    },

    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return machine;
}

/*
|--------------------------------------------------------------------------
| Determine history state
|--------------------------------------------------------------------------
*/

function historyTypeToStatus(type) {
  if (type === "machine") {
    return "machine";
  }

  if (type === "taken") {
    return "taken";
  }

  return "store";
}

/*
|--------------------------------------------------------------------------
| Import Tool History
|--------------------------------------------------------------------------
*/

async function importToolHistory({ oldTool, mongoTool, machineMap, migrationUserId }) {
  const history = normalizeHistory(oldTool.history);

  if (history.length === 0) {
    return 0;
  }

  /*
   * Delete ONLY records previously created
   * by this migration.
   *
   * Existing non-migration history is preserved.
   */
  await ToolMovement.deleteMany({
    toolCode: mongoTool.toolCode,

    note: {
      $regex: `^\\${MIGRATION_NOTE}`,
    },
  });

  let previousStatus = "store";

  let previousMachineId = null;

  let importedCount = 0;

  for (const item of history) {
    const toStatus = historyTypeToStatus(item.toType);

    let toMachineId = null;

    if (toStatus === "machine" && item.toLabel) {
      const machineName = String(item.toLabel).trim();

      let machine = machineMap.get(machineName);

      if (!machine) {
        machine = await getOrCreateMachine(machineName);

        if (machine) {
          machineMap.set(machineName, machine);
        }
      }

      if (machine) {
        toMachineId = machine._id;
      }
    }

    let action = "edited";

    if (toStatus === "machine") {
      action = "assigned";
    } else if (toStatus === "store") {
      action = "returned";
    } else if (toStatus === "taken") {
      action = "taken_out";
    }

    let note = item.note || "";

    if (!note) {
      if (action === "assigned" && item.toLabel) {
        note = `Assigned to ${item.toLabel}`;
      }

      if (action === "returned") {
        note = "Returned to store";
      }
    }

    note = `${MIGRATION_NOTE} ${note}`.trim();

    await ToolMovement.create({
      toolId: mongoTool._id,

      toolCode: mongoTool.toolCode,

      action,

      fromStatus: previousStatus,

      toStatus,

      fromMachineId: previousMachineId,

      toMachineId,

      note,

      performedBy: migrationUserId,

      createdAt: item.at,

      updatedAt: item.at,
    });

    previousStatus = toStatus;

    previousMachineId = toMachineId;

    importedCount++;
  }

  return importedCount;
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function main() {
  console.log("");
  console.log("====================================");
  console.log(" Supabase → MongoDB Migration");
  console.log("====================================");
  console.log("");

  /*
   * Validate environment
   */

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY is missing from .env");
  }

  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is missing from .env");
  }

  console.log(`Supabase URL: ${SUPABASE_URL}`);

  console.log(`Supabase key type: ${SUPABASE_KEY.startsWith("sb_publishable_") ? "publishable" : SUPABASE_KEY.startsWith("sb_secret_") ? "secret" : "legacy/other"}`);

  /*
   * Connect MongoDB
   */

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("MongoDB connected");

  /*
   * Load Supabase
   */

  const oldTools = await loadSupabaseTools();

  if (oldTools.length === 0) {
    console.log("No Supabase tools found.");

    await mongoose.disconnect();

    return;
  }

  /*
   * Migration user
   */

  const migrationUserId = await getMigrationUserId();

  /*
   * Collect machine names
   */

  console.log("");
  console.log("Collecting machine names...");

  const machineNames = new Set();

  for (const oldTool of oldTools) {
    const machineName = getMachineName(oldTool);

    if (machineName) {
      machineNames.add(machineName);
    }

    /*
     * Also inspect history.
     */

    for (const history of oldTool.history || []) {
      if (history.toType === "machine" && history.toLabel) {
        machineNames.add(String(history.toLabel).trim());
      }
    }
  }

  console.log(`Machines detected: ${machineNames.size}`);

  /*
   * Create / update machines
   */

  const machineMap = new Map();

  console.log("");
  console.log("Creating / updating machines...");

  for (const name of machineNames) {
    if (!name) {
      continue;
    }

    const machine = await getOrCreateMachine(name);

    if (!machine) {
      continue;
    }

    machineMap.set(name, machine);

    console.log(`Machine: ${machine.code} → ${machine.name}`);
  }

  /*
   * Import tools
   */

  console.log("");
  console.log("Importing tools...");

  let imported = 0;

  let updated = 0;

  let skipped = 0;

  let historyImported = 0;

  const migrationErrors = [];

  /*
   * Current machine assignments.
   *
   * Legacy system could have multiple tools
   * assigned to same machine.
   *
   * MongoDB schema has:
   *
   * unique machineId when status=machine
   *
   * Therefore we must detect conflicts.
   */

  const assignedMachines = new Map();

  /*
   * First collect existing Mongo
   * machine assignments.
   */

  const existingMachineTools = await Tool.find({
    status: "machine",

    machineId: {
      $ne: null,
    },
  })
    .select("_id toolCode machineId")
    .lean();

  for (const existing of existingMachineTools) {
    assignedMachines.set(String(existing.machineId), existing.toolCode);
  }

  /*
   * Process tools
   */

  for (const oldTool of oldTools) {
    try {
      const toolCode = String(oldTool.id || "").trim();

      if (!toolCode) {
        skipped++;

        continue;
      }

      const status = normalizeStatus(oldTool);

      const machineName = getMachineName(oldTool);

      let machine = machineName ? machineMap.get(machineName) : null;

      const products = normalizeProducts(oldTool.products);

      const takenAt = getTakenAt(oldTool);

      const takenNote = getTakenNote(oldTool);

      let finalStatus = status;

      let finalMachineId = null;

      /*
       * Machine assignment
       */

      if (status === "machine") {
        if (machine) {
          const machineId = String(machine._id);

          const assignedTo = assignedMachines.get(machineId);

          /*
           * If another tool already
           * owns this machine, don't
           * break MongoDB unique index.
           */
          if (assignedTo && assignedTo !== toolCode) {
            console.warn(`WARNING: Machine "${machine.name}" is already assigned to "${assignedTo}".`);

            console.warn(`Tool "${toolCode}" will be imported as store to avoid duplicate machine assignment.`);

            finalStatus = "store";

            finalMachineId = null;
          } else {
            finalMachineId = machine._id;

            assignedMachines.set(machineId, toolCode);
          }
        } else {
          console.warn(`Machine not found for ${toolCode}: ${machineName}`);

          finalStatus = "store";

          finalMachineId = null;
        }
      }

      /*
       * Tool update object
       */

      const update = {
        toolCode,

        size: String(oldTool.size || "").trim(),

        status: finalStatus,

        machineId: finalMachineId,

        takenAt: finalStatus === "taken" ? takenAt : null,

        takenNote: finalStatus === "taken" ? takenNote : "",

        notes: String(oldTool.notes || "").trim(),

        products,

        version: Number(oldTool.version) > 0 ? Number(oldTool.version) : 1,
      };

      /*
       * Check existing tool
       */

      const existing = await Tool.findOne({
        toolCode,
      });

      /*
       * Upsert
       */

      const mongoTool = await Tool.findOneAndUpdate(
        {
          toolCode,
        },

        {
          $set: update,
        },

        {
          upsert: true,

          new: true,

          setDefaultsOnInsert: true,
        },
      );

      if (existing) {
        updated++;
      } else {
        imported++;
      }

      /*
       * History
       */

      const importedHistory = await importToolHistory({
        oldTool,

        mongoTool,

        machineMap,

        migrationUserId,
      });

      historyImported += importedHistory;

      console.log(`${imported + updated}/${oldTools.length} ` + `${toolCode} → ${finalStatus}` + (importedHistory > 0 ? ` | history: ${importedHistory}` : ""));
    } catch (error) {
      skipped++;

      migrationErrors.push({
        toolCode: oldTool?.id || "unknown",

        error: error?.message || String(error),
      });

      console.error(`ERROR migrating ${oldTool?.id || "unknown"}:`, error?.message || error);
    }
  }

  /*
   * Final verification
   */

  console.log("");
  console.log("Running verification...");

  const mongoToolCount = await Tool.countDocuments();

  const mongoMachineCount = await Machine.countDocuments();

  const mongoMovementCount = await ToolMovement.countDocuments();

  /*
   * Summary
   */

  console.log("");
  console.log("====================================");

  console.log(" Migration completed");

  console.log("====================================");

  console.log(`Supabase tools : ${oldTools.length}`);

  console.log(`Imported       : ${imported}`);

  console.log(`Updated        : ${updated}`);

  console.log(`Skipped        : ${skipped}`);

  console.log(`Machines       : ${machineMap.size}`);

  console.log(`History        : ${historyImported}`);

  console.log(`Mongo tools    : ${mongoToolCount}`);

  console.log(`Mongo machines : ${mongoMachineCount}`);

  console.log(`Mongo movements: ${mongoMovementCount}`);

  /*
   * Errors
   */

  if (migrationErrors.length > 0) {
    console.log("");
    console.log("Migration errors:");

    for (const item of migrationErrors) {
      console.log(` - ${item.toolCode}: ${item.error}`);
    }
  }

  console.log("");

  await mongoose.disconnect();

  console.log("MongoDB disconnected.");

  console.log("");
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

main().catch(async (error) => {
  console.error("");
  console.error("Migration failed:");
  console.error(error);
  console.error("");

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
