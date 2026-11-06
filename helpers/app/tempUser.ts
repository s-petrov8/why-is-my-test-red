import {
    APIRequestContext,
    Browser,
    BrowserContext,
    expect,
    Page,
} from '@playwright/test';
import { ApiEndpoints, UserRoleIds } from '../../enums/app/app';
import { createAuthenticatedContext } from './createStorageState';
import { createEmployeeData } from '../../test-data/factories/app/employee.factory';
import { createUserData } from '../../test-data/factories/app/user.factory';
import {
    DeleteEmployeesResponseSchema,
    EmployeeResponseSchema,
} from '../../fixtures/api/schemas/app/employeeSchema';
import { RecordsNotFoundResponseSchema } from '../../fixtures/api/schemas/app/errorSchema';
import {
    DeleteUsersResponseSchema,
    UserResponseSchema,
} from '../../fixtures/api/schemas/app/userSchema';

/**
 * Provisioning for throwaway persons: an employee, the account that signs in as
 * them, and a signed-in browser session.
 *
 * NOTE: a PIM employee is a personnel record, NOT a login. Creating one produces
 * nobody who can sign in, which is why `createTempUser` always creates both.
 */

/** A throwaway person: the employee record plus the account that signs in as them. */
export type TempUser = {
    /** PIM employee number of the person the account signs in as. */
    empNumber: number;
    /** Id of the user account itself, used to delete it during teardown. */
    userId: number;
    username: string;
    password: string;
    /** Full name as the employee autocomplete and results tables render it. */
    employeeFullName: string;
};

/** What can differ from a plain ESS account. */
export type TempUserOptions = {
    userRoleId?: UserRoleIds;
};

/**
 * Creates an employee together with an ESS account that signs in as them.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {TempUserOptions} [options] - What differs from a plain ESS account.
 * @returns {Promise<TempUser>} The created person and their credentials.
 *
 * @example
 * ```ts
 * const applicant = await createTempUser(context);
 * const admin = await createTempUser(context, { userRoleId: UserRoleIds.ADMIN });
 * ```
 */
export async function createTempUser(
    context: APIRequestContext,
    options?: TempUserOptions
): Promise<TempUser> {
    const employeeResponse = await context.post(ApiEndpoints.PIM_EMPLOYEES, {
        data: createEmployeeData(),
    });

    expect(employeeResponse.status()).toBe(200);

    const employee = EmployeeResponseSchema.parse(
        await employeeResponse.json()
    ).data;

    const userPayload = createUserData(employee.empNumber, options);
    const userResponse = await context.post(ApiEndpoints.ADMIN_USERS, {
        data: userPayload,
    });

    expect(userResponse.status()).toBe(200);

    const user = UserResponseSchema.parse(await userResponse.json()).data;

    return {
        empNumber: employee.empNumber,
        userId: user.id,
        username: userPayload.username,
        password: userPayload.password,
        employeeFullName: [
            employee.firstName,
            employee.middleName,
            employee.lastName,
        ]
            .filter((part): boolean => part.length > 0)
            .join(' '),
    };
}

/**
 * Deletes a throwaway person: first the account, then the employee it points at.
 *
 * @param {APIRequestContext} context - An authenticated request context.
 * @param {TempUser} user - The person to remove.
 * @returns {Promise<void>} Resolves once both records are gone.
 */
export async function deleteTempUser(
    context: APIRequestContext,
    user: TempUser
): Promise<void> {
    const deleteUserResponse = await context.delete(ApiEndpoints.ADMIN_USERS, {
        data: { ids: [user.userId] },
    });

    expect([200, 404]).toContain(deleteUserResponse.status());

    if (deleteUserResponse.status() === 200) {
        expect(
            DeleteUsersResponseSchema.parse(await deleteUserResponse.json())
        ).toBeTruthy();
    }

    const deleteEmployeeResponse = await context.delete(
        ApiEndpoints.PIM_EMPLOYEES,
        { data: { ids: [user.empNumber] } }
    );

    expect([200, 404]).toContain(deleteEmployeeResponse.status());

    const deleteBody = await deleteEmployeeResponse.json();

    if (deleteEmployeeResponse.status() === 200) {
        expect(DeleteEmployeesResponseSchema.parse(deleteBody)).toBeTruthy();
    } else {
        expect(RecordsNotFoundResponseSchema.parse(deleteBody)).toBeTruthy();
    }
}

/**
 * Signs a throwaway person into a browser context of their own.
 * The caller owns the returned context and must `close()` it.
 *
 * @param {Browser} browser - Browser used to build the context.
 * @param {TempUser} user - The account to sign in as.
 * @returns {Promise<{ context: BrowserContext, page: Page }>} The signed-in session.
 *
 * @example
 * ```ts
 * const { context, page } = await signInAsTempUser(browser, applicant);
 * ```
 */
export async function signInAsTempUser(
    browser: Browser,
    user: TempUser
): Promise<{ context: BrowserContext; page: Page }> {
    const apiContext = await createAuthenticatedContext({
        username: user.username,
        password: user.password,
    });

    let storageState;

    try {
        storageState = await apiContext.storageState();
    } finally {
        // The request context has served its purpose once the cookie is out of
        // it; the browser context below carries the session from here.
        await apiContext.dispose();
    }

    const context = await browser.newContext({ storageState });

    try {
        return { context, page: await context.newPage() };
    } catch (error) {
        await context.close();
        throw error;
    }
}
