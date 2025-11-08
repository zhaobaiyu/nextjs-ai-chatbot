import { getMessageByErrorCode } from "@/lib/errors";
import { isGuestModeEnabled } from "@/lib/constants";
import { expect, test } from "../fixtures";
import { generateRandomTestUser } from "../helpers";
import { AuthPage } from "../pages/auth";
import { ChatPage } from "../pages/chat";

// Tests for when ENABLE_GUEST_MODE=true
test.describe
  .serial("Guest Session (Guest Mode Enabled)", () => {
    test.skip(!isGuestModeEnabled, "Guest mode is disabled");

    test("Authenticate as guest user when a new session is loaded", async ({
      page,
    }) => {
      const response = await page.goto("/");

      if (!response) {
        throw new Error("Failed to load page");
      }

      let request: any = response.request();

      const chain: string[] = [];

      while (request) {
        chain.unshift(request.url());
        request = request.redirectedFrom();
      }

      expect(chain).toEqual([
        "http://localhost:3000/",
        "http://localhost:3000/api/auth/guest?redirectUrl=http%3A%2F%2Flocalhost%3A3000%2F",
        "http://localhost:3000/",
      ]);
    });

    test("Log out is not available for guest users", async ({ page }) => {
      await page.goto("/");

      const sidebarToggleButton = page.getByTestId("sidebar-toggle-button");
      await sidebarToggleButton.click();

      const userNavButton = page.getByTestId("user-nav-button");
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();
      const userNavMenu = page.getByTestId("user-nav-menu");
      await expect(userNavMenu).toBeVisible();

      const authMenuItem = page.getByTestId("user-nav-item-auth");
      await expect(authMenuItem).toContainText("Login to your account");
    });

    test("Allow navigating to /login as guest user", async ({ page }) => {
      await page.goto("/login");
      await page.waitForURL("/login");
      await expect(page).toHaveURL("/login");
    });

    test("Allow navigating to /register as guest user", async ({ page }) => {
      await page.goto("/register");
      await page.waitForURL("/register");
      await expect(page).toHaveURL("/register");
    });

    test("Do not show email in user menu for guest user", async ({ page }) => {
      await page.goto("/");

      const sidebarToggleButton = page.getByTestId("sidebar-toggle-button");
      await sidebarToggleButton.click();

      const userEmail = page.getByTestId("user-email");
      await expect(userEmail).toContainText("Guest");
    });

    test("Guest user cannot send more than 20 messages/day", async ({
      page,
    }) => {
      test.fixme();
      const chatPage = new ChatPage(page);
      await chatPage.createNewChat();

      for (let i = 0; i <= 20; i++) {
        await chatPage.sendUserMessage("Why is the sky blue?");
        await chatPage.isGenerationComplete();
      }

      await chatPage.sendUserMessage("Why is the sky blue?");
      await chatPage.expectToastToContain(
        getMessageByErrorCode("rate_limit:chat")
      );
    });
  });

// Tests for when ENABLE_GUEST_MODE=false
test.describe
  .serial("Authentication Required (Guest Mode Disabled)", () => {
    test.skip(isGuestModeEnabled, "Guest mode is enabled");

    test("Redirect to /login when unauthenticated user tries to access home", async ({
      page,
    }) => {
      const response = await page.goto("/");

      if (!response) {
        throw new Error("Failed to load page");
      }

      let request: any = response.request();

      const chain: string[] = [];

      while (request) {
        chain.unshift(request.url());
        request = request.redirectedFrom();
      }

      expect(chain).toEqual([
        "http://localhost:3000/",
        "http://localhost:3000/login",
      ]);
    });

    test("Allow accessing /login page without authentication", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.waitForURL("/login");
      await expect(page).toHaveURL("/login");
    });

    test("Allow accessing /register page without authentication", async ({
      page,
    }) => {
      await page.goto("/register");
      await page.waitForURL("/register");
      await expect(page).toHaveURL("/register");
    });

    test("Do not allow guest API route when guest mode is disabled", async ({
      page,
    }) => {
      await page.goto("/api/auth/guest");

      // Should redirect to login since guest mode is disabled
      // The URL may include callback parameters
      await page.waitForURL(/\/login/);
      await expect(page.url()).toContain("/login");
    });
  });

// Tests that apply regardless of guest mode setting
test.describe
  .serial("Authenticated Session (Both Modes)", () => {
    test("Do not authenticate as guest user when an existing non-guest session is active", async ({
      adaContext,
    }) => {
      const response = await adaContext.page.goto("/");

      if (!response) {
        throw new Error("Failed to load page");
      }

      let request: any = response.request();

      const chain: string[] = [];

      while (request) {
        chain.unshift(request.url());
        request = request.redirectedFrom();
      }

      expect(chain).toEqual(["http://localhost:3000/"]);
    });
  });

test.describe
  .serial("Login and Registration", () => {
    let authPage: AuthPage;

    const testUser = generateRandomTestUser();

    test.beforeEach(({ page }) => {
      authPage = new AuthPage(page);
    });

    test("Register new account", async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain("Account created successfully!");
    });

    test("Register new account with existing email", async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain("Account already exists!");
    });

    test("Log into account that exists", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL("/");
      await expect(page.getByPlaceholder("Send a message...")).toBeVisible();
    });

    test("Display user email in user menu", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL("/");
      await expect(page.getByPlaceholder("Send a message...")).toBeVisible();

      const userEmail = page.getByTestId("user-email");
      await expect(userEmail).toHaveText(testUser.email);
    });

    test("Log out as non-guest user", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      await authPage.openSidebar();

      const userNavButton = page.getByTestId("user-nav-button");
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();
      const userNavMenu = page.getByTestId("user-nav-menu");
      await expect(userNavMenu).toBeVisible();

      const authMenuItem = page.getByTestId("user-nav-item-auth");
      await expect(authMenuItem).toContainText("Sign out");

      await authMenuItem.click();

      // When guest mode is disabled, after logout should redirect to login
      if (!isGuestModeEnabled) {
        await page.waitForURL(/\/login/);
        await expect(page.url()).toContain("/login");
      } else {
        // When guest mode is enabled, after logout should show Guest
        const userEmail = page.getByTestId("user-email");
        await expect(userEmail).toContainText("Guest");
      }
    });

    test("Do not force create a guest session if non-guest session already exists", async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      const userEmail = page.getByTestId("user-email");
      await expect(userEmail).toHaveText(testUser.email);

      await page.goto("/api/auth/guest");
      await page.waitForURL("/");

      const updatedUserEmail = page.getByTestId("user-email");
      await expect(updatedUserEmail).toHaveText(testUser.email);
    });

    test("Log out is available for non-guest users", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      authPage.openSidebar();

      const userNavButton = page.getByTestId("user-nav-button");
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();
      const userNavMenu = page.getByTestId("user-nav-menu");
      await expect(userNavMenu).toBeVisible();

      const authMenuItem = page.getByTestId("user-nav-item-auth");
      await expect(authMenuItem).toContainText("Sign out");
    });

    test("Do not navigate to /register for non-guest users", async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      await page.goto("/register");
      await expect(page).toHaveURL("/");
    });

    test("Do not navigate to /login for non-guest users", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      await page.goto("/login");
      await expect(page).toHaveURL("/");
    });
  });
