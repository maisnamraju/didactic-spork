export type ChatRole = "user" | "assistant";

export interface ChatMessageRecord {
  id: number;
  patientId: number;
  ownerUserId: string;
  role: ChatRole;
  message: string;
  provider: string;
  createdAt: Date;
}

export interface ChatMessageResponse {
  id: number;
  patient_id: number;
  role: ChatRole;
  message: string;
  provider: string;
  created_at: string;
}

export interface ChatReplyResponse {
  patient_id: number;
  ai_response: string;
  provider: string;
  message_id: number;
}
