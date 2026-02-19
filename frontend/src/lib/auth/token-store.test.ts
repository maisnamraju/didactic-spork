import { describe, it, expect, beforeEach } from "vitest";
import { TokenStore } from "./token-store";

describe("TokenStore", () => {
  let store: TokenStore;

  beforeEach(() => {
    store = new TokenStore();
  });

  it("should store and retrieve access token", () => {
    store.setTokens({
      accessToken: "test-access-token",
      expiresIn: 900,
    });

    expect(store.getAccessToken()).toBe("test-access-token");
  });

  it("should return null when no token is stored", () => {
    expect(store.getAccessToken()).toBeNull();
  });

  it("should clear tokens", () => {
    store.setTokens({
      accessToken: "test-token",
      expiresIn: 900,
    });

    store.clearTokens();

    expect(store.getAccessToken()).toBeNull();
  });

  it("should detect expired tokens", () => {
    store.setTokens({
      accessToken: "test-token",
      expiresIn: 1, // 1 second - will expire with 5s buffer
    });

    expect(store.isTokenExpired()).toBe(true);
  });

  it("should detect valid tokens", () => {
    store.setTokens({
      accessToken: "test-token",
      expiresIn: 900, // 15 minutes
    });

    expect(store.isTokenExpired()).toBe(false);
  });

  it("should return null and auto-clear expired token", () => {
    store.setTokens({
      accessToken: "test-token",
      expiresIn: 1, // 1 second - will expire with 5s buffer
    });

    expect(store.getAccessToken()).toBeNull();
  });

  it("should reject empty access token", () => {
    expect(() => {
      store.setTokens({ accessToken: "", expiresIn: 900 });
    }).toThrow("Access token cannot be empty");
  });

  it("should reject whitespace-only access token", () => {
    expect(() => {
      store.setTokens({ accessToken: "   ", expiresIn: 900 });
    }).toThrow("Access token cannot be empty");
  });

  it("should reject negative expiresIn", () => {
    expect(() => {
      store.setTokens({ accessToken: "token", expiresIn: -1 });
    }).toThrow("expiresIn must be positive");
  });

  it("should reject zero expiresIn", () => {
    expect(() => {
      store.setTokens({ accessToken: "token", expiresIn: 0 });
    }).toThrow("expiresIn must be positive");
  });
});
