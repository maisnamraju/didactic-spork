import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../src/config/env";
import { consumeEmailVerificationToken } from "../../src/lib/email-verification-token-store";
import { prisma } from "../../src/lib/prisma";
import { hasConfiguredTestDatabase, resetDatabase } from "../helpers/db";
import { createTestApp } from "../helpers/test-app";

const describeWithDb = hasConfiguredTestDatabase() ? describe : describe.skip;

describeWithDb("Auth e2e", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it("issues bearer token on sign-up and sign-in when set-auth-token=true", async () => {
    const email = `auth-${Date.now()}@example.com`;
    const password = "Password123!";

    const signUp = await request(app)
      .post("/api/auth/sign-up/email")
      .set("set-auth-token", "true")
      .send({
        email,
        password,
        name: "Auth User",
      });

    expect([200, 201]).toContain(signUp.status);
    expect(signUp.headers["set-auth-token"]).toBeTruthy();

    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .set("set-auth-token", "true")
      .send({
        email,
        password,
      });

    expect(signIn.status).toBe(200);
    expect(signIn.headers["set-auth-token"]).toBeTruthy();
  });

  it("verifies email and persists email_verified state", async () => {
    const email = `verify-${Date.now()}@example.com`;
    const password = "Password123!";

    const signUp = await request(app).post("/api/auth/sign-up/email").send({
      email,
      password,
      name: "Verify User",
    });

    expect([200, 201]).toContain(signUp.status);

    const userBefore = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    expect(userBefore).toBeTruthy();
    expect(userBefore?.emailVerified).toBe(false);

    // Token is captured automatically on sign-up (sendOnSignUp: true)
    const token = consumeEmailVerificationToken(email);
    expect(token).toBeTruthy();

    if (!token) {
      throw new Error("Expected verification token to be captured on sign-up");
    }

    const verify = await request(app).get("/api/auth/verify-email").query({ token });

    expect(verify.status).toBe(200);
    expect(verify.body.status).toBe(true);

    const userAfter = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    expect(userAfter).toBeTruthy();
    expect(userAfter?.emailVerified).toBe(true);
  });

  it("logs verification URL with frontend callback on sign-up", async () => {
    const email = `log-${Date.now()}@example.com`;
    const password = "Password123!";
    const consoleSpy = vi.spyOn(console, "log");

    await request(app).post("/api/auth/sign-up/email").send({
      email,
      password,
      name: "Log User",
    });

    const logCall = consoleSpy.mock.calls.find(
      (args) => typeof args[0] === "string" && args[0].includes("[Auth] Verification URL for"),
    );

    expect(logCall).toBeTruthy();

    const loggedUrl = logCall![0] as string;
    expect(loggedUrl).toContain(`[Auth] Verification URL for ${email}:`);
    expect(loggedUrl).toContain(
      `callbackURL=${encodeURIComponent(`${env.CORS_ORIGINS}/email-verified`)}`,
    );

    consoleSpy.mockRestore();
  });

  it("rejects unauthenticated patient and chat access", async () => {
    const patients = await request(app).get("/patients");
    expect(patients.status).toBe(401);

    const chat = await request(app).post("/chat").send({
      patient_id: 1,
      message: "Hello",
    });
    expect(chat.status).toBe(401);
  });
});
