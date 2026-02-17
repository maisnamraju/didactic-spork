import { z } from "zod";

const intSchema = z
  .string()
  .regex(/^\d+$/, "Must be an integer")
  .transform((value) => Number.parseInt(value, 10));

export const idParamSchema = z.object({
  id: intSchema.refine((value) => value > 0, "id must be positive"),
});

const limitSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return 20;
    }

    return Number.parseInt(value, 10);
  })
  .refine((value) => Number.isInteger(value) && value >= 1 && value <= 100, {
    message: "limit must be between 1 and 100",
  });

const cursorSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return null;
    }

    return Number.parseInt(value, 10);
  })
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
    message: "cursor must be a positive integer",
  });

export const cursorPaginationQuerySchema = z.object({
  limit: limitSchema,
  cursor: cursorSchema,
});
