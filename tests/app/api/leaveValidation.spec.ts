import { appConfig } from '../../../config/app';
import { ApiEndpoints, LeaveActions } from '../../../enums/app/app';
import type { ApiRequestParams } from '../../../fixtures/api/api-types';
import {
    InvalidParameterResponseSchema,
    RecordsNotFoundResponseSchema,
} from '../../../fixtures/api/schemas/app/errorSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { applyForLeave } from '../../../helpers/app/leave';
import {
    addDays,
    formatIsoDate,
    getLeaveWeek,
} from '../../../helpers/util/util';
import {
    createLeaveComment,
    createLeaveRequestData,
} from '../../../test-data/factories/app/leave.factory';
import {
    INVALID_LEAVE_REQUEST_VALUES,
    REQUIRED_LEAVE_REQUEST_FIELDS,
} from '../../../test-data/static/app/invalidLeaveRequests';
import {
    INVALID_NUMBER_VALUES,
    INVALID_STRING_VALUES,
} from '../../../test-data/static/util/invalid-values';

/** An id no record holds: the largest the column allows. */
const UNKNOWN_ID = 2147483647;

/** Universal type mismatches per field. Omitting a field is the omission test's row. */
const TYPE_MISMATCHES: readonly { field: string; value: unknown }[] = [
    ...INVALID_NUMBER_VALUES.map((value) => ({ field: 'leaveTypeId', value })),
    ...INVALID_STRING_VALUES.map((value) => ({ field: 'fromDate', value })),
    ...INVALID_STRING_VALUES.map((value) => ({ field: 'toDate', value })),
].filter(({ value }) => value !== undefined);

/** The documented 404s of the endpoints the leave specs call. */
const NOT_FOUND_CALLS: { description: string; params: ApiRequestParams }[] = [
    {
        description: 'GET a leave type',
        params: {
            method: 'GET',
            url: `${ApiEndpoints.LEAVE_TYPES}/${UNKNOWN_ID}`,
        },
    },
    {
        description: 'DELETE leave types',
        params: {
            method: 'DELETE',
            url: ApiEndpoints.LEAVE_TYPES,
            body: { ids: [UNKNOWN_ID] },
        },
    },
    {
        description: 'GET an entitlement',
        params: {
            method: 'GET',
            url: `${ApiEndpoints.LEAVE_ENTITLEMENTS}/${UNKNOWN_ID}`,
        },
    },
    {
        description: 'DELETE entitlements',
        params: {
            method: 'DELETE',
            url: ApiEndpoints.LEAVE_ENTITLEMENTS,
            body: { ids: [UNKNOWN_ID] },
        },
    },
    {
        description: 'DELETE holidays',
        params: {
            method: 'DELETE',
            url: ApiEndpoints.LEAVE_HOLIDAYS,
            body: { ids: [UNKNOWN_ID] },
        },
    },
    {
        description: "PUT an employee's leave request",
        params: {
            method: 'PUT',
            url: `${ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS}/${UNKNOWN_ID}`,
            body: { action: LeaveActions.CANCEL },
        },
    },
    {
        description: 'PUT one day of leave',
        params: {
            method: 'PUT',
            url: `${ApiEndpoints.LEAVE_DAYS}/${UNKNOWN_ID}`,
            body: { action: LeaveActions.CANCEL },
        },
    },
    {
        description: 'POST a comment on a leave request',
        params: {
            method: 'POST',
            url: `${ApiEndpoints.LEAVE_REQUESTS}/${UNKNOWN_ID}${ApiEndpoints.LEAVE_COMMENTS_SUFFIX}`,
            body: { comment: createLeaveComment() },
        },
    },
];

test.describe('api/v2/leave validation', () => {
    test(
        'should answer 422 on each required field a leave request omits',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const leave = createLeaveRequestData({
                leaveTypeId: leaveType.id,
                fromDate: monday,
            });

            await test.step('WHEN the body is empty, THEN every required field is named', async () => {
                const { status, body } = await employee.api({
                    method: 'POST',
                    url: ApiEndpoints.LEAVE_REQUESTS,
                    baseUrl: appConfig.apiUrl,
                    body: {},
                });

                expect(status).toBe(422);
                expect(
                    InvalidParameterResponseSchema.parse(body).error.data
                        .invalidParamKeys
                ).toEqual(
                    expect.arrayContaining([...REQUIRED_LEAVE_REQUEST_FIELDS])
                );
            });

            for (const field of REQUIRED_LEAVE_REQUEST_FIELDS) {
                await test.step(`WHEN ${field} is omitted, THEN it is named`, async () => {
                    const { status, body } = await employee.api({
                        method: 'POST',
                        url: ApiEndpoints.LEAVE_REQUESTS,
                        baseUrl: appConfig.apiUrl,
                        body: { ...leave, [field]: undefined },
                    });

                    expect(status).toBe(422);
                    expect(
                        InvalidParameterResponseSchema.parse(body).error.data
                            .invalidParamKeys
                    ).toContain(field);
                });
            }
        }
    );

    // FIXME: no ticket yet. The annotations mark `duration` as required, and the API accepts a single day without one, as a full day.
    // eslint-disable-next-line playwright/no-skipped-test -- the Constitution's form for a documented status the application does not honour
    test.skip(
        'should answer 422 when a leave request omits its duration',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const { status, body } = await employee.api({
                method: 'POST',
                url: ApiEndpoints.LEAVE_REQUESTS,
                baseUrl: appConfig.apiUrl,
                body: {
                    ...createLeaveRequestData({
                        leaveTypeId: leaveType.id,
                        fromDate: monday,
                    }),
                    duration: undefined,
                },
            });

            expect(status).toBe(422);
            expect(
                InvalidParameterResponseSchema.parse(body).error.data
                    .invalidParamKeys
            ).toContain('duration');
        }
    );

    test(
        'should answer 422 on each field of a leave request holding an invalid value',
        { tag: '@api' },
        async ({ leaveType, newLeaveEmployee }) => {
            const { monday } = getLeaveWeek();
            const employee = await newLeaveEmployee();
            const leave = createLeaveRequestData({
                leaveTypeId: leaveType.id,
                fromDate: monday,
            });

            for (const { field, value } of [
                ...INVALID_LEAVE_REQUEST_VALUES,
                ...TYPE_MISMATCHES,
            ]) {
                await test.step(`WHEN ${field} holds ${JSON.stringify(value)}, THEN it is named`, async () => {
                    const { status, body } = await employee.api({
                        method: 'POST',
                        url: ApiEndpoints.LEAVE_REQUESTS,
                        baseUrl: appConfig.apiUrl,
                        body: { ...leave, [field]: value },
                    });

                    expect(status).toBe(422);
                    expect(
                        InvalidParameterResponseSchema.parse(body).error.data
                            .invalidParamKeys
                    ).toContain(field);
                });
            }

            await test.step('WHEN the to date is before the from date, THEN the from date is named', async () => {
                const { status, body } = await employee.api({
                    method: 'POST',
                    url: ApiEndpoints.LEAVE_REQUESTS,
                    baseUrl: appConfig.apiUrl,
                    body: {
                        ...leave,
                        toDate: formatIsoDate(addDays(monday, -1)),
                    },
                });

                expect(status).toBe(422);
                expect(
                    InvalidParameterResponseSchema.parse(body).error.data
                        .invalidParamKeys
                ).toContain('fromDate');
            });

            await test.step('THEN none of them created anything, so the date is still free', async () => {
                await applyForLeave(employee.api, leave);
            });
        }
    );

    test(
        'should answer 404 for records that do not exist',
        { tag: '@api' },
        async ({ apiRequest }) => {
            for (const { description, params } of NOT_FOUND_CALLS) {
                await test.step(description, async () => {
                    const { status, body } = await apiRequest({
                        ...params,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status).toBe(404);
                    expect(
                        RecordsNotFoundResponseSchema.parse(body)
                    ).toBeTruthy();
                });
            }
        }
    );

    // FIXME: no ticket yet. The annotations document a 404, and the API answers 422 on leaveTypeId.
    // eslint-disable-next-line playwright/no-skipped-test -- the Constitution's form for a documented status the application does not honour
    test.skip(
        'should answer 404 for the balance of a leave type that does not exist',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: `${ApiEndpoints.LEAVE_BALANCE_BY_TYPE}/${UNKNOWN_ID}`,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(404);
            expect(RecordsNotFoundResponseSchema.parse(body)).toBeTruthy();
        }
    );

    // FIXME: no ticket yet. The annotations document a 404 for the work week, and one always exists, so no request reaches it.
    // eslint-disable-next-line playwright/no-skipped-test -- the Constitution's form for a documented status the application does not honour
    test.skip(
        'should answer 404 when the work week does not exist',
        { tag: '@api' },
        async ({ apiRequest }) => {
            const { status, body } = await apiRequest({
                method: 'GET',
                url: ApiEndpoints.LEAVE_WORK_WEEK,
                baseUrl: appConfig.apiUrl,
            });

            expect(status).toBe(404);
            expect(RecordsNotFoundResponseSchema.parse(body)).toBeTruthy();
        }
    );
});
