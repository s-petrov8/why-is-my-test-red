import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { Messages, Routes } from '../../enums/app/app';

/**
 * Page Object for System Users (`Admin > User Management > Users`), the list of
 * accounts. Somebody without access gets the same URL with HTTP 403 and an alert.
 */
export class SystemUsersPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'System Users' });
    }

    get usernameFilter(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; the labels are not associated with their inputs
        return this.page
            .locator('.oxd-input-group')
            .filter({ hasText: 'Username' })
            .getByRole('textbox');
    }

    get searchButton(): Locator {
        return this.page.getByRole('button', { name: 'Search' });
    }

    get addButton(): Locator {
        return this.page.getByRole('button', { name: 'Add' });
    }

    rowForUsername(username: string): Locator {
        return this.page.getByRole('row').filter({ hasText: username });
    }

    private editButtonForUsername(username: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the row's action buttons hold an icon and have no accessible name
        return this.rowForUsername(username).locator(
            'button:has(.bi-pencil-fill)'
        );
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get noRecordsMessage(): Locator {
        return this.toast.getByText(Messages.NO_RECORDS_FOUND);
    }

    get credentialRequiredMessage(): Locator {
        return this.page
            .getByRole('alert')
            .getByText(Messages.CREDENTIAL_REQUIRED);
    }

    // ==================== Actions ====================

    /**
     * Navigates directly to the list.
     *
     * @returns {Promise<number | undefined>} The HTTP status of the page: 403 without access.
     */
    async openSystemUsersPage(): Promise<number | undefined> {
        const response = await this.page.goto(
            `${appConfig.appUrl}${Routes.ADMIN_SYSTEM_USERS}`,
            { waitUntil: 'domcontentloaded' }
        );

        return response?.status();
    }

    /**
     * Filters the list to one username.
     *
     * @param {string} username - The username to search for.
     * @returns {Promise<void>} Resolves once the search is submitted.
     */
    async searchByUsername(username: string): Promise<void> {
        await this.usernameFilter.fill(username);
        await this.searchButton.click();
    }

    /**
     * Opens one account's Edit User form.
     *
     * @param {string} username - The account's username, shown in the list.
     * @returns {Promise<void>} Resolves once the edit button is clicked.
     */
    async openEditFormFor(username: string): Promise<void> {
        await this.editButtonForUsername(username).click();
    }
}
