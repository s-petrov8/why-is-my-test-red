import { LeaveStatuses } from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import { readMyLeaveRequests } from '../../../helpers/app/leave';
import {
    assignSupervisor,
    removeSupervisor,
} from '../../../helpers/app/reportingLine';

/**
 * A reporting line deciding who can reach and approve a leave request, as the line
 * moves from one person to another. The lines change over the API, and the screens
 * show what each person gets. Every record is created and removed by the fixtures, so
 * this is `@e2e`, not `@destructive`.
 */
test.describe('reporting line change', () => {
    test.slow();

    test(
        'should give access to a pending leave request only to whoever holds the line',
        { tag: '@e2e' },
        async ({
            tempLeaveApprovalUsers,
            adminContext,
            apiRequestAs,
            newTempUser,
            newSupervisorOf,
            signInAs,
        }) => {
            const {
                applicant,
                supervisor,
                leaveTypeName,
                leaveDate,
                leavePeriod,
            } = tempLeaveApprovalUsers;
            // Someone else's supervisor, so the refusal below comes from the line and not the role.
            const newSupervisor = await newSupervisorOf(await newTempUser());

            const employeeSession = await signInAs(applicant);
            const formerSupervisorSession = await signInAs(supervisor);
            const newSupervisorSession = await signInAs(newSupervisor);
            let leaveRequestId = 0;

            await test.step('GIVEN the employee requested leave', async () => {
                await employeeSession.applyLeavePage.openApplyLeavePage();
                await employeeSession.applyLeavePage.applyForLeave({
                    leaveType: leaveTypeName,
                    fromDate: leaveDate,
                    toDate: leaveDate,
                });

                await expect(
                    employeeSession.applyLeavePage.successMessage
                ).toBeVisible();

                const { data } = await readMyLeaveRequests(
                    await apiRequestAs(applicant)
                );
                leaveRequestId = data[0].id;
            });

            await test.step('THEN their supervisor can open it', async () => {
                await formerSupervisorSession.leaveRequestDetailsPage.openLeaveRequest(
                    leaveRequestId
                );

                await expect(
                    formerSupervisorSession.leaveRequestDetailsPage
                        .approveButton
                ).toBeVisible();
            });

            await test.step('AND the supervisor of someone else cannot', async () => {
                await newSupervisorSession.leaveRequestDetailsPage.openLeaveRequest(
                    leaveRequestId
                );

                await expect(
                    newSupervisorSession.leaveRequestDetailsPage.noRecordsAlert
                ).toBeVisible();
                await expect(
                    newSupervisorSession.leaveRequestDetailsPage.heading
                ).toBeHidden();
            });

            await test.step('WHEN the line moves to that person', async () => {
                await removeSupervisor(adminContext, {
                    empNumber: applicant.empNumber,
                    supervisorEmpNumber: supervisor.empNumber,
                });
                await assignSupervisor(adminContext, {
                    empNumber: applicant.empNumber,
                    supervisorEmpNumber: newSupervisor.empNumber,
                });
            });

            await test.step('THEN the former supervisor loses the request', async () => {
                await formerSupervisorSession.leaveRequestDetailsPage.openLeaveRequest(
                    leaveRequestId
                );

                await expect(
                    formerSupervisorSession.leaveRequestDetailsPage
                        .noRecordsAlert
                ).toBeVisible();
                await expect(
                    formerSupervisorSession.leaveRequestDetailsPage
                        .approveButton
                ).toBeHidden();
            });

            await test.step('AND the new supervisor can approve it', async () => {
                await newSupervisorSession.leaveRequestDetailsPage.openLeaveRequest(
                    leaveRequestId
                );
                await newSupervisorSession.leaveRequestDetailsPage.approveButton.click();

                await expect(
                    newSupervisorSession.leaveRequestDetailsPage.updatedMessage
                ).toBeVisible();
                await expect(
                    newSupervisorSession.leaveRequestDetailsPage.dayRows
                ).toContainText(LeaveStatuses.SCHEDULED);
            });

            await test.step('AND the employee sees it scheduled', async () => {
                await employeeSession.myLeaveListPage.openMyLeaveList();
                await employeeSession.myLeaveListPage.filterToPeriodAndVerify(
                    leavePeriod
                );

                await expect(
                    employeeSession.myLeaveListPage.rowForDate(leaveDate)
                ).toContainText(LeaveStatuses.SCHEDULED);
            });
        }
    );
});
