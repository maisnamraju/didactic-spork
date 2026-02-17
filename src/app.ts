import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authHandler } from "./lib/better-auth.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);

  app.all(/^\/api\/auth(\/.*)?$/, authHandler);

  app.use(requestIdMiddleware);

  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use(express.json({ limit: "1mb" }));

  app.use(apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
