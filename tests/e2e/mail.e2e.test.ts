import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { hasConfiguredTestDatabase, resetDatabase } from "../helpers/db.js";
import { authHeader, createTestApp, registerAndLogin } from "../helpers/test-app.js";

const describeWithDb = hasConfiguredTestDatabase() ? describe : describe.skip;

describeWithDb("Mail e2e", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it("sends email via nodemailer transport for authenticated users", async () => {
    const owner = await registerAndLogin(app, { name: "Mailer Owner" });

    const send = await request(app)
      .post("/emails/send")
      .set(authHeader(owner.token))
      .send({
        to: "patient@example.com",
        subject: "Appointment reminder",
        text: "Your appointment is tomorrow at 9:00 AM",
      });

    expect(send.status).toBe(202);
    expect(typeof send.body.message_id).toBe("string");
    expect(Array.isArray(send.body.accepted)).toBe(true);
    expect(send.body.accepted).toContain("patient@example.com");
    expect(Array.isArray(send.body.rejected)).toBe(true);
  });

  it("requires at least one email body format", async () => {
    const owner = await registerAndLogin(app, { name: "Mailer Validation" });

    const send = await request(app)
      .post("/emails/send")
      .set(authHeader(owner.token))
      .send({
        to: "patient@example.com",
        subject: "Missing body",
      });

    expect(send.status).toBe(400);
    expect(send.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unauthenticated send attempts", async () => {
    const send = await request(app).post("/emails/send").send({
      to: "patient@example.com",
      subject: "Unauthorized",
      text: "Body",
    });

    expect(send.status).toBe(401);
  });
});
