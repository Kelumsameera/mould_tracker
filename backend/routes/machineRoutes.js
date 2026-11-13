import * as c from "../controllers/machineController.js";
import { createMachineSchema, updateMachineSchema } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

export const machineRouteTable = [
  ["get", "/", ["mould.view"], c.listMachines],
  ["post", "/", ["mould.edit"], c.createMachine, createMachineSchema],
  ["patch", "/:id", ["mould.edit"], c.updateMachine, updateMachineSchema]
];

export default routerFrom(machineRouteTable);
