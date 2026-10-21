import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";

// Builds a router from a route table: [method, path, permissions (any of), handler, body schema?, query schema?].
// The same table is used by the tests to check every route against every role.
export function routerFrom(table) {
  const router = Router();
  router.use(requireAuth);
  for (const [method, path, permissions, handler, body, query] of table) {
    const steps = [requirePermission(...permissions)];
    if (query) steps.push(validate(query, "query"));
    if (body) steps.push(validate(body));
    router[method](path, ...steps, asyncHandler(handler));
  }
  return router;
}
