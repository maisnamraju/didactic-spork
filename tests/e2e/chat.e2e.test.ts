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

  describe("Chat Page Navigation API Tests", () => {
    // Note: These tests verify the API endpoints that support chat page navigation.
    // Full E2E tests with browser automation (Playwright/Cypress) would additionally test:
    // - Clicking the chat button from dashboard navigates to /chat/:patientId
    // - Back button navigation returns to dashboard
    // - URL changes and browser history management
    // - Frontend route guards and redirects
    // - Loading states during navigation
    // - Error states when patient doesn't exist

    it("simulates dashboard to chat page navigation flow", async () => {
      const owner = await registerAndLogin(app, { name: "Nav Owner" });

      const createPatient = await request(app).post("/patients").set(authHeader(owner.token)).send({
        name: "Nav Patient",
        email: "nav-patient@example.com",
        phone: "+12025550777",
        dob: "1990-05-15",
        medical_notes: "Regular checkups",
      });

      expect(createPatient.status).toBe(201);
      const patientId = createPatient.body.id as number;

      const getPatient = await request(app)
        .get(`/patients/${patientId}`)
        .set(authHeader(owner.token));

      expect(getPatient.status).toBe(200);
      expect(getPatient.body.id).toBe(patientId);
      expect(getPatient.body.name).toBe("Nav Patient");

      const getChatHistory = await request(app)
        .get(`/patients/${patientId}/chats`)
        .set(authHeader(owner.token));

      expect(getChatHistory.status).toBe(200);
      expect(getChatHistory.body.data).toEqual([]);
    });

    it("prevents unauthorized access to chat page data", async () => {
      const owner = await registerAndLogin(app, { name: "Chat Page Owner" });
      const unauthorized = await registerAndLogin(app, { name: "Unauthorized User" });

      const createPatient = await request(app).post("/patients").set(authHeader(owner.token)).send({
        name: "Private Patient",
        email: "private-patient@example.com",
        phone: "+12025550666",
        dob: "1985-03-20",
        medical_notes: "Private medical info",
      });

      expect(createPatient.status).toBe(201);
      const patientId = createPatient.body.id as number;

      const unauthorizedPatientAccess = await request(app)
        .get(`/patients/${patientId}`)
        .set(authHeader(unauthorized.token));

      expect(unauthorizedPatientAccess.status).toBe(404);

      const unauthorizedChatAccess = await request(app)
        .get(`/patients/${patientId}/chats`)
        .set(authHeader(unauthorized.token));

      expect(unauthorizedChatAccess.status).toBe(404);
    });

    it("loads existing chat history when navigating to chat page", async () => {
      const owner = await registerAndLogin(app, { name: "History Owner" });

      const createPatient = await request(app).post("/patients").set(authHeader(owner.token)).send({
        name: "History Patient",
        email: "history-patient@example.com",
        phone: "+12025550555",
        dob: "1992-07-10",
        medical_notes: "Follow-up needed",
      });

      expect(createPatient.status).toBe(201);
      const patientId = createPatient.body.id as number;

      await request(app).post("/chat").set(authHeader(owner.token)).send({
        patient_id: patientId,
        message: "First message",
      });

      await request(app).post("/chat").set(authHeader(owner.token)).send({
        patient_id: patientId,
        message: "Second message",
      });

      const history = await request(app)
        .get(`/patients/${patientId}/chats`)
        .set(authHeader(owner.token));

      expect(history.status).toBe(200);
      expect(history.body.data.length).toBe(4);
      expect(history.body.data[0].role).toBe("user");
      expect(history.body.data[0].content).toBe("First message");
      expect(history.body.data[1].role).toBe("assistant");
      expect(history.body.data[2].role).toBe("user");
      expect(history.body.data[2].content).toBe("Second message");
      expect(history.body.data[3].role).toBe("assistant");
    });
  });
});
