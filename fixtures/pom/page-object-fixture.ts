import { test as base } from '@playwright/test';
import { createPageObjects, PageObjects } from './page-objects';

export type FrameworkFixtures = {
    /** Page objects bound to the pre-authenticated admin session. */
    adminSession: PageObjects;
    resetStorageState: () => Promise<void>;
};

/**
 * Extended test with page object fixtures.
 * Import this in your test files to access page objects.
 */
export const test = base.extend<FrameworkFixtures>({
    adminSession: async ({ page }, use) => {
        await use(createPageObjects(page));
    },

    resetStorageState: async ({ context }, use) => {
        await use(async () => {
            await context.clearCookies();
            await context.clearPermissions();
        });
    },
});
