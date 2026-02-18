import { env } from "../../config/env";
import { MicroserviceAIProvider } from "./microservice.provider";
import { MockAIProvider } from "./mock.provider";
import type { AIProvider } from "./provider.interface";

export function createAIProvider(): AIProvider {
  if (env.AI_PROVIDER === "mock") {
    return new MockAIProvider();
  }

  return new MicroserviceAIProvider();
}
