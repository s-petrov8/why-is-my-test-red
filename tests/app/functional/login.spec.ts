import { getEnv } from '../../../config/env';
import { expect, test } from '../../../fixtures/pom/test-options';
import { INVALID_LOGIN_ATTEMPTS } from '../../../test-data/static/app/invalidCredentials';

// Credentials stay out of the config objects and are read from the validated
// environment directly.
const env = getEnv();

test.describe('functional login', () => {
    test.beforeEach(async ({ resetStorageState, adminSession }) => {
        // The project runs with an authenticated storage state, so it has to be
        // cleared before the login page will render.
        await resetStorageState();
        await adminSession.loginPage.openLoginPage();
    });

    test(
        'should login successfully with valid credentials',
        { tag: '@smoke' },
        async ({ adminSession }) => {
            await test.step('WHEN user enters valid credentials', async () => {
                await adminSession.loginPage.loginAndVerify(
                    env.ADMIN_USERNAME,
                    env.ADMIN_PASSWORD
                );
            });

            await test.step('THEN the login form is no longer displayed', async () => {
                await expect(adminSession.loginPage.loginButton).toBeHidden();
            });
        }
    );

    for (const { description, username, password } of INVALID_LOGIN_ATTEMPTS) {
        test(
            `should show error for invalid credentials - ${description}`,
            { tag: '@regression' },
            async ({ adminSession }) => {
                await test.step(`WHEN user enters invalid credentials - username: "${username}"`, async () => {
                    await adminSession.loginPage.login(username, password);
                });

                await test.step('THEN the invalid credentials error should be displayed', async () => {
                    await expect(
                        adminSession.loginPage.invalidCredentialsMessage
                    ).toBeVisible();
                });
            }
        );
    }
});
