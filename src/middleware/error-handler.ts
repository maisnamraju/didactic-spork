import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { logger } from "../lib/logger";
import { ApiError } from "../utils/api-error";

type PrismaLikeError = {
  code?: string;
  meta?: unknown;
};

type BetterAuthLikeError = {
  status?: number;
  body?: {
    code?: string;
    message?: string;
  };
};

export const errorHandlerMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues,
      },
    });
    return;
  }

  const maybePrismaError = error as PrismaLikeError;
  if (maybePrismaError.code === "P2002") {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A unique constraint was violated",
        details: maybePrismaError.meta,
      },
    });
    return;
  }

  const maybeBetterAuthError = error as BetterAuthLikeError;
  if (typeof maybeBetterAuthError.status === "number" && maybeBetterAuthError.body) {
    const code = maybeBetterAuthError.body.code ?? "AUTH_ERROR";
    const message = maybeBetterAuthError.body.message ?? "Authentication error";
    res.status(maybeBetterAuthError.status).json({
      error: {
        code,
        message,
      },
    });
    return;
  }

  logger.error({ err: error }, "Unhandled error");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
