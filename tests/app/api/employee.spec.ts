import { appConfig } from '../../../config/app';
import { ApiEndpoints } from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    DeleteEmployeesResponseSchema,
    EmployeeResponseSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';
import { createEmployeeData } from '../../../test-data/factories/app/employee.factory';
import { INVALID_EMPLOYEE_DATA } from '../../../test-data/static/app/invalidEmployeeData';
import { InvalidParameterResponseSchema } from '../../../fixtures/api/schemas/app/errorSchema';
import { VALID_EMPLOYEE_DATA } from '../../../test-data/static/app/validEmployeeData';

test.describe('api/v2/pim/employees', () => {
    let empNumberToClean: number | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (empNumberToClean !== undefined) {
            const id = empNumberToClean;
            empNumberToClean = undefined;
            const { status, body } = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.PIM_EMPLOYEES,
                baseUrl: appConfig.apiUrl,
                body: { ids: [id] },
            });
            expect(status).toBe(200);
            const deleteResponse = DeleteEmployeesResponseSchema.parse(body);
            expect(deleteResponse.data).toEqual([String(id)]);
        }
    });

    for (const { description, overrides, expected } of VALID_EMPLOYEE_DATA) {
        test(
            `should create an employee with ${description}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const requestBody = { ...createEmployeeData(), ...overrides };

                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.PIM_EMPLOYEES,
                    baseUrl: appConfig.apiUrl,
                    body: requestBody,
                });
                expect(status).toBe(200);
                const employeeResponse = EmployeeResponseSchema.parse(body);
                empNumberToClean = employeeResponse.data.empNumber;
                expect(employeeResponse.data).toMatchObject({
                    ...requestBody,
                    ...expected,
                });

                expect(employeeResponse.data.terminationId).toBeNull();
            }
        );
    }

    for (const {
        description,
        invalidKey,
        ...invalidFields
    } of INVALID_EMPLOYEE_DATA) {
        test(
            `should reject an employee with ${description}`,
            { tag: '@api' },
            async ({ apiRequest }) => {
                const requestBody = {
                    ...createEmployeeData(),
                    ...invalidFields,
                };
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.PIM_EMPLOYEES,
                    baseUrl: appConfig.apiUrl,
                    body: requestBody,
                });
                if (status === 200) {
                    const employeeResponse = EmployeeResponseSchema.parse(body);
                    empNumberToClean = employeeResponse.data.empNumber;
                }

                expect(status).toBe(422);
                const error = InvalidParameterResponseSchema.parse(body);
                expect(error.error.data.invalidParamKeys).toEqual([invalidKey]);
            }
        );
    }

    test(
        'should delete an employee',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { empNumber } = tempTestEmployee;

            await test.step('WHEN the employee is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.PIM_EMPLOYEES,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [empNumber] },
                });

                expect(status).toBe(200);
                const deleteResponse =
                    DeleteEmployeesResponseSchema.parse(body);
                expect(deleteResponse.data).toEqual([String(empNumber)]);
            });

            await test.step('THEN the employee can no longer be retrieved', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(422);
                const error = InvalidParameterResponseSchema.parse(body);
                expect(error.error.data.invalidParamKeys).toEqual([
                    'empNumber',
                ]);
            });
        }
    );
});
