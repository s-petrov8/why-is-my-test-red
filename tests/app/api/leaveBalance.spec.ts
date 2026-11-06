import { appConfig } from '../../../config/app';
import {
    ApiEndpoints,
    LeaveActions,
    LeaveDurationTypes,
    LeaveRefusals,
    LeaveStatuses,
} from '../../../enums/app/app';
import {
    DeleteLeaveRecordsResponseSchema,
    EligibleLeaveTypesResponseSchema,
    LeaveEntitlementReadResponseSchema,
    LeaveTypeResponseSchema,
} from '../../../fixtures/api/schemas/app/leaveSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    applyForLeave,
    changeLeaveRequest,
    grantLeaveEntitlement,
    readEntitlement,
    readLeaveBalance,
    readLeaveDays,
    readLeaveRequest,
    submitLeaveRequest,
    refusalOf,
} from '../../../helpers/app/leave';
import {
    createWorkShift,
    deleteWorkShift,
} from '../../../helpers/app/workShift';
import {
    addDays,
    getLeavePeriod,
    getLeaveWeek,
} from '../../../helpers/util/util';
import {
    createLeaveRequestData,
    createLeaveTypeName,
    createWorkShiftData,
} from '../../../test-data/factories/app/leave.factory';

/** The days a test's employee holds, unless the test says otherwise. */
const ENTITLED_DAYS = 5;

/** A morning of two hours, a quarter of the default 8-hour shift. */
const TWO_HOUR_DURATION = {
    type: LeaveDurationTypes.SPECIFY_TIME,
    fromTime: '09:00',
    toTime: '11:00',
};

const FOUR_HOUR_SHIFT = {
    hoursPerDay: '4',
    startTime: '09:00',
    endTime: '13:00',
};

test.describe('api/v2/leave balance and entitlements', () => {
    let leaveTypeIdToDelete: number | undefined;
    let workShiftIdToDelete: number | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (leaveTypeIdToDelete !== undefined) {
            const id = leaveTypeIdToDelete;
            leaveTypeIdToDelete = undefined;
            const { status, body } = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.LEAVE_TYPES,
                baseUrl: appConfig.apiUrl,
                body: { ids: [id] },
            });
            expect(status).toBe(200);
            expect(DeleteLeaveRecordsResponseSchema.parse(body)).toBeTruthy();
        }

        if (workShiftIdToDelete !== undefined) {
            const id = workShiftIdToDelete;
            workShiftIdToDelete = undefined;
            await deleteWorkShift(apiRequest, id);
        }
    });

    test(
        'should create a leave type and answer with its exact shape',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const leaveType = {
                name: createLeaveTypeName(),
                situational: false,
            };

            const { status, body } = await apiRequest({
                method: 'POST',
                url: ApiEndpoints.LEAVE_TYPES,
                baseUrl: appConfig.apiUrl,
                body: leaveType,
            });

            expect(status).toBe(200);
            const created = LeaveTypeResponseSchema.parse(body);
            leaveTypeIdToDelete = created.data.id;
            expect(created.data).toEqual({
                id: expect.any(Number),
                ...leaveType,
                deleted: false,
            });
        }
    );

    test(
        'should hold applied days as pending and move them to scheduled on approval without changing the balance',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee, newSupervisorOf }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });
            const supervisor = await newSupervisorOf(employee);
            let requestId = 0;

            await test.step('WHEN the employee applies for one day', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('THEN the day is pending and taken off the balance', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, monday)
                ).toMatchObject({
                    entitled: ENTITLED_DAYS,
                    pending: 1,
                    scheduled: 0,
                    taken: 0,
                    used: 1,
                    balance: ENTITLED_DAYS - 1,
                });
            });

            await test.step('WHEN the supervisor approves it', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.APPROVE
                );
            });

            await test.step('THEN the day is scheduled and the balance is unchanged', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, monday)
                ).toMatchObject({
                    entitled: ENTITLED_DAYS,
                    pending: 0,
                    scheduled: 1,
                    taken: 0,
                    used: 1,
                    balance: ENTITLED_DAYS - 1,
                });
            });
        }
    );

    test(
        'should give the days back when scheduled leave is cancelled',
        { tag: '@api' },
        async ({
            apiRequest,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });
            const supervisor = await newSupervisorOf(employee);
            const entitlementId = employee.entitlementId ?? 0;
            let requestId = 0;

            await test.step('GIVEN an applied day', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('AND the supervisor approved it', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.APPROVE
                );
            });

            await test.step('AND the entitlement counts it as used', async () => {
                const entitlement = await readEntitlement(
                    apiRequest,
                    entitlementId
                );

                expect(entitlement.daysUsed).toBe(1);
            });

            await test.step('WHEN the supervisor cancels it', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.CANCEL
                );
            });

            await test.step('THEN the entitlement no longer counts it', async () => {
                const entitlement = await readEntitlement(
                    apiRequest,
                    entitlementId
                );

                expect(entitlement.daysUsed).toBe(0);
            });

            await test.step('AND the balance is whole again', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, monday)
                ).toMatchObject({
                    scheduled: 0,
                    used: 0,
                    balance: ENTITLED_DAYS,
                });
            });
        }
    );

    test(
        'should give the days back when pending leave is rejected',
        { tag: '@api' },
        async ({
            apiRequest,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });
            const supervisor = await newSupervisorOf(employee);
            const entitlementId = employee.entitlementId ?? 0;
            let requestId = 0;

            await test.step('GIVEN an applied day', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN the supervisor rejects it', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.REJECT
                );
            });

            await test.step('THEN the entitlement no longer counts it', async () => {
                const entitlement = await readEntitlement(
                    apiRequest,
                    entitlementId
                );

                expect(entitlement.daysUsed).toBe(0);
            });

            await test.step('AND the balance is whole again', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, monday)
                ).toMatchObject({
                    pending: 0,
                    used: 0,
                    balance: ENTITLED_DAYS,
                });
            });
        }
    );

    test(
        'should accept leave using exactly the balance and refuse a further half day',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday, friday, nextMonday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });

            await test.step('WHEN the employee applies for all five days', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                        toDate: friday,
                    })
                );
            });

            await test.step('THEN nothing is left', async () => {
                const { balance } = await readLeaveBalance(
                    employee.api,
                    leaveType.id,
                    monday
                );

                expect(balance).toBe(0);
            });

            await test.step('AND a further half day is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData(
                                {
                                    leaveTypeId: leaveType.id,
                                    fromDate: nextMonday,
                                },
                                {
                                    duration: {
                                        type: LeaveDurationTypes.HALF_DAY_MORNING,
                                    },
                                }
                            )
                        )
                    )
                ).toBe(LeaveRefusals.BALANCE_EXCEEDED);
            });
        }
    );

    test(
        'should refuse leave without an entitlement and not offer the leave type',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: 0 });

            await test.step('WHEN the employee applies, THEN it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData({
                                leaveTypeId: leaveType.id,
                                fromDate: monday,
                            })
                        )
                    )
                ).toBe(LeaveRefusals.BALANCE_EXCEEDED);
            });

            await test.step('AND the leave type is not eligible for them', async () => {
                const { status, body } = await employee.api({
                    method: 'GET',
                    url: ApiEndpoints.LEAVE_ELIGIBLE_TYPES,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const eligible = EligibleLeaveTypesResponseSchema.parse(body);
                expect(eligible.data).not.toContainEqual(
                    expect.objectContaining({ id: leaveType.id })
                );
            });
        }
    );

    test(
        'should count only the working days of a range across a weekend',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { friday, nextMonday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });
            let requestId = 0;

            await test.step('WHEN the employee applies from Friday to Monday', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: friday,
                        toDate: nextMonday,
                    })
                );
            });

            await test.step('THEN the request counts two days', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.noOfDays).toBe(2);
            });

            await test.step('AND the weekend days show as such and count nothing', async () => {
                const days = await readLeaveDays(employee.api, requestId);

                expect(
                    days.map(({ leaveStatus }) => [
                        leaveStatus.name,
                        leaveStatus.lengthDays,
                    ])
                ).toEqual([
                    [LeaveStatuses.PENDING_APPROVAL, 1],
                    [LeaveStatuses.WEEKEND, 0],
                    [LeaveStatuses.WEEKEND, 0],
                    [LeaveStatuses.PENDING_APPROVAL, 1],
                ]);
            });

            await test.step('AND the balance loses two days', async () => {
                const { balance } = await readLeaveBalance(
                    employee.api,
                    leaveType.id,
                    friday
                );

                expect(balance).toBe(ENTITLED_DAYS - 2);
            });
        }
    );

    test(
        'should convert timed leave to days by the length of the shift',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const onDefaultShift = await newLeaveEmployee({ days: 1 });
            const onShortShift = await newLeaveEmployee({ days: 1 });
            const timedLeave = createLeaveRequestData(
                { leaveTypeId: leaveType.id, fromDate: monday },
                { duration: TWO_HOUR_DURATION }
            );

            await test.step('GIVEN one employee on a 4-hour shift', async () => {
                workShiftIdToDelete = await createWorkShift(
                    apiRequest,
                    createWorkShiftData({
                        empNumbers: [onShortShift.empNumber],
                        hours: FOUR_HOUR_SHIFT,
                    })
                );
            });

            await test.step('WHEN an employee on the 8-hour default applies for two hours', async () => {
                await applyForLeave(onDefaultShift.api, timedLeave);
            });

            await test.step('THEN it counts a quarter of a day', async () => {
                const { used } = await readLeaveBalance(
                    onDefaultShift.api,
                    leaveType.id,
                    monday
                );

                expect(used).toBe(0.25);
            });

            await test.step('WHEN the employee on the 4-hour shift applies for two hours', async () => {
                await applyForLeave(onShortShift.api, timedLeave);
            });

            await test.step('THEN it counts half a day', async () => {
                const { used } = await readLeaveBalance(
                    onShortShift.api,
                    leaveType.id,
                    monday
                );

                expect(used).toBe(0.5);
            });
        }
    );

    test(
        'should use the earliest entitlement first and reverse it on cancel',
        { tag: '@api' },
        async ({
            apiRequest,
            adminContext,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday, wednesday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: 2 });
            const supervisor = await newSupervisorOf(employee);
            const earlierId = employee.entitlementId ?? 0;
            const period = getLeavePeriod(monday);
            let laterId = 0;
            let requestId = 0;

            await test.step('GIVEN a second entitlement starting a day later', async () => {
                const later = await grantLeaveEntitlement(adminContext, {
                    empNumber: employee.empNumber,
                    leaveTypeId: leaveType.id,
                    fromDate: addDays(period.fromDate, 1),
                    toDate: period.toDate,
                    days: 2,
                });

                expect(later.id).not.toBe(earlierId);
                laterId = later.id;
            });

            await test.step('WHEN the employee applies for three days', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                        toDate: wednesday,
                    })
                );
            });

            await test.step('THEN the earlier entitlement is used up', async () => {
                const { daysUsed } = await readEntitlement(
                    apiRequest,
                    earlierId
                );

                expect(daysUsed).toBe(2);
            });

            await test.step('AND the later one covers the remainder', async () => {
                const { daysUsed } = await readEntitlement(apiRequest, laterId);

                expect(daysUsed).toBe(1);
            });

            await test.step('WHEN the supervisor cancels the request', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.CANCEL
                );
            });

            await test.step('THEN the earlier entitlement is free again', async () => {
                const { daysUsed } = await readEntitlement(
                    apiRequest,
                    earlierId
                );

                expect(daysUsed).toBe(0);
            });

            await test.step('AND so is the later one', async () => {
                const { daysUsed } = await readEntitlement(apiRequest, laterId);

                expect(daysUsed).toBe(0);
            });
        }
    );

    test(
        'should refuse to delete an entitlement in use and delete an unused one',
        { tag: '@api' },
        async ({ apiRequest, adminContext, leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: 2 });
            const inUseId = employee.entitlementId ?? 0;
            const period = getLeavePeriod(monday);
            let unusedId = 0;

            await test.step('GIVEN an unused entitlement starting a day later', async () => {
                const unused = await grantLeaveEntitlement(adminContext, {
                    empNumber: employee.empNumber,
                    leaveTypeId: leaveType.id,
                    fromDate: addDays(period.fromDate, 1),
                    toDate: period.toDate,
                    days: 2,
                });

                expect(unused.deletable).toBe(true);
                unusedId = unused.id;
            });

            await test.step('AND a request using the earlier one', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('THEN the one in use is marked as not deletable', async () => {
                const { deletable } = await readEntitlement(
                    apiRequest,
                    inUseId
                );

                expect(deletable).toBe(false);
            });

            await test.step('AND deleting it is refused', async () => {
                expect(
                    refusalOf(
                        await apiRequest({
                            method: 'DELETE',
                            url: ApiEndpoints.LEAVE_ENTITLEMENTS,
                            baseUrl: appConfig.apiUrl,
                            body: { ids: [inUseId] },
                        })
                    )
                ).toBe(LeaveRefusals.ENTITLEMENT_IN_USE);
            });

            await test.step('WHEN the unused one is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.LEAVE_ENTITLEMENTS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [unusedId] },
                });

                expect(status).toBe(200);
                const deleted = DeleteLeaveRecordsResponseSchema.parse(body);
                expect(deleted.data).toEqual([unusedId]);
            });

            await test.step('THEN it is marked as deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: `${ApiEndpoints.LEAVE_ENTITLEMENTS}/${unusedId}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const entitlement =
                    LeaveEntitlementReadResponseSchema.parse(body);
                expect(entitlement.data.deleted).toBe(true);
            });
        }
    );
});
