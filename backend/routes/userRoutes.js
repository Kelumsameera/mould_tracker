import { Router } from "express";
import { createUser, listUsers, updateUser } from "../controllers/userController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { asyncHandler as h } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createUserSchema, updateUserSchema } from "../validators/schemas.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", h(listUsers));
router.post("/", validate(createUserSchema), h(createUser));
router.patch("/:id", validate(updateUserSchema), h(updateUser));

export default router;
