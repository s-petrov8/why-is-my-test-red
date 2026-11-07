import { Locator, Page, Response } from '@playwright/test';
import { appConfig } from '../../config/app';
import {
    ApiEndpoints,
    EmployeeIncludeOptions,
    Messages,
    Routes,
} from '../../enums/app/app';

/**
 * Page Object for the PIM employee list (`/pim/viewEmployeeList`).
 */

export class EmployeeListPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'Employee Information' });
    }

    get employeeNameInput(): Locator {
        return this.filterField('Employee Name').getByRole('textbox');
    }

    get employeeIdInput(): Locator {
        return this.filterField('Employee Id').getByRole('textbox');
    }

    get includeDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.filterField('Include').locator('.oxd-select-text');
    }

    includeOption(option: EmployeeIncludeOptions): Locator {
        return this.page.getByRole('option', { name: option, exact: true });
    }

    get searchButton(): Locator {
        return this.page.getByRole('button', { name: 'Search' });
    }

    get resetButton(): Locator {
        return this.page.getByRole('button', { name: 'Reset' });
    }

    get resultsTable(): Locator {
        return this.page.getByRole('table');
    }

    get resultRows(): Locator {
        return this.resultsTable
            .getByRole('rowgroup')
            .filter({ hasNot: this.page.getByRole('columnheader') })
            .getByRole('row');
    }

    resultRowContaining(text: string): Locator {
        return this.resultRows.filter({ hasText: text });
    }

    // ==================== Feedback Locators ====================

    get recordsFoundMessage(): Locator {
        return this.page.getByText(/\(\d+\) Records? Found/);
    }

    get noRecordsFoundMessage(): Locator {
        return this.resultsSummary.getByText(Messages.NO_RECORDS_FOUND);
    }

    // ==================== Internal Locators ====================

    private get resultsSummary(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the page exposes no landmark, role or accessible name to anchor to
        return this.page.locator(
            '.orangehrm-horizontal-padding.orangehrm-vertical-padding'
        );
    }

    private filterField(label: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; nothing semantic identifies it
        const group = this.page.locator('.oxd-input-group');

        return group.filter({
            has: this.page.getByText(label, { exact: true }),
        });
    }

    // ==================== Actions ====================

    /**
     * Opens the employee list and waits for the employee request the page fires
     * on load. That wait is load-bearing: a search issued while the initial
     * request is still in flight would let `submitSearch()` settle on the
     * unfiltered response instead of the filtered one.
     *
     * @returns {Promise<void>} Resolves once the initial list has loaded.
     */
    async openEmployeeList(): Promise<void> {
        await Promise.all([
            this.waitForEmployeeList(),
            this.page.goto(`${appConfig.appUrl}${Routes.PIM_EMPLOYEE_LIST}`, {
                waitUntil: 'domcontentloaded',
            }),
        ]);
    }

    /**
     * Filters the list by employee name.
     *
     * @param {string} name - Full or partial employee name to search for.
     * @returns {Promise<void>} Resolves when the filtered results are returned.
     *
     * @example
     * ```ts
     * await employeeListPage.searchByEmployeeName('Amelia');
     * await expect(employeeListPage.recordsFoundMessage).toBeVisible();
     * ```
     */
    async searchByEmployeeName(name: string): Promise<void> {
        await this.employeeNameInput.fill(name);
        await this.submitSearch();
    }

    /**
     * Filters the list by employee id.
     *
     * @param {string} employeeId - The employee id to search for.
     * @returns {Promise<void>} Resolves when the filtered results are returned.
     *
     * @example
     * ```ts
     * await employeeListPage.searchByEmployeeId('01715');
     * ```
     */
    async searchByEmployeeId(employeeId: string): Promise<void> {
        await this.employeeIdInput.fill(employeeId);
        await this.submitSearch();
    }

    /**
     * Chooses which employees the next search includes, by their employment.
     *
     * @param {EmployeeIncludeOptions} option - The option to choose.
     * @returns {Promise<void>} Resolves once the option is chosen.
     */
    async selectInclude(option: EmployeeIncludeOptions): Promise<void> {
        await this.includeDropdown.click();
        await this.includeOption(option).click();
    }

    /**
     * Submits the filter form and waits for the employee request it triggers.
     *
     * @returns {Promise<void>} Resolves when the search response arrives.
     */
    private async submitSearch(): Promise<void> {
        await Promise.all([
            this.waitForEmployeeList(),
            this.searchButton.click(),
        ]);
    }

    /**
     * Waits for the employee request that backs every render of the list.
     *
     * @returns {Promise<Response>} The employee list response.
     */
    private waitForEmployeeList(): Promise<Response> {
        return this.page.waitForResponse(
            (response) =>
                response.url().includes(ApiEndpoints.PIM_EMPLOYEES) &&
                response.request().method() === 'GET'
        );
    }
}
