import { listAudit } from "../controllers/auditController.js";
import { auditQuery } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

export const auditRouteTable = [["get", "/", ["audit.view"], listAudit, null, auditQuery]];

export default routerFrom(auditRouteTable);
