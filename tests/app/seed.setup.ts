/**
 * seed.setup.ts
 * Creates the leave configuration a fresh OrangeHRM install lacks: a calendar-year
 * leave period, which `getLeavePeriod` assumes, and one leave type.
 */

import { ApiEndpoints } from '../../enums/app/app';
import { expect, test } from '../../fixtures/pom/test-options';
import { createAuthenticatedContext } from '../../helpers/app/createStorageState';

const LEAVE_PERIOD_START = { startMonth: 1, startDay: 1 };
const LEAVE_TYPE = { name: 'Annual Leave', situational: false };

test.describe('seed setup', () => {
    test('setup leave period and leave type', async () => {
        const context = await createAuthenticatedContext();

        try {
            const period = await context.put(ApiEndpoints.LEAVE_PERIOD, {
                data: LEAVE_PERIOD_START,
            });
            expect(period.status()).toBe(200);

            const leaveType = await context.post(ApiEndpoints.LEAVE_TYPES, {
                data: LEAVE_TYPE,
            });
            expect(leaveType.status()).toBe(200);
        } finally {
            await context.dispose();
        }
    });
});
