import { appConfig } from '../../../config/app';
import { ApiEndpoints, UserRoleIds } from '../../../enums/app/app';
import {
    DeleteUsersResponseSchema,
    UserListResponseSchema,
    UserResponseSchema,
} from '../../../fixtures/api/schemas/app/userSchema';
import {
    DeleteWorkShiftsResponseSchema,
    WorkShiftResponseSchema,
} from '../../../fixtures/api/schemas/app/workShiftSchema';
import { expect, test } from '../../../fixtures/pom/test-options';
import { deleteWorkShift } from '../../../helpers/app/workShift';
import { createWorkShiftData } from '../../../test-data/factories/app/leave.factory';
import {
    createUserData,
    createUserUpdateData,
} from '../../../test-data/factories/app/user.factory';

/** The length of the shift the work shift shapes are checked with. */
const SHIFT_HOURS = {
    hoursPerDay: '4',
    startTime: '09:00',
    endTime: '13:00',
};

/**
 * The owning tests for the Admin shapes that fixtures, teardown and shared helpers
 * read without validating, as the project overrides in `AGENTS.md` require. A bug in
 * one of these responses fails the one test here that names it, and the rest carry on.
 */
test.describe('api/v2 admin shapes that setup, teardown and shared helpers rely on', () => {
    let userIdToDelete: number | undefined;
    let workShiftIdToDelete: number | undefined;

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

        if (workShiftIdToDelete !== undefined) {
            const id = workShiftIdToDelete;
            workShiftIdToDelete = undefined;
            await deleteWorkShift(apiRequest, id);
        }
    });

    test(
        'should create, read, list, update and delete a user account with their exact shapes',
        { tag: '@api' },
        async ({ apiRequest, tempTestEmployee }) => {
            const account = createUserData(tempTestEmployee.empNumber);
            let userId = 0;

            await test.step('WHEN an account is created', async () => {
                const { status, body } = await apiRequest<{
                    data: { id: number };
                }>({
                    method: 'POST',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: account,
                });

                expect(status).toBe(200);
                // Recorded before the parse, so a shape failure still cleans up.
                userId = body.data.id;
                userIdToDelete = userId;
                expect(UserResponseSchema.parse(body)).toBeTruthy();
            });

            await test.step('WHEN it is read', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: `${ApiEndpoints.ADMIN_USERS}/${userId}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const read = UserResponseSchema.parse(body);
                expect(read.data.userName).toBe(account.username);
            });

            await test.step('WHEN the list is filtered to it', async () => {
                const { status, body } = await apiRequest({
                    method: 'GET',
                    url: `${ApiEndpoints.ADMIN_USERS}?username=${account.username}`,
                    baseUrl: appConfig.apiUrl,
                });

                expect(status).toBe(200);
                const list = UserListResponseSchema.parse(body);
                expect(list.data.map(({ id }) => id)).toEqual([userId]);
                expect(list.meta.total).toBe(1);
            });

            await test.step('WHEN it is updated', async () => {
                const { status, body } = await apiRequest({
                    method: 'PUT',
                    url: `${ApiEndpoints.ADMIN_USERS}/${userId}`,
                    baseUrl: appConfig.apiUrl,
                    body: createUserUpdateData({
                        username: account.username,
                        empNumber: account.empNumber,
                        status: false,
                        userRoleId: UserRoleIds.ESS,
                    }),
                });

                expect(status).toBe(200);
                const updated = UserResponseSchema.parse(body);
                expect(updated.data.status).toBe(false);
            });

            await test.step('WHEN it is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_USERS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [userId] },
                });

                expect(status).toBe(200);
                userIdToDelete = undefined;
                const deleted = DeleteUsersResponseSchema.parse(body);
                expect(deleted.data).toEqual([userId]);
            });
        }
    );

    test(
        'should create and delete a work shift with their exact shapes',
        { tag: '@api' },
        async ({ apiRequest }) => {
            let workShiftId = 0;

            await test.step('WHEN a work shift is created', async () => {
                const { status, body } = await apiRequest<{
                    data: { id: number };
                }>({
                    method: 'POST',
                    url: ApiEndpoints.ADMIN_WORK_SHIFTS,
                    baseUrl: appConfig.apiUrl,
                    body: createWorkShiftData({
                        empNumbers: [],
                        hours: SHIFT_HOURS,
                    }),
                });

                expect(status).toBe(200);
                // Recorded before the parse, so a shape failure still cleans up.
                workShiftId = body.data.id;
                workShiftIdToDelete = workShiftId;
                expect(WorkShiftResponseSchema.parse(body)).toBeTruthy();
            });

            await test.step('WHEN it is deleted', async () => {
                const { status, body } = await apiRequest({
                    method: 'DELETE',
                    url: ApiEndpoints.ADMIN_WORK_SHIFTS,
                    baseUrl: appConfig.apiUrl,
                    body: { ids: [workShiftId] },
                });

                expect(status).toBe(200);
                workShiftIdToDelete = undefined;
                const deleted = DeleteWorkShiftsResponseSchema.parse(body);
                expect(deleted.data).toEqual([workShiftId]);
            });
        }
    );
});
