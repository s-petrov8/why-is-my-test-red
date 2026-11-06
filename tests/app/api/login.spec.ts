import { appConfig } from '../../../config/app';
import { getEnv } from '../../../config/env';
import { ANONYMOUS_STORAGE_STATE } from '../../../config/util/util';
import { ApiEndpoints, Routes } from '../../../enums/app/app';
import {
    SessionExpiredResponse,
    SessionExpiredResponseSchema,
} from '../../../fixtures/api/schemas/app/errorSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { extractCsrfToken } from '../../../helpers/app/createStorageState';
import {
    EMPTY_LOGIN_ATTEMPT,
    INVALID_LOGIN_ATTEMPTS,
} from '../../../test-data/static/app/invalidCredentials';

// URLs come from `appConfig`; credentials stay out of the config objects and are
// read from the validated environment directly.
const env = getEnv();

test.describe('api/login', () => {
    // Login has to be exercised anonymously. The chromium project applies the
    // authenticated storage state to the request context as well, and an
    // authenticated GET of the login page redirects straight to the dashboard
    // without ever rendering a CSRF token.
    //
    // An explicit empty state is required here -- `storageState: undefined` reads
    // as "no override" and silently inherits the project's authenticated state.
    test.use({ storageState: ANONYMOUS_STORAGE_STATE });

    test(
        'should serve the login page with a CSRF token',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest<string>({
                method: 'GET',
                url: Routes.LOGIN,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            expect(extractCsrfToken(body)).toBeTruthy();
        }
    );

    test(
        'should redirect to the dashboard for valid credentials',
        { tag: '@api' },
        async ({ apiRequest }) => {
            let token = '';

            await test.step('GIVEN a CSRF token issued by the login page', async () => {
                const { status, body } = await apiRequest<string>({
                    method: 'GET',
                    url: Routes.LOGIN,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                token = extractCsrfToken(body);
            });

            await test.step('WHEN the valid credentials are submitted', async () => {
                const { status, headers } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.AUTH_VALIDATE,
                    baseUrl: appConfig.apiUrl,
                    form: {
                        _token: token,
                        username: env.ADMIN_USERNAME,
                        password: env.ADMIN_PASSWORD,
                    },
                    maxRedirects: 0,
                });

                // A rejected login answers 302 as well, so the redirect target --
                // not the status -- is what proves the credentials were accepted.
                expect(status).toBe(302);
                expect(headers['location']).toContain(Routes.DASHBOARD);
            });
        }
    );

    for (const { description, username, password } of [
        ...INVALID_LOGIN_ATTEMPTS,
        EMPTY_LOGIN_ATTEMPT,
    ]) {
        test(
            `should redirect back to login for invalid credentials - ${description}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                let token = '';

                await test.step('GIVEN a CSRF token issued by the login page', async () => {
                    const { status, body } = await apiRequest<string>({
                        method: 'GET',
                        url: Routes.LOGIN,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status).toBe(200);
                    token = extractCsrfToken(body);
                });

                await test.step(`WHEN invalid credentials are submitted - username: "${username}"`, async () => {
                    const { status, headers } = await apiRequest({
                        method: 'POST',
                        url: ApiEndpoints.AUTH_VALIDATE,
                        baseUrl: appConfig.apiUrl,
                        form: {
                            _token: token,
                            username,
                            password,
                        },
                        maxRedirects: 0,
                    });

                    expect(status).toBe(302);
                    expect(headers['location']).toContain(Routes.LOGIN);
                });
            }
        );
    }

    test(
        'should return 401 for an API request without a session',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest<SessionExpiredResponse>({
                method: 'GET',
                url: ApiEndpoints.PIM_EMPLOYEES,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(401);
            expect(SessionExpiredResponseSchema.parse(body)).toBeTruthy();
        }
    );
});
