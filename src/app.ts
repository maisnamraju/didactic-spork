import express from "express";
import morgan from "morgan";
import helmet from "helmet";

import { env } from "./config/env";
import { authHandler } from "./lib/better-auth";
import { errorHandlerMiddleware } from "./middleware/error-handler";
import { notFoundMiddleware } from "./middleware/not-found";
import { requestIdMiddleware } from "./middleware/request-id";
import { apiRouter } from "./routes/index";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(helmet());

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
