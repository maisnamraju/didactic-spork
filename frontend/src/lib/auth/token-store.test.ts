import { describe, it, expect, beforeEach } from "vitest";
import { tokenStore } from "./token-store";

describe("TokenStore", () => {
  beforeEach(() => {
    tokenStore.clearTokens();
  });

  it("should store and retrieve access token", () => {
    tokenStore.setTokens({
      accessToken: "test-access-token",
      expiresIn: 900,
    });

    expect(tokenStore.getAccessToken()).toBe("test-access-token");
  });

  it("should return null when no token is stored", () => {
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("should clear tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: 900,
    });

    tokenStore.clearTokens();

    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("should detect expired tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: -1, // Already expired
    });

    expect(tokenStore.isTokenExpired()).toBe(true);
  });

  it("should detect valid tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: 900, // 15 minutes
    });

    expect(tokenStore.isTokenExpired()).toBe(false);
  });
});
