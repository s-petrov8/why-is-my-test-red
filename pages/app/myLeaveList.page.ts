import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { Messages, Routes } from '../../enums/app/app';
import { formatIsoDate, formatLeaveDays } from '../../helpers/util/util';

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
     * Cancels the employee's own request on one date.
     *
     * @param {Date} date - The request's date.
     * @returns {Promise<void>} Resolves once the cancellation is submitted.
     */
    async cancelLeaveOn(date: Date): Promise<void> {
        await this.cancelButton(date).click();
    }
}
