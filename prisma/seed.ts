import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../src/config/env";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("Password123!", env.BCRYPT_SALT_ROUNDS);

  // Create demo user
  const user = await prisma.user.create({
    data: {
      name: "Dr. Demo User",
      email: "demo@teraleads.com",
      emailVerified: true,
    },
  });

  // Create credential account for better-auth
  await prisma.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    },
  });

  console.log(`Created user: ${user.email} (password: Password123!)`);

  // Create patients
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        ownerUserId: user.id,
        name: "Alice Johnson",
        email: "alice.johnson@example.com",
        phone: "+1-555-0101",
        dob: new Date("1985-03-15"),
        medicalNotes: "Annual checkup scheduled. No known allergies. Blood pressure slightly elevated at last visit.",
      },
    }),
    prisma.patient.create({
      data: {
        ownerUserId: user.id,
        name: "Bob Martinez",
        email: "bob.martinez@example.com",
        phone: "+1-555-0102",
        dob: new Date("1972-11-28"),
        medicalNotes: "Type 2 diabetes, managed with metformin. Last A1C: 6.8%. Follow-up in 3 months.",
      },
    }),
    prisma.patient.create({
      data: {
        ownerUserId: user.id,
        name: "Carol Chen",
        email: "carol.chen@example.com",
        phone: "+1-555-0103",
        dob: new Date("1990-07-04"),
        medicalNotes: "Post-operative follow-up after knee arthroscopy. Physical therapy in progress. Recovering well.",
      },
    }),
    prisma.patient.create({
      data: {
        ownerUserId: user.id,
        name: "David Okonkwo",
        email: "david.okonkwo@example.com",
        phone: "+1-555-0104",
        dob: new Date("1968-01-22"),
        medicalNotes: "Hypertension managed with lisinopril 10mg. Cholesterol borderline. Recommended dietary changes.",
      },
    }),
    prisma.patient.create({
      data: {
        ownerUserId: user.id,
        name: "Emily Park",
        email: "emily.park@example.com",
        phone: "+1-555-0105",
        dob: new Date("1995-09-12"),
        medicalNotes: "Seasonal allergies. Prescribed cetirizine as needed. No other conditions.",
      },
    }),
  ]);

  console.log(`Created ${patients.length} patients`);

  // Create some chat messages for the first two patients
  await prisma.chatMessage.createMany({
    data: [
      {
        patientId: patients[0].id,
        ownerUserId: user.id,
        role: "user",
        message: "What medications is Alice currently taking?",
      },
      {
        patientId: patients[0].id,
        ownerUserId: user.id,
        role: "assistant",
        message: "Based on Alice Johnson's records, she has no current medications listed. Her notes mention slightly elevated blood pressure at the last visit, but no prescription was added. You may want to monitor this at the next annual checkup.",
        provider: "mock",
      },
      {
        patientId: patients[1].id,
        ownerUserId: user.id,
        role: "user",
        message: "When is Bob's next follow-up and what should we check?",
      },
      {
        patientId: patients[1].id,
        ownerUserId: user.id,
        role: "assistant",
        message: "Bob Martinez has a follow-up scheduled in 3 months. Key items to review: A1C levels (last was 6.8%), metformin dosage effectiveness, and general diabetes management progress.",
        provider: "mock",
      },
    ],
  });

  console.log("Created chat messages");
  console.log("\nSeed complete! Login with:");
  console.log("  Email:    demo@teraleads.com");
  console.log("  Password: Password123!");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
