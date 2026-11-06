import {
    APIRequestContext,
    BrowserContext,
    test as base,
} from '@playwright/test';
import { appConfig } from '../../config/app';
import { ANONYMOUS_STORAGE_STATE } from '../../config/util/util';
import { StorageStatePaths } from '../../enums/app/app';
import { createAuthenticatedContext } from '../../helpers/app/createStorageState';
import { assignSupervisor } from '../../helpers/app/reportingLine';
import {
    createTempUser,
    deleteTempUser,
    signInAsTempUser,
    TempUser,
    TempUserOptions,
} from '../../helpers/app/tempUser';
import { ApiRequestFn, ApiRequestParams } from '../api/api-types';
import { apiRequest } from '../api/plain-function';
import { createPageObjects, PageObjects } from '../pom/page-objects';

/**
 * Identity helper fixtures, shared by every area: creating throwaway persons,
 * signing them in, and putting them in reporting lines.
 *
 * Each person is removed after the test, and everything a person owns goes with
 * them, so a test reuses shared configuration such as a leave type while staying
 * isolated from every other test.
 *
 * - `newTempUser`: a person who can sign in, for browser tests through `signInAs`.
 * - `newApiUser`: the same person with `api`, the API signed in as them.
 * - `newSupervisorOf`: a new person who supervises an existing one.
 * - `apiRequestAs`: the API signed in as an existing person.
 * - `newSignedOutSession`: a browser session nobody has signed in to, for tests of
 *   the login page itself.
 *
 * The admin session is the `apiRequest` fixture, or `adminContext` for helpers
 * taking a request context. Never edit `Admin` or terminate
 * employee 1, because both break the shared session: use a person from here.
 */

// ==================== Types ====================

/** A throwaway person, with the API already signed in as them. */
export type ApiUser = TempUser & { api: ApiRequestFn };

export type UserFixtures = {
    /** A request context on the admin session, for helpers taking relative paths. */
    adminContext: APIRequestContext;
    newTempUser: (options?: TempUserOptions) => Promise<TempUser>;
    signInAs: (user: TempUser) => Promise<PageObjects>;
    newSignedOutSession: () => Promise<PageObjects>;
    apiRequestAs: (user: TempUser) => Promise<ApiRequestFn>;
    newApiUser: (options?: TempUserOptions) => Promise<ApiUser>;
    newSupervisorOf: (
        subordinate: TempUser,
        options?: TempUserOptions
    ) => Promise<ApiUser>;
};

// ==================== Fixtures ====================

export const test = base.extend<UserFixtures>({
    adminContext: async ({ playwright }, use) => {
        const context = await playwright.request.newContext({
            baseURL: appConfig.appUrl,
            storageState: StorageStatePaths.APP,
        });

        try {
            await use(context);
        } finally {
            await context.dispose();
        }
    },
    /**
     * Hands the test a function that creates a throwaway person on demand, and
     * deletes every person it created afterwards.
     */
    newTempUser: async ({ adminContext }, use) => {
        const created: TempUser[] = [];

        await use(async (options?: TempUserOptions): Promise<TempUser> => {
            const user = await createTempUser(adminContext, options);
            created.push(user);

            return user;
        });

        for (const user of [...created].reverse()) {
            await deleteTempUser(adminContext, user);
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
    /**
     * Hands the test a function that opens a browser context of its own with nobody
     * signed in, closing every one afterwards.
     */
    newSignedOutSession: async ({ browser }, use) => {
        const contexts: BrowserContext[] = [];

        try {
            await use(async (): Promise<PageObjects> => {
                const context = await browser.newContext({
                    storageState: ANONYMOUS_STORAGE_STATE,
                });
                contexts.push(context);

                return createPageObjects(await context.newPage());
            });
        } finally {
            for (const context of contexts) {
                await context.close();
            }
        }
    },
    /**
     * Hands the test a function that signs a person in to the API, disposing every
     * session afterwards. Several stay live at once, so a test can move between
     * roles.
     */
    apiRequestAs: async ({}, use) => {
        const contexts: APIRequestContext[] = [];

        try {
            await use(async (user: TempUser): Promise<ApiRequestFn> => {
                const context = await createAuthenticatedContext({
                    username: user.username,
                    password: user.password,
                });
                contexts.push(context);

                return async <T = unknown>(params: ApiRequestParams) => {
                    const response = await apiRequest(context, params);

                    return { ...response, body: response.body as T };
                };
            });
        } finally {
            for (const context of contexts) {
                await context.dispose();
            }
        }
    },
    /** Hands the test a function that creates a person and signs them in to the API. */
    newApiUser: async ({ newTempUser, apiRequestAs }, use) => {
        await use(async (options?: TempUserOptions): Promise<ApiUser> => {
            const user = await newTempUser(options);

            return { ...user, api: await apiRequestAs(user) };
        });
    },
    /**
     * Hands the test a function that creates a person and makes them the direct
     * supervisor of someone. The reporting line goes when either person is removed.
     */
    newSupervisorOf: async ({ adminContext, newApiUser }, use) => {
        await use(
            async (
                subordinate: TempUser,
                options?: TempUserOptions
            ): Promise<ApiUser> => {
                const supervisor = await newApiUser(options);

                await assignSupervisor(adminContext, {
                    empNumber: subordinate.empNumber,
                    supervisorEmpNumber: supervisor.empNumber,
                });

                return supervisor;
            }
        );
    },
});
