import { APIRequestContext, expect } from '@playwright/test';
import { ApiEndpoints, ReportingMethodIds } from '../../enums/app/app';
import { InvalidParameterResponseSchema } from '../../fixtures/api/schemas/app/errorSchema';
import {
    LeaveEntitlementResponseSchema,
    LeaveTypeListResponseSchema,
    LeaveTypeResponseSchema,
    SupervisorResponseSchema,
} from '../../fixtures/api/schemas/app/leaveSchema';
import { formatIsoDate } from '../util/util';

/** Page size used when scanning the configured leave types. */
const LEAVE_TYPE_LOOKUP_LIMIT = 50;

/**
 * Tries to create a leave type. The application answers 422 on `name` when a
 * leave type already has that name, which is not proof it's a usable one, so
 * the caller confirms that with `assertLeaveTypeExists`.
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
    const body: unknown = await response.json();

    if (response.ok()) {
        expect(response.status()).toBe(200);
        expect(LeaveTypeResponseSchema.parse(body)).toBeTruthy();
        expect(body).toMatchObject({ data: leaveType });

        return true;
    }

    expect(response.status()).toBe(422);
    expect(
        InvalidParameterResponseSchema.parse(body).error.data.invalidParamKeys
    ).toEqual(['name']);

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

    const leaveTypes = LeaveTypeListResponseSchema.parse(await response.json());

    expect(
        leaveTypes.data,
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

    const leaveTypes = LeaveTypeListResponseSchema.parse(await response.json());
    const usable = leaveTypes.data.find(
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
 * Grants an employee days of one leave type for one leave period.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} entitlement - What to grant.
 * @param {number} entitlement.empNumber - Employee receiving the days.
 * @param {number} entitlement.leaveTypeId - Leave type the days belong to.
 * @param {Date} entitlement.fromDate - First day of the leave period.
 * @param {Date} entitlement.toDate - Last day of the leave period.
 * @param {number} entitlement.days - Number of days to grant.
 * @returns {Promise<void>} Resolves once the entitlement exists.
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
): Promise<void> {
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
    expect(
        LeaveEntitlementResponseSchema.parse(await response.json())
    ).toBeTruthy();
}

/**
 * Puts one employee in another's reporting line, making the second their
 * approver.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} reportingLine - Who reports to whom.
 * @param {number} reportingLine.empNumber - The subordinate.
 * @param {number} reportingLine.supervisorEmpNumber - The approver.
 * @returns {Promise<void>} Resolves once the reporting line exists.
 *
 * @example
 * ```ts
 * await assignSupervisor(context, {
 *     empNumber: applicant.empNumber,
 *     supervisorEmpNumber: supervisor.empNumber,
 * });
 * ```
 */
export async function assignSupervisor(
    context: APIRequestContext,
    reportingLine: { empNumber: number; supervisorEmpNumber: number }
): Promise<void> {
    const response = await context.post(
        `${ApiEndpoints.PIM_EMPLOYEES}/${reportingLine.empNumber}${ApiEndpoints.PIM_SUPERVISORS_SUFFIX}`,
        {
            data: {
                empNumber: reportingLine.supervisorEmpNumber,
                reportingMethodId: ReportingMethodIds.DIRECT,
            },
        }
    );

    expect(response.status()).toBe(200);
    expect(SupervisorResponseSchema.parse(await response.json())).toBeTruthy();
}
