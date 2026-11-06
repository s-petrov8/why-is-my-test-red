import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { LeaveStatuses, Messages, Routes } from '../../enums/app/app';
import { formatAppDate } from '../../helpers/util/util';

/**
 * Page Object for the Leave List (`Leave > Leave List`), an approver's view of
 * other employees' leave requests.
 */
export class LeaveListPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'Leave List' });
    }

    /**
     * Scopes to the filter group whose label matches, the only handle the
     * unlabelled filter controls offer.
     */
    private inputGroup(label: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; the labels are not associated with their inputs
        return this.page.locator('.oxd-input-group').filter({ hasText: label });
    }

    get fromDateInput(): Locator {
        return this.inputGroup('From Date').getByRole('textbox');
    }

    get toDateInput(): Locator {
        return this.inputGroup('To Date').getByRole('textbox');
    }

    get statusDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.inputGroup('Show Leave with Status').locator(
            '.oxd-select-text'
        );
    }

    get employeeNameInput(): Locator {
        return this.page.getByPlaceholder('Type for hints...');
    }

    get employeeNameOptions(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the dropdown wrapper exposes no role; only the options inside it are semantic
        return this.page.locator('.oxd-autocomplete-dropdown');
    }

    get searchButton(): Locator {
        return this.page.getByRole('button', { name: 'Search' });
    }

    get resetButton(): Locator {
        return this.page.getByRole('button', { name: 'Reset' });
    }

    get resultRows(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- `getByRole('row')` also matches the header row, which carries no employee and no actions
        return this.page.locator('.oxd-table-card');
    }

    rowForEmployee(employeeName: string): Locator {
        return this.resultRows.filter({ hasText: employeeName });
    }

    approveButtonForEmployee(employeeName: string): Locator {
        return this.rowForEmployee(employeeName).getByRole('button', {
            name: 'Approve',
        });
    }

    rejectButtonForEmployee(employeeName: string): Locator {
        return this.rowForEmployee(employeeName).getByRole('button', {
            name: 'Reject',
        });
    }

    private actionsMenuForEmployee(employeeName: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the actions menu button has an icon and no accessible name
        return this.rowForEmployee(employeeName).locator(
            'button.oxd-icon-button'
        );
    }

    private get viewDetailsMenuItem(): Locator {
        return this.page.getByText(Messages.LEAVE_VIEW_DETAILS);
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get successMessage(): Locator {
        return this.toast.getByText(Messages.UPDATED_SUCCESSFULLY);
    }

    get noRecordsMessage(): Locator {
        return this.toast.getByText(Messages.NO_RECORDS_FOUND);
    }

    // ==================== Actions ====================

    /**
     * Navigates directly to the Leave List.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openLeaveListPage(): Promise<void> {
        await this.page.goto(`${appConfig.appUrl}${Routes.LEAVE_LIST}`, {
            waitUntil: 'domcontentloaded',
        });
    }

    /**
     * Picks a value in the `Show Leave with Status` filter.
     *
     * The filter is multi-select and already carries `Pending Approval` by
     * default, so selecting another status ADDS to it rather than replacing it.
     *
     * @param {LeaveStatuses} status - The status to add to the filter.
     * @returns {Promise<void>} Resolves once the option is selected.
     */
    async selectStatus(status: LeaveStatuses): Promise<void> {
        await this.statusDropdown.click();
        await this.page
            .getByRole('option', { name: status, exact: true })
            .click();
    }

    /**
     * Filters the list to one employee over one date range, then searches.
     *
     * @param {object} filter - The filter to apply.
     * @param {string} filter.employeeName - Full name as the autocomplete renders it.
     * @param {Date} filter.fromDate - Start of the date range to search.
     * @param {Date} filter.toDate - End of the date range to search.
     * @returns {Promise<void>} Resolves once the search request completes.
     */
    async searchLeaveRequests(filter: {
        employeeName: string;
        fromDate: Date;
        toDate: Date;
    }): Promise<void> {
        await this.fromDateInput.fill(formatAppDate(filter.fromDate));

        await this.toDateInput.clear();
        await this.toDateInput.fill(formatAppDate(filter.toDate));

        await this.employeeNameInput.fill(filter.employeeName);
        await this.employeeNameOptions
            .getByRole('option', { name: filter.employeeName })
            .click();

        await this.searchButton.click();
    }

    /**
     * Approves the pending request belonging to one employee.
     *
     * @param {string} employeeName - Full name as the results table renders it.
     * @returns {Promise<void>} Resolves once the approval is submitted.
     */
    async approveLeaveFor(employeeName: string): Promise<void> {
        await this.approveButtonForEmployee(employeeName).click();
    }

    /**
     * Opens the details page of the pending request belonging to one employee.
     *
     * @param {string} employeeName - Full name as the results table renders it.
     * @returns {Promise<void>} Resolves once the menu item is clicked.
     */
    async openDetailsFor(employeeName: string): Promise<void> {
        await this.actionsMenuForEmployee(employeeName).click();
        await this.viewDetailsMenuItem.click();
    }
}
