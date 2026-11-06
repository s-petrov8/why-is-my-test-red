import { APIRequestContext, expect } from '@playwright/test';
import { ApiEndpoints, ReportingMethodIds } from '../../enums/app/app';
import {
    LeaveEntitlementResponseSchema,
    LeaveType,
    LeaveTypeListResponseSchema,
    SupervisorResponseSchema,
} from '../../fixtures/api/schemas/app/leaveSchema';
import { formatIsoDate } from '../util/util';

/** The `limit` value that makes the application return every leave type. */
const ALL_LEAVE_TYPES_LIMIT = 0;

/**
 * Lists every leave type the instance configures.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @returns {Promise<LeaveType[]>} The configured leave types.
 */
async function listLeaveTypes(
    context: APIRequestContext
): Promise<LeaveType[]> {
    const response = await context.get(ApiEndpoints.LEAVE_TYPES, {
        params: { limit: ALL_LEAVE_TYPES_LIMIT },
    });

    expect(response.status()).toBe(200);

    return LeaveTypeListResponseSchema.parse(await response.json()).data;
}

/**
 * Creates a leave type unless the instance already has one with that name, which
 * the application would reject with a 422.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} leaveType - The leave type that has to exist.
 * @param {string} leaveType.name - Its name, unique on an instance.
 * @param {boolean} leaveType.situational - Whether it needs no entitlement.
 * @returns {Promise<void>} Resolves once the leave type exists.
 */
export async function ensureLeaveType(
    context: APIRequestContext,
    leaveType: { name: string; situational: boolean }
): Promise<void> {
    const leaveTypes = await listLeaveTypes(context);
    const exists = leaveTypes.some(
        (existing): boolean =>
            !existing.deleted && existing.name === leaveType.name
    );

    if (exists) {
        return;
    }

    const response = await context.post(ApiEndpoints.LEAVE_TYPES, {
        data: leaveType,
    });

    expect(response.status()).toBe(200);
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
    const leaveTypes = await listLeaveTypes(context);
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
