import { APIRequestContext, expect } from '@playwright/test';
import { ApiEndpoints, ReportingMethodIds } from '../../enums/app/app';

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
}

/**
 * Removes one employee from another's reporting line.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {object} reportingLine - Who reports to whom.
 * @param {number} reportingLine.empNumber - The subordinate.
 * @param {number} reportingLine.supervisorEmpNumber - The supervisor to remove.
 * @returns {Promise<void>} Resolves once the reporting line is gone.
 */
export async function removeSupervisor(
    context: APIRequestContext,
    reportingLine: { empNumber: number; supervisorEmpNumber: number }
): Promise<void> {
    const response = await context.delete(
        `${ApiEndpoints.PIM_EMPLOYEES}/${reportingLine.empNumber}${ApiEndpoints.PIM_SUPERVISORS_SUFFIX}`,
        { data: { ids: [reportingLine.supervisorEmpNumber] } }
    );

    expect(response.status(), await response.text()).toBe(200);
}
