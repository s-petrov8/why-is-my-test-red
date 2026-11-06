import { appConfig } from '../../../config/app';
import { ENTITLED_DAYS } from '../../../config/leave';
import {
    ApiEndpoints,
    ReportingMethodIds,
    ReservedHolidayWeeks,
} from '../../../enums/app/app';
import { SupervisorResponseSchema } from '../../../fixtures/api/schemas/app/employeeSchema';
import {
    DeleteLeaveRecordsResponseSchema,
    LeaveEntitlementResponseSchema,
    LeaveTypeListResponseSchema,
} from '../../../fixtures/api/schemas/app/leaveSchema';
import {
    DeleteUsersResponseSchema,
    UserResponseSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { createHoliday, deleteHolidays } from '../../../helpers/app/leave';
import {
    formatIsoDate,
    getLeavePeriod,
    getLeaveWeek,
    getNextJuneWeek,
} from '../../../helpers/util/util';
import { createHolidayData } from '../../../test-data/factories/app/leave.factory';
import { createUserData } from '../../../test-data/factories/app/user.factory';

/**
 * The owning tests for shapes that fixtures and teardown read without validating,
 * as the project overrides in `AGENTS.md` require. A bug in one of these responses
 * fails the one test here that names it, and setup carries on.
 */
test.describe('api/v2 shapes that setup and teardown rely on', () => {
    let holidayIdToDelete: number | undefined;
    let userIdToDelete: number | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (holidayIdToDelete !== undefined) {
            const id = holidayIdToDelete;
            holidayIdToDelete = undefined;
            await deleteHolidays(apiRequest, [id]);
        }

        if (userIdToDelete !== undefined) {
            const id = userIdToDelete;
            userIdToDelete = undefined;
            const { status } = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.ADMIN_USERS,
                baseUrl: appConfig.apiUrl,
                body: { ids: [id] },
            });
            expect(status).toBe(200);
        }
    });

    test(
        'should list leave types with their exact shape',
        { tag: '@api' },
        async ({ apiRequest, leaveType }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: ApiEndpoints.LEAVE_TYPES,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const list = LeaveTypeListResponseSchema.parse(body);
            expect(list.data).toContainEqual(
                expect.objectContaining({ id: leaveType.id })
            );
        }
    );

    test(
        'should grant an entitlement and answer with its exact shape',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newTempUser }) => {
            const { monday } = getLeaveWeek();
            const period = getLeavePeriod(monday);
            const employee = await newTempUser();

            const { status, body } = await apiRequest({
                method: 'POST',
                url: ApiEndpoints.LEAVE_ENTITLEMENTS,
                baseUrl: appConfig.apiUrl,
                body: {
                    empNumber: employee.empNumber,
                    leaveTypeId: leaveType.id,
                    fromDate: formatIsoDate(period.fromDate),
                    toDate: formatIsoDate(period.toDate),
                    entitlement: ENTITLED_DAYS,
                },
            });

            expect(status).toBe(200);
            const entitlement = LeaveEntitlementResponseSchema.parse(body);
            expect(entitlement.data).toMatchObject({
                entitlement: ENTITLED_DAYS,
                daysUsed: 0,
                deleted: false,
                deletable: true,
            });
        }
    );

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
        'should create and delete a user account with their exact shapes',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            let userId = 0;

            await test.step('WHEN an account is created', async () => {
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: createUserData(tempTestEmployee.empNumber),
                });

                expect(status).toBe(200);
                userId = UserResponseSchema.parse(body).data.id;
                userIdToDelete = userId;
            });

            await test.step('WHEN it is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [userId] },
                });

                expect(status).toBe(200);
                userIdToDelete = undefined;
                const deleted = DeleteUsersResponseSchema.parse(body);
                expect(deleted.data).toEqual([userId]);
            });
        }
    );

    test(
        'should delete a holiday with the exact shape',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { monday } = getNextJuneWeek(
                ReservedHolidayWeeks.DELETED_HOLIDAY
            );
            let holidayId = 0;

            await test.step('GIVEN a holiday', async () => {
                holidayId = (
                    await createHoliday(apiRequest, createHolidayData(monday))
                ).id;
                holidayIdToDelete = holidayId;
            });

            await test.step('WHEN it is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.LEAVE_HOLIDAYS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [holidayId] },
                });

                expect(status).toBe(200);
                holidayIdToDelete = undefined;
                const deleted = DeleteLeaveRecordsResponseSchema.parse(body);
                expect(deleted.data).toEqual([holidayId]);
            });
        }
    );
});
