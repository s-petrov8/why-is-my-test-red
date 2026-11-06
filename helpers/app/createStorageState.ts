import { APIRequestContext, expect, request } from '@playwright/test';
import { appConfig } from '../../config/app';
import { getEnv } from '../../config/env';
import { ANONYMOUS_STORAGE_STATE } from '../../config/util/util';
import { ApiEndpoints, Routes, StorageStatePaths } from '../../enums/app/app';

// URLs come from `appConfig`; credentials stay out of the config objects and are
// read from the validated environment directly.
const env = getEnv();

/**
 * Matches the CSRF token in the login page markup.
 */
const CSRF_TOKEN_PATTERN = /:token="&quot;(.+?)&quot;"/;

/**
 * Extracts the CSRF token from login page markup.
 *
 * @param {string} html - The raw HTML of the login page.
 * @returns {string} The CSRF token to submit alongside the credentials.
 * @throws {Error} If no token is present, which means the markup has changed.
 */
export function extractCsrfToken(html: string): string {
    const token = CSRF_TOKEN_PATTERN.exec(html)?.[1];

    if (!token) {
        throw new Error(
            `CSRF token not found on ${Routes.LOGIN}. The login page markup has likely changed.`
        );
    }

    return token;
}

/**
 * Logs in over HTTP and returns the authenticated request context.
 *
 * No browser is launched -- the application authenticates purely via its session
 * cookie, so two requests replace a full browser start-up and keep authentication
 * independent of the login page's selectors.
 *
 * The caller owns the returned context and must `dispose()` it.
 *
 * @param {object} [credentials] - Who to sign in as. Defaults to the administrator.
 * @param {string} credentials.username - Username to submit.
 * @param {string} credentials.password - Password to submit.
 * @returns {Promise<APIRequestContext>} An authenticated request context.
 * @throws {Error} If the CSRF token cannot be found in the login page markup.
 */
export async function createAuthenticatedContext(credentials?: {
    username: string;
    password: string;
}): Promise<APIRequestContext> {
    const { username, password } = credentials ?? {
        username: env.ADMIN_USERNAME,
        password: env.ADMIN_PASSWORD,
    };

    const context = await request.newContext({
        baseURL: appConfig.appUrl,
        // Start anonymous. `request.newContext()` inherits the project's
        // `use.storageState`, and an already-authenticated context redirects the
        // login page to the dashboard, which carries no CSRF token.
        storageState: ANONYMOUS_STORAGE_STATE,
    });

    try {
        const loginPage = await context.get(Routes.LOGIN);
        expect(loginPage.status()).toBe(200);

        const token = extractCsrfToken(await loginPage.text());

        const validation = await context.post(ApiEndpoints.AUTH_VALIDATE, {
            form: { _token: token, username, password },
            maxRedirects: 0,
        });

        // A rejected login also answers 302 -- redirecting back to the login page --
        // so the redirect target, not the status, is what proves authentication.
        expect(validation.status()).toBe(302);
        expect(validation.headers()['location']).toContain(Routes.DASHBOARD);

        return context;
    } catch (error) {
        await context.dispose();
        throw error;
    }
}

/**
 * Submits credentials the application is expected to refuse, and reads the login
 * page it redirects back to, which carries the reason for the refusal.
 *
 * @param {object} credentials - Who tries to sign in.
 * @param {string} credentials.username - Username to submit.
 * @param {string} credentials.password - Password to submit.
 * @returns {Promise<string>} The markup of the login page after the refusal.
 */
export async function readSignInRefusal(credentials: {
    username: string;
    password: string;
}): Promise<string> {
    const { username, password } = credentials;
    const context = await request.newContext({
        baseURL: appConfig.appUrl,
        storageState: ANONYMOUS_STORAGE_STATE,
    });

    try {
        const loginPage = await context.get(Routes.LOGIN);
        expect(loginPage.status()).toBe(200);

        const validation = await context.post(ApiEndpoints.AUTH_VALIDATE, {
            form: {
                _token: extractCsrfToken(await loginPage.text()),
                username,
                password,
            },
            maxRedirects: 0,
        });

        expect(validation.status()).toBe(302);
        expect(validation.headers()['location']).toContain(Routes.LOGIN);

        const refusalPage = await context.get(Routes.LOGIN);
        expect(refusalPage.status()).toBe(200);

        return await refusalPage.text();
    } finally {
        await context.dispose();
    }
}

/**
 * Creates and saves the browser storage state for an authenticated session.
 * This is used for authentication setup before running tests.
 *
 * @returns {Promise<void>} Resolves when storage state is saved.
 */
export async function createAppStorageState(): Promise<void> {
    const context = await createAuthenticatedContext();

    try {
        await context.storageState({ path: StorageStatePaths.APP });
    } finally {
        await context.dispose();
    }
}
