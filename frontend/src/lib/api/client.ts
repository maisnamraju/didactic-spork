import type { ApiErrorPayload } from "@/lib/types/api";

type UnauthorizedHandler = (error: ApiClientError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

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

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const error = toApiClientError(response.status, payload);

    if (response.status === 401) {
      unauthorizedHandler?.(error);
    }

    throw error;
  }

  return payload as T;
}
