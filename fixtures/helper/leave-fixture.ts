import { expect } from '@playwright/test';
import { ApiEndpoints } from '../../enums/app/app';
import { ENTITLED_DAYS } from '../../config/leave';
import { grantLeaveForDate, resolveLeaveType } from '../../helpers/app/leave';
import { assignSupervisor } from '../../helpers/app/reportingLine';
import { TempUser, TempUserOptions } from '../../helpers/app/tempUser';
import {
    getFutureWeekday,
    getLeavePeriod,
    getLeaveWeek,
} from '../../helpers/util/util';
import { createLeaveTypeName } from '../../test-data/factories/app/leave.factory';
import { ApiUser, test as userTest } from './user-fixture';

/**
 * Leave helper fixtures: the preconditions the leave workflow needs. These are
 * shared setup, so they check statuses and read only what they need, as the project
 * overrides in `AGENTS.md` require.
 */

/** An id for a leave type and the name the Leave screens show for it. */
export type LeaveTypeRef = { id: number; name: string };

/** An employee holding an entitlement, with the API signed in as them. */
export type LeaveEmployee = ApiUser & {
    /** The entitlement granted to them. Absent when `days` was zero. */
    entitlementId?: number;
};

/** How far ahead a temporary user's leave is booked, before weekend adjustment. */
const LEAVE_DAYS_AHEAD = 14;

// ==================== Types ====================

/** The two people a leave approval needs, plus the leave they will agree on. */
export type LeaveApprovalUsers = {
    /** Requests the leave. Holds the entitlement and reports to `supervisor`. */
    applicant: TempUser;
    /** Approves the leave. Exists only to be the applicant's reporting line. */
    supervisor: TempUser;
    leaveTypeId: number;
    leaveTypeName: string;
    /** A future weekday the applicant holds entitlement for. */
    leaveDate: Date;
    /** The leave period containing `leaveDate`, for filtering the Leave List. */
    leavePeriod: { fromDate: Date; toDate: Date };
    /** The days the applicant holds. */
    entitledDays: number;
};

export type LeaveFixtures = {
    /** An applicant and their supervisor, with entitlement and reporting line. */
    tempLeaveApprovalUsers: LeaveApprovalUsers;
    /** The shared leave type. A fresh employee per test isolates its balances. */
    leaveType: LeaveTypeRef;
    /** A leave type of the test's own, deleted afterwards. Its name stays taken. */
    newLeaveType: () => Promise<LeaveTypeRef>;
    /** A new employee holding `days` of the shared leave type, 5 by default. */
    newLeaveEmployee: (
        options?: TempUserOptions & {
            days?: number;
            /** A date in the leave period to grant for. By default, `getLeaveWeek`'s. */
            entitledOn?: Date;
        }
    ) => Promise<LeaveEmployee>;
};

// ==================== Fixtures ====================

export const test = userTest.extend<LeaveFixtures>({
    /**
     * Sets up the preconditions a leave approval needs, using the two factories
     * above, and hands back the two people plus the leave they will agree on.
     *
     * @param {object} fixtures - Playwright fixture arguments.
     * @param {function} fixtures.newTempUser - Factory creating the two people.
     * @param {function} use - Playwright fixture lifecycle callback.
     */
    tempLeaveApprovalUsers: async ({ adminContext, newTempUser }, use) => {
        const applicant = await newTempUser();
        const supervisor = await newTempUser();

        const leaveType = await resolveLeaveType(adminContext);
        const leaveDate = getFutureWeekday(LEAVE_DAYS_AHEAD);

        await grantLeaveForDate(adminContext, {
            empNumber: applicant.empNumber,
            leaveTypeId: leaveType.id,
            leaveDate,
            days: ENTITLED_DAYS,
        });

        await assignSupervisor(adminContext, {
            empNumber: applicant.empNumber,
            supervisorEmpNumber: supervisor.empNumber,
        });

        await use({
            applicant,
            supervisor,
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveType.name,
            leaveDate,
            leavePeriod: getLeavePeriod(leaveDate),
            entitledDays: ENTITLED_DAYS,
        });
    },
    leaveType: async ({ adminContext }, use) => {
        await use(await resolveLeaveType(adminContext));
    },
    newLeaveType: async ({ adminContext }, use) => {
        const created: number[] = [];

        await use(async (): Promise<LeaveTypeRef> => {
            const response = await adminContext.post(ApiEndpoints.LEAVE_TYPES, {
                data: { name: createLeaveTypeName(), situational: false },
            });

            expect(response.status()).toBe(200);

            const { data: leaveType }: { data: LeaveTypeRef } =
                await response.json();

            created.push(leaveType.id);

            return { id: leaveType.id, name: leaveType.name };
        });

        if (created.length > 0) {
            const response = await adminContext.delete(
                ApiEndpoints.LEAVE_TYPES,
                {
                    data: { ids: created },
                }
            );

            expect(response.status()).toBe(200);
        }
    },
    newLeaveEmployee: async ({ adminContext, newApiUser, leaveType }, use) => {
        await use(async (options) => {
            const {
                days = ENTITLED_DAYS,
                entitledOn = getLeaveWeek().monday,
                ...userOptions
            } = options ?? {};
            const employee = await newApiUser(userOptions);

            if (days === 0) {
                return employee;
            }

            const entitlement = await grantLeaveForDate(adminContext, {
                empNumber: employee.empNumber,
                leaveTypeId: leaveType.id,
                leaveDate: entitledOn,
                days,
            });

            return { ...employee, entitlementId: entitlement.id };
        });
    },
});
