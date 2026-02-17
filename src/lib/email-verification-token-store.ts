const verificationTokenByEmail = new Map<string, string>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function captureEmailVerificationToken(email: string, token: string): void {
  verificationTokenByEmail.set(normalizeEmail(email), token);
}

export function consumeEmailVerificationToken(email: string): string | null {
  const normalizedEmail = normalizeEmail(email);
  const token = verificationTokenByEmail.get(normalizedEmail) ?? null;

  if (token) {
    verificationTokenByEmail.delete(normalizedEmail);
  }

  return token;
}

export function clearEmailVerificationTokens(): void {
  verificationTokenByEmail.clear();
}
