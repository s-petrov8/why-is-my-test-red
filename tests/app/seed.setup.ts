/**
 * seed.setup.ts
 * Creates the leave configuration a fresh OrangeHRM install lacks: a calendar-year
 * leave period, which `getLeavePeriod` assumes, and one leave type. It can run more
 * than once on an instance: a repeat run confirms the leave type an earlier run made.
 */

import type { APIRequestContext } from '@playwright/test';
import { ApiEndpoints } from '../../enums/app/app';
import { expect, test } from '../../fixtures/pom/test-options';
import { createAuthenticatedContext } from '../../helpers/app/createStorageState';
import {
    assertLeaveTypeExists,
    createLeaveType,
} from '../../helpers/app/leave';

const LEAVE_PERIOD_START = { startMonth: 1, startDay: 1 };
const LEAVE_TYPE = { name: 'Annual Leave', situational: false };

/**
 * Creates the leave type. Only when its name is taken does this make a second
 * call, so a fresh instance gets the create alone.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @returns {Promise<void>} Resolves once the leave type exists.
 */
async function seedLeaveType(context: APIRequestContext): Promise<void> {
    const created = await test.step('WHEN the leave type is created', () =>
        createLeaveType(context, LEAVE_TYPE));

    if (!created) {
        await test.step('THEN the leave type holding that name is the expected one', () =>
            assertLeaveTypeExists(context, LEAVE_TYPE));
    }
}

test.describe('seed setup', () => {
    test('setup leave period and leave type', async () => {
        const context = await createAuthenticatedContext();

        try {
            await test.step('GIVEN a calendar-year leave period', async () => {
                const period = await context.put(ApiEndpoints.LEAVE_PERIOD, {
                    data: LEAVE_PERIOD_START,
                });
                expect(period.status()).toBe(200);
            });

            await seedLeaveType(context);
        } finally {
            await context.dispose();
        }
    });
});
