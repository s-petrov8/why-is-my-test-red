import { appConfig } from '../../../config/app';
import { ApiEndpoints, ReportingMethodIds } from '../../../enums/app/app';
import {
    DeleteSupervisorsResponseSchema,
    EmployeeListResponse,
    SupervisorResponseSchema,
} from '../../../fixtures/api/schemas/app/employeeSchema';
import type { InvalidParameterResponse } from '../../../fixtures/api/schemas/app/errorSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { assignSupervisor } from '../../../helpers/app/reportingLine';
import { formatIsoDate } from '../../../helpers/util/util';
import { createTerminationData } from '../../../test-data/factories/app/employee.factory';

/**
 * What a reporting line gives a supervisor, and what it doesn't. Being a supervisor is
 * derived from having a line, and is read again on each request. The people are removed
 * by the fixtures, and their lines go with them, so nothing here needs its own cleanup.
 */
test.describe('api/v2/pim/employees reporting lines', () => {
    test(
        'should add a supervisor and answer with the exact shape',
        { tag: '@api' },
        async ({ apiRequest, newTempUser }) => {
            const subordinate = await newTempUser();
            const supervisor = await newTempUser();

            const { status, body } = await apiRequest({
                method: 'POST',
                url: `${ApiEndpoints.PIM_EMPLOYEES}/${subordinate.empNumber}${ApiEndpoints.PIM_SUPERVISORS_SUFFIX}`,
                baseUrl: appConfig.apiUrl,
                body: {
                    empNumber: supervisor.empNumber,
                    reportingMethodId: ReportingMethodIds.DIRECT,
                },
            });

            expect(status).toBe(200);
            const reportingLine = SupervisorResponseSchema.parse(body);
            expect(reportingLine.data.supervisor.empNumber).toBe(
                supervisor.empNumber
            );
        }
    );

    test(
        'should limit a supervisor to their subordinate',
        { tag: '@api' },
        async ({ newTempUser, newSupervisorOf, tempTestEmployee }) => {
            const subordinate = await newTempUser();
            const supervisor = await newSupervisorOf(subordinate);

            await test.step('WHEN the supervisor lists employees THEN only the subordinate is there', async () => {
                const { status, body } =
                    await supervisor.api<EmployeeListResponse>({
                        method: 'GET',
                        url: ApiEndpoints.PIM_EMPLOYEES,
                        baseUrl: appConfig.apiUrl,
                    });

                expect(status).toBe(200);
                expect(
                    body.data.map(({ empNumber }): number => empNumber)
                ).toEqual([subordinate.empNumber]);
                expect(body.meta.total).toBe(1);
            });

            await test.step('WHEN the supervisor reads the subordinate THEN it is allowed', async () => {
                const { status } = await supervisor.api({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${subordinate.empNumber}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
            });

            await test.step('WHEN the supervisor reads an unrelated employee THEN it is refused', async () => {
                const { status, body } =
                    await supervisor.api<InvalidParameterResponse>({
                        method: 'GET',
                        url: `${ApiEndpoints.PIM_EMPLOYEES}/${tempTestEmployee.empNumber}`,
                        baseUrl: appConfig.apiUrl,
                    });

                expect(status).toBe(422);
                expect(body.error.data.invalidParamKeys).toEqual(['empNumber']);
            });
        }
    );

    test(
        'should revoke access in the same session when the line is removed, and answer 404 for the absent line',
        { tag: '@api' },
        async ({ apiRequest, newTempUser, newSupervisorOf }) => {
            const subordinate = await newTempUser();
            const supervisor = await newSupervisorOf(subordinate);
            const linesUrl = `${ApiEndpoints.PIM_EMPLOYEES}/${subordinate.empNumber}${ApiEndpoints.PIM_SUPERVISORS_SUFFIX}`;
            const absentLineRequests = [
                {
                    description: 'read',
                    method: 'GET',
                    url: `${linesUrl}/${supervisor.empNumber}`,
                },
                {
                    description: 'update',
                    method: 'PUT',
                    url: `${linesUrl}/${supervisor.empNumber}`,
                    body: { reportingMethodId: ReportingMethodIds.INDIRECT },
                },
                {
                    description: 'delete',
                    method: 'DELETE',
                    url: linesUrl,
                    body: { ids: [supervisor.empNumber] },
                },
            ] as const;

            await test.step('GIVEN the supervisor can read the subordinate', async () => {
                const { status } = await supervisor.api({
                    method: 'GET',
                    url: `${ApiEndpoints.PIM_EMPLOYEES}/${subordinate.empNumber}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
            });

            await test.step('WHEN the line is removed', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: linesUrl,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [supervisor.empNumber] },
                });

                expect(status).toBe(200);
                expect(
                    DeleteSupervisorsResponseSchema.parse(body).data
                ).toEqual([supervisor.empNumber]);
            });

            await test.step('THEN the same session can no longer read the subordinate', async () => {
                const { status, body } =
                    await supervisor.api<InvalidParameterResponse>({
                        method: 'GET',
                        url: `${ApiEndpoints.PIM_EMPLOYEES}/${subordinate.empNumber}`,
                        baseUrl: appConfig.apiUrl,
                    });

                expect(status).toBe(422);
                expect(body.error.data.invalidParamKeys).toEqual(['empNumber']);
            });

            await test.step('AND its employee list is empty', async () => {
                const { status, body } =
                    await supervisor.api<EmployeeListResponse>({
                        method: 'GET',
                        url: ApiEndpoints.PIM_EMPLOYEES,
                        baseUrl: appConfig.apiUrl,
                    });

                expect(status).toBe(200);
                expect(body.data).toEqual([]);
            });

            for (const { description, ...request } of absentLineRequests) {
                await test.step(`AND a ${description} of the absent line is 404`, async () => {
                    const { status } = await apiRequest({
                        ...request,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status).toBe(404);
                });
            }
        }
    );

    test(
        "should not let the boss of a supervisor reach the supervisor's subordinate",
        { tag: '@api' },
        async ({
            adminContext,
            newTempUser,
            newSupervisorOf,
            tempTestEmployee,
        }) => {
            const supervisor = await newTempUser();
            const boss = await newSupervisorOf(supervisor);

            await test.step('GIVEN the supervisor has a subordinate', async () => {
                await assignSupervisor(adminContext, {
                    empNumber: tempTestEmployee.empNumber,
                    supervisorEmpNumber: supervisor.empNumber,
                });
            });

            await test.step('WHEN the boss lists employees THEN only their own subordinate is there', async () => {
                const { status, body } = await boss.api<EmployeeListResponse>({
                    method: 'GET',
                    url: ApiEndpoints.PIM_EMPLOYEES,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                expect(
                    body.data.map(({ empNumber }): number => empNumber)
                ).toEqual([supervisor.empNumber]);
            });

            await test.step("WHEN the boss reads the supervisor's subordinate THEN it is refused", async () => {
                const { status, body } =
                    await boss.api<InvalidParameterResponse>({
                        method: 'GET',
                        url: `${ApiEndpoints.PIM_EMPLOYEES}/${tempTestEmployee.empNumber}`,
                        baseUrl: appConfig.apiUrl,
                    });

                expect(status).toBe(422);
                expect(body.error.data.invalidParamKeys).toEqual(['empNumber']);
            });
        }
    );

    test(
        "should refuse a supervisor's writes to a subordinate's job, termination and lines",
        { tag: '@api' },
        async ({ adminContext, newApiUser, tempTestEmployee }) => {
            const supervisor = await newApiUser();
            const subordinateUrl = `${ApiEndpoints.PIM_EMPLOYEES}/${tempTestEmployee.empNumber}`;
            const deniedWrites = [
                {
                    description: 'job details',
                    method: 'PUT',
                    url: `${subordinateUrl}${ApiEndpoints.PIM_JOB_DETAILS_SUFFIX}`,
                    body: { joinedDate: formatIsoDate(new Date()) },
                },
                {
                    description: 'termination',
                    method: 'POST',
                    url: `${subordinateUrl}${ApiEndpoints.PIM_TERMINATIONS_SUFFIX}`,
                    body: createTerminationData(),
                },
                {
                    description: 'adding a supervisor',
                    method: 'POST',
                    url: `${subordinateUrl}${ApiEndpoints.PIM_SUPERVISORS_SUFFIX}`,
                    body: {
                        empNumber: supervisor.empNumber,
                        reportingMethodId: ReportingMethodIds.INDIRECT,
                    },
                },
            ] as const;

            await test.step('GIVEN the supervisor has a subordinate', async () => {
                await assignSupervisor(adminContext, {
                    empNumber: tempTestEmployee.empNumber,
                    supervisorEmpNumber: supervisor.empNumber,
                });
            });

            for (const { description, ...write } of deniedWrites) {
                await test.step(`WHEN the supervisor writes ${description} THEN it is 403`, async () => {
                    const { status } = await supervisor.api({
                        ...write,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status).toBe(403);
                });
            }
        }
    );
});
