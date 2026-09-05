import { z } from "zod";

export const permissionParamsSchema = z.object({
  id: z.string().uuid("Invalid permission ID format"),
});
