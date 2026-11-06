import {
    ApiEndpoints,
    HolidayLengths,
    LeaveRefusals,
    LeaveStatuses,
    ReservedHolidayWeeks,
    WorkWeekDayLengths,
} from '../../../enums/app/app';
import { WorkWeek } from '../../../fixtures/api/schemas/app/leaveSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    applyForLeave,
    createHoliday,
    deleteHolidays,
    readLeaveDays,
    readLeaveRequest,
    readWorkWeek,
    refusalOf,
    submitLeaveRequest,
    updateWorkWeek,
} from '../../../helpers/app/leave';
import { getLeaveWeek, getNextJuneWeek } from '../../../helpers/util/util';
import {
    createHolidayData,
    createLeaveRequestData,
} from '../../../test-data/factories/app/leave.factory';

test.describe('api/v2/leave working days and holidays', () => {
    let holidayIdsToDelete: number[] = [];
    let workWeekToRestore: WorkWeek | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (holidayIdsToDelete.length > 0) {
            const ids = holidayIdsToDelete;
            holidayIdsToDelete = [];
            await deleteHolidays(apiRequest, ids);
        }

        if (workWeekToRestore !== undefined) {
            const workWeek = workWeekToRestore;
            workWeekToRestore = undefined;
            await updateWorkWeek(apiRequest, workWeek);
        }
    });

    test(
        'should refuse leave falling only on a weekend',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { saturday, sunday } = getLeaveWeek();
            const employee = await newLeaveEmployee();

            expect(
                refusalOf(
                    await submitLeaveRequest(
                        employee.api,
                        createLeaveRequestData({
                            leaveTypeId: leaveType.id,
                            fromDate: saturday,
                            toDate: sunday,
                        })
                    )
                )
            ).toBe(LeaveRefusals.NO_WORKING_DAYS);
        }
    );

    test(
        'should refuse leave on a full holiday alone and count it as nothing in a range',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { monday, tuesday, wednesday } = getNextJuneWeek(
                ReservedHolidayWeeks.FULL_HOLIDAY
            );
            const employee = await newLeaveEmployee({ entitledOn: monday });
            let requestId = 0;

            await test.step('GIVEN a full holiday on the Tuesday', async () => {
                const holiday = await createHoliday(
                    apiRequest,
                    createHolidayData(tuesday)
                );

                holidayIdsToDelete.push(holiday.id);
            });

            await test.step('WHEN the employee applies for that day alone, THEN it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData({
                                leaveTypeId: leaveType.id,
                                fromDate: tuesday,
                            })
                        )
                    )
                ).toBe(LeaveRefusals.NO_WORKING_DAYS);
            });

            await test.step('WHEN the employee applies from Monday to Wednesday', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                        toDate: wednesday,
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

            await test.step('AND the Tuesday shows as a holiday of no length', async () => {
                const days = await readLeaveDays(employee.api, requestId);

                expect(days[1].leaveStatus).toMatchObject({
                    name: LeaveStatuses.HOLIDAY,
                    lengthDays: 0,
                });
            });
        }
    );

    test(
        'should cap a full-day request on a half holiday at half a day',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { monday } = getNextJuneWeek(
                ReservedHolidayWeeks.HALF_HOLIDAY
            );
            const employee = await newLeaveEmployee({ entitledOn: monday });
            let requestId = 0;

            await test.step('GIVEN a half holiday', async () => {
                const holiday = await createHoliday(
                    apiRequest,
                    createHolidayData(monday, {
                        length: HolidayLengths.HALF_DAY,
                    })
                );

                holidayIdsToDelete.push(holiday.id);
            });

            await test.step('WHEN the employee applies for the whole day', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('THEN the request counts half a day', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.noOfDays).toBe(0.5);
            });
        }
    );

    test(
        'should apply a recurring holiday in a later year',
        { tag: '@api' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { monday, tuesday } = getNextJuneWeek(
                ReservedHolidayWeeks.RECURRING_HOLIDAY
            );
            const employee = await newLeaveEmployee({ entitledOn: monday });
            const sameDateThisYear = new Date(monday);
            sameDateThisYear.setFullYear(monday.getFullYear() - 1);
            let requestId = 0;

            await test.step('GIVEN a recurring holiday created for this year', async () => {
                const holiday = await createHoliday(
                    apiRequest,
                    createHolidayData(sameDateThisYear, { recurring: true })
                );

                holidayIdsToDelete.push(holiday.id);
            });

            await test.step('WHEN the employee applies across that date next year', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                        toDate: tuesday,
                    })
                );
            });

            await test.step('THEN only the other day counts', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.noOfDays).toBe(1);
            });

            await test.step('AND that date shows as a holiday', async () => {
                const days = await readLeaveDays(employee.api, requestId);

                expect(days[0].leaveStatus.name).toBe(LeaveStatuses.HOLIDAY);
            });
        }
    );

    test(
        'should count a full-day request on a half-day Friday as half a day',
        { tag: '@destructive' },
        async ({ apiRequest, leaveType, newLeaveEmployee }) => {
            const { friday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const workWeek = await readWorkWeek(apiRequest);
            let requestId = 0;

            workWeekToRestore = workWeek;

            await test.step('GIVEN Friday is made a half day', async () => {
                await updateWorkWeek(apiRequest, {
                    ...workWeek,
                    friday: WorkWeekDayLengths.HALF_DAY,
                });
            });

            await test.step('WHEN the employee applies for the whole Friday', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: friday,
                    })
                );
            });

            await test.step('THEN the request counts half a day', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.noOfDays).toBe(0.5);
            });
        }
    );
});
