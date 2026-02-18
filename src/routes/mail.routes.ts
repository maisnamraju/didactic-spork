import { Router } from "express";

import { sendEmailController } from "../controllers/mail.controller";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";

export const mailRouter = Router();

mailRouter.post("/emails/send", requireAuth, asyncHandler(sendEmailController));
