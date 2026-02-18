import { Router } from "express";

import {
  createPatientController,
  deletePatientController,
  getPatientController,
  listPatientsController,
  updatePatientController,
} from "../controllers/patient.controller";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";

export const patientRouter = Router();

patientRouter.use(requireAuth);

patientRouter.post("/patients", asyncHandler(createPatientController));
patientRouter.get("/patients", asyncHandler(listPatientsController));
patientRouter.get("/patients/:id", asyncHandler(getPatientController));
patientRouter.patch("/patients/:id", asyncHandler(updatePatientController));
patientRouter.delete("/patients/:id", asyncHandler(deletePatientController));
