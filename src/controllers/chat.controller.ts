import type { RequestHandler } from "express";

import { getAuthContext } from "../middleware/require-auth";
import type { ChatReplyResponse } from "../models/chat-message.model";
import { createAIProvider } from "../services/ai/provider.factory";
import { ChatService } from "../services/chat.service";
import { mapChatMessageToResponse } from "../utils/mapper";
import {
  createChatBodySchema,
  listPatientChatsQuerySchema,
  patientIdParamSchema,
} from "../validators/chat.validator";

const chatService = new ChatService(createAIProvider());

export const createChatController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const body = createChatBodySchema.parse(req.body);

  const response: ChatReplyResponse = await chatService.createReply(
    auth.user.id,
    body.patient_id,
    body.message,
  );

  res.status(201).json(response);
};

export const listPatientChatsController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const params = patientIdParamSchema.parse(req.params);
  const query = listPatientChatsQuerySchema.parse(req.query);

  const result = await chatService.listByPatient(auth.user.id, params.id, query);

  res.json({
    data: result.data.map(mapChatMessageToResponse),
    next_cursor: result.next_cursor,
  });
};
