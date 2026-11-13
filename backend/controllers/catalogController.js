import ExcelJS from "exceljs";
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import { audit } from "../lib/audit.js";
import { can } from "../lib/permissions.js";
import { fail } from "../utils/ApiError.js";
import { imageDTO } from "../utils/serializers.js";
import { displayStatus } from "../lib/mouldState.js";
import { setting } from "../lib/settings.js";
import {
  EXPORT_CAP as DEFAULT_EXPORT_CAP, PAGE_SIZE, describeFilters, itemSummaryPipeline, mouldListPipeline, mouldSummaryPipeline, productDetailPipeline, productListPipeline, shapeList, shapeSummary
} from "../lib/catalog.js";

const uploadUrl = (p) => (p ? `/uploads/${p}` : null);
const mouldRow = (r) => ({
  id: String(r._id), toolId: r.toolId, process: r.process, owner: r.owner ?? null, capableMachines: r.capableMachines || [], cavities: r.cavities || 0,
  itemCount: r.itemCount, status: displayStatus(r.status), location: r.location, materials: r.materials || []
});
const productRow = (r) => ({
  itemId: r._id, description: r.description || "", thumbUrl: uploadUrl(r.thumbPath), materialId: r.materialId ?? null, materialDescription: r.materialDescription ?? null,
  masterbatchId: r.masterbatchId ?? null, qas: r.qas ?? null, family: r.family || "", processes: r.processes || [], mouldCount: r.mouldCount,
  moulds: (r.moulds || []).map((m) => ({ id: String(m.id), toolId: m.toolId })).sort((a, b) => a.toolId.localeCompare(b.toolId))
});

// GET /api/catalog/summary?process=
export async function catalogSummary(req, res) {
  const { process } = req.validQuery;
  const [mouldRows, itemFacet] = await Promise.all([Mould.aggregate(mouldSummaryPipeline(process)), Item.aggregate(itemSummaryPipeline(process))]);
  res.json({ success: true, summary: shapeSummary(mouldRows, itemFacet) });
}

// GET /api/catalog/moulds?process&status&owner&machine&material&q&sort&page
export async function catalogMoulds(req, res) {
  const pageSize = setting("limits.pageSize") ?? PAGE_SIZE;
  const out = shapeList(await Mould.aggregate(mouldListPipeline({ ...req.validQuery, limit: pageSize })), "moulds");
  res.json({ success: true, total: out.total, pageSize, rows: out.rows.map(mouldRow), breakdown: out.breakdown });
}

// GET /api/catalog/products?process&family&material&q&sort&page
export async function catalogProducts(req, res) {
  const pageSize = setting("limits.pageSize") ?? PAGE_SIZE;
  const out = shapeList(await Item.aggregate(productListPipeline({ ...req.validQuery, limit: pageSize })), "products");
  res.json({ success: true, total: out.total, pageSize, rows: out.rows.map(productRow), breakdown: out.breakdown });
}

// GET /api/catalog/products/:itemId - every live mould that makes this item.
export async function catalogProduct(req, res) {
  const rows = await Item.aggregate(productDetailPipeline(req.params.itemId));
  if (!rows.length) fail(404, "NOT_FOUND", "Item not found");
  const first = rows[0];
  res.json({
    success: true,
    product: {
      itemId: first.itemId.toUpperCase(), description: first.description || "", materialId: first.materialId ?? null, masterbatchId: first.masterbatchId ?? null, qas: first.qas ?? null,
      images: rows.flatMap((r) => r.images || []).slice(0, 5).map(imageDTO),
      moulds: rows.map((r) => ({ id: String(r.mould.id), toolId: r.mould.toolId, status: displayStatus(r.mould.status), process: r.mould.process, owner: r.mould.owner ?? null, cavities: r.cavities ?? null }))
    }
  });
}

// GET /api/catalog/export?tab=moulds|products&format=csv|xlsx&<filters>  (export.run; max EXPORT_CAP rows; audited)
export async function catalogExport(req, res) {
  if (!can(req.user, "export.run")) fail(403, "FORBIDDEN", "You do not have permission to export");
  const q = req.validQuery;
  const products = q.tab === "products";
  const EXPORT_CAP = setting("limits.exportRowCap") ?? DEFAULT_EXPORT_CAP;
  const shaped = shapeList(await (products ? Item.aggregate(productListPipeline({ ...q, page: 1, limit: EXPORT_CAP + 1 })) : Mould.aggregate(mouldListPipeline({ ...q, page: 1, limit: EXPORT_CAP + 1 }))), q.tab);
  const truncated = shaped.rows.length > EXPORT_CAP;
  const rows = shaped.rows.slice(0, EXPORT_CAP).map(products ? productRow : mouldRow);
  const header = products
    ? ["Item ID", "Description", "Material", "Masterbatch", "QAS", "Family", "Process", "Moulds", "Tool IDs"]
    : ["Tool ID", "Process", "Owner", "Capable machines", "Cavities", "Items", "Status", "Materials"];
  const values = rows.map((r) => products
    ? [r.itemId, r.description, r.materialId, r.masterbatchId, r.qas, r.family, r.processes.join(" "), r.mouldCount, r.moulds.map((m) => m.toolId).join(" ")]
    : [r.toolId, r.process, r.owner, r.capableMachines.join(" "), r.cavities, r.itemCount, r.status, r.materials.join(" ")]);
  const info = [`Catalog ${products ? "products" : "moulds"}`, `Filters: ${describeFilters(q)}`, `Rows: ${rows.length} of ${shaped.total}${truncated ? ` (limited to ${EXPORT_CAP}; narrow the filters to export the rest)` : ""}`, `Exported: ${new Date().toISOString()}`];
  await audit(req, { action: "catalog.exported", entityType: "Export", entityLabel: `catalog-${q.tab}`, after: { format: q.format, filters: describeFilters(q), rows: rows.length, total: shaped.total, truncated } });
  const name = `catalog-${q.tab}-${new Date().toISOString().slice(0, 10)}`;
  if (truncated) res.set("X-Export-Truncated", String(EXPORT_CAP));
  if (q.format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(products ? "Products" : "Moulds");
    for (const line of info) ws.addRow([line]);
    ws.addRow([]);
    ws.addRow(header).font = { bold: true };
    for (const v of values) ws.addRow(v);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").set("Content-Disposition", `attachment; filename="${name}.xlsx"`);
    return res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [...info.map((l) => cell(l)), "", header.map(cell).join(","), ...values.map((v) => v.map(cell).join(","))];
  res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.send("﻿" + lines.join("\r\n"));
}
