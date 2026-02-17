export interface PatientRecord {
  id: number;
  ownerUserId: string;
  name: string;
  email: string;
  phone: string;
  dob: Date;
  medicalNotes: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  medical_notes: string;
  created_at: string;
  updated_at: string;
}
