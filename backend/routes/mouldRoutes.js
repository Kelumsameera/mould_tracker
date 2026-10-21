import * as c from "../controllers/mouldController.js";
import * as w from "../controllers/workLogController.js";
import * as s from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const VIEW = ["moulds.view"];
const MANAGE = ["moulds.manage"];
// The move route lets anyone with a move permission in; lib/workflow.js decides the exact move.
const MOVE = ["moves.machine", "moves.mouldRoom", "workshop.work"];

export const mouldRouteTable = [
  ["get", "/", VIEW, c.listMoulds, null, s.listMouldsQuery],
  ["get", "/stats", VIEW, c.mouldStats],
  ["get", "/:id", VIEW, c.getMould],
  ["get", "/:id/history", VIEW, c.getMouldHistory],
  ["post", "/", MANAGE, c.createMould, s.createMouldSchema],
  ["patch", "/:id", MANAGE, c.updateMould, s.updateMouldSchema],
  ["delete", "/:id", MANAGE, c.deleteMould, s.reasonSchema],
  ["post", "/:id/restore", MANAGE, c.restoreMould],
  ["post", "/:id/move", MOVE, c.moveMould, s.moveMouldSchema],
  ["post", "/:id/status", ["workshop.work"], c.changeStatus, s.statusSchema],
  ["post", "/:id/shots", ["moves.machine", "workshop.work"], c.recordShots, s.shotsSchema],
  ["post", "/:id/items", MANAGE, c.addItem, s.createItemSchema],
  ["patch", "/:id/items/:itemId", MANAGE, c.updateItem, s.updateItemSchema],
  ["delete", "/:id/items/:itemId", MANAGE, c.deleteItem, s.reasonSchema],
  ["get", "/:id/worklogs", ["worklog.view"], w.listMouldWorkLogs],
  ["post", "/:id/worklogs", ["worklog.create"], w.createWorkLog, s.createWorkLogSchema],
  ["post", "/:id/problems", ["problem.report"], w.reportProblem, s.reportProblemSchema]
];

export default routerFrom(mouldRouteTable);
