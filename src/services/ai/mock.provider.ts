import { env } from "../../config/env";
import type {
  AIProvider,
  GenerateAIResponseInput,
  GenerateAIResponseOutput,
} from "./provider.interface";

export class MockAIProvider implements AIProvider {
  public async generateResponse(input: GenerateAIResponseInput): Promise<GenerateAIResponseOutput> {
    if (input.message.includes(env.AI_MOCK_FAIL_KEY)) {
      throw new Error("Mock AI provider failure requested");
    }

    const response = `Mock reply for ${input.patientName}: received \"${input.message}\".`;

    return {
      message: response,
      provider: "mock",
    };
  }
}
