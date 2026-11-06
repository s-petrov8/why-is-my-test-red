/**
 * Application-specific constants.
 * Add your application's repeated string values here.
 *
 * @example
 * ```ts
 * import { Messages, ApiEndpoints } from '../../enums/app/app';
 *
 * await expect(page.getByText(Messages.LOGIN_FAILED)).toBeVisible();
 * ```
 */

export enum Messages {
    LOGIN_FAILED = 'Invalid credentials',
    /** Rendered in the results area of a list view when a filter matches nothing */
    NO_RECORDS_FOUND = 'No Records Found',
    SAVED_SUCCESSFULLY = 'Successfully Saved',
    UPDATED_SUCCESSFULLY = 'Successfully Updated',
    LEAVE_SUBMIT_FAILED = 'Failed to Submit',
}

export enum LeaveStatuses {
    PENDING_APPROVAL = 'Pending Approval',
    SCHEDULED = 'Scheduled',
    REJECTED = 'Rejected',
    CANCELLED = 'Cancelled',
}

export enum UserRoleIds {
    ADMIN = 1,
    ESS = 2,
}

export enum ReportingMethodIds {
    DIRECT = 1,
    INDIRECT = 2,
}

/** API endpoint paths */
export enum ApiEndpoints {
    AUTH_VALIDATE = '/web/index.php/auth/validate',
    PIM_EMPLOYEES = '/web/index.php/api/v2/pim/employees',
    PIM_SUPERVISORS_SUFFIX = '/supervisors',
    ADMIN_USERS = '/web/index.php/api/v2/admin/users',
    LEAVE_PERIOD = '/web/index.php/api/v2/leave/leave-period',
    LEAVE_TYPES = '/web/index.php/api/v2/leave/leave-types',
    LEAVE_ENTITLEMENTS = '/web/index.php/api/v2/leave/leave-entitlements',
    LEAVE_REQUESTS = '/web/index.php/api/v2/leave/leave-requests',
    LEAVE_EMPLOYEE_REQUESTS = '/web/index.php/api/v2/leave/employees/leave-requests',
}

/** Application route paths (appended to `appConfig.appUrl`) */
export enum Routes {
    LOGIN = '/web/index.php/auth/login',
    DASHBOARD = '/web/index.php/dashboard/index',
    PIM_EMPLOYEE_LIST = '/web/index.php/pim/viewEmployeeList',
    LEAVE_APPLY = '/web/index.php/leave/applyLeave',
    LEAVE_LIST = '/web/index.php/leave/viewLeaveList',
}

/** Storage state file paths */
export enum StorageStatePaths {
    APP = '.auth/app/appStorageState.json',
}
