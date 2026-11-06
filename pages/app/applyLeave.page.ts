import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ApiEndpoints, Messages, Routes } from '../../enums/app/app';
import { formatAppDate, formatIsoDate } from '../../helpers/util/util';

/**
 * Page Object for the Apply Leave form (`Leave > Apply`), the page an employee
 * uses to request leave for themselves.
 */
export class ApplyLeavePage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: 'Apply Leave' });
    }

    /**
     * Scopes to the field group whose label starts with this text, the only handle
     * the unlabelled controls on this form offer. Anchored because a group also
     * holds its error, and "To date should be after from date" names another field.
     */
    private inputGroup(label: string): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the wrapper is a plain div; the labels are not associated with their inputs
        return this.page
            .locator('.oxd-input-group')
            .filter({ hasText: new RegExp(`^${label}`) });
    }

    get leaveTypeDropdown(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the select trigger is a tabindex div with no role and no accessible name
        return this.inputGroup('Leave Type').locator('.oxd-select-text');
    }

    leaveTypeOption(leaveType: string): Locator {
        return this.page.getByRole('option', { name: leaveType, exact: true });
    }

    get leaveBalance(): Locator {
        return this.inputGroup('Leave Balance');
    }

    get fromDateInput(): Locator {
        return this.inputGroup('From Date').getByRole('textbox');
    }

    get toDateInput(): Locator {
        return this.inputGroup('To Date').getByRole('textbox');
    }

    get commentsInput(): Locator {
        return this.inputGroup('Comments').getByRole('textbox');
    }

    get applyButton(): Locator {
        return this.page.getByRole('button', { name: 'Apply' });
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get successMessage(): Locator {
        return this.toast.getByText(Messages.SAVED_SUCCESSFULLY);
    }

    get submitFailedMessage(): Locator {
        return this.toast.getByText(Messages.LEAVE_SUBMIT_FAILED);
    }

    get balanceNotSufficient(): Locator {
        return this.leaveBalance.getByText(
            Messages.LEAVE_BALANCE_NOT_SUFFICIENT
        );
    }

    get overlapHeading(): Locator {
        return this.page.getByRole('heading', {
            name: Messages.LEAVE_OVERLAP_HEADING,
        });
    }

    get overlapRows(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- `getByRole('row')` also matches the header row
        return this.page.locator('.oxd-table-card');
    }

    get validationErrors(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- field errors render as plain spans with no role and no link to their input
        return this.page.locator('.oxd-input-field-error-message');
    }

    // ==================== Actions ====================

    /**
     * Navigates directly to the Apply Leave form.
     *
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openApplyLeavePage(): Promise<void> {
        await this.page.goto(`${appConfig.appUrl}${Routes.LEAVE_APPLY}`, {
            waitUntil: 'domcontentloaded',
        });
    }

    /**
     * Opens the Leave Type dropdown and picks a type by its visible name.
     *
     * @param {string} leaveType - The leave type name, e.g. 'CAN - Vacation'.
     * @returns {Promise<void>} Resolves once the option is selected.
     */
    async selectLeaveType(leaveType: string): Promise<void> {
        await this.leaveTypeDropdown.click();
        await this.leaveTypeOption(leaveType).click();
    }

    /**
     * Fills the leave date range and leaves the field, which is when the form
     * recalculates the balance.
     *
     * @param {Date} fromDate - First day of leave.
     * @param {Date} toDate - Last day of leave.
     * @returns {Promise<void>} Resolves once both dates are set.
     */
    async setLeaveDates(fromDate: Date, toDate: Date): Promise<void> {
        await this.fromDateInput.fill(formatAppDate(fromDate));

        await this.toDateInput.clear();
        await this.toDateInput.fill(formatAppDate(toDate));
        await this.toDateInput.blur();
    }

    /**
     * Fills the leave date range and waits for the form's recalculation, so a check
     * of the balance can't pass on what the form showed before it.
     *
     * @param {Date} fromDate - First day of leave.
     * @param {Date} toDate - Last day of leave.
     * @returns {Promise<boolean>} Whether the application says the range goes below zero.
     */
    async setLeaveDatesAndWaitForBalance(
        fromDate: Date,
        toDate: Date
    ): Promise<boolean> {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (candidate) =>
                    candidate
                        .url()
                        .includes(ApiEndpoints.LEAVE_BALANCE_BY_TYPE) &&
                    candidate.url().includes(`toDate=${formatIsoDate(toDate)}`)
            ),
            this.setLeaveDates(fromDate, toDate),
        ]);
        const { data }: { data: { negative: boolean } } = await response.json();

        return data.negative;
    }

    /**
     * Opens the Leave Type dropdown, leaving it open to read its options.
     *
     * @returns {Promise<void>} Resolves once the dropdown is open.
     */
    async openLeaveTypeOptions(): Promise<void> {
        await this.leaveTypeDropdown.click();
    }

    /**
     * Fills the whole form and submits it, for a request that conflicts with
     * existing leave: the form checks for a conflict first and sends no request
     * when it finds one. Other requests use {@link applyForLeave}.
     *
     * @param {object} leave - The leave to request.
     * @param {string} leave.leaveType - The leave type name.
     * @param {Date} leave.fromDate - First day of leave.
     * @param {Date} leave.toDate - Last day of leave.
     * @returns {Promise<void>} Resolves once the form is submitted.
     */
    async submitConflictingLeave(leave: {
        leaveType: string;
        fromDate: Date;
        toDate: Date;
    }): Promise<void> {
        await this.selectLeaveType(leave.leaveType);
        await this.setLeaveDates(leave.fromDate, leave.toDate);
        await this.applyButton.click();
    }

    /**
     * Fills the whole form, submits it, and waits for the application to answer
     * the submission. Makes no assertion about the outcome, so it serves both
     * the accepted and the rejected path.
     *
     * @param {object} leave - The leave to request.
     * @param {string} leave.leaveType - The leave type name.
     * @param {Date} leave.fromDate - First day of leave.
     * @param {Date} leave.toDate - Last day of leave.
     * @param {string} [leave.comment] - Optional comment shown to the approver.
     * @returns {Promise<void>} Resolves once the form is submitted.
     */
    async applyForLeave(leave: {
        leaveType: string;
        fromDate: Date;
        toDate: Date;
        comment?: string;
    }): Promise<void> {
        await this.selectLeaveType(leave.leaveType);
        await this.setLeaveDates(leave.fromDate, leave.toDate);

        if (leave.comment !== undefined) {
            await this.commentsInput.fill(leave.comment);
        }

        await Promise.all([
            this.page.waitForResponse(
                (response) =>
                    response.url().includes(ApiEndpoints.LEAVE_REQUESTS) &&
                    response.request().method() === 'POST'
            ),
            this.applyButton.click(),
        ]);
    }
}
