import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { hasConfiguredTestDatabase, resetDatabase } from "../helpers/db";
import { authHeader, createTestApp, registerAndLogin } from "../helpers/test-app";

const describeWithDb = hasConfiguredTestDatabase() ? describe : describe.skip;

describeWithDb("Chat e2e", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it("stores user+assistant messages and returns AI response", async () => {
    const owner = await registerAndLogin(app, { name: "Chat Owner" });

    const createPatient = await request(app).post("/patients").set(authHeader(owner.token)).send({
      name: "Chat Patient",
      email: "chat-patient@example.com",
      phone: "+12025550999",
      dob: "1988-08-08",
      medical_notes: "No known allergies",
    });

    expect(createPatient.status).toBe(201);

    const patientId = createPatient.body.id as number;

    const reply = await request(app).post("/chat").set(authHeader(owner.token)).send({
      patient_id: patientId,
      message: "How is the blood pressure trend?",
    });

    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({
      patient_id: patientId,
      provider: "mock",
    });
    expect(typeof reply.body.ai_response).toBe("string");

    const history = await request(app)
      .get(`/patients/${patientId}/chats`)
      .set(authHeader(owner.token));

    expect(history.status).toBe(200);
    expect(history.body.data.length).toBe(2);
    expect(history.body.data[0].role).toBe("user");
    expect(history.body.data[1].role).toBe("assistant");

    const otherUser = await registerAndLogin(app, { name: "Other" });
    const denied = await request(app)
      .get(`/patients/${patientId}/chats`)
      .set(authHeader(otherUser.token));

    expect(denied.status).toBe(404);
  });

  it("returns 502 on AI failure and keeps user message persisted", async () => {
    const owner = await registerAndLogin(app, { name: "Failure Owner" });

    const createPatient = await request(app).post("/patients").set(authHeader(owner.token)).send({
      name: "Failure Patient",
      email: "failure-patient@example.com",
      phone: "+12025550888",
      dob: "1981-01-01",
      medical_notes: "Hypertension",
    });

    expect(createPatient.status).toBe(201);

    const patientId = createPatient.body.id as number;

    const fail = await request(app).post("/chat").set(authHeader(owner.token)).send({
      patient_id: patientId,
      message: "Please fail __fail_ai__",
    });

    expect(fail.status).toBe(502);
    expect(fail.body.error.code).toBe("AI_PROVIDER_ERROR");

    const history = await request(app)
      .get(`/patients/${patientId}/chats`)
      .set(authHeader(owner.token));

    expect(history.status).toBe(200);
    expect(history.body.data.length).toBe(1);
    expect(history.body.data[0].role).toBe("user");
  });
});
