import { Router } from "express";
import { createChatController, listPatientChatsController } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const chatRouter = Router();

chatRouter.post("/chat", requireAuth, asyncHandler(createChatController));
chatRouter.get("/patients/:id/chats", requireAuth, asyncHandler(listPatientChatsController));
