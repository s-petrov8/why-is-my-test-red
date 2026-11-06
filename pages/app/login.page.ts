import { expect, Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ApiEndpoints, Messages, Routes } from '../../enums/app/app';

/**
 * Page Object for the login page.
 *
 * All locators were verified against the live application with `playwright-cli`.
 * The username and password inputs expose their accessible name via their
 * `placeholder` attribute -- the `<label>` elements are not associated with the
 * inputs, so `getByLabel()` matches nothing and `getByRole('textbox')` is both
 * the priority-correct and the only working strategy.
 */
export class LoginPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'Login' });
    }

    get companyBranding(): Locator {
        return this.page.getByRole('img', { name: 'company-branding' });
    }

    get usernameInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Username' });
    }

    get passwordInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Password' });
    }

    get loginButton(): Locator {
        return this.page.getByRole('button', { name: 'Login' });
    }

    // ==================== Feedback Locators ====================

    get errorAlert(): Locator {
        return this.page.getByRole('alert');
    }

    get invalidCredentialsMessage(): Locator {
        return this.errorAlert.getByText(Messages.LOGIN_FAILED);
    }

    // ==================== Actions ====================

    /**
     * Navigates to the login page.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openLoginPage(): Promise<void> {
        await this.page.goto(`${appConfig.appUrl}${Routes.LOGIN}`, {
            waitUntil: 'domcontentloaded',
        });
    }

    /**
     * Fills the credentials, submits the form, and waits for the login request
     * to resolve. Makes no assertion about the outcome -- the request is issued
     * for both accepted and rejected credentials, so this method serves the
     * happy path and the invalid-credentials path alike.
     *
     * @param {string} username - The user's username.
     * @param {string} password - The user's password.
     * @returns {Promise<void>} Resolves when the login request completes.
     *
     * @example
     * ```ts
     * await loginPage.login('wrong', 'wrong');
     * await expect(loginPage.invalidCredentialsMessage).toBeVisible();
     * ```
     */
    async login(username: string, password: string): Promise<void> {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);

        await Promise.all([
            this.page.waitForResponse(
                (response) =>
                    response.url().includes(ApiEndpoints.AUTH_VALIDATE) &&
                    response.request().method() === 'POST'
            ),
            this.loginButton.click(),
        ]);
    }

    /**
     * Logs in and verifies the attempt succeeded by asserting the browser
     * landed on the dashboard. Use this when the login is expected to pass.
     *
     * @param {string} username - The user's username.
     * @param {string} password - The user's password.
     * @returns {Promise<void>} Resolves once the dashboard URL is reached.
     *
     * @example
     * ```ts
     * const env = getEnv();
     * await loginPage.loginAndVerify(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
     * ```
     */
    async loginAndVerify(username: string, password: string): Promise<void> {
        await this.login(username, password);

        await expect(this.page).toHaveURL(
            `${appConfig.appUrl}${Routes.DASHBOARD}`
        );
    }
}
