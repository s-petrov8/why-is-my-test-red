import { Page } from '@playwright/test';
import { ApplyLeavePage } from '../../pages/app/applyLeave.page';
import { EmployeeListPage } from '../../pages/app/employeeList.page';
import { LeaveListPage } from '../../pages/app/leaveList.page';
import { LoginPage } from '../../pages/app/login.page';

/**
 * Every page object, bound to one browser page.
 *
 * This is the ONLY place a page object is registered. Adding one here makes it
 * available to every session in the suite; no fixture has to be written for it.
 *
 * A "session" is just a signed-in page plus these objects, and there are two
 * ways to get one -- they differ only in where the page comes from:
 *
 * - `adminSession` (`page-object-fixture.ts`) wraps the project's `page`, which
 *   the storage state has already authenticated.
 * - `signInAs` (`fixtures/helper/user-fixture.ts`) creates a context and signs
 *   somebody into it.
 *
 * Both return this same `PageObjects` shape, so a test reads the same whichever
 * role it is acting as.
 *
 * Every page is offered to every session on purpose. Which of them a given user
 * may actually reach is the application's business, and asserting on that is a
 * test's job, not this registry's.
 */
export type PageObjects = {
    loginPage: LoginPage;
    employeeListPage: EmployeeListPage;
    applyLeavePage: ApplyLeavePage;
    leaveListPage: LeaveListPage;
};

/**
 * Builds the page objects for one page.
 *
 * Construction is free -- each page object only stores the `Page` it was handed
 * and resolves its locators lazily -- so building the whole set costs nothing
 * even when a caller uses one of them.
 *
 * @param {Page} page - The browser page to bind every page object to.
 * @returns {PageObjects} The page objects for that page.
 *
 * @example
 * ```ts
 * const { applyLeavePage } = createPageObjects(page);
 * ```
 */
export function createPageObjects(page: Page): PageObjects {
    return {
        loginPage: new LoginPage(page),
        employeeListPage: new EmployeeListPage(page),
        applyLeavePage: new ApplyLeavePage(page),
        leaveListPage: new LeaveListPage(page),
    };
}
