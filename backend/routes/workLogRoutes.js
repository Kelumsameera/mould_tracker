import * as w from "../controllers/workLogController.js";
import { workLogQuery } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const REPORT = ["worklog.report"]; // Super Admin and Admin

export const workLogRouteTable = [
  ["get", "/workers", ["worklog.create"], w.listWorkers],
  ["get", "/summary", REPORT, w.workLogSummary, null, workLogQuery],
  ["get", "/export", REPORT, w.exportWorkLogs, null, workLogQuery],
  ["get", "/", REPORT, w.listWorkLogs, null, workLogQuery]
];

export default routerFrom(workLogRouteTable);
