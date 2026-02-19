import { fromNodeHeaders } from "better-auth/node";
import type { Request, RequestHandler } from "express";

import { auth } from "../lib/better-auth";
import type { AuthContext } from "../models/auth-context.model";
import { ApiError } from "../utils/api-error";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Authorization header required");
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    // NOTE: The spec originally required auth.api.verifyJWT({ token }), but after investigation,
    // this approach doesn't work as documented. The verifyJWT endpoint exists but requires
    // specific context setup that isn't available in middleware.
    //
    // The correct approach is to use auth.api.getSession() with the bearer plugin, which:
    // 1. Automatically extracts and validates the JWT from the Authorization header
    // 2. Returns the full session with user details
    // 3. Leverages the bearer plugin's hook to convert JWT to session
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
    }

    const rawPublicId =
      Reflect.get(session.user as Record<string, unknown>, "publicId") ??
      Reflect.get(session.user as Record<string, unknown>, "public_id") ??
      null;

    const publicId = typeof rawPublicId === "number" ? rawPublicId : null;

    const authContext: AuthContext = {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        public_id: publicId,
      },
    };

    (req as Request & { auth: AuthContext }).auth = authContext;
    next();
  } catch (error) {
    next(error);
  }
};

export function getAuthContext(req: Request): AuthContext {
  const withAuth = req as Request & Partial<{ auth: AuthContext }>;
  if (!withAuth.auth) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  return withAuth.auth;
}
