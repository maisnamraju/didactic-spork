import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { toNodeHandler } from "better-auth/node";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";

import { env } from "../config/env";
import { MailService } from "../services/mail.service";
import { captureEmailVerificationToken } from "./email-verification-token-store";
import { prisma } from "./prisma";

const mailService = new MailService();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGINS],
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
    sendVerificationEmail: async ({ user, token, url }) => {
      if (env.NODE_ENV === "test") {
        captureEmailVerificationToken(user.email, token);
        return;
      }

      await mailService.send({
        to: user.email,
        subject: "Verify your TeraLeads account",
        text: `Verify your email address by visiting this link: ${url}`,
        html: `<p>Verify your email address by visiting this link:</p><p><a href="${url}">${url}</a></p>`,
      });
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
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days for refresh tokens
  },
  plugins: [
    bearer(),
    jwt({
      jwt: {
        expirationTime: 60 * 15, // 15 minutes for access tokens
      },
    }),
  ],
});

export const authHandler = toNodeHandler(auth);
