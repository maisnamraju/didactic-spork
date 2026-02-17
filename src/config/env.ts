import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const smtpSecureSchema = z.enum(["true", "false"]).default("false").transform((value) => value === "true");

const rawEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/teraleads"),
    TEST_DATABASE_URL: z.string().optional(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters")
      .default("replace-this-in-prod-with-32-plus-char-secret"),
    BETTER_AUTH_URL: z.string().url().optional(),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
    AI_PROVIDER: z.enum(["mock"]).default("mock"),
    AI_MOCK_FAIL_KEY: z.string().default("__fail_ai__"),
    MAIL_TRANSPORT: z.enum(["smtp", "json"]).optional(),
    MAIL_FROM: z.string().email().default("no-reply@example.com"),
    MAIL_FROM_NAME: z.string().trim().min(1).max(120).default("TeraLeads"),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: smtpSecureSchema,
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasSmtpUser = Boolean(value.SMTP_USER);
    const hasSmtpPass = Boolean(value.SMTP_PASS);
    if (hasSmtpUser !== hasSmtpPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_USER"],
        message: "SMTP_USER and SMTP_PASS must both be set when using SMTP auth",
      });
    }
  });

const parsed = rawEnvSchema.parse(process.env);

const databaseUrl =
  parsed.NODE_ENV === "test" && parsed.TEST_DATABASE_URL ? parsed.TEST_DATABASE_URL : parsed.DATABASE_URL;
const mailTransport = parsed.MAIL_TRANSPORT ?? (parsed.NODE_ENV === "test" ? "json" : "smtp");

export const env = {
  ...parsed,
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_URL: parsed.BETTER_AUTH_URL ?? `http://localhost:${parsed.PORT}`,
  MAIL_TRANSPORT: mailTransport,
};

export type AppEnv = typeof env;
