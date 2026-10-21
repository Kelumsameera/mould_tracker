import * as c from "../controllers/machineController.js";
import { createMachineSchema, updateMachineSchema } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

export const machineRouteTable = [
  ["get", "/", ["moulds.view"], c.listMachines],
  ["post", "/", ["moulds.manage"], c.createMachine, createMachineSchema],
  ["patch", "/:id", ["moulds.manage"], c.updateMachine, updateMachineSchema]
];

export default routerFrom(machineRouteTable);
