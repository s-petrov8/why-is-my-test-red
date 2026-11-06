import { createAuthenticatedContext } from '../../helpers/app/createStorageState';
import {
    assignSupervisor,
    grantLeaveEntitlement,
    resolveLeaveType,
} from '../../helpers/app/leave';
import { TempUser } from '../../helpers/app/tempUser';
import { getFutureWeekday, getLeavePeriod } from '../../helpers/util/util';
import { test as userTest } from './user-fixture';

/** Leave helper fixtures: the preconditions the leave workflow needs before it */

/** Days of leave granted to a temporary user -- enough for any single request. */
const ENTITLEMENT_DAYS = 5;

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
};

export type LeaveFixtures = {
    /** An applicant and their supervisor, with entitlement and reporting line. */
    tempLeaveApprovalUsers: LeaveApprovalUsers;
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
    tempLeaveApprovalUsers: async ({ newTempUser }, use) => {
        const context = await createAuthenticatedContext();

        try {
            const applicant = await newTempUser();
            const supervisor = await newTempUser();

            const leaveType = await resolveLeaveType(context);
            const leaveDate = getFutureWeekday(LEAVE_DAYS_AHEAD);
            const leavePeriod = getLeavePeriod(leaveDate);

            await grantLeaveEntitlement(context, {
                empNumber: applicant.empNumber,
                leaveTypeId: leaveType.id,
                fromDate: leavePeriod.fromDate,
                toDate: leavePeriod.toDate,
                days: ENTITLEMENT_DAYS,
            });

            await assignSupervisor(context, {
                empNumber: applicant.empNumber,
                supervisorEmpNumber: supervisor.empNumber,
            });

            await use({
                applicant,
                supervisor,
                leaveTypeId: leaveType.id,
                leaveTypeName: leaveType.name,
                leaveDate,
                leavePeriod,
            });
        } finally {
            await context.dispose();
        }
    },
});
