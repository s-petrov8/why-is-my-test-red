import { expect, Locator, Page, Response } from '@playwright/test';
import { appConfig } from '../../config/app';
import {
    ApiEndpoints,
    Messages,
    Routes,
    TerminationReasons,
} from '../../enums/app/app';

/**
 * Page Object for an employee's Job tab (`/pim/viewJobDetails/empNumber/{n}`), where
 * an administrator terminates and reactivates their employment.
 */
export class EmployeeJobPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'Job Details' });
    }

    get terminateButton(): Locator {
        return this.page.getByRole('button', { name: 'Terminate Employment' });
    }

    get activateButton(): Locator {
        return this.page.getByRole('button', { name: 'Activate Employment' });
    }

    terminatedOn(date: string): Locator {
        return this.page.getByText(`${Messages.TERMINATED_ON}: ${date}`);
    }

    get terminatedOnAnyDate(): Locator {
        return this.page.getByText(Messages.TERMINATED_ON);
    }

    private get terminateDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    get terminationDateInput(): Locator {
        return this.terminateDialog.getByPlaceholder('yyyy-mm-dd');
    }

    get terminationReasonDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.terminateDialog.locator('.oxd-select-text');
    }

    terminationReasonOption(reason: TerminationReasons): Locator {
        return this.page.getByRole('option', { name: reason, exact: true });
    }

    get saveTerminationButton(): Locator {
        return this.terminateDialog.getByRole('button', { name: 'Save' });
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get successMessage(): Locator {
        return this.toast.getByText(Messages.UPDATED_SUCCESSFULLY);
    }

    get errorMessage(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it as an error
        return this.page.locator('.oxd-toast--error');
    }

    get terminationValidationErrors(): Locator {
        return this.terminateDialog.getByText(Messages.REQUIRED, {
            exact: true,
        });
    }

    // ==================== Actions ====================

    /**
     * Opens an employee's Job tab and waits for the job details the page loads.
     *
     * @param {number} empNumber - The employee.
     * @returns {Promise<void>} Resolves once the job details have loaded.
     */
    async openJobDetails(empNumber: number): Promise<void> {
        await Promise.all([
            this.waitForJobDetails(empNumber),
            this.page.goto(
                `${appConfig.appUrl}${Routes.PIM_JOB_DETAILS}/${empNumber}`,
                { waitUntil: 'domcontentloaded' }
            ),
        ]);
    }

    /**
     * Terminates the employment through the form, confirming the date and reason it
     * filled before saving.
     *
     * @param {object} termination - The termination.
     * @param {string} termination.date - The date, as `yyyy-mm-dd`.
     * @param {TerminationReasons} termination.reason - The reason.
     * @returns {Promise<void>} Resolves once the form is submitted.
     */
    async terminateEmploymentAndVerify(termination: {
        date: string;
        reason: TerminationReasons;
    }): Promise<void> {
        await this.terminateButton.click();

        await this.terminationDateInput.fill(termination.date);
        await expect(this.terminationDateInput).toHaveValue(termination.date);

        await this.terminationReasonDropdown.click();
        await this.terminationReasonOption(termination.reason).click();
        await expect(this.terminationReasonDropdown).toHaveText(
            termination.reason
        );

        await this.saveTerminationButton.click();
    }

    /**
     * Waits for the job details request of one employee.
     *
     * @param {number} empNumber - The employee.
     * @returns {Promise<Response>} The job details response.
     */
    private waitForJobDetails(empNumber: number): Promise<Response> {
        return this.page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(
                        `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_JOB_DETAILS_SUFFIX}`
                    ) && response.request().method() === 'GET'
        );
    }
}
