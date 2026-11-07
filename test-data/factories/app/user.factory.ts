import { faker } from '@faker-js/faker';
import { UserRoleIds } from '../../../enums/app/app';
import {
    CreateUserRequest,
    CreateUserRequestSchema,
    UpdateUserRequest,
    UpdateUserRequestSchema,
} from '../../../fixtures/api/schemas/app/userSchema';

/**
 * Builds a password that satisfies the application's complexity rules by
 * construction rather than by chance.
 *
 * `faker.internet.password()` draws from one character pool, so a generated
 * value can legitimately come back without a digit or an upper-case letter and
 * be rejected. Assembling one segment per required class removes that flake:
 * the result always carries lower-case, upper-case, digits and a symbol.
 *
 * @returns {string} A password meeting every character-class requirement.
 */
function generatePassword(): string {
    const lower = faker.string.alpha({ length: 5, casing: 'lower' });
    const upper = faker.string.alpha({ length: 2, casing: 'upper' });
    const digits = faker.string.numeric(3);

    return `${lower}${upper}${digits}!`;
}

/**
 * Generates a valid user-account creation payload with randomized credentials.
 *
 * The username is suffixed with random digits because usernames are unique
 * across the instance -- a bare Faker username collides once the same name is
 * drawn twice, and the application answers that with a validation error rather
 * than a clear conflict.
 *
 * `empNumber` has no sensible random value: the account must point at an
 * employee that actually exists, so the caller always supplies it.
 *
 * @param {number} empNumber - The PIM employee this account signs in as.
 * @param {Partial<CreateUserRequest>} overrides - Optional values to override the generated ones.
 * @returns {CreateUserRequest} A valid payload matching the CreateUserRequestSchema.
 *
 * @example
 * ```ts
 * const user = createUserData(employee.empNumber);
 * const adminUser = createUserData(employee.empNumber, { userRoleId: UserRoleIds.ADMIN });
 * ```
 */
export const createUserData = (
    empNumber: number,
    overrides?: Partial<CreateUserRequest>
): CreateUserRequest => {
    const defaultUser: CreateUserRequest = {
        username: `${faker.internet.username().replace(/[^a-zA-Z]/g, '')}${faker.string.numeric(5)}`,
        password: generatePassword(),
        status: true,
        userRoleId: UserRoleIds.ESS,
        empNumber,
    };

    const mergedUser = { ...defaultUser, ...overrides };

    return CreateUserRequestSchema.parse(mergedUser);
};

/**
 * Builds the payload of an edit that leaves the account's password as it is.
 *
 * @param {object} account - The account being edited, and its values after the edit.
 * @param {string} account.username - The account's username.
 * @param {number} account.empNumber - The PIM employee the account signs in as.
 * @param {boolean} account.status - Whether the account is enabled.
 * @param {UserRoleIds} account.userRoleId - The account's role.
 * @returns {UpdateUserRequest} A valid payload matching the UpdateUserRequestSchema.
 */
export const createUserUpdateData = (account: {
    username: string;
    empNumber: number;
    status: boolean;
    userRoleId: UserRoleIds;
}): UpdateUserRequest =>
    UpdateUserRequestSchema.parse({
        ...account,
        password: '',
        changePassword: false,
    });
