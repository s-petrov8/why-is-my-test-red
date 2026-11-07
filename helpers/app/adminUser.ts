import { expect, request } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ANONYMOUS_STORAGE_STATE } from '../../config/util/util';
import { ApiEndpoints, Routes, UserRoleIds } from '../../enums/app/app';
import type { ApiRequestFn } from '../../fixtures/api/api-types';
import { createUserUpdateData } from '../../test-data/factories/app/user.factory';
import { extractCsrfToken } from './createStorageState';
import type { TempUser } from './tempUser';

/** Matches the login page's `:error` prop, which holds why a sign-in was refused. */
const LOGIN_ERROR_PATTERN = /:error="(.+?)"/;

/** How a sign-in attempt ended. */
export type SignInAttempt = {
    /** Where the application redirected the attempt. */
    location: string;
    /** The reason the login page gives, when it gives one. */
    message: string | undefined;
};

/**
 * Edits a throwaway person's account, leaving its password as it is. Never use this
 * on `Admin`: any edit ends the session the whole suite shares.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {TempUser} user - The person whose account changes.
 * @param {object} values - The account's values after the edit.
 * @param {boolean} values.status - Whether the account is enabled.
 * @param {UserRoleIds} values.userRoleId - The account's role.
 * @returns {Promise<void>} Resolves once the edit is saved.
 */
export async function updateAccount(
    api: ApiRequestFn,
    user: TempUser,
    values: { status: boolean; userRoleId: UserRoleIds }
): Promise<void> {
    const { status, body } = await api({
        method: 'PUT',
        url: `${ApiEndpoints.ADMIN_USERS}/${user.userId}`,
        baseUrl: appConfig.apiUrl,
        body: createUserUpdateData({
            username: user.username,
            empNumber: user.empNumber,
            ...values,
        }),
    });

    expect(status, JSON.stringify(body)).toBe(200);
}

/**
 * Reads why the login page says a person was refused or signed out. The application
 * keeps the reason until a login page shows it, once.
 *
 * @param {string} html - The raw HTML of the login page.
 * @returns {string | undefined} The reason, when the page gives one.
 */
export function readLoginMessage(html: string): string | undefined {
    const error = LOGIN_ERROR_PATTERN.exec(html)?.[1];

    return error
        ? (JSON.parse(error.replaceAll('&quot;', '"')) as { message: string })
              .message
        : undefined;
}

/**
 * Tries to sign in over HTTP, from a session of its own, and reports the outcome.
 *
 * A refused sign-in answers the same 302 to the login page whatever the reason, and
 * only the login page it redirects to names the reason.
 *
 * @param {TempUser} user - Whose credentials to submit.
 * @returns {Promise<SignInAttempt>} Where the attempt was redirected, and the reason given.
 */
export async function attemptSignIn(user: TempUser): Promise<SignInAttempt> {
    const context = await request.newContext({
        baseURL: appConfig.appUrl,
        storageState: ANONYMOUS_STORAGE_STATE,
    });

    try {
        const loginPage = await context.get(Routes.LOGIN);
        const loginHtml = await loginPage.text();
        expect(loginPage.status(), loginHtml).toBe(200);

        const validation = await context.post(ApiEndpoints.AUTH_VALIDATE, {
            form: {
                _token: extractCsrfToken(loginHtml),
                username: user.username,
                password: user.password,
            },
            maxRedirects: 0,
        });
        expect(validation.status(), await validation.text()).toBe(302);

        const location = validation.headers()['location'];
        const landing = await context.get(location);

        return { location, message: readLoginMessage(await landing.text()) };
    } finally {
        await context.dispose();
    }
}
