import { appConfig } from '../../../config/app';
import {
    ApiEndpoints,
    Messages,
    Routes,
    UserRoleNames,
    UserStatuses,
} from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import { createUserData } from '../../../test-data/factories/app/user.factory';
import { ESS_MENU_ITEMS } from '../../../test-data/static/app/roleMenus';

/**
 * End-to-end cover for an account's life, as the admin and the person each see it,
 * in browser contexts of their own. The admin session only touches this test's
 * account, so this is `@e2e`, not `@destructive`.
 */
test.describe('account lifecycle', () => {
    test.slow();

    let createdUsername: string | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (createdUsername === undefined) {
            return;
        }

        const { status, body } = await apiRequest<{ data: { id: number }[] }>({
            method: 'GET',
            url: `${ApiEndpoints.ADMIN_USERS}?username=${createdUsername}`,
            baseUrl: appConfig.apiUrl,
        });
        createdUsername = undefined;
        expect(status, JSON.stringify(body)).toBe(200);

        const ids = body.data.map(({ id }) => id);

        if (ids.length > 0) {
            const deleted = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.ADMIN_USERS,
                baseUrl: appConfig.apiUrl,
                body: { ids },
            });
            expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
        }
    });

    test(
        'should let an admin create an account the person can use, then disable it and end their session',
        { tag: '@e2e' },
        async ({ adminSession, newSignedOutSession, tempTestEmployee }) => {
            const { username, password } = createUserData(
                tempTestEmployee.empNumber
            );
            const employeeName = [
                tempTestEmployee.firstName,
                tempTestEmployee.middleName,
                tempTestEmployee.lastName,
            ].join(' ');
            const { systemUsersPage, saveSystemUserPage } = adminSession;
            const person = await newSignedOutSession();

            await test.step('GIVEN the admin is on the System Users screen', async () => {
                await systemUsersPage.openSystemUsersPage();

                await expect(systemUsersPage.heading).toBeVisible();
            });

            await test.step('WHEN the admin adds an enabled ESS account', async () => {
                await systemUsersPage.addButton.click();

                await expect(saveSystemUserPage.addHeading).toBeVisible();

                createdUsername = username;
                await saveSystemUserPage.addUser({
                    role: UserRoleNames.ESS,
                    employeeName,
                    status: UserStatuses.ENABLED,
                    username,
                    password,
                });
            });

            await test.step('THEN the list holds it, enabled', async () => {
                await expect(systemUsersPage.heading).toBeVisible();

                await systemUsersPage.searchByUsername(username);

                await expect(
                    systemUsersPage.rowForUsername(username)
                ).toContainText(UserRoleNames.ESS);
                await expect(
                    systemUsersPage.rowForUsername(username)
                ).toContainText(UserStatuses.ENABLED);
            });

            await test.step('WHEN the person signs in, THEN they see the ESS menu', async () => {
                await person.loginPage.openLoginPage();
                await person.loginPage.loginAndVerify(username, password);

                await expect(person.mainMenu.menuLinks).toHaveText([
                    ...ESS_MENU_ITEMS,
                ]);
            });

            await test.step('WHEN the admin disables the account', async () => {
                await systemUsersPage.openEditFormFor(username);

                await expect(saveSystemUserPage.editHeading).toBeVisible();

                await saveSystemUserPage.changeStatusAndVerify(
                    username,
                    UserStatuses.DISABLED
                );
            });

            await test.step('THEN the list shows it disabled', async () => {
                await expect(systemUsersPage.heading).toBeVisible();

                await systemUsersPage.searchByUsername(username);

                await expect(
                    systemUsersPage.rowForUsername(username)
                ).toContainText(UserStatuses.DISABLED);
            });

            await test.step("WHEN the person opens another page, THEN they're sent to the login page", async () => {
                await person.mainMenu.menuLink(ESS_MENU_ITEMS[0]).click();

                await expect(person.loginPage.heading).toBeVisible();
                await expect(person.loginPage.heading.page()).toHaveURL(
                    `${appConfig.appUrl}${Routes.LOGIN}`
                );
            });

            await test.step('WHEN they sign in again, THEN the login page says the account is disabled', async () => {
                await person.loginPage.login(username, password);

                await expect(person.loginPage.errorAlert).toHaveText(
                    Messages.ACCOUNT_DISABLED
                );
            });
        }
    );
});
