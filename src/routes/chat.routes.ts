import { Router } from "express";

import { createChatController, listPatientChatsController } from "../controllers/chat.controller";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";

export const chatRouter = Router();

chatRouter.post("/chat", requireAuth, asyncHandler(createChatController));
chatRouter.get("/patients/:id/chats", requireAuth, asyncHandler(listPatientChatsController));
2