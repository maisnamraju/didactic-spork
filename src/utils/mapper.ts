import type { ChatMessageRecord, ChatMessageResponse } from "../models/chat-message.model";
import type { PatientRecord, PatientResponse } from "../models/patient.model";

function toIso(date: Date): string {
  return date.toISOString();
}

export function mapPatientToResponse(patient: PatientRecord): PatientResponse {
  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    dob: patient.dob.toISOString().slice(0, 10),
    medical_notes: patient.medicalNotes,
    created_at: toIso(patient.createdAt),
    updated_at: toIso(patient.updatedAt),
  };
}

export function mapChatMessageToResponse(message: ChatMessageRecord): ChatMessageResponse {
  return {
    id: message.id,
    patient_id: message.patientId,
    role: message.role,
    message: message.message,
    provider: message.provider,
    created_at: toIso(message.createdAt),
  };
}
