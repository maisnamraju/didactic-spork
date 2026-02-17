import type { CursorPaginatedResult } from "../models/pagination.model.js";
import type { PatientRecord } from "../models/patient.model.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export interface CreatePatientInput {
  name: string;
  email: string;
  phone: string;
  dob: string;
  medical_notes: string;
}

export interface UpdatePatientInput {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  medical_notes?: string;
}

export interface CursorInput {
  limit: number;
  cursor: number | null;
}

function mapPatient(record: {
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
}): PatientRecord {
  return record;
}

export class PatientService {
  public async create(ownerUserId: string, input: CreatePatientInput): Promise<PatientRecord> {
    const created = await prisma.patient.create({
      data: {
        ownerUserId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        dob: new Date(`${input.dob}T00:00:00.000Z`),
        medicalNotes: input.medical_notes,
      },
    });

    return mapPatient(created);
  }

  public async list(ownerUserId: string, pagination: CursorInput): Promise<CursorPaginatedResult<PatientRecord>> {
    const rows = await prisma.patient.findMany({
      where: {
        ownerUserId,
        deletedAt: null,
        ...(pagination.cursor !== null
          ? {
              id: {
                gt: pagination.cursor,
              },
            }
          : {}),
      },
      orderBy: {
        id: "asc",
      },
      take: pagination.limit + 1,
    });

    const hasMore = rows.length > pagination.limit;
    const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;

    return {
      data: sliced.map(mapPatient),
      next_cursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  public async getById(ownerUserId: string, id: number): Promise<PatientRecord> {
    const patient = await prisma.patient.findFirst({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new ApiError(404, "NOT_FOUND", "Patient not found");
    }

    return mapPatient(patient);
  }

  public async update(ownerUserId: string, id: number, input: UpdatePatientInput): Promise<PatientRecord> {
    await this.getById(ownerUserId, id);

    const updated = await prisma.patient.update({
      where: {
        id,
      },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.dob !== undefined ? { dob: new Date(`${input.dob}T00:00:00.000Z`) } : {}),
        ...(input.medical_notes !== undefined ? { medicalNotes: input.medical_notes } : {}),
      },
    });

    return mapPatient(updated);
  }

  public async softDelete(ownerUserId: string, id: number): Promise<void> {
    await this.getById(ownerUserId, id);

    await prisma.patient.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
