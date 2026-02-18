import { apiRequest } from "@/lib/api/client";
import type {
  CreatePatientInput,
  CursorPage,
  Patient,
  PatientDto,
  UpdatePatientInput,
} from "@/lib/types/api";

function mapPatient(patient: PatientDto): Patient {
  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    dob: patient.dob,
    medicalNotes: patient.medical_notes,
    createdAt: patient.created_at,
    updatedAt: patient.updated_at,
  };
}

function toPatientPayload(input: CreatePatientInput | UpdatePatientInput): Record<string, unknown> {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.dob !== undefined ? { dob: input.dob } : {}),
    ...(input.medicalNotes !== undefined ? { medical_notes: input.medicalNotes } : {}),
  };
}

export async function listPatients(params: {
  limit: number;
  cursor: number | null;
}): Promise<{ data: Patient[]; nextCursor: number | null }> {
  const search = new URLSearchParams({
    limit: String(params.limit),
  });

  if (params.cursor !== null) {
    search.set("cursor", String(params.cursor));
  }

  const response = await apiRequest<CursorPage<PatientDto>>(
    `/patients?${search.toString()}`,
  );

  return {
    data: response.data.map(mapPatient),
    nextCursor: response.next_cursor,
  };
}

export async function getPatient(id: number): Promise<Patient> {
  const response = await apiRequest<PatientDto>(`/patients/${id}`);
  return mapPatient(response);
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const response = await apiRequest<PatientDto>("/patients", {
    method: "POST",
    body: JSON.stringify(toPatientPayload(input)),
  });

  return mapPatient(response);
}

export async function updatePatient(
  id: number,
  input: UpdatePatientInput,
): Promise<Patient> {
  const response = await apiRequest<PatientDto>(`/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toPatientPayload(input)),
  });

  return mapPatient(response);
}

export async function deletePatient(id: number): Promise<void> {
  await apiRequest<unknown>(`/patients/${id}`, {
    method: "DELETE",
  });
}
