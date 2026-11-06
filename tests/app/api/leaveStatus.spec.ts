import { appConfig } from '../../../config/app';
import { ENTITLED_DAYS } from '../../../config/leave';
import {
    ApiEndpoints,
    LeaveActions,
    LeaveRefusals,
    LeaveStatuses,
    UserRoleIds,
} from '../../../enums/app/app';
import { ForbiddenResponseSchema } from '../../../fixtures/api/schemas/app/errorSchema';
import { LeaveDayResponseSchema } from '../../../fixtures/api/schemas/app/leaveSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    allowedActionsOf,
    applyForLeave,
    changeLeaveRequest,
    readLeaveBalance,
    readLeaveDays,
    readMyLeaveRequests,
    readLeaveRequest,
    submitLeaveAction,
    refusalOf,
} from '../../../helpers/app/leave';
import { assignSupervisor } from '../../../helpers/app/reportingLine';
import {
    getLeaveWeek,
    getPastWeekday,
    isInCurrentLeavePeriod,
} from '../../../helpers/util/util';
import {
    createLeaveComment,
    createLeaveRequestData,
} from '../../../test-data/factories/app/leave.factory';

/** Leave this far back is clear of today in any time zone the runner and the instance differ by. */
const PAST_LEAVE_DAYS_BACK = 2;

test.describe('api/v2/leave status changes and access', () => {
    test(
        'should offer the right actions on pending leave and move it to scheduled on approval',
        { tag: '@api' },
        async ({
            apiRequest,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const supervisor = await newSupervisorOf(employee);
            let requestId = 0;

            await test.step('GIVEN a pending request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('THEN the employee can only cancel it', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.leaveBreakdown).toEqual([
                    expect.objectContaining({
                        name: LeaveStatuses.PENDING_APPROVAL,
                    }),
                ]);
                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.CANCEL,
                ]);
            });

            await test.step('AND the supervisor can approve, cancel or reject it', async () => {
                const request = await readLeaveRequest(
                    supervisor.api,
                    requestId
                );

                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.APPROVE,
                    LeaveActions.CANCEL,
                    LeaveActions.REJECT,
                ]);
            });

            await test.step('AND so can the admin', async () => {
                const request = await readLeaveRequest(apiRequest, requestId);

                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.APPROVE,
                    LeaveActions.CANCEL,
                    LeaveActions.REJECT,
                ]);
            });

            await test.step('WHEN the supervisor approves it', async () => {
                await changeLeaveRequest(
                    supervisor.api,
                    requestId,
                    LeaveActions.APPROVE
                );
            });

            await test.step('THEN it is scheduled', async () => {
                const request = await readLeaveRequest(
                    supervisor.api,
                    requestId
                );

                expect(request.leaveBreakdown).toEqual([
                    expect.objectContaining({ name: LeaveStatuses.SCHEDULED }),
                ]);
            });
        }
    );

    test(
        'should offer only cancel on scheduled leave and refuse approving or rejecting it',
        { tag: '@api' },
        async ({
            apiRequest,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const supervisor = await newSupervisorOf(employee);
            let requestId = 0;

            await test.step('GIVEN a request', async () => {
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

            await test.step('THEN the employee can only cancel it', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.CANCEL,
                ]);
            });

            await test.step('AND so can the supervisor', async () => {
                const request = await readLeaveRequest(
                    supervisor.api,
                    requestId
                );

                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.CANCEL,
                ]);
            });

            await test.step('AND so can the admin', async () => {
                const request = await readLeaveRequest(apiRequest, requestId);

                expect(allowedActionsOf(request)).toEqual([
                    LeaveActions.CANCEL,
                ]);
            });

            for (const action of [LeaveActions.APPROVE, LeaveActions.REJECT]) {
                await test.step(`AND ${action} is refused`, async () => {
                    expect(
                        refusalOf(
                            await submitLeaveAction(
                                supervisor.api,
                                requestId,
                                action
                            )
                        )
                    ).toBe(LeaveRefusals.ACTION_NOT_ALLOWED);
                });
            }
        }
    );

    for (const { status, closingAction } of [
        {
            status: LeaveStatuses.REJECTED,
            closingAction: LeaveActions.REJECT,
        },
        {
            status: LeaveStatuses.CANCELLED,
            closingAction: LeaveActions.CANCEL,
        },
    ]) {
        test(
            `should offer no actions on ${status} leave and refuse them all`,
            { tag: '@api' },
            async ({
                apiRequest,
                leaveType,
                newLeaveEmployee,
                newSupervisorOf,
            }) => {
                const { monday } = getLeaveWeek();
                const employee = await newLeaveEmployee();
                const supervisor = await newSupervisorOf(employee);
                let requestId = 0;

                await test.step('GIVEN a request', async () => {
                    requestId = await applyForLeave(
                        employee.api,
                        createLeaveRequestData({
                            leaveTypeId: leaveType.id,
                            fromDate: monday,
                        })
                    );
                });

                await test.step(`AND the supervisor closed it as ${status}`, async () => {
                    await changeLeaveRequest(
                        supervisor.api,
                        requestId,
                        closingAction
                    );
                });

                await test.step('THEN the employee has no actions', async () => {
                    const request = await readLeaveRequest(
                        employee.api,
                        requestId,
                        ApiEndpoints.LEAVE_REQUESTS
                    );

                    expect(request.leaveBreakdown).toEqual([
                        expect.objectContaining({ name: status }),
                    ]);
                    expect(allowedActionsOf(request)).toEqual([]);
                });

                await test.step('AND neither does the supervisor', async () => {
                    const request = await readLeaveRequest(
                        supervisor.api,
                        requestId
                    );

                    expect(allowedActionsOf(request)).toEqual([]);
                });

                await test.step('AND neither does the admin', async () => {
                    const request = await readLeaveRequest(
                        apiRequest,
                        requestId
                    );

                    expect(allowedActionsOf(request)).toEqual([]);
                });

                for (const action of Object.values(LeaveActions)) {
                    await test.step(`AND ${action} is refused`, async () => {
                        expect(
                            refusalOf(
                                await submitLeaveAction(
                                    apiRequest,
                                    requestId,
                                    action
                                )
                            )
                        ).toBe(LeaveRefusals.ACTION_NOT_ALLOWED);
                    });
                }
            }
        );
    }

    test(
        'should not let anyone approve their own leave, whatever their role',
        { tag: '@api' },
        async ({ adminContext, leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const essEmployee = await newLeaveEmployee();
            const supervisor = await newLeaveEmployee();
            const admin = await newLeaveEmployee({
                userRoleId: UserRoleIds.ADMIN,
            });
            const subordinate = await newLeaveEmployee({ days: 0 });

            await test.step('GIVEN the supervisor has a subordinate', async () => {
                await assignSupervisor(adminContext, {
                    empNumber: subordinate.empNumber,
                    supervisorEmpNumber: supervisor.empNumber,
                });
            });

            for (const { role, applicant } of [
                { role: 'an ESS employee', applicant: essEmployee },
                { role: 'a supervisor', applicant: supervisor },
                { role: 'an admin', applicant: admin },
            ]) {
                let requestId = 0;

                await test.step(`GIVEN ${role} has a pending request`, async () => {
                    requestId = await applyForLeave(
                        applicant.api,
                        createLeaveRequestData({
                            leaveTypeId: leaveType.id,
                            fromDate: monday,
                        })
                    );
                });

                await test.step(`THEN ${role} can only cancel it`, async () => {
                    const leaveRequest = await readLeaveRequest(
                        applicant.api,
                        requestId,
                        ApiEndpoints.LEAVE_REQUESTS
                    );

                    expect(allowedActionsOf(leaveRequest)).toEqual([
                        LeaveActions.CANCEL,
                    ]);
                });

                await test.step(`AND ${role} approving it is refused`, async () => {
                    expect(
                        refusalOf(
                            await submitLeaveAction(
                                applicant.api,
                                requestId,
                                LeaveActions.APPROVE,
                                ApiEndpoints.LEAVE_REQUESTS
                            )
                        )
                    ).toBe(LeaveRefusals.ACTION_NOT_ALLOWED);
                });
            }
        }
    );

    test(
        'should refuse a stranger access to a request, and refuse leave assigned to a non-subordinate',
        { tag: '@api' },
        async ({
            leaveType,
            newApiUser,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const { monday, tuesday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const stranger = await newApiUser();
            const ownTeamMember = await newLeaveEmployee();
            const otherSupervisor = await newSupervisorOf(ownTeamMember);
            let requestId = 0;

            await test.step('GIVEN a request', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    })
                );
            });

            await test.step('WHEN a stranger reads it, THEN it is forbidden', async () => {
                const { status, body } = await stranger.api({
                    method: 'GET',
                    url: `${ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS}/${requestId}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(403);
                expect(ForbiddenResponseSchema.parse(body)).toBeTruthy();
            });

            await test.step('WHEN a stranger acts on it, THEN it is forbidden', async () => {
                const { status, body } = await submitLeaveAction(
                    stranger.api,
                    requestId,
                    LeaveActions.CANCEL
                );

                expect(status).toBe(403);
                expect(ForbiddenResponseSchema.parse(body)).toBeTruthy();
            });

            await test.step('WHEN a stranger comments on it, THEN it is forbidden', async () => {
                const { status, body } = await stranger.api({
                    method: 'POST',
                    url: `${ApiEndpoints.LEAVE_REQUESTS}/${requestId}${ApiEndpoints.LEAVE_COMMENTS_SUFFIX}`,
                    baseUrl: appConfig.apiUrl,
                    body: { comment: createLeaveComment() },
                });

                expect(status).toBe(403);
                expect(ForbiddenResponseSchema.parse(body)).toBeTruthy();
            });

            await test.step('WHEN a supervisor of someone else assigns them leave, THEN the employee is invalid', async () => {
                const { status, body } = await otherSupervisor.api<{
                    error: { data: { invalidParamKeys: string[] } };
                }>({
                    method: 'POST',
                    url: ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS,
                    baseUrl: appConfig.apiUrl,
                    body: {
                        empNumber: employee.empNumber,
                        ...createLeaveRequestData({
                            leaveTypeId: leaveType.id,
                            fromDate: tuesday,
                        }),
                    },
                });

                expect(status).toBe(422);
                expect(body.error.data.invalidParamKeys).toEqual(['empNumber']);
            });

            await test.step('WHEN a stranger with no team assigns them leave, THEN it is forbidden', async () => {
                const { status, body } = await stranger.api({
                    method: 'POST',
                    url: ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS,
                    baseUrl: appConfig.apiUrl,
                    body: {
                        empNumber: employee.empNumber,
                        ...createLeaveRequestData({
                            leaveTypeId: leaveType.id,
                            fromDate: tuesday,
                        }),
                    },
                });

                expect(status).toBe(403);
                expect(ForbiddenResponseSchema.parse(body)).toBeTruthy();
            });
        }
    );

    test(
        'should mark past approved leave as taken after a list read and let only the admin cancel it',
        { tag: '@api' },
        async ({
            apiRequest,
            leaveType,
            newLeaveEmployee,
            newSupervisorOf,
        }) => {
            const pastDate = getPastWeekday(PAST_LEAVE_DAYS_BACK);

            // eslint-disable-next-line playwright/no-skipped-test -- the first days of January have no past weekday this test can use
            test.skip(
                !isInCurrentLeavePeriod(pastDate),
                'No past weekday in the leave period yet: a fresh instance has no earlier period, so a balance before it has nothing to read.'
            );

            const employee = await newLeaveEmployee({
                days: ENTITLED_DAYS,
                entitledOn: pastDate,
            });
            const supervisor = await newSupervisorOf(employee);
            let requestId = 0;

            await test.step('GIVEN a request for a past date', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: pastDate,
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

            await test.step('WHEN the list is read, THEN the leave is taken', async () => {
                const list = await readMyLeaveRequests(employee.api);

                expect(list.data[0].leaveBreakdown).toEqual([
                    expect.objectContaining({ name: LeaveStatuses.TAKEN }),
                ]);
            });

            await test.step('AND the balance counts it as taken', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, pastDate)
                ).toMatchObject({
                    scheduled: 0,
                    taken: 1,
                    used: 1,
                    balance: ENTITLED_DAYS - 1,
                });
            });

            await test.step('AND the employee has no actions', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(allowedActionsOf(request)).toEqual([]);
            });

            await test.step('AND neither does the supervisor', async () => {
                const request = await readLeaveRequest(
                    supervisor.api,
                    requestId
                );

                expect(allowedActionsOf(request)).toEqual([]);
            });

            await test.step('AND the supervisor cancelling it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveAction(
                            supervisor.api,
                            requestId,
                            LeaveActions.CANCEL
                        )
                    )
                ).toBe(LeaveRefusals.ACTION_NOT_ALLOWED);
            });

            await test.step('AND the employee cancelling it is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveAction(
                            employee.api,
                            requestId,
                            LeaveActions.CANCEL,
                            ApiEndpoints.LEAVE_REQUESTS
                        )
                    )
                ).toBe(LeaveRefusals.ACTION_NOT_ALLOWED);
            });

            await test.step('WHEN the admin cancels it', async () => {
                await changeLeaveRequest(
                    apiRequest,
                    requestId,
                    LeaveActions.CANCEL
                );
            });

            await test.step('THEN the balance is whole again', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, pastDate)
                ).toMatchObject({
                    taken: 0,
                    used: 0,
                    balance: ENTITLED_DAYS,
                });
            });
        }
    );

    test(
        'should give a request mixed statuses when one day is cancelled, refuse request-level actions, and sum the balance per day',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday, wednesday } = getLeaveWeek();
            const employee = await newLeaveEmployee({ days: ENTITLED_DAYS });
            let requestId = 0;
            let tuesdayId = 0;

            await test.step('GIVEN a request for three days', async () => {
                requestId = await applyForLeave(
                    employee.api,
                    createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                        toDate: wednesday,
                    })
                );
            });

            await test.step('AND its days are known', async () => {
                const days = await readLeaveDays(employee.api, requestId);

                expect(days).toHaveLength(3);
                tuesdayId = days[1].id;
            });

            await test.step('WHEN the employee cancels the middle day', async () => {
                const { status, body } = await employee.api({
                    method: 'PUT',
                    url: `${ApiEndpoints.LEAVE_DAYS}/${tuesdayId}`,
                    baseUrl: appConfig.apiUrl,
                    body: { action: LeaveActions.CANCEL },
                });

                expect(status).toBe(200);
                const day = LeaveDayResponseSchema.parse(body);
                expect(day.data.status.name).toBe(LeaveStatuses.CANCELLED);
            });

            await test.step('THEN the request has mixed statuses and no request-level actions', async () => {
                const request = await readLeaveRequest(
                    employee.api,
                    requestId,
                    ApiEndpoints.LEAVE_REQUESTS
                );

                expect(request.hasMultipleStatus).toBe(true);
                expect(allowedActionsOf(request)).toEqual([]);
            });

            await test.step('AND a request-level action is refused', async () => {
                expect(
                    refusalOf(
                        await submitLeaveAction(
                            employee.api,
                            requestId,
                            LeaveActions.CANCEL,
                            ApiEndpoints.LEAVE_REQUESTS
                        )
                    )
                ).toBe(LeaveRefusals.MULTIPLE_STATUSES);
            });

            await test.step('AND the balance counts the two days left', async () => {
                expect(
                    await readLeaveBalance(employee.api, leaveType.id, monday)
                ).toMatchObject({
                    pending: 2,
                    used: 2,
                    balance: ENTITLED_DAYS - 2,
                });
            });
        }
    );
});
