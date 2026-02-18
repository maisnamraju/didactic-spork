import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

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

    const sendVerification = await request(app).post("/api/auth/send-verification-email").send({
      email,
    });

    expect(sendVerification.status).toBe(200);
    expect(sendVerification.body).toEqual({ status: true });

    const token = consumeEmailVerificationToken(email);
    expect(token).toBeTruthy();

    if (!token) {
      throw new Error("Expected verification token to be captured");
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
