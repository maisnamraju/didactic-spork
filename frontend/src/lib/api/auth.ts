import { apiRequest, isApiClientError } from "@/lib/api/client";
import { tokenStore } from "../auth/token-store";

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

interface AuthResponse {
  token?: string;
  accessToken?: string;
  expiresIn?: number;
  user?: SessionDto["user"];
  session?: SessionDto["session"];
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

function storeTokenFromResponse(response: AuthResponse): void {
  const accessToken = response.token || response.accessToken;
  const expiresIn = response.expiresIn || 900; // Default 15 minutes

  if (accessToken && expiresIn > 0) {
    tokenStore.setTokens({ accessToken, expiresIn });
  }
}

export async function signIn(input: SignInInput): Promise<void> {
  const response = await apiRequest<AuthResponse>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(input),
  });

  storeTokenFromResponse(response);
}

export async function signUp(input: SignUpInput): Promise<void> {
  const response = await apiRequest<AuthResponse>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  });

  storeTokenFromResponse(response);
}

export async function signOut(): Promise<void> {
  try {
    await apiRequest<unknown>("/api/auth/sign-out", {
      method: "POST",
    });
  } finally {
    tokenStore.clearTokens();
  }
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const token = tokenStore.getAccessToken();
    if (!token) {
      return null;
    }

    const response = await apiRequest<SessionDto>("/api/auth/get-session");
    return mapSession(response);
  } catch (error) {
    if (isApiClientError(error) && error.status === 401) {
      tokenStore.clearTokens();
      return null;
    }

    throw error;
  }
}
