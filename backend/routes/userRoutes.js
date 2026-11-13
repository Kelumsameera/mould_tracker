import { createUser, deleteUser, listUsers, updateUser, listUserAccess, updateUserAccess, updateRoleAccess } from "../controllers/userController.js";
import { createUserSchema, reasonSchema, updateUserSchema, roleAccessSchema, userAccessSchema } from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const MANAGE = ["users.manage"]; // limited further by ASSIGNABLE_ROLES (canManageUser)

export const userRouteTable = [
  ["get", "/access", ["access.manage"], listUserAccess],
  ["patch", "/roles/:role/access", ["access.manage"], updateRoleAccess, roleAccessSchema],
  ["patch", "/:id/access", ["access.manage"], updateUserAccess, userAccessSchema],
  ["get", "/", MANAGE, listUsers],
  ["post", "/", MANAGE, createUser, createUserSchema],
  ["patch", "/:id", MANAGE, updateUser, updateUserSchema],
  ["delete", "/:id", MANAGE, deleteUser, reasonSchema]
];

export default routerFrom(userRouteTable);
