import { Router } from "express";
import {
  assignTool, createTool, deleteTool, getTool, getToolHistory,
  listTools, returnTool, takeOutTool, updateTool
} from "../controllers/toolController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { asyncHandler as h } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";
import { assignToolSchema, createToolSchema, takeOutSchema, updateToolSchema } from "../validators/schemas.js";

const router = Router();
const canEdit = requireRole("admin", "operator");

router.use(requireAuth);

router.get("/", h(listTools));
router.get("/:id", h(getTool));
router.get("/:id/history", h(getToolHistory));

router.post("/", canEdit, validate(createToolSchema), h(createTool));
router.patch("/:id", canEdit, validate(updateToolSchema), h(updateTool));
router.post("/:id/assign", canEdit, validate(assignToolSchema), h(assignTool));
router.post("/:id/return", canEdit, h(returnTool));
router.post("/:id/taken-out", canEdit, validate(takeOutSchema), h(takeOutTool));
router.delete("/:id", requireRole("admin"), h(deleteTool));

export default router;
