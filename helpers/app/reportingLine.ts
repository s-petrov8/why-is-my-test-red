import { APIRequestContext, expect } from '@playwright/test';
import { ApiEndpoints, ReportingMethodIds } from '../../enums/app/app';
import { SupervisorResponseSchema } from '../../fixtures/api/schemas/app/leaveSchema';

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
