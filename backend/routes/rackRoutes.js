import * as c from "../controllers/rackController.js";
import * as s from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const VIEW = ["racks.view"];
const MANAGE = ["racks.manage"]; // Super Admin only; Admin sees racks read-only

export const rackRouteTable = [
  ["get", "/", VIEW, c.listRacks],
  ["post", "/zones", MANAGE, c.createZone, s.createZoneSchema],
  ["patch", "/zones/:id", MANAGE, c.updateZone, s.updateZoneSchema],
  ["delete", "/zones/:id", MANAGE, c.deleteZone],
  ["post", "/bulk", MANAGE, c.bulkRacks, s.bulkRacksSchema],
  ["post", "/remove-row", MANAGE, c.removeRow, s.removeRowSchema],
  ["post", "/", MANAGE, c.createRack, s.createRackSchema],
  ["get", "/:id", VIEW, c.getRack],
  ["patch", "/:id", MANAGE, c.updateRack, s.updateRackSchema],
  ["delete", "/:id", MANAGE, c.deleteRack]
];

export default routerFrom(rackRouteTable);
