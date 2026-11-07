import { expect, test } from '../../../fixtures/pom/test-options';
import {
    ADMIN_MENU_ITEMS,
    ESS_MENU_ITEMS,
    SUPERVISOR_MENU_ITEMS,
} from '../../../test-data/static/app/roleMenus';

const HTTP_FORBIDDEN = 403;

test.describe('functional role menus', () => {
    test(
        'should show each role its own menu and refuse the users screen to anyone but an admin',
        { tag: '@regression' },
        async ({ adminSession, newSupervisorOf, newTempUser, signInAs }) => {
            const subordinate = await newTempUser();
            const essPerson = await newTempUser();
            // A reporting line reaches a person's menu at sign-in, so they sign in after it exists.
            const supervisor = await newSupervisorOf(subordinate);
            const essSession = await signInAs(essPerson);
            const supervisorSession = await signInAs(supervisor);

            await test.step('GIVEN an admin, THEN their menu holds Admin and PIM and the users screen opens', async () => {
                await adminSession.mainMenu.openDashboard();

                await expect(adminSession.mainMenu.menuLinks).toHaveText([
                    ...ADMIN_MENU_ITEMS,
                ]);

                await adminSession.systemUsersPage.openSystemUsersPage();

                await expect(
                    adminSession.systemUsersPage.heading
                ).toBeVisible();
            });

            await test.step('GIVEN an ESS account, THEN their menu has no Admin or PIM', async () => {
                await essSession.mainMenu.openDashboard();

                await expect(essSession.mainMenu.menuLinks).toHaveText([
                    ...ESS_MENU_ITEMS,
                ]);
            });

            await test.step('WHEN the ESS account opens the users screen, THEN it is forbidden', async () => {
                expect(
                    await essSession.systemUsersPage.openSystemUsersPage()
                ).toBe(HTTP_FORBIDDEN);

                await expect(
                    essSession.systemUsersPage.credentialRequiredMessage
                ).toBeVisible();
                await expect(essSession.systemUsersPage.heading).toHaveCount(0);
            });

            await test.step('GIVEN a supervisor, THEN their menu gains PIM and still has no Admin', async () => {
                await supervisorSession.mainMenu.openDashboard();

                await expect(supervisorSession.mainMenu.menuLinks).toHaveText([
                    ...SUPERVISOR_MENU_ITEMS,
                ]);
            });

            await test.step('WHEN the supervisor opens the users screen, THEN it is forbidden', async () => {
                expect(
                    await supervisorSession.systemUsersPage.openSystemUsersPage()
                ).toBe(HTTP_FORBIDDEN);

                await expect(
                    supervisorSession.systemUsersPage.credentialRequiredMessage
                ).toBeVisible();
                await expect(
                    supervisorSession.systemUsersPage.heading
                ).toHaveCount(0);
            });
        }
    );
});
