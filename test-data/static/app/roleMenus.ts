/**
 * The main menu each role sees, in the order the application renders it. The
 * Supervisor role comes from a reporting line, on top of an ESS account.
 */

export const ADMIN_MENU_ITEMS = [
    'Admin',
    'PIM',
    'Leave',
    'Time',
    'Recruitment',
    'My Info',
    'Performance',
    'Dashboard',
    'Directory',
    'Maintenance',
    'Claim',
    'Buzz',
] as const;

export const ESS_MENU_ITEMS = [
    'Leave',
    'Time',
    'My Info',
    'Performance',
    'Dashboard',
    'Directory',
    'Claim',
    'Buzz',
] as const;

export const SUPERVISOR_MENU_ITEMS = [
    'PIM',
    'Leave',
    'Time',
    'My Info',
    'Performance',
    'Dashboard',
    'Directory',
    'Claim',
    'Buzz',
] as const;
