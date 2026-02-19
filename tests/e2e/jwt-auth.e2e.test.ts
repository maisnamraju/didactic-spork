import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { hasConfiguredTestDatabase, resetDatabase } from "../helpers/db";
import { authHeader, createTestApp, registerAndLogin } from "../helpers/test-app";

const describeWithDb = hasConfiguredTestDatabase() ? describe : describe.skip;

describeWithDb("JWT Authentication E2E", () => {
  const app = createTestApp();
  let accessToken: string;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    // Register and login to get a fresh token
    const session = await registerAndLogin(app, {
      email: "jwt-test@example.com",
      password: "SecurePass123!",
      name: "JWT Test User",
    });
    accessToken = session.token;
  });

  it("should authenticate with valid JWT token", async () => {
    const res = await request(app)
      .get("/patients")
      .set(authHeader(accessToken))
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it("should return 401 with missing Authorization header", async () => {
    await request(app)
      .get("/patients")
      .expect(401);
  });

  it("should return 401 with invalid JWT token", async () => {
    await request(app)
      .get("/patients")
      .set("Authorization", "Bearer invalid.token.here")
      .expect(401);
  });

  it("should return 401 with malformed Authorization header", async () => {
    await request(app)
      .get("/patients")
      .set("Authorization", accessToken) // Missing "Bearer "
      .expect(401);
  });
});
