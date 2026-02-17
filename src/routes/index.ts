import { Router } from "express";
import { chatRouter } from "./chat.routes.js";
import { mailRouter } from "./mail.routes.js";
import { patientRouter } from "./patient.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

apiRouter.use(patientRouter);
apiRouter.use(chatRouter);
apiRouter.use(mailRouter);
