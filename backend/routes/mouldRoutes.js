import * as c from "../controllers/mouldController.js";
import * as w from "../controllers/workLogController.js";
import * as s from "../validators/schemas.js";
import { routerFrom, SIGNED_IN } from "./table.js";

const VIEW = ["mould.view"];
const EDIT = ["mould.edit"];
const IMAGES = ["mould.images.manage"];
const DELETE = ["mould.delete"];
// Editing a mould: details need mould.edit, capable machines need mould.machines.edit (checked per field).
const UPDATE = ["mould.edit", "mould.machines.edit"];
// The planner authorizes moves according to the current settings and workflow.
const MOVE = SIGNED_IN;

export const mouldRouteTable = [
  ["get", "/", VIEW, c.listMoulds, null, s.listMouldsQuery],
  ["get", "/stats", VIEW, c.mouldStats, null, s.listMouldsQuery],
  ["get", "/suggest", VIEW, c.suggestMoulds, null, s.suggestQuery],
  ["get", "/:id", VIEW, c.getMould],
  ["get", "/:id/history", VIEW, c.getMouldHistory],
  ["post", "/", ["mould.create"], c.createMould, s.createMouldSchema],
  ["patch", "/:id", UPDATE, c.updateMould, s.updateMouldSchema],
  ["delete", "/:id", DELETE, c.deleteMould, s.reasonSchema],
  ["post", "/:id/restore", DELETE, c.restoreMould],
  ["post", "/:id/move", MOVE, c.moveMould, s.moveMouldSchema],
  ["post", "/:id/status", ["status.change"], c.changeStatus, s.statusSchema],
  ["post", "/:id/cavities", ["cavity.manage"], c.setCavities, s.cavitiesSchema],
  ["get", "/:id/cavity-downtime", VIEW, c.getCavityDowntime],
  ["post", "/:id/shots", ["move.machine", "status.change"], c.recordShots, s.shotsSchema],
  ["post", "/:id/items", EDIT, c.addItem, s.addItemSchema],
  ["patch", "/:id/items/:itemId", EDIT, c.updateItem, s.updateItemSchema],
  ["delete", "/:id/items/:itemId", EDIT, c.deleteItem, s.optionalReasonSchema],
  ["post", "/:id/items/:itemId/images", IMAGES, c.addItemImage, s.itemImageSchema],
  ["put", "/:id/items/:itemId/images/order", IMAGES, c.reorderItemImages, s.itemImageOrderSchema],
  ["put", "/:id/items/:itemId/images/:key", IMAGES, c.replaceItemImage, s.itemImageSchema],
  ["delete", "/:id/items/:itemId/images/:key", IMAGES, c.removeItemImage, s.optionalReasonSchema],
  ["get", "/:id/worklogs", ["worklog.view"], w.listMouldWorkLogs],
  ["post", "/:id/worklogs", ["worklog.create"], w.createWorkLog, s.createWorkLogSchema],
  ["post", "/:id/problems", ["problem.report"], w.reportProblem, s.reportProblemSchema]
];

export default routerFrom(mouldRouteTable);
