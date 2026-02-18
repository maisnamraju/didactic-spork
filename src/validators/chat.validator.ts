import { z } from "zod";

import { cursorPaginationQuerySchema, idParamSchema } from "./common.validator";

export const createChatBodySchema = z.object({
  patient_id: z.number().int().positive(),
  message: z.string().trim().min(1, "message is required").max(4000, "message is too long"),
});

export const listPatientChatsQuerySchema = cursorPaginationQuerySchema;

export const patientIdParamSchema = idParamSchema;

export type CreateChatBody = z.infer<typeof createChatBodySchema>;
export type ListPatientChatsQuery = z.infer<typeof listPatientChatsQuerySchema>;
