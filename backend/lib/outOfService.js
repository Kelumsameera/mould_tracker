import { z } from "zod";

export const dispatchDetailsSchema = z.object({
  recipientName: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(500),
  repairDetails: z.string().trim().min(1).max(2000)
}).strict();
