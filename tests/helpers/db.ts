import { clearEmailVerificationTokens } from "../../src/lib/email-verification-token-store";
import { prisma } from "../../src/lib/prisma";

export function hasConfiguredTestDatabase(): boolean {
  return process.env.RUN_E2E === "true" && Boolean(process.env.TEST_DATABASE_URL);
}

export async function resetDatabase(): Promise<void> {
  clearEmailVerificationTokens();
  await prisma.chatMessage.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.jwks.deleteMany();
  await prisma.user.deleteMany();
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
