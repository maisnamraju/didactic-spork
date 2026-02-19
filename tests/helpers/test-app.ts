import type { Express } from "express";
import request from "supertest";

import { createApp } from "../../src/app";
import { env } from "../../src/config/env";
import { consumeEmailVerificationToken } from "../../src/lib/email-verification-token-store";

export interface AuthSession {
  email: string;
  password: string;
  name: string;
  token: string;
}

export function createTestApp(): Express {
  return createApp();
}

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function randomEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.com`;
}

async function signInWithEmail(app: Express, email: string, password: string) {
  return request(app)
    .post("/api/auth/sign-in/email")
    .set("origin", env.BETTER_AUTH_URL)
    .set("set-auth-token", "true")
    .send({
      email,
      password,
    });
}

export async function verifyEmailForUser(app: Express, email: string): Promise<void> {
  // Try consuming a token already captured on sign-up (sendOnSignUp: true)
  let token = consumeEmailVerificationToken(email);

  if (!token) {
    const sendVerificationResponse = await request(app)
      .post("/api/auth/send-verification-email")
      .set("origin", env.BETTER_AUTH_URL)
      .send({
        email,
      });

    if (sendVerificationResponse.status !== 200) {
      throw new Error(
        `Send verification email failed with status ${sendVerificationResponse.status}`,
      );
    }

    token = consumeEmailVerificationToken(email);
  }

  if (!token) {
    throw new Error("Expected a captured verification token but none was available");
  }

  const verifyResponse = await request(app)
    .get("/api/auth/verify-email")
    .set("origin", env.BETTER_AUTH_URL)
    .query({
      token,
    });

  if (verifyResponse.status !== 200) {
    throw new Error(`Verify email failed with status ${verifyResponse.status}`);
  }
}

export async function registerAndLogin(
  app: Express,
  overrides?: Partial<AuthSession>,
): Promise<AuthSession> {
  const email = overrides?.email ?? randomEmail("user");
  const password = overrides?.password ?? "Password123!";
  const name = overrides?.name ?? "Test User";

  const signUpResponse = await request(app)
    .post("/api/auth/sign-up/email")
    .set("origin", env.BETTER_AUTH_URL)
    .set("set-auth-token", "true")
    .send({
      email,
      password,
      name,
    });

  if (signUpResponse.status !== 200 && signUpResponse.status !== 201) {
    throw new Error(`Sign-up failed with status ${signUpResponse.status}`);
  }

  let token = readHeaderValue(signUpResponse.headers["set-auth-token"]);

  if (!token) {
    const signInResponse = await signInWithEmail(app, email, password);

    if (signInResponse.status === 403) {
      await verifyEmailForUser(app, email);
      const verifiedSignInResponse = await signInWithEmail(app, email, password);

      if (verifiedSignInResponse.status !== 200) {
        throw new Error(
          `Sign-in after verification failed with status ${verifiedSignInResponse.status}`,
        );
      }

      token = readHeaderValue(verifiedSignInResponse.headers["set-auth-token"]);
    } else {
      if (signInResponse.status !== 200) {
        throw new Error(`Sign-in failed with status ${signInResponse.status}`);
      }

      token = readHeaderValue(signInResponse.headers["set-auth-token"]);
    }
  }

  if (!token) {
    throw new Error("Expected set-auth-token header but none was returned");
  }

  return {
    email,
    password,
    name,
    token,
  };
}

export function authHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}
