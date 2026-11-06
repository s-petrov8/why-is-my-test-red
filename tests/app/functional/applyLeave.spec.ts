import { LeaveStatuses, Messages } from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import { applyForLeave, readMyLeaveRequests } from '../../../helpers/app/leave';
import {
    formatIsoDate,
    formatLeaveDays,
    getLeaveWeek,
} from '../../../helpers/util/util';
import { createLeaveRequestData } from '../../../test-data/factories/app/leave.factory';

/** Two days held, so a two-day request fits exactly and a three-day one does not. */
const EXACT_FIT_DAYS = 2;

test.describe('functional apply leave', () => {
    test(
        'should list only eligible leave types and warn when the balance is not sufficient',
        { tag: '@regression' },
        async ({ leaveType, newLeaveEmployee, newLeaveType, signInAs }) => {
            const { monday, tuesday, wednesday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: EXACT_FIT_DAYS });
            const ineligibleType = await newLeaveType();
            const { applyLeavePage } = await signInAs(employee);

            await test.step('GIVEN the employee is on the Apply Leave form', async () => {
                await applyLeavePage.openApplyLeavePage();

                await expect(applyLeavePage.heading).toBeVisible();
            });

            await test.step('WHEN they open the Leave Type options', async () => {
                await applyLeavePage.openLeaveTypeOptions();
            });

            await test.step('THEN the type they hold days of is listed and the other is not', async () => {
                await expect(
                    applyLeavePage.leaveTypeOption(leaveType.name)
                ).toBeVisible();
                await expect(
                    applyLeavePage.leaveTypeOption(ineligibleType.name)
                ).toHaveCount(0);
            });

            await test.step('WHEN they pick it and two days they can cover', async () => {
                await applyLeavePage.leaveTypeOption(leaveType.name).click();

                expect(
                    await applyLeavePage.setLeaveDatesAndWaitForBalance(
                        monday,
                        tuesday
                    )
                ).toBe(false);
            });

            await test.step('THEN the form shows their balance, without a warning', async () => {
                await expect(applyLeavePage.leaveBalance).toContainText(
                    formatLeaveDays(EXACT_FIT_DAYS)
                );
                await expect(applyLeavePage.balanceNotSufficient).toHaveCount(
                    0
                );
            });

            await test.step('WHEN they extend it to three days', async () => {
                expect(
                    await applyLeavePage.setLeaveDatesAndWaitForBalance(
                        monday,
                        wednesday
                    )
                ).toBe(true);
            });

            await test.step('THEN the form warns the balance is not sufficient', async () => {
                await expect(applyLeavePage.balanceNotSufficient).toBeVisible();
            });
        }
    );

    test(
        'should show the conflicting leave and create nothing when a request overlaps',
        { tag: '@regression' },
        async ({ leaveType, newLeaveEmployee, signInAs }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const { applyLeavePage } = await signInAs(employee);

            await test.step('GIVEN the employee already has leave on the date', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN they request the same date on the form', async () => {
                await applyLeavePage.openApplyLeavePage();
                await applyLeavePage.submitConflictingLeave({
                    leaveType: leaveType.name,
                    fromDate: monday,
                    toDate: monday,
                });
            });

            await test.step('THEN a warning says the submission failed', async () => {
                await expect(applyLeavePage.submitFailedMessage).toBeVisible();
                await expect(applyLeavePage.submitFailedMessage).toHaveText(
                    Messages.LEAVE_SUBMIT_FAILED
                );
            });

            await test.step('AND the conflicting leave is shown', async () => {
                await expect(applyLeavePage.overlapHeading).toBeVisible();
                await expect(applyLeavePage.overlapRows).toHaveCount(1);
                await expect(applyLeavePage.overlapRows).toContainText(
                    formatIsoDate(monday)
                );
                await expect(applyLeavePage.overlapRows).toContainText(
                    LeaveStatuses.PENDING_APPROVAL
                );
            });

            await test.step('AND no second request exists', async () => {
                const { meta } = await readMyLeaveRequests(employee.api);

                expect(meta.total).toBe(1);
            });
        }
    );
});
