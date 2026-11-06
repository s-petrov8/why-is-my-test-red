import { appConfig } from '../../../config/app';
import { ApiEndpoints } from '../../../enums/app/app';
import {
    Employee,
    EmployeeListResponseSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';
import { InvalidParameterResponseSchema } from '../../../fixtures/api/schemas/app/errorSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { INVALID_EMPLOYEE_SEARCH } from '../../../test-data/static/app/invalidEmployeeSearch';

const searchUrl = (params: Record<string, string>): string =>
    `${ApiEndpoints.PIM_EMPLOYEES}?${new URLSearchParams(params).toString()}`;

/**
 * Ways the `name` filter is expected to match one known employee. The search term
 * is derived from the employee the fixture created, so these cannot live in a
 * static data file -- static files hold literal values only.
 */
const MATCHING_NAME_TERMS = [
    {
        description: 'first name',
        term: (employee: Employee): string => employee.firstName,
    },
    {
        description: 'last name',
        term: (employee: Employee): string => employee.lastName,
    },
    {
        description: 'full name',
        term: (employee: Employee): string =>
            `${employee.firstName} ${employee.lastName}`,
    },
    {
        description: 'lower-cased first name',
        term: (employee: Employee): string => employee.firstName.toLowerCase(),
    },
] as const;

test.describe('api/v2/pim/employees GET', () => {
    // ==================== Matching searches ====================

    test(
        'should find the employee by exact employee id',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: searchUrl({ employeeId: tempTestEmployee.employeeId! }),
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = EmployeeListResponseSchema.parse(body);
            expect(list.data.map((employee) => employee.empNumber)).toContain(
                tempTestEmployee.empNumber
            );
        }
    );

    for (const { description, term } of MATCHING_NAME_TERMS) {
        test(
            `should find the employee by ${description}`,
            { tag: '@api' },
            async ({ apiRequest, tempTestEmployee }) => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: searchUrl({ name: term(tempTestEmployee) }),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const list = EmployeeListResponseSchema.parse(body);
                expect(
                    list.data.map((employee) => employee.empNumber)
                ).toContain(tempTestEmployee.empNumber);
            }
        );
    }

    test(
        'should find the employee by employee id via the nameOrId filter',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: searchUrl({ nameOrId: tempTestEmployee.employeeId! }),
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = EmployeeListResponseSchema.parse(body);
            expect(list.data.map((employee) => employee.empNumber)).toContain(
                tempTestEmployee.empNumber
            );
        }
    );

    // ==================== Non-matching searches ====================
    //
    // These assert the employee is ABSENT from the results rather than asserting
    // an empty result set. The demo application is shared, so another record could
    // legitimately match the same term -- but nothing can make an exact-match
    // filter return an employee whose id does not equal the search value.

    test(
        'should not match the employee by a partial employee id',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: searchUrl({
                    employeeId: tempTestEmployee.employeeId!.slice(0, 4),
                }),
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = EmployeeListResponseSchema.parse(body);
            expect(
                list.data.map((employee) => employee.empNumber)
            ).not.toContain(tempTestEmployee.empNumber);
        }
    );

    test(
        'should not match an employee id through the name filter',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: searchUrl({ name: tempTestEmployee.employeeId! }),
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = EmployeeListResponseSchema.parse(body);
            expect(
                list.data.map((employee) => employee.empNumber)
            ).not.toContain(tempTestEmployee.empNumber);
        }
    );

    // ==================== Combined filters ====================

    test(
        'should combine the name and employee id filters with AND semantics',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const otherEmployeeId = `9${tempTestEmployee.employeeId!.slice(1)}`;

            await test.step('GIVEN both filters describe the same employee', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: searchUrl({
                        name: tempTestEmployee.firstName,
                        employeeId: tempTestEmployee.employeeId!,
                    }),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const list = EmployeeListResponseSchema.parse(body);
                expect(
                    list.data.map((employee) => employee.empNumber)
                ).toContain(tempTestEmployee.empNumber);
            });

            await test.step('WHEN the employee id belongs to a different employee THEN the employee is excluded', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: searchUrl({
                        name: tempTestEmployee.firstName,
                        employeeId: otherEmployeeId,
                    }),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const list = EmployeeListResponseSchema.parse(body);
                expect(
                    list.data.map((employee) => employee.empNumber)
                ).not.toContain(tempTestEmployee.empNumber);
            });
        }
    );

    // ==================== Unfiltered collection ====================

    test(
        'should return a paged collection when no filter is supplied',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: ApiEndpoints.PIM_EMPLOYEES,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = EmployeeListResponseSchema.parse(body);

            // The page is capped by the endpoint's default limit, so it holds at
            // most as many records as the total match count reports.
            expect(list.data.length).toBeGreaterThan(0);
            expect(list.meta.total).toBeGreaterThanOrEqual(list.data.length);
        }
    );

    // ==================== Rejected parameters ====================

    for (const {
        description,
        param,
        value,
        invalidKey,
    } of INVALID_EMPLOYEE_SEARCH) {
        test(
            `should reject a search with ${description}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: searchUrl({ [param]: value }),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(422);
                const error = InvalidParameterResponseSchema.parse(body);
                expect(error.error.data.invalidParamKeys).toEqual([invalidKey]);
            }
        );
    }
});
