import { expect, test as base } from '@playwright/test';
import { ApiEndpoints } from '../../enums/app/app';
import { createAuthenticatedContext } from '../../helpers/app/createStorageState';
import { createEmployeeData } from '../../test-data/factories/app/employee.factory';
import { Employee } from '../api/schemas/app/employeeSchema';

/**
 * PIM helper fixtures: personnel records with no login attached.
 *
 * For an employee that can also SIGN IN, use `newTempUser` from
 * `user-fixture.ts` -- an employee is a personnel record, not an account.
 *
 * See `user-fixture.ts` for the conventions governing helper fixtures generally.
 */

// ==================== Types ====================

export type PimFixtures = {
    /** An employee created via API before the test and deleted after it. */
    tempTestEmployee: Employee;
};

// ==================== Fixtures ====================

export const test = base.extend<PimFixtures>({
    /**
     * Creates a PIM employee before the test and deletes it afterwards.
     * @param {object} fixtures - Playwright fixture arguments (unused).
     * @param {function} use - Playwright fixture lifecycle callback.
     */
    tempTestEmployee: async ({}, use) => {
        const context = await createAuthenticatedContext();
        let empNumber: number | undefined;

        try {
            // ── SETUP: Runs before the test ──────────────────────────────
            const createResponse = await context.post(
                ApiEndpoints.PIM_EMPLOYEES,
                { data: createEmployeeData() }
            );

            expect(createResponse.status()).toBe(200);

            const created: { data: Employee } = await createResponse.json();

            empNumber = created.data.empNumber;

            // ── YIELD: Passes data to the test ───────────────────────────
            await use(created.data);
        } finally {
            // ── TEARDOWN: Runs on every exit path ────────────────────────
            try {
                if (empNumber !== undefined) {
                    const deleteResponse = await context.delete(
                        ApiEndpoints.PIM_EMPLOYEES,
                        { data: { ids: [empNumber] } }
                    );
                    expect([200, 404]).toContain(deleteResponse.status());
                }
            } finally {
                // Nested so a failed delete assertion cannot leak the context.
                await context.dispose();
            }
        }
    },
});
