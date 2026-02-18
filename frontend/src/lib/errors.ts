import { isApiClientError } from "@/lib/api/client";

const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Please review the form values and try again.",
  CONFLICT: "A record with the same unique value already exists.",
  AI_PROVIDER_ERROR: "The AI provider could not respond right now. Please try again.",
  UNAUTHORIZED: "Your session expired. Please sign in again.",
};

export function getErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
): string {
  if (isApiClientError(error)) {
    const mapped = CODE_MESSAGES[error.code];
    if (mapped) {
      return mapped;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
