import { z } from "zod";

import { cursorPaginationQuerySchema, idParamSchema } from "./common.validator";

function isValidDateString(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be in YYYY-MM-DD format")
  .refine((value) => isValidDateString(value), "dob must be a valid calendar date");

const nameSchema = z.string().trim().min(1, "name is required").max(120, "name is too long");

const emailSchema = z
  .string()
  .trim()
  .email("email must be valid")
  .transform((value) => value.toLowerCase());

const phoneSchema = z
  .string()
  .trim()
  .min(7, "phone must be at least 7 characters")
  .max(20, "phone must be at most 20 characters")
  .regex(/^[+0-9()\-\s]+$/, "phone contains invalid characters");

const medicalNotesSchema = z
  .string()
  .trim()
  .min(1, "medical_notes is required")
  .max(10000, "medical_notes is too long");

export const createPatientBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  dob: dobSchema,
  medical_notes: medicalNotesSchema,
});

export const updatePatientBodySchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    dob: dobSchema.optional(),
    medical_notes: medicalNotesSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const patientIdParamSchema = idParamSchema;

export const listPatientsQuerySchema = cursorPaginationQuerySchema;

export type CreatePatientBody = z.infer<typeof createPatientBodySchema>;
export type UpdatePatientBody = z.infer<typeof updatePatientBodySchema>;
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
