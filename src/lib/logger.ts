import pino from "pino";

import { env } from "../config/env";

const level = env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL;

export const logger = pino({
  level,
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});
