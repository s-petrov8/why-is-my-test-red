import { appConfig } from '../../../config/app';
import { ApiEndpoints, Messages } from '../../../enums/app/app';
import {
    EmployeeListResponse,
    EmployeeResponse,
    JobDetailsResponse,
    JobDetailsResponseSchema,
    TerminationResponseSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';
import { RecordsNotFoundResponseSchema } from '../../../fixtures/api/schemas/app/errorSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { readSignInRefusal } from '../../../helpers/app/createStorageState';
import {
    reactivateEmployee,
    submitReactivation,
    terminateEmployee,
} from '../../../helpers/app/termination';
import { createTerminationData } from '../../../test-data/factories/app/employee.factory';

/**
 * Termination and reactivation of throwaway employees. The fixtures remove each one,
 * termination record included, so nothing here needs its own cleanup. Termination ends
 * the employee's sessions at once, so a session opened before it is not reused after.
 */
test.describe('api/v2/pim/employees terminations', () => {
    test(
        'should terminate an employee, and set the termination on the employee and their job details',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { empNumber } = tempTestEmployee;
            const termination = createTerminationData();
            let terminationId = 0;

            await test.step('WHEN the employee is terminated', async () => {
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_TERMINATIONS_SUFFIX}`,
                    baseUrl: appConfig.apiUrl,
                    body: termination,
                });

                expect(status).toBe(200);
                const created = TerminationResponseSchema.parse(body);
                expect(created.data).toMatchObject({
                    date: termination.date,
                    note: termination.note,
                    terminationReason: { id: termination.terminationReasonId },
                });
                expect(created.meta.empNumber).toBe(empNumber);
                terminationId = created.data.id;
            });

            await test.step('THEN the employee points at the record', async () => {
                const { status, body } = await apiRequest<EmployeeResponse>({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                expect(body.data.terminationId).toBe(terminationId);
            });

            await test.step('AND the job details carry it', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_JOB_DETAILS_SUFFIX}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                expect(
                    JobDetailsResponseSchema.parse(body).data
                        .employeeTerminationRecord
                ).toEqual({ id: terminationId, date: termination.date });
            });
        }
    );

    test(
        'should reactivate an employee, clearing the record and restoring their listing, and answer 404 when not terminated',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const { empNumber, employeeId } = tempTestEmployee;
            const listingUrl = `${ApiEndpoints.PIM_EMPLOYEES}?employeeId=${employeeId}`;

            await test.step('GIVEN a terminated employee', async () => {
                await terminateEmployee(apiRequest, empNumber);
            });

            await test.step('AND they have left the default list', async () => {
                const { status, body } = await apiRequest<EmployeeListResponse>(
                    {
                        method: 'GET',
                        url: listingUrl,
                        baseUrl: appConfig.apiUrl,
                    }
                );

                expect(status).toBe(200);
                expect(body.data).toEqual([]);
            });

            await test.step('WHEN they are reactivated', async () => {
                const { status, body } = await submitReactivation(
                    apiRequest,
                    empNumber
                );

                expect(status).toBe(200);
                expect(
                    TerminationResponseSchema.parse(body).meta.empNumber
                ).toBe(empNumber);
            });

            await test.step('THEN the employee points at no record', async () => {
                const { status, body } = await apiRequest<EmployeeResponse>({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                expect(body.data.terminationId).toBeNull();
            });

            await test.step('AND the job details carry none', async () => {
                const { status, body } = await apiRequest<JobDetailsResponse>({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_JOB_DETAILS_SUFFIX}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                expect(body.data.employeeTerminationRecord.id).toBeNull();
            });

            await test.step('AND they are back on the default list', async () => {
                const { status, body } = await apiRequest<EmployeeListResponse>(
                    {
                        method: 'GET',
                        url: listingUrl,
                        baseUrl: appConfig.apiUrl,
                    }
                );

                expect(status).toBe(200);
                expect(
                    body.data.map((employee): number => employee.empNumber)
                ).toEqual([empNumber]);
            });

            await test.step('WHEN someone not terminated is reactivated THEN it is 404', async () => {
                const { status, body } = await submitReactivation(
                    apiRequest,
                    empNumber
                );

                expect(status).toBe(404);
                expect(RecordsNotFoundResponseSchema.parse(body)).toBeTruthy();
            });
        }
    );

    test(
        'should end the session of a terminated user and refuse their sign-in until they are reactivated',
        { tag: '@api' },
        async ({ apiRequest, apiRequestAs, newApiUser }) => {
            const user = await newApiUser();
            const ownRecordUrl = `${ApiEndpoints.PIM_EMPLOYEES}/${user.empNumber}`;

            await test.step('GIVEN the user has a working session', async () => {
                const { status } = await user.api({
                    method: 'GET',
                    url: ownRecordUrl,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
            });

            await test.step('WHEN they are terminated', async () => {
                await terminateEmployee(apiRequest, user.empNumber);
            });

            await test.step('THEN that session answers 401', async () => {
                const { status } = await user.api({
                    method: 'GET',
                    url: ownRecordUrl,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(401);
            });

            await test.step('AND a new sign-in is refused, naming the termination', async () => {
                expect(await readSignInRefusal(user)).toContain(
                    Messages.EMPLOYEE_TERMINATED
                );
            });

            await test.step('WHEN they are reactivated', async () => {
                await reactivateEmployee(apiRequest, user.empNumber);
            });

            await test.step('THEN they can sign in and reach their record', async () => {
                const newSession = await apiRequestAs(user);
                const { status } = await newSession({
                    method: 'GET',
                    url: ownRecordUrl,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
            });
        }
    );
});
