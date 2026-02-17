import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasConfiguredTestDatabase, resetDatabase } from "../helpers/db.js";
import { authHeader, createTestApp, registerAndLogin } from "../helpers/test-app.js";

const describeWithDb = hasConfiguredTestDatabase() ? describe : describe.skip;

describeWithDb("Patients e2e", () => {
  const app = createTestApp();

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("supports patient CRUD, owner isolation, pagination, soft delete, and unique constraints", async () => {
    const owner = await registerAndLogin(app, { name: "Owner" });
    const other = await registerAndLogin(app, { name: "Other" });

    const create = await request(app)
      .post("/patients")
      .set(authHeader(owner.token))
      .send({
        name: "Alice Doe",
        email: "alice@example.com",
        phone: "+12025550101",
        dob: "1990-01-01",
        medical_notes: "Diabetes type 2",
      });

    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({
      name: "Alice Doe",
      email: "alice@example.com",
      phone: "+12025550101",
      dob: "1990-01-01",
      medical_notes: "Diabetes type 2",
    });

    const patientId = create.body.id as number;

    const get = await request(app).get(`/patients/${patientId}`).set(authHeader(owner.token));
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(patientId);

    const update = await request(app)
      .patch(`/patients/${patientId}`)
      .set(authHeader(owner.token))
      .send({
        medical_notes: "Updated notes",
      });

    expect(update.status).toBe(200);
    expect(update.body.medical_notes).toBe("Updated notes");

    const denied = await request(app).get(`/patients/${patientId}`).set(authHeader(other.token));
    expect(denied.status).toBe(404);

    const create2 = await request(app)
      .post("/patients")
      .set(authHeader(owner.token))
      .send({
        name: "Bob",
        email: "bob@example.com",
        phone: "+12025550102",
        dob: "1991-02-02",
        medical_notes: "Asthma",
      });

    expect(create2.status).toBe(201);

    const listPage1 = await request(app).get("/patients?limit=1").set(authHeader(owner.token));
    expect(listPage1.status).toBe(200);
    expect(listPage1.body.data.length).toBe(1);
    expect(typeof listPage1.body.next_cursor).toBe("number");

    const listPage2 = await request(app)
      .get(`/patients?limit=1&cursor=${listPage1.body.next_cursor as number}`)
      .set(authHeader(owner.token));

    expect(listPage2.status).toBe(200);
    expect(listPage2.body.data.length).toBe(1);

    const duplicateEmail = await request(app)
      .post("/patients")
      .set(authHeader(owner.token))
      .send({
        name: "Dup Email",
        email: "ALICE@example.com",
        phone: "+12025550103",
        dob: "1992-03-03",
        medical_notes: "n/a",
      });

    expect(duplicateEmail.status).toBe(409);

    const duplicatePhone = await request(app)
      .post("/patients")
      .set(authHeader(owner.token))
      .send({
        name: "Dup Phone",
        email: "dup-phone@example.com",
        phone: "+12025550101",
        dob: "1993-04-04",
        medical_notes: "n/a",
      });

    expect(duplicatePhone.status).toBe(409);

    const del = await request(app).delete(`/patients/${patientId}`).set(authHeader(owner.token));
    expect(del.status).toBe(204);

    const getDeleted = await request(app).get(`/patients/${patientId}`).set(authHeader(owner.token));
    expect(getDeleted.status).toBe(404);

    const chatsDeleted = await request(app)
      .get(`/patients/${patientId}/chats`)
      .set(authHeader(owner.token));
    expect(chatsDeleted.status).toBe(404);
  });

});
