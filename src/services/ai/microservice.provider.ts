import { z } from "zod";

import { env } from "../../config/env";
import type {
  AIProvider,
  GenerateAIResponseInput,
  GenerateAIResponseOutput,
} from "./provider.interface";

const aiServiceResponseSchema = z.object({
  message: z.string().trim().min(1),
  provider: z.string().trim().min(1),
});

const aiServiceErrorSchema = z.object({
  detail: z
    .union([
      z.string(),
      z.object({
        code: z.string().optional(),
        message: z.string().optional(),
      }),
    ])
    .optional(),
});

export class MicroserviceAIProvider implements AIProvider {
  public async generateResponse(input: GenerateAIResponseInput): Promise<GenerateAIResponseOutput> {
    let response: Response;

    try {
      response = await fetch(this.getGenerateUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: input.message,
          patient_context: {
            patient_id: input.patientId,
            patient_name: input.patientName,
            medical_notes: input.medicalNotes,
          },
        }),
        signal: AbortSignal.timeout(env.AI_SERVICE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `AI microservice request failed: ${error instanceof Error ? error.message : "Unknown network error"}`,
      );
    }

    if (!response.ok) {
      const detail = await this.readErrorDetail(response);
      throw new Error(
        detail
          ? `AI microservice returned ${response.status}: ${detail}`
          : `AI microservice returned ${response.status}`,
      );
    }

    const payload = await this.readPayload(response);
    const parsed = aiServiceResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("AI microservice returned an invalid response payload");
    }

    return {
      message: parsed.data.message,
      provider: parsed.data.provider,
    };
  }

  private getGenerateUrl(): string {
    return new URL("/generate", env.AI_SERVICE_URL).toString();
  }

  private async readPayload(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private async readErrorDetail(response: Response): Promise<string | null> {
    const payload = await this.readPayload(response);
    const parsed = aiServiceErrorSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }

    const detail = parsed.data.detail;
    if (!detail) {
      return null;
    }

    if (typeof detail === "string") {
      return detail;
    }

    return detail.message ?? detail.code ?? null;
  }
}
