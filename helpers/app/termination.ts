import { expect } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ApiEndpoints } from '../../enums/app/app';
import type {
    ApiRequestFn,
    ApiRequestResponse,
} from '../../fixtures/api/api-types';
import { createTerminationData } from '../../test-data/factories/app/employee.factory';

/**
 * The termination calls tests share. As the project overrides in `AGENTS.md` require,
 * they check the status: `termination.spec.ts` validates the shapes. Termination ends
 * the employee's sessions at once, and terminating employee 1 locks the whole instance,
 * so these are only ever called on a throwaway employee.
 */

/**
 * Terminates an employee and confirms it was accepted.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number} empNumber - The employee.
 * @returns {Promise<void>} Resolves once they are terminated.
 */
export async function terminateEmployee(
    api: ApiRequestFn,
    empNumber: number
): Promise<void> {
    const { status, body } = await api({
        method: 'POST',
        url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_TERMINATIONS_SUFFIX}`,
        baseUrl: appConfig.apiUrl,
        body: createTerminationData(),
    });

    expect(status, JSON.stringify(body)).toBe(200);
}

/**
 * Reactivates an employee and returns the raw answer, for a test of a refusal or of
 * the response. To reactivate and carry on, use {@link reactivateEmployee}.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number} empNumber - The employee.
 * @returns The status and body of the response.
 */
export function submitReactivation(
    api: ApiRequestFn,
    empNumber: number
): Promise<ApiRequestResponse> {
    return api({
        method: 'DELETE',
        url: `${ApiEndpoints.PIM_EMPLOYEES}/${empNumber}${ApiEndpoints.PIM_TERMINATIONS_SUFFIX}`,
        baseUrl: appConfig.apiUrl,
    });
}

/**
 * Reactivates a terminated employee and confirms it was accepted.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number} empNumber - The employee.
 * @returns {Promise<void>} Resolves once they are active again.
 */
export async function reactivateEmployee(
    api: ApiRequestFn,
    empNumber: number
): Promise<void> {
    const { status, body } = await submitReactivation(api, empNumber);

    expect(status, JSON.stringify(body)).toBe(200);
}
