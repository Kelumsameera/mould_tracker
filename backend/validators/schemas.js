import { z } from "zod";

const product = z.object({
  pid: z.string().trim().min(1, "Product ID is required").max(100).transform((s) => s.toUpperCase()),
  desc: z.string().trim().max(500).default(""),
  cav: z.coerce.number().int().min(0).default(0)
});

const products = z
  .array(product)
  .refine((list) => new Set(list.map((p) => p.pid)).size === list.length, {
    message: "Duplicate product ID inside tool"
  });

const toolCode = z.string().trim().min(1, "Tool code is required").max(100);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const role = z.enum(["admin", "operator", "viewer"]);

export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const passkeyRegistrationSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(80),
});
export const passkeyDeleteSchema = z.object({ currentPassword: z.string().min(1).max(256) });
export const passkeyResponseSchema = z.object({ response: z.object({ id: z.string().min(1).max(2048) }).passthrough() });

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const createToolSchema = z.object({
  toolCode,
  size: z.string().trim().max(50).default(""),
  products: products.default([]),
  notes: z.string().max(2000).default("")
});

export const updateToolSchema = z.object({
  toolCode: toolCode.optional(),
  size: z.string().trim().max(50).optional(),
  products: products.optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().positive().optional()
});

export const assignToolSchema = z.object({ machineName: z.string().trim().min(1, "Enter a machine name").max(150) });
export const takeOutSchema = z.object({ note: z.string().trim().max(300).default("") });

export const createMachineSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150)
});

export const updateMachineSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  active: z.boolean().optional()
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  password,
  role: role.default("operator")
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: role.optional(),
  active: z.boolean().optional(),
  password: password.optional()
});
