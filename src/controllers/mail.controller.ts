import type { RequestHandler } from "express";

import { MailService } from "../services/mail.service";
import { sendEmailBodySchema } from "../validators/mail.validator";

const mailService = new MailService();

export const sendEmailController: RequestHandler = async (req, res) => {
  const body = sendEmailBodySchema.parse(req.body);
  const result = await mailService.send(body);

  res.status(202).json({
    message_id: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  });
};
