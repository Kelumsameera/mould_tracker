import { createUser, deleteUser, listUsers, updateUser, listUserAccess, updateUserAccess } from "../controllers/userController.js";
import { createUserSchema, reasonSchema, updateUserSchema, updateUserAccessSchema } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const MANAGE = ["users.manage"]; // Admins too, but only Super Admins touch Super Admins (canManageUser)

export const userRouteTable = [
  ["get", "/access", ["access.manage"], listUserAccess],
  ["patch", "/:id/access", ["access.manage"], updateUserAccess, updateUserAccessSchema],
  ["get", "/", MANAGE, listUsers],
  ["post", "/", MANAGE, createUser, createUserSchema],
  ["patch", "/:id", MANAGE, updateUser, updateUserSchema],
  ["delete", "/:id", MANAGE, deleteUser, reasonSchema]
];

export default routerFrom(userRouteTable);
