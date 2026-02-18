import { apiRequest, isApiClientError } from "@/lib/api/client";

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
}

interface SessionDto {
  user?: {
    id: string;
    email: string;
    name: string;
    publicId?: number | null;
    public_id?: number | null;
  } | null;
  session?: {
    expiresAt?: string | null;
  } | null;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    publicId: number | null;
  };
  expiresAt: string | null;
}

function mapSession(session: SessionDto | null): AuthSession | null {
  if (!session?.user) {
    return null;
  }

  const rawPublicId = session.user.publicId ?? session.user.public_id ?? null;
  const publicId = typeof rawPublicId === "number" ? rawPublicId : null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      publicId,
    },
    expiresAt: session.session?.expiresAt ?? null,
  };
}

export async function signIn(input: SignInInput): Promise<void> {
  await apiRequest<unknown>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function signUp(input: SignUpInput): Promise<void> {
  await apiRequest<unknown>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function signOut(): Promise<void> {
  await apiRequest<unknown>("/api/auth/sign-out", {
    method: "POST",
  });
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    console.log("[Auth] Fetching session from API");
    const response = await apiRequest<SessionDto>("/api/auth/get-session");
    console.log("[Auth] Raw session response:", response);
    const mapped = mapSession(response);
    console.log("[Auth] Mapped session:", mapped);
    return mapped;
  } catch (error) {
    console.error("[Auth] Error fetching session:", error);
    if (isApiClientError(error) && error.status === 401) {
      console.log("[Auth] 401 error, returning null");
      return null;
    }

    throw error;
  }
}
