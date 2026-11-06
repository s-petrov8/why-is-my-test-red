import { expect } from '@playwright/test';
import { appConfig } from '../../config/app';
import { ApiEndpoints } from '../../enums/app/app';
import type { ApiRequestFn } from '../../fixtures/api/api-types';
import {
    CreateWorkShiftRequest,
    DeleteWorkShiftsResponseSchema,
    WorkShiftResponseSchema,
} from '../../fixtures/api/schemas/app/workShiftSchema';

/**
 * Creates a work shift and assigns employees to it.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {CreateWorkShiftRequest} workShift - The shift.
 * @returns {Promise<number>} The id of the new shift.
 */
export async function createWorkShift(
    api: ApiRequestFn,
    workShift: CreateWorkShiftRequest
): Promise<number> {
    const { status, body } = await api({
        method: 'POST',
        url: ApiEndpoints.ADMIN_WORK_SHIFTS,
        baseUrl: appConfig.apiUrl,
        body: workShift,
    });

    expect(status).toBe(200);

    return WorkShiftResponseSchema.parse(body).data.id;
}

/**
 * Deletes a work shift.
 *
 * @param {ApiRequestFn} api - The API, signed in as an administrator.
 * @param {number} id - The shift.
 * @returns {Promise<void>} Resolves once it is gone.
 */
export async function deleteWorkShift(
    api: ApiRequestFn,
    id: number
): Promise<void> {
    const { status, body } = await api({
        method: 'DELETE',
        url: ApiEndpoints.ADMIN_WORK_SHIFTS,
        baseUrl: appConfig.apiUrl,
        body: { ids: [id] },
    });

    expect(status).toBe(200);
    expect(DeleteWorkShiftsResponseSchema.parse(body).data).toEqual([id]);
}
