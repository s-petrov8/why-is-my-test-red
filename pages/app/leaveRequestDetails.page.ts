import { Locator, Page } from '@playwright/test';
import { appConfig } from '../../config/app';
import { Messages, Routes } from '../../enums/app/app';

/**
 * Page Object for Leave Request Details (reached from the Leave List), where an
 * approver sees one request's days and acts on them.
 */
export class LeaveRequestDetailsPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', {
            name: 'Leave Request Details',
        });
    }

    get dayRows(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- `getByRole('row')` also matches the header row
        return this.page.locator('.oxd-table-card');
    }

    get approveButton(): Locator {
        return this.dayRows.getByRole('button', { name: 'Approve' });
    }

    get rejectButton(): Locator {
        return this.dayRows.getByRole('button', { name: 'Reject' });
    }

    get commentsButton(): Locator {
        return this.page.getByRole('button', { name: 'Comments' });
    }

    private get commentsDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    get commentInput(): Locator {
        return this.commentsDialog.getByRole('textbox');
    }

    get saveCommentButton(): Locator {
        return this.commentsDialog.getByRole('button', { name: 'Save' });
    }

    // ==================== Feedback Locators ====================

    get toast(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it
        return this.page.locator('.oxd-toast');
    }

    get updatedMessage(): Locator {
        return this.toast.getByText(Messages.UPDATED_SUCCESSFULLY);
    }

    get commentSavedMessage(): Locator {
        return this.toast.getByText(Messages.SAVED_SUCCESSFULLY);
    }

    get errorMessage(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- the toast carries no alert role; only its class identifies it as an error
        return this.page.locator('.oxd-toast--error');
    }

    get validationErrors(): Locator {
        // eslint-disable-next-line playwright/no-raw-locators -- field errors render as plain spans with no role and no link to their input
        return this.page.locator('.oxd-input-field-error-message');
    }

    get noRecordsAlert(): Locator {
        return this.page
            .getByRole('alert')
            .getByText(Messages.NO_RECORDS_FOUND);
    }

    // ==================== Actions ====================

    /**
     * Opens one leave request directly by its id. Someone with no access to it gets
     * {@link noRecordsAlert} in place of its details.
     *
     * @param {number} leaveRequestId - The leave request.
     * @returns {Promise<void>} Resolves when navigation is complete.
     */
    async openLeaveRequest(leaveRequestId: number): Promise<void> {
        await this.page.goto(
            `${appConfig.appUrl}${Routes.LEAVE_REQUEST_DETAILS}/${leaveRequestId}`,
            { waitUntil: 'domcontentloaded' }
        );
    }

    /**
     * Adds a comment to the whole request.
     *
     * @param {string} comment - The comment.
     * @returns {Promise<void>} Resolves once the comment is submitted.
     */
    async addComment(comment: string): Promise<void> {
        await this.commentsButton.click();
        await this.commentInput.fill(comment);
        await this.saveCommentButton.click();
    }
}
