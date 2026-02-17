import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

export const notFoundMiddleware: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", "Resource not found"));
};
