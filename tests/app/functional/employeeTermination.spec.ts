import {
    EmployeeIncludeOptions,
    Messages,
    TerminationReasons,
} from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import { createTerminationData } from '../../../test-data/factories/app/employee.factory';

/**
 * Terminating and reactivating an employee through the screens. The employee comes
 * from the `tempTestEmployee` fixture, which removes them afterwards.
 */
test.describe('functional employee termination', () => {
    test(
        'should terminate from the Job tab, list under Past Employees Only, and activate again',
        { tag: '@regression' },
        async ({ adminSession, tempTestEmployee }) => {
            const { employeeJobPage, employeeListPage } = adminSession;
            const { date } = createTerminationData();
            const employeeId = tempTestEmployee.employeeId!;

            await test.step('WHEN the employee is terminated from the Job tab', async () => {
                await employeeJobPage.openJobDetails(
                    tempTestEmployee.empNumber
                );
                await employeeJobPage.terminateEmploymentAndVerify({
                    date,
                    reason: TerminationReasons.OTHER,
                });
            });

            await test.step('THEN the tab shows the termination date and offers activation', async () => {
                await expect(employeeJobPage.successMessage).toBeVisible();
                await expect(employeeJobPage.terminatedOn(date)).toBeVisible();
                await expect(employeeJobPage.activateButton).toBeVisible();
            });

            await test.step('WHEN Past Employees Only is searched for them', async () => {
                await employeeListPage.openEmployeeList();
                await employeeListPage.selectInclude(
                    EmployeeIncludeOptions.PAST_ONLY
                );
                await employeeListPage.searchByEmployeeId(employeeId);
            });

            await test.step('THEN they are listed as a past employee', async () => {
                await expect(
                    employeeListPage.resultRowContaining(employeeId)
                ).toContainText(Messages.PAST_EMPLOYEE);
            });

            await test.step('WHEN they are activated from the Job tab', async () => {
                await employeeJobPage.openJobDetails(
                    tempTestEmployee.empNumber
                );
                await employeeJobPage.activateButton.click();
            });

            await test.step('THEN the tab offers termination again', async () => {
                await expect(employeeJobPage.terminateButton).toBeVisible();
                await expect(employeeJobPage.terminatedOnAnyDate).toBeHidden();
            });

            await test.step('AND Past Employees Only no longer holds them', async () => {
                await employeeListPage.openEmployeeList();
                await employeeListPage.selectInclude(
                    EmployeeIncludeOptions.PAST_ONLY
                );
                await employeeListPage.searchByEmployeeId(employeeId);

                await expect(
                    employeeListPage.noRecordsFoundMessage
                ).toBeVisible();
            });
        }
    );
});
