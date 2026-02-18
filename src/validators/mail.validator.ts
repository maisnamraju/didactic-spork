import { z } from "zod";

const recipientSchema = z
  .string()
  .trim()
  .email("to must be a valid email")
  .transform((value) => value.toLowerCase());

const subjectSchema = z
  .string()
  .trim()
  .min(1, "subject is required")
  .max(200, "subject is too long");

const textSchema = z.string().trim().min(1, "text cannot be empty").max(10000, "text is too long");

const htmlSchema = z.string().trim().min(1, "html cannot be empty").max(20000, "html is too long");

export const sendEmailBodySchema = z
  .object({
    to: recipientSchema,
    subject: subjectSchema,
    text: textSchema.optional(),
    html: htmlSchema.optional(),
  })
  .refine((value) => value.text !== undefined || value.html !== undefined, {
    message: "At least one of text or html must be provided",
    path: ["text"],
  });

export type SendEmailBody = z.infer<typeof sendEmailBodySchema>;
