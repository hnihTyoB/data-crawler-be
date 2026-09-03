import { Router } from "express";
import { ApiKeyController } from "./api-key.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createApiKeySchema,
  updateApiKeyStatusSchema,
} from "./api-key.validation";

const router = Router();
const controller = new ApiKeyController();

router.post(
  "/",
  authMiddleware,
  validate(createApiKeySchema),
  controller.create,
);
router.get("/", authMiddleware, controller.list);
router.patch(
  "/:id",
  authMiddleware,
  validate(updateApiKeyStatusSchema),
  controller.setActive,
);
router.delete("/:id", authMiddleware, controller.revoke);

export default router;
