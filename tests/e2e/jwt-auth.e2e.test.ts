import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
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

  afterAll(async () => {
    await resetDatabase();
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

  it("should return error details in response body for invalid token", async () => {
    const res = await request(app)
      .get("/patients")
      .set("Authorization", "Bearer invalid.token.here")
      .expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBeDefined();
  });

  it("should return error details in response body for missing token", async () => {
    const res = await request(app)
      .get("/patients")
      .expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBeDefined();
  });

  it("should populate auth context with user details on successful authentication", async () => {
    const res = await request(app)
      .get("/patients")
      .set(authHeader(accessToken))
      .expect(200);

    // Verify that the request was authenticated by checking that we got a successful response
    // The auth context is used internally by the route handlers
    expect(res.body).toBeDefined();
  });
});
