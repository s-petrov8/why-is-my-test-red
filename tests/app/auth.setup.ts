/**
 * auth.setup.ts
 * Playwright setup script to generate storage states for authentication.
 *
 * This runs before the main test suite to generate the browser storage state
 * with an authenticated session cookie.
 */

import * as fs from 'node:fs';
import { expect, test } from '../../fixtures/pom/test-options';
import { StorageStatePaths } from '../../enums/app/app';
import { createAppStorageState } from '../../helpers/app/createStorageState';

test.describe('auth setup', () => {
    test('setup authentication - browser storage state', async () => {
        await createAppStorageState();
        expect(fs.existsSync(StorageStatePaths.APP)).toBe(true);
    });
});
