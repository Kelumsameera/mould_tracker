import { Router } from "express";
import { changePassword, login, logout, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema } from "../validators/schemas.js";

const router = Router();

router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/password", requireAuth, validate(changePasswordSchema), asyncHandler(changePassword));

export default router;
