import { Router } from "express";

import { chatRouter } from "./chat.routes";
import { mailRouter } from "./mail.routes";
import { patientRouter } from "./patient.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

apiRouter.use(patientRouter);
apiRouter.use(chatRouter);
apiRouter.use(mailRouter);
