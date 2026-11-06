import { appConfig } from '../../../config/app';
import {
    ApiEndpoints,
    Messages,
    PasswordRules,
    Routes,
    UserRoleIds,
} from '../../../enums/app/app';
import { PasswordCheckResponseSchema } from '../../../fixtures/api/schemas/app/userSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import {
    attemptSignIn,
    readLoginMessage,
    updateAccount,
} from '../../../helpers/app/adminUser';
import {
    createUserData,
    createUserUpdateData,
} from '../../../test-data/factories/app/user.factory';
import type { ApiRequestParams } from '../../../fixtures/api/api-types';
import type { TempUser } from '../../../helpers/app/tempUser';
import {
    INVALID_PASSWORDS,
    LONGEST_VALID_PASSWORD,
} from '../../../test-data/static/app/passwords';

/** The fields of an account these tests read. */
type AccountFields = {
    userName: string;
    status: boolean;
    userRole: { id: number };
};

/** The body of a 422, which names the fields it refused. */
type InvalidParameters = { error: { data: { invalidParamKeys: string[] } } };

/** The list filtered to one username, so a test sees only its own account. */
const accountsNamed = (username: string): string =>
    `${ApiEndpoints.ADMIN_USERS}?username=${username}`;

const accountOf = (user: TempUser): string =>
    `${ApiEndpoints.ADMIN_USERS}/${user.userId}`;

const ownEmployee = (user: TempUser): string =>
    `${ApiEndpoints.PIM_EMPLOYEES}/${user.empNumber}`;

test.describe('api/v2 admin users', () => {
    let userIdToDelete: number | undefined;

    test.afterEach(async ({ apiRequest }) => {
        if (userIdToDelete !== undefined) {
            const id = userIdToDelete;
            userIdToDelete = undefined;
            const { status, body } = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.ADMIN_USERS,
                baseUrl: appConfig.apiUrl,
                body: { ids: [id] },
            });
            expect(status, JSON.stringify(body)).toBe(200);
        }
    });

    test(
        'should refuse an ESS account every user operation and leave the data unchanged',
        { tag: '@api' },
        async ({ apiRequest, newApiUser, newTempUser }) => {
            const essPerson = await newApiUser();
            const target = await newTempUser();
            const newAccount = createUserData(target.empNumber);
            const refusedCalls: {
                description: string;
                params: ApiRequestParams;
            }[] = [
                {
                    description: 'list accounts',
                    params: { method: 'GET', url: ApiEndpoints.ADMIN_USERS },
                },
                {
                    description: 'read an account',
                    params: { method: 'GET', url: accountOf(target) },
                },
                {
                    description: 'create an account',
                    params: {
                        method: 'POST',
                        url: ApiEndpoints.ADMIN_USERS,
                        body: newAccount,
                    },
                },
                {
                    description: 'rename, disable and promote an account',
                    params: {
                        method: 'PUT',
                        url: accountOf(target),
                        body: createUserUpdateData({
                            username: newAccount.username,
                            empNumber: target.empNumber,
                            status: false,
                            userRoleId: UserRoleIds.ADMIN,
                        }),
                    },
                },
                {
                    description: 'delete an account',
                    params: {
                        method: 'DELETE',
                        url: ApiEndpoints.ADMIN_USERS,
                        body: { ids: [target.userId] },
                    },
                },
                {
                    description: 'check a username',
                    params: {
                        method: 'GET',
                        url: `${ApiEndpoints.ADMIN_USERNAME_CHECK}?userName=${newAccount.username}`,
                    },
                },
            ];

            for (const { description, params } of refusedCalls) {
                await test.step(`WHEN ESS tries to ${description}, THEN it answers 403`, async () => {
                    const { status, body } = await essPerson.api({
                        ...params,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status, JSON.stringify(body)).toBe(403);
                });
            }

            await test.step('WHEN an admin checks that username, THEN it is free', async () => {
                const { status, body } = await apiRequest<{
                    data: { valid: boolean };
                }>({
                    method: 'GET',
                    url: `${ApiEndpoints.ADMIN_USERNAME_CHECK}?userName=${newAccount.username}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
                expect(body.data.valid).toBe(true);
            });

            await test.step('THEN the target account is unchanged', async () => {
                const { status, body } = await apiRequest<{
                    data: AccountFields;
                }>({
                    method: 'GET',
                    url: accountOf(target),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
                expect(body.data.userName).toBe(target.username);
                expect(body.data.status).toBe(true);
                expect(body.data.userRole.id).toBe(UserRoleIds.ESS);
            });

            await test.step('THEN no account was created', async () => {
                const { status, body } = await apiRequest<{
                    data: unknown[];
                }>({
                    method: 'GET',
                    url: accountsNamed(newAccount.username),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
                expect(body.data).toEqual([]);
            });
        }
    );

    test(
        'should refuse a disabled account, end its session, and let it back in when re-enabled',
        { tag: '@api' },
        async ({ apiRequest, apiRequestAs, newApiUser }) => {
            const person = await newApiUser();

            await test.step('GIVEN the person has a live session', async () => {
                const { status, body } = await person.api({
                    method: 'GET',
                    url: ownEmployee(person),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
            });

            await test.step('WHEN the admin disables the account', async () => {
                await updateAccount(apiRequest, person, {
                    status: false,
                    userRoleId: UserRoleIds.ESS,
                });
            });

            await test.step('THEN the live session ends', async () => {
                const { status, body } = await person.api({
                    method: 'GET',
                    url: ownEmployee(person),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(401);
            });

            // The edit also changes the account's modified time, which ends a session by
            // itself, with "Session Expired". Only the reason shows the status rule held.
            await test.step('THEN the session ended because the account is disabled', async () => {
                const { status, body } = await person.api<string>({
                    method: 'GET',
                    url: Routes.LOGIN,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, body).toBe(200);
                expect(readLoginMessage(body)).toBe(Messages.ACCOUNT_DISABLED);
            });

            await test.step('THEN signing in is refused, naming the reason', async () => {
                const attempt = await attemptSignIn(person);

                expect(attempt.location).toContain(Routes.LOGIN);
                expect(attempt.message).toBe(Messages.ACCOUNT_DISABLED);
            });

            await test.step('WHEN the admin enables the account', async () => {
                await updateAccount(apiRequest, person, {
                    status: true,
                    userRoleId: UserRoleIds.ESS,
                });
            });

            await test.step('THEN signing in works again', async () => {
                const attempt = await attemptSignIn(person);

                expect(attempt.location).toContain(Routes.DASHBOARD);
            });

            await test.step('THEN a new session reaches their own record', async () => {
                const api = await apiRequestAs(person);
                const { status, body } = await api({
                    method: 'GET',
                    url: ownEmployee(person),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
            });
        }
    );

    test(
        'should refuse a deleted account, end its session, hide it, and answer 404 on it',
        { tag: '@api' },
        async ({ apiRequest, newApiUser }) => {
            const person = await newApiUser();
            const callsOnDeletedAccount: {
                description: string;
                params: ApiRequestParams;
            }[] = [
                {
                    description: 'GET the account',
                    params: { method: 'GET', url: accountOf(person) },
                },
                {
                    description: 'PUT the account',
                    params: {
                        method: 'PUT',
                        url: accountOf(person),
                        body: createUserUpdateData({
                            username: person.username,
                            empNumber: person.empNumber,
                            status: true,
                            userRoleId: UserRoleIds.ESS,
                        }),
                    },
                },
                {
                    description: 'DELETE the account',
                    params: {
                        method: 'DELETE',
                        url: ApiEndpoints.ADMIN_USERS,
                        body: { ids: [person.userId] },
                    },
                },
            ];

            await test.step('WHEN the admin deletes the account', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [person.userId] },
                });

                expect(status, JSON.stringify(body)).toBe(200);
            });

            await test.step('THEN the live session ends', async () => {
                const { status, body } = await person.api({
                    method: 'GET',
                    url: ownEmployee(person),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(401);
            });

            await test.step('THEN signing in is refused as invalid credentials', async () => {
                const attempt = await attemptSignIn(person);

                expect(attempt.location).toContain(Routes.LOGIN);
                expect(attempt.message).toBe(Messages.LOGIN_FAILED);
            });

            await test.step('THEN the list no longer holds it', async () => {
                const { status, body } = await apiRequest<{
                    data: unknown[];
                }>({
                    method: 'GET',
                    url: accountsNamed(person.username),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(200);
                expect(body.data).toEqual([]);
            });

            for (const { description, params } of callsOnDeletedAccount) {
                await test.step(`WHEN the admin tries to ${description}, THEN it answers 404`, async () => {
                    const { status, body } = await apiRequest({
                        ...params,
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status, JSON.stringify(body)).toBe(404);
                });
            }
        }
    );

    test(
        'should refuse an admin deleting themselves, alone or in a batch, and delete nothing',
        { tag: '@api' },
        async ({ apiRequest, newApiUser, newTempUser }) => {
            const tempAdmin = await newApiUser({
                userRoleId: UserRoleIds.ADMIN,
            });
            const other = await newTempUser();
            const survivors = [
                { name: 'the admin', account: tempAdmin },
                { name: 'the other account', account: other },
            ];
            const refusedBatches = [
                { description: 'alone', ids: [tempAdmin.userId] },
                {
                    description: 'in a batch with another account',
                    ids: [tempAdmin.userId, other.userId],
                },
            ];

            for (const { description, ids } of refusedBatches) {
                await test.step(`WHEN the admin deletes themselves ${description}, THEN it answers 422 on ids`, async () => {
                    const { status, body } =
                        await tempAdmin.api<InvalidParameters>({
                            method: 'DELETE',
                            url: ApiEndpoints.ADMIN_USERS,
                            baseUrl: appConfig.apiUrl,
                            body: { ids },
                        });

                    expect(status, JSON.stringify(body)).toBe(422);
                    expect(body.error.data.invalidParamKeys).toEqual(['ids']);
                });

                for (const { name, account } of survivors) {
                    await test.step(`THEN ${name} still exists`, async () => {
                        const { status, body } = await apiRequest({
                            method: 'GET',
                            url: accountOf(account),
                            baseUrl: appConfig.apiUrl,
                        });

                        expect(status, JSON.stringify(body)).toBe(200);
                    });
                }
            }

            await test.step('WHEN the admin deletes only the other account, THEN that works', async () => {
                const { status, body } = await tempAdmin.api({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [other.userId] },
                });

                expect(status, JSON.stringify(body)).toBe(200);
            });
        }
    );

    test(
        'should apply a role change at the next sign-in, promoting and demoting',
        { tag: '@api' },
        async ({ apiRequest, apiRequestAs, newApiUser }) => {
            const person = await newApiUser();
            const roleChanges = [
                {
                    description: 'promotes them',
                    userRoleId: UserRoleIds.ADMIN,
                    status: 200,
                },
                {
                    description: 'demotes them',
                    userRoleId: UserRoleIds.ESS,
                    status: 403,
                },
            ];

            await test.step('GIVEN an ESS account, THEN listing accounts answers 403', async () => {
                const { status, body } = await person.api({
                    method: 'GET',
                    url: accountsNamed(person.username),
                    baseUrl: appConfig.apiUrl,
                });

                expect(status, JSON.stringify(body)).toBe(403);
            });

            for (const change of roleChanges) {
                await test.step(`WHEN the admin ${change.description}`, async () => {
                    await updateAccount(apiRequest, person, {
                        status: true,
                        userRoleId: change.userRoleId,
                    });
                });

                await test.step(`THEN after signing in again, listing accounts answers ${change.status}`, async () => {
                    const api = await apiRequestAs(person);
                    const { status, body } = await api({
                        method: 'GET',
                        url: accountsNamed(person.username),
                        baseUrl: appConfig.apiUrl,
                    });

                    expect(status, JSON.stringify(body)).toBe(change.status);
                });
            }
        }
    );

    test(
        'should refuse a password that breaks one policy rule, and name that rule',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            for (const { description, password, rule } of INVALID_PASSWORDS) {
                await test.step(`WHEN an account is created with ${description}, THEN it answers 422 on password`, async () => {
                    const { status, body } =
                        await apiRequest<InvalidParameters>({
                            method: 'POST',
                            url: ApiEndpoints.ADMIN_USERS,
                            baseUrl: appConfig.apiUrl,
                            body: {
                                ...createUserData(tempTestEmployee.empNumber),
                                password,
                            },
                        });

                    expect(status, JSON.stringify(body)).toBe(422);
                    expect(body.error.data.invalidParamKeys).toEqual([
                        'password',
                    ]);
                });

                await test.step(`WHEN the password check reads ${description}, THEN it names ${rule}`, async () => {
                    const { status, body } = await apiRequest<{
                        data: { messages: string[] };
                    }>({
                        method: 'POST',
                        url: ApiEndpoints.PASSWORD_CHECK,
                        baseUrl: appConfig.apiUrl,
                        body: { password },
                    });

                    expect(status, JSON.stringify(body)).toBe(200);
                    expect(body.data.messages).toEqual([PasswordRules[rule]]);
                });
            }

            await test.step('WHEN the password check reads the longest valid password, THEN it names no rule', async () => {
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.PASSWORD_CHECK,
                    baseUrl: appConfig.apiUrl,
                    body: { password: LONGEST_VALID_PASSWORD },
                });

                expect(status, JSON.stringify(body)).toBe(200);
                expect(
                    PasswordCheckResponseSchema.parse(body).data.messages
                ).toEqual([]);
            });

            await test.step('WHEN an account is created with it, THEN it is accepted', async () => {
                const { status, body } = await apiRequest<{
                    data: { id: number };
                }>({
                    method: 'POST',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: createUserData(tempTestEmployee.empNumber, {
                        password: LONGEST_VALID_PASSWORD,
                    }),
                });

                expect(status, JSON.stringify(body)).toBe(200);
                userIdToDelete = body.data.id;
            });
        }
    );
});
