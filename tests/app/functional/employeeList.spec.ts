import { expect, test } from '../../../fixtures/pom/test-options';
import { NO_MATCH_EMPLOYEE_NAME } from '../../../test-data/static/app/invalidEmployeeSearch';

/**
 * Search coverage for the PIM employee list.
 *
 * The employee under test comes from the `tempTestEmployee` helper fixture,
 * which creates it over the API and deletes it afterwards. That keeps the search
 * terms unique to the run and means these tests own their data -- nothing shared
 * is mutated, so they are tagged by importance rather than `@destructive`, and
 * they need no cleanup hook of their own.
 */
test.describe('functional PIM employee list search', () => {
    test.beforeEach(async ({ adminSession }) => {
        await adminSession.employeeListPage.openEmployeeList();
    });

    test(
        'should find the employee by name',
        { tag: '@smoke' },
        async ({ adminSession, tempTestEmployee }) => {
            await test.step('WHEN the list is filtered by the employee name', async () => {
                await adminSession.employeeListPage.searchByEmployeeName(
                    tempTestEmployee.firstName
                );
            });

            await test.step('THEN the employee is listed among the results', async () => {
                await expect(
                    adminSession.employeeListPage.resultRowContaining(
                        tempTestEmployee.employeeId!
                    )
                ).toBeVisible();
                await expect(
                    adminSession.employeeListPage.recordsFoundMessage
                ).toBeVisible();
            });
        }
    );

    test(
        'should find the employee by employee id',
        { tag: '@regression' },
        async ({ adminSession, tempTestEmployee }) => {
            await test.step('WHEN the list is filtered by the employee id', async () => {
                await adminSession.employeeListPage.searchByEmployeeId(
                    tempTestEmployee.employeeId!
                );
            });

            await test.step('THEN only the matching employee is listed', async () => {
                await expect(
                    adminSession.employeeListPage.resultRows
                ).toHaveCount(1);
                await expect(
                    adminSession.employeeListPage.resultRowContaining(
                        tempTestEmployee.employeeId!
                    )
                ).toBeVisible();
            });
        }
    );

    test(
        'should show the empty state when the search matches no employee',
        { tag: '@regression' },
        async ({ adminSession }) => {
            await test.step('WHEN the list is filtered by a name that matches nothing', async () => {
                await adminSession.employeeListPage.searchByEmployeeName(
                    NO_MATCH_EMPLOYEE_NAME
                );
            });

            await test.step('THEN the no-records message replaces the results', async () => {
                await expect(
                    adminSession.employeeListPage.noRecordsFoundMessage
                ).toBeVisible();
                await expect(
                    adminSession.employeeListPage.resultRows
                ).toHaveCount(0);
                await expect(
                    adminSession.employeeListPage.recordsFoundMessage
                ).toBeHidden();
            });
        }
    );
});
