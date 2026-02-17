import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { toNodeHandler } from "better-auth/node";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { env } from "../config/env.js";
import { captureEmailVerificationToken } from "./email-verification-token-store.js";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, token }) => {
      if (env.NODE_ENV === "test") {
        captureEmailVerificationToken(user.email, token);
      }
    },
  },
  user: {
    additionalFields: {
      publicId: {
        type: "number",
        required: false,
        input: false,
        unique: true,
        fieldName: "public_id",
      },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [bearer(), jwt()],
});

export const authHandler = toNodeHandler(auth);
