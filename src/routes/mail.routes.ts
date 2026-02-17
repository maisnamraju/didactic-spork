import { Router } from "express";
import { sendEmailController } from "../controllers/mail.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const mailRouter = Router();

mailRouter.post("/emails/send", requireAuth, asyncHandler(sendEmailController));
