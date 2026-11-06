import { APIRequestContext, expect } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ApiEndpoints, LeaveActions } from '../../enums/app/app';
import type {
    ApiRequestFn,
    ApiRequestResponse,
} from '../../fixtures/api/api-types';
import type {
    ApplyLeaveRequest,
    CreateHolidayRequest,
    DetailedLeaveRequest,
    Holiday,
    LeaveBalance,
    LeaveBalanceBreakdown,
    LeaveDayList,
    LeaveEntitlement,
    LeaveType,
    MyLeaveRequestList,
    WorkWeek,
} from '../../fixtures/api/schemas/app/leaveSchema';
import { formatIsoDate, getLeavePeriod } from '../util/util';

/** Page size used when scanning the configured leave types. */
const LEAVE_TYPE_LOOKUP_LIMIT = 50;

/**
 * Tries to create a leave type, checking the status as the project overrides in
 * `AGENTS.md` require. The application answers 422 on `name` when a
 * leave type already has that name, which is not proof it's a usable one, so the
 * caller confirms that with `assertLeaveTypeExists`.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} leaveType - The leave type to create.
 * @param {string} leaveType.name - Its name.
 * @param {boolean} leaveType.situational - Whether it needs no entitlement.
 * @returns {Promise<boolean>} True if created, false if the name is taken.
 */
export async function createLeaveType(
    context: APIRequestContext,
    leaveType: { name: string; situational: boolean }
): Promise<boolean> {
    const response = await context.post(ApiEndpoints.LEAVE_TYPES, {
        data: leaveType,
    });

    if (response.ok()) {
        expect(response.status()).toBe(200);

        return true;
    }

    expect(response.status()).toBe(422);

    const invalid: { error: { data: { invalidParamKeys: string[] } } } =
        await response.json();

    expect(invalid.error.data.invalidParamKeys).toEqual(['name']);

    return false;
}

/**
 * Asserts that an undeleted leave type with this exact configuration exists. The
 * `name` filter leaves out deleted leave types and ignores case.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} leaveType - The leave type that has to exist.
 * @param {string} leaveType.name - Its name.
 * @param {boolean} leaveType.situational - Whether it needs no entitlement.
 * @returns {Promise<void>} Resolves once the leave type is confirmed.
 */
export async function assertLeaveTypeExists(
    context: APIRequestContext,
    leaveType: { name: string; situational: boolean }
): Promise<void> {
    const response = await context.get(ApiEndpoints.LEAVE_TYPES, {
        params: { name: leaveType.name },
    });

    expect(response.status()).toBe(200);

    const { data: leaveTypes }: { data: LeaveType[] } = await response.json();

    expect(
        leaveTypes,
        `"${leaveType.name}" was rejected as a duplicate but no matching leave type is listed. It may have been deleted or changed on this instance; start a fresh instance.`
    ).toContainEqual(expect.objectContaining(leaveType));
}

/**
 * Picks a leave type an employee can be granted an entitlement for.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @returns {Promise<{ id: number, name: string }>} The chosen leave type.
 * @throws {Error} If the instance configures no usable leave type.
 */
export async function resolveLeaveType(
    context: APIRequestContext
): Promise<{ id: number; name: string }> {
    const response = await context.get(ApiEndpoints.LEAVE_TYPES, {
        params: { limit: LEAVE_TYPE_LOOKUP_LIMIT },
    });

    expect(response.status()).toBe(200);

    const { data: leaveTypes }: { data: LeaveType[] } = await response.json();
    const usable = leaveTypes.find(
        (leaveType): boolean => !leaveType.deleted && !leaveType.situational
    );

    if (!usable) {
        throw new Error(
            'The application configures no non-situational leave type, so no entitlement can be granted.'
        );
    }

    return { id: usable.id, name: usable.name };
}

/**
 * Grants an employee days of one leave type for one leave period. Checks only the
 * status, and hands back the fields as they came: `leaveShapes.spec.ts` owns the shape.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} entitlement - What to grant.
 * @param {number} entitlement.empNumber - Employee receiving the days.
 * @param {number} entitlement.leaveTypeId - Leave type the days belong to.
 * @param {Date} entitlement.fromDate - First day of the leave period.
 * @param {Date} entitlement.toDate - Last day of the leave period.
 * @param {number} entitlement.days - Number of days to grant.
 * @returns {Promise<LeaveEntitlement>} The entitlement as it now stands.
 */
export async function grantLeaveEntitlement(
    context: APIRequestContext,
    entitlement: {
        empNumber: number;
        leaveTypeId: number;
        fromDate: Date;
        toDate: Date;
        days: number;
    }
): Promise<LeaveEntitlement> {
    const response = await context.post(ApiEndpoints.LEAVE_ENTITLEMENTS, {
        data: {
            empNumber: entitlement.empNumber,
            leaveTypeId: entitlement.leaveTypeId,
            fromDate: formatIsoDate(entitlement.fromDate),
            toDate: formatIsoDate(entitlement.toDate),
            entitlement: entitlement.days,
        },
    });

    expect(response.status()).toBe(200);

    const { data }: { data: LeaveEntitlement } = await response.json();

    return data;
}

/**
 * Grants the days for the leave period of a leave date, and for today's period when
 * that is a different one. The Apply form offers a leave type only to someone who
 * holds it in today's period, so without this, leave booked into next year can't be
 * applied for on the form.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} entitlement - What to grant.
 * @param {number} entitlement.empNumber - Employee receiving the days.
 * @param {number} entitlement.leaveTypeId - Leave type the days belong to.
 * @param {Date} entitlement.leaveDate - A date in the leave period to grant for.
 * @param {number} entitlement.days - Number of days to grant in each period.
 * @returns {Promise<LeaveEntitlement>} The entitlement covering `leaveDate`.
 */
export async function grantLeaveForDate(
    context: APIRequestContext,
    entitlement: {
        empNumber: number;
        leaveTypeId: number;
        leaveDate: Date;
        days: number;
    }
): Promise<LeaveEntitlement> {
    const { leaveDate, ...grant } = entitlement;
    const today = new Date();

    if (today.getFullYear() !== leaveDate.getFullYear()) {
        await grantLeaveEntitlement(context, {
            ...grant,
            ...getLeavePeriod(today),
        });
    }

    return grantLeaveEntitlement(context, {
        ...grant,
        ...getLeavePeriod(leaveDate),
    });
}

/*
 * The calls tests share. As the project overrides in `AGENTS.md` require, they check
 * the status and read only what they need: `leaveShapes.spec.ts` and the other owning
 * tests validate the shapes.
 */

/**
 * Applies for leave as the caller and returns the raw answer, for a test of a
 * refusal. To apply and carry on, use {@link applyForLeave}.
 *
 * @param {ApiRequestFn} api - The API, signed in as the applicant.
 * @param {ApplyLeaveRequest} leaveRequest - The leave to apply for.
 * @returns The status and body of the response.
 */
export function submitLeaveRequest<T = unknown>(
    api: ApiRequestFn,
    leaveRequest: ApplyLeaveRequest
): Promise<ApiRequestResponse<T>> {
    return api<T>({
        method: 'POST',
        url: ApiEndpoints.LEAVE_REQUESTS,
        baseUrl: appConfig.apiUrl,
        body: leaveRequest,
    });
}

/**
 * Applies for leave as the caller and confirms it was accepted.
 *
 * @param {ApiRequestFn} api - The API, signed in as the applicant.
 * @param {ApplyLeaveRequest} leaveRequest - The leave to apply for.
 * @returns {Promise<number>} The id of the new leave request.
 */
export async function applyForLeave(
    api: ApiRequestFn,
    leaveRequest: ApplyLeaveRequest
): Promise<number> {
    const { status, body } = await submitLeaveRequest<{
        data: { id: number };
    }>(api, leaveRequest);

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data.id;
}

/**
 * Confirms a call was refused by a business rule and returns the rule's message,
 * for the test to compare with the rule it expects.
 *
 * @param {object} response - The raw answer.
 * @param {number} response.status - Its status.
 * @param {object} response.body - Its body.
 * @returns {string} The message naming the rule that refused the call.
 */
export function refusalOf(response: {
    status: number;
    body: { error: { message: string } };
}): string {
    expect(response.status, JSON.stringify(response.body)).toBe(400);

    return response.body.error.message;
}

/**
 * Reads what the application says about leave over a date range: whether it would
 * take the balance below zero, and each leave period's balance.
 *
 * @param {ApiRequestFn} api - The API, signed in as the employee.
 * @param {number} leaveTypeId - The leave type.
 * @param {Date} fromDate - The range's first day.
 * @param {Date} toDate - The range's last day.
 * @returns {Promise<LeaveBalanceBreakdown>} The answer.
 */
export async function readLeaveBalanceForRange(
    api: ApiRequestFn,
    leaveTypeId: number,
    fromDate: Date,
    toDate: Date
): Promise<LeaveBalanceBreakdown> {
    const { status, body } = await api<{ data: LeaveBalanceBreakdown }>({
        method: 'GET',
        url: `${ApiEndpoints.LEAVE_BALANCE_BY_TYPE}/${leaveTypeId}?fromDate=${formatIsoDate(fromDate)}&toDate=${formatIsoDate(toDate)}`,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data;
}

/**
 * Reads one leave period's balance.
 *
 * The dated form is used because the plain one reports only today's leave
 * period, and leave booked ahead can fall in the next.
 *
 * @param {ApiRequestFn} api - The API, signed in as the employee.
 * @param {number} leaveTypeId - The leave type.
 * @param {Date} date - A date in the wanted leave period.
 * @returns {Promise<LeaveBalance>} The balance.
 */
export async function readLeaveBalance(
    api: ApiRequestFn,
    leaveTypeId: number,
    date: Date
): Promise<LeaveBalance> {
    const { breakdown } = await readLeaveBalanceForRange(
        api,
        leaveTypeId,
        date,
        date
    );

    return breakdown[0].balance;
}

/**
 * Reads an entitlement.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number} entitlementId - The entitlement.
 * @returns {Promise<LeaveEntitlement>} The entitlement.
 */
export async function readEntitlement(
    api: ApiRequestFn,
    entitlementId: number
): Promise<LeaveEntitlement> {
    const { status, body } = await api<{ data: LeaveEntitlement }>({
        method: 'GET',
        url: `${ApiEndpoints.LEAVE_ENTITLEMENTS}/${entitlementId}`,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data;
}

/**
 * Reads a leave request as the caller's role sees it.
 *
 * @param {ApiRequestFn} api - The API, signed in as the reader.
 * @param {number} leaveRequestId - The leave request.
 * @param {ApiEndpoints} [endpoint] - `LEAVE_REQUESTS` for an employee's own request.
 * @returns {Promise<DetailedLeaveRequest>} The request, with `allowedActions` for that role.
 */
export async function readLeaveRequest(
    api: ApiRequestFn,
    leaveRequestId: number,
    endpoint: ApiEndpoints = ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS
): Promise<DetailedLeaveRequest> {
    const { status, body } = await api<{ data: DetailedLeaveRequest }>({
        method: 'GET',
        url: `${endpoint}/${leaveRequestId}?model=detailed`,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data;
}

/**
 * Lists a leave request's actions for the caller's role, in a fixed order.
 *
 * @param {DetailedLeaveRequest} leaveRequest - The request, as that role read it.
 * @returns {LeaveActions[]} The action names, sorted.
 */
export function allowedActionsOf(
    leaveRequest: DetailedLeaveRequest
): LeaveActions[] {
    return leaveRequest.allowedActions
        .map(({ action }): LeaveActions => action)
        .sort();
}

/**
 * Takes an action on a leave request and returns the raw answer, for a test of a
 * refusal. To act and carry on, use {@link changeLeaveRequest}.
 *
 * @param {ApiRequestFn} api - The API, signed in as whoever acts.
 * @param {number} leaveRequestId - The leave request.
 * @param {LeaveActions} action - The action.
 * @param {ApiEndpoints} [endpoint] - `LEAVE_REQUESTS` for an employee's own request.
 * @returns The status and body of the response.
 */
export function submitLeaveAction<T = unknown>(
    api: ApiRequestFn,
    leaveRequestId: number,
    action: LeaveActions,
    endpoint: ApiEndpoints = ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS
): Promise<ApiRequestResponse<T>> {
    return api<T>({
        method: 'PUT',
        url: `${endpoint}/${leaveRequestId}`,
        baseUrl: appConfig.apiUrl,
        body: { action },
    });
}

/**
 * Takes an action on a leave request and confirms it was accepted.
 *
 * @param {ApiRequestFn} api - The API, signed in as whoever acts.
 * @param {number} leaveRequestId - The leave request.
 * @param {LeaveActions} action - The action.
 * @param {ApiEndpoints} [endpoint] - `LEAVE_REQUESTS` for an employee's own request.
 * @returns {Promise<void>} Resolves once the action is accepted.
 */
export async function changeLeaveRequest(
    api: ApiRequestFn,
    leaveRequestId: number,
    action: LeaveActions,
    endpoint: ApiEndpoints = ApiEndpoints.LEAVE_EMPLOYEE_REQUESTS
): Promise<void> {
    const { status, body } = await submitLeaveAction(
        api,
        leaveRequestId,
        action,
        endpoint
    );

    expect(status, JSON.stringify(body)).toBe(200);
}

/**
 * Reads the caller's own leave requests, in every status. A list read is also what
 * moves approved leave whose date has passed to Taken.
 *
 * @param {ApiRequestFn} api - The API, signed in as the employee.
 * @returns {Promise<MyLeaveRequestList>} The requests and their total.
 */
export async function readMyLeaveRequests(
    api: ApiRequestFn
): Promise<MyLeaveRequestList> {
    const { status, body } = await api<MyLeaveRequestList>({
        method: 'GET',
        url: ApiEndpoints.LEAVE_REQUESTS,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body;
}

/**
 * Reads a leave request's days, one row per date in its range.
 *
 * @param {ApiRequestFn} api - The API, signed in as a reader of the request.
 * @param {number} leaveRequestId - The leave request.
 * @returns {Promise<LeaveDayList>} The days.
 */
export async function readLeaveDays(
    api: ApiRequestFn,
    leaveRequestId: number
): Promise<LeaveDayList> {
    const { status, body } = await api<{ data: LeaveDayList }>({
        method: 'GET',
        url: `${ApiEndpoints.LEAVE_REQUESTS}/${leaveRequestId}${ApiEndpoints.LEAVE_DAYS_SUFFIX}`,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data;
}

/**
 * Creates a holiday. Holidays affect every employee on their date, so a test
 * uses a date from `getNextJuneWeek` and deletes it with {@link deleteHolidays}.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {CreateHolidayRequest} holiday - The holiday.
 * @returns {Promise<Holiday>} The created holiday.
 */
export async function createHoliday(
    api: ApiRequestFn,
    holiday: CreateHolidayRequest
): Promise<Holiday> {
    const { status, body } = await api<{ data: Holiday }>({
        method: 'POST',
        url: ApiEndpoints.LEAVE_HOLIDAYS,
        baseUrl: appConfig.apiUrl,
        body: holiday,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body.data;
}

/**
 * Deletes holidays.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number[]} ids - The holidays.
 * @returns {Promise<void>} Resolves once they are gone.
 */
export async function deleteHolidays(
    api: ApiRequestFn,
    ids: number[]
): Promise<void> {
    const { status, body } = await api({
        method: 'DELETE',
        url: ApiEndpoints.LEAVE_HOLIDAYS,
        baseUrl: appConfig.apiUrl,
        body: { ids },
    });

    expect(status, JSON.stringify(body)).toBe(200);
}

/**
 * Reads the work week.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @returns {Promise<WorkWeek>} The length of each weekday.
 */
export async function readWorkWeek(api: ApiRequestFn): Promise<WorkWeek> {
    const { status, body } = await api<{ data: WorkWeek }>({
        method: 'GET',
        url: ApiEndpoints.LEAVE_WORK_WEEK,
        baseUrl: appConfig.apiUrl,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } =
        body.data;

    return { monday, tuesday, wednesday, thursday, friday, saturday, sunday };
}

/**
 * Replaces the work week and confirms it was accepted. It is global, so a test that
 * calls this is `@destructive` and restores what {@link readWorkWeek} gave it.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {WorkWeek} workWeek - The length of each weekday.
 * @returns The response body, for a test to validate. Restoring ignores it.
 */
export async function updateWorkWeek(
    api: ApiRequestFn,
    workWeek: WorkWeek
): Promise<unknown> {
    const { status, body } = await api({
        method: 'PUT',
        url: ApiEndpoints.LEAVE_WORK_WEEK,
        baseUrl: appConfig.apiUrl,
        body: workWeek,
    });

    expect(status, JSON.stringify(body)).toBe(200);

    return body;
}
