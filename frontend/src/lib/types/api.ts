export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CursorPage<T> {
  data: T[];
  next_cursor: number | null;
}

export interface PatientDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  medical_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  medicalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientInput {
  name: string;
  email: string;
  phone: string;
  dob: string;
  medicalNotes: string;
}

export interface UpdatePatientInput {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  medicalNotes?: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessageDto {
  id: number;
  patient_id: number;
  role: ChatRole;
  message: string;
  provider: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  patientId: number;
  role: ChatRole;
  message: string;
  provider: string;
  createdAt: string;
}

export interface CreateChatInput {
  patientId: number;
  message: string;
}

export interface ChatReplyDto {
  patient_id: number;
  ai_response: string;
  provider: string;
  message_id: number;
}

export interface ChatReply {
  patientId: number;
  aiResponse: string;
  provider: string;
  messageId: number;
}
