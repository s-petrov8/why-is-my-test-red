import { expect, Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { Messages, Routes } from '../../enums/app/app';
import {
    formatAppDate,
    formatIsoDate,
    formatLeaveDays,
} from '../../helpers/util/util';

/**
 * Page Object for My Leave List (`Leave > My Leave`), where an employee sees their
 * own requests in every status.
 */
export class MyLeaveListPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'My Leave List' });
    }

    /**
     * Scopes to the filter group whose label starts with this text, the only handle
     * the unlabelled filter controls offer.
     */
    private inputGroup(label: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; the labels are not associated with their inputs
        return this.page
            .locator('.oxd-input-group')
            .filter({ hasText: new RegExp(`^${label}`) });
    }

    get fromDateInput(): Locator {
        return this.inputGroup('From Date').getByRole('textbox');
    }

    get toDateInput(): Locator {
        return this.inputGroup('To Date').getByRole('textbox');
    }

    get searchButton(): Locator {
        return this.page.getByRole('button', { name: 'Search' });
    }

    get resultRows(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- `getByRole('row')` also matches the header row, which carries no request and no actions
        return this.page.locator('.oxd-table-card');
    }

    rowForDate(date: Date): Locator {
        return this.resultRows.filter({ hasText: formatIsoDate(date) });
    }

    balanceCell(date: Date, days: number): Locator {
        return this.rowForDate(date).getByRole('cell', {
            name: formatLeaveDays(days),
            exact: true,
        });
    }

    cancelButton(date: Date): Locator {
        return this.rowForDate(date).getByRole('button', { name: 'Cancel' });
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get updatedMessage(): Locator {
        return this.toast.getByText(Messages.UPDATED_SUCCESSFULLY);
    }

    get errorMessage(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it as an error
        return this.page.locator('.oxd-toast--error');
    }

    get validationErrors(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- field errors render as plain spans with no role and no link to their input
        return this.page.locator('.oxd-input-field-error-message');
    }

    // ==================== Actions ====================

    /**
     * Navigates directly to My Leave List.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openMyLeaveList(): Promise<void> {
        await this.page.goto(`${appConfig.appUrl}${Routes.LEAVE_MY_LIST}`, {
            waitUntil: 'domcontentloaded',
        });
    }

    /**
     * Filters the list to a date range, then searches. The list starts on today's
     * leave period, so leave booked into the next one needs this to show.
     *
     * The form fills its default dates in when the leave periods answer arrives, and
     * only into a field that is still empty. An answer arriving while a date is being
     * typed runs the two values together, so this waits for the defaults first, and
     * confirms the dates it typed.
     *
     * @param {object} period - The range.
     * @param {Date} period.fromDate - Its first day.
     * @param {Date} period.toDate - Its last day.
     * @returns {Promise<void>} Resolves once the search is submitted.
     */
    async filterToPeriodAndVerify(period: {
        fromDate: Date;
        toDate: Date;
    }): Promise<void> {
        await expect(this.toDateInput).not.toHaveValue('');

        await this.fromDateInput.fill(formatAppDate(period.fromDate));
        await this.toDateInput.fill(formatAppDate(period.toDate));

        await expect(this.fromDateInput).toHaveValue(
            formatAppDate(period.fromDate)
        );
        await expect(this.toDateInput).toHaveValue(
            formatAppDate(period.toDate)
        );

        await this.searchButton.click();
    }

    /**
     * Cancels the employee's own request on one date.
     *
     * @param {Date} date - The request's date.
     * @returns {Promise<void>} Resolves once the cancellation is submitted.
     */
    async cancelLeaveOn(date: Date): Promise<void> {
        await this.cancelButton(date).click();
    }
}
