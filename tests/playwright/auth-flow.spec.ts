import { test, expect } from "@playwright/test";

const TEST_EMAIL = "demo@teraleads.com";
const TEST_PASSWORD = "Password123!";

test.describe("JWT Auth Flow", () => {
  test("sign in redirects to dashboard", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByText("Patients")).toBeVisible();
  });

  test("unauthenticated user is redirected to sign-in", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });
  });

  test("sign in stores JWT and uses it for API calls", async ({ page }) => {
    await page.goto("/sign-in");

    // Watch for the token request
    const tokenRequest = page.waitForResponse(
      (res) => res.url().includes("/api/auth/token") && res.status() === 200,
    );

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Verify token endpoint was called after sign-in
    const tokenResponse = await tokenRequest;
    const tokenBody = await tokenResponse.json();
    expect(tokenBody.token || tokenBody.accessToken).toBeTruthy();

    // Verify we land on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Verify subsequent API calls include Authorization header
    const apiRequest = page.waitForRequest(
      (req) => req.url().includes("/patients") && req.method() === "GET",
    );

    const req = await apiRequest;
    const authHeader = req.headers()["authorization"];
    expect(authHeader).toMatch(/^Bearer .+/);
  });

  test("sign out clears session and redirects to sign-in", async ({ page }) => {
    // Sign in first
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Sign out
    await page.getByRole("button", { name: /sign out|log out/i }).click();

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });

    // Verify we can't go back to dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });
  });
});
