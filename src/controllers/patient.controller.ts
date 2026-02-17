import type { RequestHandler } from "express";
import { getAuthContext } from "../middleware/require-auth.js";
import { PatientService } from "../services/patient.service.js";
import { mapPatientToResponse } from "../utils/mapper.js";
import {
  createPatientBodySchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
  updatePatientBodySchema,
} from "../validators/patient.validator.js";

const patientService = new PatientService();

export const createPatientController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const body = createPatientBodySchema.parse(req.body);

  const patient = await patientService.create(auth.user.id, body);

  res.status(201).json(mapPatientToResponse(patient));
};

export const listPatientsController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const query = listPatientsQuerySchema.parse(req.query);

  const result = await patientService.list(auth.user.id, query);

  res.json({
    data: result.data.map(mapPatientToResponse),
    next_cursor: result.next_cursor,
  });
};

export const getPatientController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const params = patientIdParamSchema.parse(req.params);

  const patient = await patientService.getById(auth.user.id, params.id);

  res.json(mapPatientToResponse(patient));
};

export const updatePatientController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const params = patientIdParamSchema.parse(req.params);
  const body = updatePatientBodySchema.parse(req.body);

  const patient = await patientService.update(auth.user.id, params.id, body);

  res.json(mapPatientToResponse(patient));
};

export const deletePatientController: RequestHandler = async (req, res) => {
  const auth = getAuthContext(req);
  const params = patientIdParamSchema.parse(req.params);

  await patientService.softDelete(auth.user.id, params.id);

  res.status(204).send();
};
