import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { changePassword, login, logout, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema } from "../validators/schemas.js";
import { passkeyRegistrationSchema, passkeyDeleteSchema, passkeyResponseSchema } from "../validators/schemas.js";
import { requirePasskeyOrigin } from "../utils/passkeyConfig.js";
import { capabilities, registrationOptions, registrationVerify, authenticationOptions, authenticationVerify, listPasskeys, deletePasskey } from "../controllers/passkeyController.js";

const router = Router();
const loginLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again later" } });
const enrollmentLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, message: "Too many passkey requests. Please try again later" } });

router.post("/login", loginLimit, validate(loginSchema), asyncHandler(login));
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/password", requireAuth, validate(changePasswordSchema), asyncHandler(changePassword));
router.get("/passkeys/capabilities", capabilities);
router.get("/passkeys", requireAuth, asyncHandler(listPasskeys));
router.post("/passkeys/register/options", requireAuth, enrollmentLimit, requirePasskeyOrigin, validate(passkeyRegistrationSchema), asyncHandler(registrationOptions));
router.post("/passkeys/register/verify", requireAuth, requirePasskeyOrigin, validate(passkeyResponseSchema), asyncHandler(registrationVerify));
router.post("/passkeys/login/options", loginLimit, requirePasskeyOrigin, asyncHandler(authenticationOptions));
router.post("/passkeys/login/verify", loginLimit, requirePasskeyOrigin, validate(passkeyResponseSchema), asyncHandler(authenticationVerify));
router.delete("/passkeys/:id", requireAuth, requirePasskeyOrigin, validate(passkeyDeleteSchema), asyncHandler(deletePasskey));

export default router;
