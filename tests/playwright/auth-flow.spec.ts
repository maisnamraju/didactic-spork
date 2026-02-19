import { expect, test } from "@playwright/test";

const DEMO_EMAIL = "demo@teraleads.com";
const DEMO_PASSWORD = "Password123!";

test.describe("Sign In", () => {
  test("redirects to dashboard on successful sign-in", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByText("Patients")).toBeVisible();
  });

  test("stores JWT and sends Authorization header on API calls", async ({ page }) => {
    await page.goto("/sign-in");

    const tokenResponse = page.waitForResponse(
      (res) => res.url().includes("/api/auth/token") && res.status() === 200,
    );

    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    const res = await tokenResponse;
    const body = await res.json();
    expect(body.token || body.accessToken).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    const apiReq = await page.waitForRequest(
      (req) => req.url().includes("/patients") && req.method() === "GET",
    );
    expect(apiReq.headers()["authorization"]).toMatch(/^Bearer .+/);
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill("WrongPassword999!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator("[class*=destructive]")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Sign Up", () => {
  test("shows email verification message after registration", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/sign-up");

    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Check your email")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("does not redirect to dashboard", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/sign-up");

    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Check your email")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign-up/);
  });
});

test.describe("Protected Routes", () => {
  test("unauthenticated user is redirected to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });
  });

  test("sign out clears session and redirects", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.getByRole("button", { name: /sign out|log out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });
  });
});
