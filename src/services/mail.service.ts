import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

function mapAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function mapAcceptedRecipients(result: { accepted?: unknown; envelope?: { to?: unknown } }): string[] {
  const accepted = mapAddressList(result.accepted);
  if (accepted.length > 0) {
    return accepted;
  }

  return mapAddressList(result.envelope?.to);
}

export class MailService {
  private readonly transporter =
    env.MAIL_TRANSPORT === "json"
      ? nodemailer.createTransport({
          jsonTransport: true,
        })
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          ...(env.SMTP_USER && env.SMTP_PASS
            ? {
                auth: {
                  user: env.SMTP_USER,
                  pass: env.SMTP_PASS,
                },
              }
            : {}),
        });

  public async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const result = await this.transporter.sendMail({
        from: {
          name: env.MAIL_FROM_NAME,
          address: env.MAIL_FROM,
        },
        to: input.to,
        subject: input.subject,
        ...(input.text ? { text: input.text } : {}),
        ...(input.html ? { html: input.html } : {}),
      });

      return {
        messageId: result.messageId,
        accepted: mapAcceptedRecipients(result),
        rejected: mapAddressList(result.rejected),
      };
    } catch (error) {
      throw new ApiError(502, "EMAIL_SEND_FAILED", "Failed to send email", {
        reason: error instanceof Error ? error.message : "Unknown email transport error",
      });
    }
  }
}
