import { apiRequest } from "@/lib/api/client";
import type {
  ChatMessage,
  ChatMessageDto,
  ChatReply,
  ChatReplyDto,
  CreateChatInput,
  CursorPage,
} from "@/lib/types/api";

function mapMessage(message: ChatMessageDto): ChatMessage {
  return {
    id: message.id,
    patientId: message.patient_id,
    role: message.role,
    message: message.message,
    provider: message.provider,
    createdAt: message.created_at,
  };
}

function mapReply(reply: ChatReplyDto): ChatReply {
  return {
    patientId: reply.patient_id,
    aiResponse: reply.ai_response,
    provider: reply.provider,
    messageId: reply.message_id,
  };
}

export async function listPatientChats(params: {
  patientId: number;
  limit: number;
  cursor: number | null;
}): Promise<{ data: ChatMessage[]; nextCursor: number | null }> {
  const search = new URLSearchParams({
    limit: String(params.limit),
  });

  if (params.cursor !== null) {
    search.set("cursor", String(params.cursor));
  }

  const response = await apiRequest<CursorPage<ChatMessageDto>>(
    `/patients/${params.patientId}/chats?${search.toString()}`,
  );

  return {
    data: response.data.map(mapMessage),
    nextCursor: response.next_cursor,
  };
}

export async function createChat(input: CreateChatInput): Promise<ChatReply> {
  const response = await apiRequest<ChatReplyDto>("/chat", {
    method: "POST",
    body: JSON.stringify({
      patient_id: input.patientId,
      message: input.message,
    }),
  });

  return mapReply(response);
}
