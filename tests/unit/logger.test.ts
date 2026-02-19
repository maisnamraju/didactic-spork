import { describe, expect, it } from "vitest";

import { logger } from "../../src/lib/logger";

describe("logger", () => {
  it("exports a pino logger instance", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("is silent in test environment", () => {
    expect(logger.level).toBe("silent");
  });

  it("has a child logger factory", () => {
    const child = logger.child({ module: "test" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });
});
