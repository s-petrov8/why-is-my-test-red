import { test as base, mergeTests, request } from '@playwright/test';
import { test as pageObjectFixture } from './page-object-fixture';
import { test as apiRequestFixture } from '../api/api-request-fixture';
import { test as leaveFixture } from '../helper/leave-fixture';
import { test as pimFixture } from '../helper/pim-fixture';

/**
 * The single import point for `test` and `expect`.
 */
const test = mergeTests(
    pageObjectFixture,
    apiRequestFixture,
    pimFixture,
    leaveFixture
);

const expect = base.expect;
export { test, expect, request };
