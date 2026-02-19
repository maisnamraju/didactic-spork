import type { ApiErrorPayload } from "@/lib/types/api";
import { tokenStore } from "../auth/token-store";

type UnauthorizedHandler = (error: ApiClientError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toApiClientError(status: number, payload: unknown): ApiClientError {
  if (payload && typeof payload === "object" && "error" in payload) {
    const parsedPayload = payload as ApiErrorPayload;
    const code =
      typeof parsedPayload.error.code === "string"
        ? parsedPayload.error.code
        : "REQUEST_FAILED";
    const message =
      typeof parsedPayload.error.message === "string"
        ? parsedPayload.error.message
        : "Request failed";

    return new ApiClientError({
      status,
      code,
      message,
      details: parsedPayload.error.details,
    });
  }

  return new ApiClientError({
    status,
    code: `HTTP_${status}`,
    message: "Request failed",
  });
}

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return false;

      const body = await res.json();
      const accessToken = body.token || body.accessToken;
      const expiresIn = body.expiresIn || 900;

      if (!accessToken) return false;

      tokenStore.setTokens({ accessToken, expiresIn });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");

  if (
    init?.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  const token = tokenStore.getAccessToken();
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const newToken = tokenStore.getAccessToken();
      if (newToken) {
        headers.set("authorization", `Bearer ${newToken}`);
      }

      const retryResponse = await fetch(path, {
        ...init,
        headers,
        credentials: "include",
      });

      const retryPayload = await parseJson(retryResponse);

      if (!retryResponse.ok) {
        const error = toApiClientError(retryResponse.status, retryPayload);
        if (retryResponse.status === 401) {
          unauthorizedHandler?.(error);
        }
        throw error;
      }

      return retryPayload as T;
    }

    const payload = await parseJson(response);
    const error = toApiClientError(response.status, payload);
    unauthorizedHandler?.(error);
    throw error;
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    throw toApiClientError(response.status, payload);
  }

  return payload as T;
}
