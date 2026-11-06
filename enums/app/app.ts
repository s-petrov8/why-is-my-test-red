/**
 * Application-specific constants.
 * Add your application's repeated string values here.
 *
 * The enums that collect members from several OrangeHRM areas have one section
 * per area. Add a member at the end of its area's section, so pull requests for
 * different areas change separate parts of this file and merge cleanly.
 *
 * @example
 * ```ts
 * import { Messages, ApiEndpoints } from '../../enums/app/app';
 *
 * await expect(page.getByText(Messages.LOGIN_FAILED)).toBeVisible();
 * ```
 */

/** Text the application renders: errors, confirmations and empty states */
export enum Messages {
    // Shared by every area
    /** Rendered in the results area of a list view when a filter matches nothing */
    NO_RECORDS_FOUND = 'No Records Found',
    SAVED_SUCCESSFULLY = 'Successfully Saved',
    UPDATED_SUCCESSFULLY = 'Successfully Updated',

    // Login
    LOGIN_FAILED = 'Invalid credentials',

    // Employee details and reporting lines

    // Admin users and roles

    // Leave
    LEAVE_SUBMIT_FAILED = 'Failed to Submit',
    LEAVE_OVERLAP_HEADING = 'Overlapping Leave Request(s) Found',
    LEAVE_BALANCE_NOT_SUFFICIENT = 'Balance not sufficient',
    LEAVE_VIEW_DETAILS = 'View Leave Details',
}

/** Statuses a leave request moves through, as the leave list renders them */
export enum LeaveStatuses {
    PENDING_APPROVAL = 'Pending Approval',
    SCHEDULED = 'Scheduled',
    TAKEN = 'Taken',
    REJECTED = 'Rejected',
    CANCELLED = 'Cancelled',
    /** A day inside a request's range that counts as no leave */
    WEEKEND = 'Weekend',
    HOLIDAY = 'Holiday',
}

/**
 * The `message` of a 400 from the leave endpoints, naming the rule that refused the
 * call. Captured from the running application: the annotations document no 400 on
 * apply or assign.
 */
export enum LeaveRefusals {
    BALANCE_EXCEEDED = 'Leave Balance Exceeded',
    NO_WORKING_DAYS = 'Failed to Submit: No Working Days Selected',
    OVERLAPPING_LEAVE = 'Overlapping Leave Request Found',
    ACTION_NOT_ALLOWED = 'Performed action not allowed',
    MULTIPLE_STATUSES = 'Leave request has multiple statuses',
    /** The application gives no specific reason for refusing to delete an entitlement in use */
    ENTITLEMENT_IN_USE = 'Bad Request',
}

/** What can be done to a leave request, as the API names it */
export enum LeaveActions {
    APPROVE = 'APPROVE',
    CANCEL = 'CANCEL',
    REJECT = 'REJECT',
}

/** How much of a day a leave request takes */
export enum LeaveDurationTypes {
    FULL_DAY = 'full_day',
    HALF_DAY_MORNING = 'half_day_morning',
    HALF_DAY_AFTERNOON = 'half_day_afternoon',
    SPECIFY_TIME = 'specify_time',
}

/** The `length` of a holiday */
export enum HolidayLengths {
    FULL_DAY = 0,
    HALF_DAY = 4,
}

/** The value of a weekday in the work week */
export enum WorkWeekDayLengths {
    FULL_DAY = 0,
    HALF_DAY = 4,
    NON_WORKING = 8,
}

/**
 * Weeks of next June that holiday tests hold for themselves. A holiday affects
 * every employee on its date, so each test has its own week.
 */
export enum ReservedHolidayWeeks {
    FULL_HOLIDAY = 0,
    HALF_HOLIDAY = 1,
    RECURRING_HOLIDAY = 2,
    DELETED_HOLIDAY = 3,
}

/** Ids of the built-in user roles */
export enum UserRoleIds {
    ADMIN = 1,
    ESS = 2,
}

/** Ids of the built-in reporting methods */
export enum ReportingMethodIds {
    DIRECT = 1,
    INDIRECT = 2,
}

/** API endpoint paths */
export enum ApiEndpoints {
    // Login
    AUTH_VALIDATE = '/web/index.php/auth/validate',

    // Employee details and reporting lines
    PIM_EMPLOYEES = '/web/index.php/api/v2/pim/employees',
    PIM_SUPERVISORS_SUFFIX = '/supervisors',

    // Admin users and roles
    ADMIN_USERS = '/web/index.php/api/v2/admin/users',
    ADMIN_WORK_SHIFTS = '/web/index.php/api/v2/admin/work-shifts',

    // Leave
    LEAVE_PERIOD = '/web/index.php/api/v2/leave/leave-period',
    LEAVE_TYPES = '/web/index.php/api/v2/leave/leave-types',
    LEAVE_ENTITLEMENTS = '/web/index.php/api/v2/leave/leave-entitlements',
    LEAVE_REQUESTS = '/web/index.php/api/v2/leave/leave-requests',
    LEAVE_EMPLOYEE_REQUESTS = '/web/index.php/api/v2/leave/employees/leave-requests',
    LEAVE_ELIGIBLE_TYPES = '/web/index.php/api/v2/leave/leave-types/eligible',
    LEAVE_BALANCE_BY_TYPE = '/web/index.php/api/v2/leave/leave-balance/leave-type',
    LEAVE_DAYS = '/web/index.php/api/v2/leave/leaves',
    LEAVE_DAYS_SUFFIX = '/leaves',
    LEAVE_COMMENTS_SUFFIX = '/leave-comments',
    LEAVE_HOLIDAYS = '/web/index.php/api/v2/leave/holidays',
    LEAVE_WORK_WEEK = '/web/index.php/api/v2/leave/workweek',
}

/** Application route paths (appended to `appConfig.appUrl`) */
export enum Routes {
    // Login
    LOGIN = '/web/index.php/auth/login',
    DASHBOARD = '/web/index.php/dashboard/index',

    // Employee details and reporting lines
    PIM_EMPLOYEE_LIST = '/web/index.php/pim/viewEmployeeList',

    // Admin users and roles

    // Leave
    LEAVE_APPLY = '/web/index.php/leave/applyLeave',
    LEAVE_LIST = '/web/index.php/leave/viewLeaveList',
    LEAVE_MY_LIST = '/web/index.php/leave/viewMyLeaveList',
}

/** Storage state file paths */
export enum StorageStatePaths {
    APP = '.auth/app/appStorageState.json',
}
