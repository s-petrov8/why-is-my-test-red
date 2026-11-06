import {
    LeaveActions,
    LeaveDurationTypes,
    LeaveRefusals,
} from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    applyForLeave,
    changeLeaveRequest,
    grantLeaveEntitlement,
    readLeaveBalance,
    submitLeaveRequest,
    refusalOf,
} from '../../../helpers/app/leave';
import { getLeavePeriod, getLeaveWeek } from '../../../helpers/util/util';
import { createLeaveRequestData } from '../../../test-data/factories/app/leave.factory';

const MORNING = { type: LeaveDurationTypes.HALF_DAY_MORNING };
const AFTERNOON = { type: LeaveDurationTypes.HALF_DAY_AFTERNOON };

/** Two adjacent stretches of a 9-to-5 day, which only touch at 11:00. */
const NINE_TO_ELEVEN = {
    type: LeaveDurationTypes.SPECIFY_TIME,
    fromTime: '09:00',
    toTime: '11:00',
};
const ELEVEN_TO_ONE = {
    type: LeaveDurationTypes.SPECIFY_TIME,
    fromTime: '11:00',
    toTime: '13:00',
};

test.describe('api/v2/leave overlapping requests', () => {
    test(
        'should refuse leave overlapping a full day, whatever its type or range',
        { tag: '@api' },
        async ({ adminContext, leaveType, newLeaveEmployee, newLeaveType }) => {
            const { monday, tuesday, wednesday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            let otherTypeId = 0;

            await test.step('GIVEN a full day on the Tuesday', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: tuesday,
                    })
                );
            });

            await test.step('WHEN the employee applies for the same date, THEN it is refused', async () => {
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
                ).toBe(LeaveRefusals.OVERLAPPING_LEAVE);
            });

            await test.step('WHEN the range contains the date, THEN it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData({
                                leaveTypeId: leaveType.id,
                                fromDate: monday,
                                toDate: wednesday,
                            })
                        )
                    )
                ).toBe(LeaveRefusals.OVERLAPPING_LEAVE);
            });

            await test.step('GIVEN another leave type', async () => {
                otherTypeId = (await newLeaveType()).id;
            });

            await test.step('AND an entitlement for it', async () => {
                await grantLeaveEntitlement(adminContext, {
                    empNumber: employee.empNumber,
                    leaveTypeId: otherTypeId,
                    ...getLeavePeriod(tuesday),
                    days: 1,
                });
            });

            await test.step('WHEN the same date is requested under that type, THEN it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData({
                                leaveTypeId: otherTypeId,
                                fromDate: tuesday,
                            })
                        )
                    )
                ).toBe(LeaveRefusals.OVERLAPPING_LEAVE);
            });
        }
    );

    test(
        'should refuse a half day on a full day and a full day on two half days',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday, tuesday } = getLeaveWeek();
            const employee = await newLeaveEmployee();

            await test.step('GIVEN a full day on the Monday', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN a half day is requested on it, THEN it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveRequest(
                            employee.api,
                            createLeaveRequestData(
                                { leaveTypeId: leaveType.id, fromDate: monday },
                                { duration: MORNING }
                            )
                        )
                    )
                ).toBe(LeaveRefusals.OVERLAPPING_LEAVE);
            });

            await test.step('GIVEN a morning on the Tuesday', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: tuesday },
                        { duration: MORNING }
                    )
                );
            });

            await test.step('AND the same afternoon', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: tuesday },
                        { duration: AFTERNOON }
                    )
                );
            });

            await test.step('WHEN a full day is requested on it, THEN it is refused', async () => {
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
                ).toBe(LeaveRefusals.OVERLAPPING_LEAVE);
            });
        }
    );

    test(
        'should accept a morning and afternoon, adjacent times, and another employee on the same date',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday, tuesday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const colleague = await newLeaveEmployee();

            await test.step('WHEN the employee requests a morning', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: monday },
                        { duration: MORNING }
                    )
                );
            });

            await test.step('AND the same afternoon', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: monday },
                        { duration: AFTERNOON }
                    )
                );
            });

            await test.step('AND two hours on the Tuesday', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: tuesday },
                        { duration: NINE_TO_ELEVEN }
                    )
                );
            });

            await test.step('AND the two hours after them', async () => {
                await applyForLeave(
                    employee.api,
                    createLeaveRequestData(
                        { leaveTypeId: leaveType.id, fromDate: tuesday },
                        { duration: ELEVEN_TO_ONE }
                    )
                );
            });

            await test.step('THEN every request counted', async () => {
                const { used } = await readLeaveBalance(
                    employee.api,
                    leaveType.id,
                    monday
                );

                expect(used).toBe(1.5);
            });

            await test.step('AND a colleague can take the same date', async () => {
                await applyForLeave(
                    colleague.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });
        }
    );

    for (const action of [LeaveActions.CANCEL, LeaveActions.REJECT]) {
        test(
            `should free the date for a new request after ${action}`,
            { tag: '@api' },
            async ({ apiRequest, leaveType, newLeaveEmployee }) => {
                const { monday } = getLeaveWeek();
                const employee = await newLeaveEmployee();
                const leave = createLeaveRequestData({
                    leaveTypeId: leaveType.id,
                    fromDate: monday,
                });
                let requestId = 0;

                await test.step('GIVEN a request on that date', async () => {
                    requestId = await applyForLeave(employee.api, leave);
                });

                await test.step('WHEN the admin takes the action', async () => {
                    await changeLeaveRequest(apiRequest, requestId, action);
                });

                await test.step('THEN the date can be requested again', async () => {
                    expect(await applyForLeave(employee.api, leave)).not.toBe(
                        requestId
                    );
                });
            }
        );
    }
});
