import { appConfig } from '../../../config/app';
import { ENTITLED_DAYS } from '../../../config/leave';
import {
    ApiEndpoints,
    LeaveActions,
    LeaveRefusals,
    ReservedHolidayWeeks,
} from '../../../enums/app/app';
import { BadRequestResponseSchema } from '../../../fixtures/api/schemas/app/errorSchema';
import {
    ApplyLeaveResponseSchema,
    DeleteLeaveRecordsResponseSchema,
    DetailedLeaveRequestResponseSchema,
    HolidayResponseSchema,
    LeaveBalanceBreakdownResponseSchema,
    LeaveDayListResponseSchema,
    LeaveEntitlementResponseSchema,
    LeavePeriodResponseSchema,
    LeaveRequestResponseSchema,
    LeaveTypeListResponseSchema,
    MyLeaveRequestListResponseSchema,
    WorkWeekResponseSchema,
} from '../../../fixtures/api/schemas/app/leaveSchema';
import {
    DeleteWorkShiftsResponseSchema,
    WorkShiftResponseSchema,
} from '../../../fixtures/api/schemas/app/workShiftSchema';
import {
    DeleteUsersResponseSchema,
    UserResponseSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    applyForLeave,
    deleteHolidays,
    submitLeaveRequest,
} from '../../../helpers/app/leave';
import { deleteWorkShift } from '../../../helpers/app/workShift';
import {
    formatIsoDate,
    getLeavePeriod,
    getLeaveWeek,
    getNextJuneWeek,
} from '../../../helpers/util/util';
import {
    createHolidayData,
    createLeaveRequestData,
    createWorkShiftData,
} from '../../../test-data/factories/app/leave.factory';
import { createUserData } from '../../../test-data/factories/app/user.factory';

/** The length of the shift the work shift shapes are checked with. */
const SHIFT_HOURS = {
    hoursPerDay: '4',
    startTime: '09:00',
    endTime: '13:00',
};

/**
 * The owning tests for shapes that fixtures, teardown and shared helpers read without
 * validating, as the project overrides in `AGENTS.md` require. A bug in one of these
 * responses fails the one test here that names it, and the rest carry on.
 */
test.describe('api/v2 shapes that setup, teardown and shared helpers rely on', () => {
    let holidayIdToDelete: number | undefined;
    let userIdToDelete: number | undefined;
    let workShiftIdToDelete: number | undefined;

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

        if (workShiftIdToDelete !== undefined) {
            const id = workShiftIdToDelete;
            workShiftIdToDelete = undefined;
            await deleteWorkShift(apiRequest, id);
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
        'should create and delete a holiday with their exact shapes',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { monday } = getNextJuneWeek(
                ReservedHolidayWeeks.DELETED_HOLIDAY
            );
            let holidayId = 0;

            await test.step('WHEN a holiday is created', async () => {
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.LEAVE_HOLIDAYS,
                    baseUrl: appConfig.apiUrl,
                    body: createHolidayData(monday),
                });

                expect(status).toBe(200);
                holidayId = HolidayResponseSchema.parse(body).data.id;
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

    test(
        'should create a leave request and answer with its exact shape',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();

            const { status, body } = await submitLeaveRequest(
                employee.api,
                createLeaveRequestData({
                    leaveTypeId: leaveType.id,
                    fromDate: monday,
                })
            );

            expect(status).toBe(200);
            const created = ApplyLeaveResponseSchema.parse(body);
            expect(created.data.leaveType.id).toBe(leaveType.id);
            expect(created.meta.empNumber).toBe(employee.empNumber);
        }
    );

    test(
        'should refuse a leave request with the exact shape of a 400',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: 0 });

            const { status, body } = await submitLeaveRequest(
                employee.api,
                createLeaveRequestData({
                    leaveTypeId: leaveType.id,
                    fromDate: monday,
                })
            );

            expect(status).toBe(400);
            const refusal = BadRequestResponseSchema.parse(body);
            expect(refusal.error.message).toBe(LeaveRefusals.BALANCE_EXCEEDED);
        }
    );

    test(
        'should read a leave request with its exact detailed shape',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            let requestId = 0;

            await test.step('GIVEN a leave request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN it is read', async () => {
                const { status, body } = await employee.api({
                    method: 'GET',
                    url: `${ApiEndpoints.LEAVE_REQUESTS}/${requestId}?model=detailed`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const read = DetailedLeaveRequestResponseSchema.parse(body);
                expect(read.data.id).toBe(requestId);
            });
        }
    );

    test(
        'should list own leave requests with their exact shape',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            let requestId = 0;

            await test.step('GIVEN a leave request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN the list is read', async () => {
                const { status, body } = await employee.api({
                    method: 'GET',
                    url: ApiEndpoints.LEAVE_REQUESTS,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const list = MyLeaveRequestListResponseSchema.parse(body);
                expect(list.meta.total).toBe(1);
                expect(list.data[0].id).toBe(requestId);
            });
        }
    );

    test(
        'should change a leave request and answer with its exact shape',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            let requestId = 0;

            await test.step('GIVEN a leave request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN the admin approves it', async () => {
                const { status, body } = await apiRequest({
                    method: 'PUT',
                    url: `${ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS}/${requestId}`,
                    baseUrl: appConfig.apiUrl,
                    body: { action: LeaveActions.APPROVE },
                });

                expect(status).toBe(200);
                const changed = LeaveRequestResponseSchema.parse(body);
                expect(changed.data.id).toBe(requestId);
            });
        }
    );

    test(
        'should read a balance over dates with its exact shape',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const isoDate = formatIsoDate(monday);
            const employee = await newLeaveEmployee();

            const { status, body } = await employee.api({
                method: 'GET',
                url: `${ApiEndpoints.LEAVE_BALANCE_BY_TYPE}/${leaveType.id}?fromDate=${isoDate}&toDate=${isoDate}`,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            const { data } = LeaveBalanceBreakdownResponseSchema.parse(body);
            expect(data.breakdown).toHaveLength(1);
            expect(data.breakdown[0].balance.entitled).toBe(ENTITLED_DAYS);
        }
    );

    test(
        "should read a leave request's days with their exact shape",
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            let requestId = 0;

            await test.step('GIVEN a leave request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN its days are read', async () => {
                const { status, body } = await employee.api({
                    method: 'GET',
                    url: `${ApiEndpoints.LEAVE_REQUESTS}/${requestId}${ApiEndpoints.LEAVE_DAYS_SUFFIX}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const days = LeaveDayListResponseSchema.parse(body);
                expect(days.meta.total).toBe(1);
            });
        }
    );

    test(
        'should read the work week with its exact shape',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: ApiEndpoints.LEAVE_WORK_WEEK,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(200);
            expect(WorkWeekResponseSchema.parse(body)).toBeTruthy();
        }
    );

    test(
        'should create and delete a work shift with their exact shapes',
        { tag: '@api' },
        async ({ apiRequest }) => {
            let workShiftId = 0;

            await test.step('WHEN a work shift is created', async () => {
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.ADMIN_WORK_SHIFTS,
                    baseUrl: appConfig.apiUrl,
                    body: createWorkShiftData({
                        empNumbers: [],
                        hours: SHIFT_HOURS,
                    }),
                });

                expect(status).toBe(200);
                workShiftId = WorkShiftResponseSchema.parse(body).data.id;
                workShiftIdToDelete = workShiftId;
            });

            await test.step('WHEN it is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_WORK_SHIFTS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [workShiftId] },
                });

                expect(status).toBe(200);
                workShiftIdToDelete = undefined;
                const deleted = DeleteWorkShiftsResponseSchema.parse(body);
                expect(deleted.data).toEqual([workShiftId]);
            });
        }
    );

    // Writes back the value it reads, so the leave period doesn't change and needs no restore.
    test(
        'should update the leave period and answer with its exact shape',
        { tag: '@destructive' },
        async ({ apiRequest }) => {
            let startMonth = 0;
            let startDay = 0;

            await test.step('GIVEN the current leave period', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: ApiEndpoints.LEAVE_PERIOD,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                ({ startMonth, startDay } =
                    LeavePeriodResponseSchema.parse(body).data);
            });

            await test.step('WHEN it is saved unchanged', async () => {
                const { status, body } = await apiRequest({
                    method: 'PUT',
                    url: ApiEndpoints.LEAVE_PERIOD,
                    baseUrl: appConfig.apiUrl,
                    body: { startMonth, startDay },
                });

                expect(status).toBe(200);
                expect(
                    LeavePeriodResponseSchema.parse(body).data
                ).toMatchObject({ startMonth, startDay });
            });
        }
    );
});
