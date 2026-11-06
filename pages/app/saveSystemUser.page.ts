import { expect, Locator, Page } from '@playwright/test';
import { Messages, UserRoleNames, UserStatuses } from '../../enums/app/app';

/**
 * Page Object for the Add User and Edit User forms
 * (`Admin > User Management > Users`), which share their fields.
 *
 * Saving shows its toast and moves straight on to the list, so whether a save worked
 * is best read from the list.
 */
export class SaveSystemUserPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get addHeading(): Locator {
        return this.page.getByRole('heading', { name: 'Add User' });
    }

    get editHeading(): Locator {
        return this.page.getByRole('heading', { name: 'Edit User' });
    }

    /**
     * Scopes to the form group whose label matches, the only handle the unlabelled
     * controls offer.
     */
    private inputGroup(label: string | RegExp): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; the labels are not associated with their inputs
        return this.page.locator('.oxd-input-group').filter({ hasText: label });
    }

    private get roleDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.inputGroup('User Role').locator('.oxd-select-text');
    }

    private get statusDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.inputGroup('Status').locator('.oxd-select-text');
    }

    get employeeNameInput(): Locator {
        return this.page.getByPlaceholder('Type for hints...');
    }

    get employeeNameOptions(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the dropdown wrapper exposes no role; only the options inside it are semantic
        return this.page.locator('.oxd-autocomplete-dropdown');
    }

    get usernameInput(): Locator {
        return this.inputGroup('Username').getByRole('textbox');
    }

    get passwordInput(): Locator {
        return this.inputGroup(/^Password/).getByRole('textbox');
    }

    get confirmPasswordInput(): Locator {
        return this.inputGroup('Confirm Password').getByRole('textbox');
    }

    get saveButton(): Locator {
        return this.page.getByRole('button', { name: 'Save' });
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get savedMessage(): Locator {
        return this.toast.getByText(Messages.SAVED_SUCCESSFULLY);
    }

    get updatedMessage(): Locator {
        return this.toast.getByText(Messages.UPDATED_SUCCESSFULLY);
    }

    get fieldErrors(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- a field's validation message has no role and no link to its input
        return this.page.locator('.oxd-input-field-error-message');
    }

    // ==================== Actions ====================

    /**
     * Fills the Add User form and saves it.
     *
     * @param {object} user - The account to create.
     * @param {UserRoleNames} user.role - The role to pick.
     * @param {string} user.employeeName - Full name as the autocomplete renders it.
     * @param {UserStatuses} user.status - The status to pick.
     * @param {string} user.username - The username to type.
     * @param {string} user.password - The password to type, twice.
     * @returns {Promise<void>} Resolves once Save is clicked.
     */
    async addUser(user: {
        role: UserRoleNames;
        employeeName: string;
        status: UserStatuses;
        username: string;
        password: string;
    }): Promise<void> {
        await this.roleDropdown.click();
        await this.page
            .getByRole('option', { name: user.role, exact: true })
            .click();

        await this.employeeNameInput.fill(user.employeeName);
        await this.employeeNameOptions
            .getByRole('option', { name: user.employeeName })
            .click();

        await this.statusDropdown.click();
        await this.page
            .getByRole('option', { name: user.status, exact: true })
            .click();

        await this.usernameInput.fill(user.username);
        await this.passwordInput.fill(user.password);
        await this.confirmPasswordInput.fill(user.password);

        await this.saveButton.click();
    }

    /**
     * Changes the status on the Edit User form and saves it.
     *
     * The form starts empty and fills in when the account's details answer, which
     * would overwrite a choice made earlier, so this waits for them and confirms the
     * status it picked.
     *
     * @param {string} username - The account the form should have loaded.
     * @param {UserStatuses} status - The status to pick.
     * @returns {Promise<void>} Resolves once Save is clicked.
     */
    async changeStatusAndVerify(
        username: string,
        status: UserStatuses
    ): Promise<void> {
        await expect(this.usernameInput).toHaveValue(username);

        await this.statusDropdown.click();
        await this.page
            .getByRole('option', { name: status, exact: true })
            .click();

        await expect(this.statusDropdown).toHaveText(status);

        await this.saveButton.click();
    }
}
