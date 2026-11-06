import { BrowserContext, test as base } from '@playwright/test';
import { createAuthenticatedContext } from '../../helpers/app/createStorageState';
import {
    createTempUser,
    deleteTempUser,
    signInAsTempUser,
    TempUser,
} from '../../helpers/app/tempUser';
import { createPageObjects, PageObjects } from '../pom/page-objects';

/** Identity helper fixtures: creating throwaway persons and signing them in. */

// ==================== Types ====================

export type UserFixtures = {
    newTempUser: () => Promise<TempUser>;
    signInAs: (user: TempUser) => Promise<PageObjects>;
};

// ==================== Fixtures ====================

export const test = base.extend<UserFixtures>({
    /**
     * Hands the test a function that creates a throwaway person on demand, and
     * deletes every person it created afterwards.
     */
    newTempUser: async ({}, use) => {
        const context = await createAuthenticatedContext();
        const created: TempUser[] = [];

        try {
            await use(async (): Promise<TempUser> => {
                const user = await createTempUser(context);
                created.push(user);

                return user;
            });
        } finally {
            try {
                for (const user of [...created].reverse()) {
                    await deleteTempUser(context, user);
                }
            } finally {
                // Nested so a failed delete assertion cannot leak the context.
                await context.dispose();
            }
        }
    },
    /**
     * Hands the test a function that signs a person in and returns the page
     * objects for their session, closing every session afterwards.
     *
     * This is the one way to reach the application as somebody other than the
     * admin the project's `storageState` holds. It replaces a fixture per
     * (role x page): any number of users can be signed in, each gets every page
     * object bound to a context of their own, and several stay live at once so a
     * test can move between roles without logging anyone out.
     */
    signInAs: async ({ browser }, use) => {
        const contexts: BrowserContext[] = [];

        try {
            await use(async (user: TempUser): Promise<PageObjects> => {
                const { context, page } = await signInAsTempUser(browser, user);
                contexts.push(context);

                return createPageObjects(page);
            });
        } finally {
            for (const context of contexts) {
                await context.close();
            }
        }
    },
});
