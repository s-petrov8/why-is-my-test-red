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
}

/** Statuses a leave request moves through, as the leave list renders them */
export enum LeaveStatuses {
    PENDING_APPROVAL = 'Pending Approval',
    SCHEDULED = 'Scheduled',
    REJECTED = 'Rejected',
    CANCELLED = 'Cancelled',
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

    // Leave
    LEAVE_PERIOD = '/web/index.php/api/v2/leave/leave-period',
    LEAVE_TYPES = '/web/index.php/api/v2/leave/leave-types',
    LEAVE_ENTITLEMENTS = '/web/index.php/api/v2/leave/leave-entitlements',
    LEAVE_REQUESTS = '/web/index.php/api/v2/leave/leave-requests',
    LEAVE_EMPLOYEE_REQUESTS = '/web/index.php/api/v2/leave/employees/leave-requests',
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
}

/** Storage state file paths */
export enum StorageStatePaths {
    APP = '.auth/app/appStorageState.json',
}
