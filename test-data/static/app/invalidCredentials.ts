/**
 * Domain-specific invalid credentials for login tests.
 *
 * Four curated sets used by authentication negative tests:
 * - `INVALID_EMAILS` — email strings that should be rejected as malformed.
 * - `INVALID_PASSWORDS` — password strings that should be rejected as weak / malformed.
 * - `INVALID_LOGIN_ATTEMPTS` — paired `{ description, username, password }` objects
 *   for data-driven login-rejection tests that iterate full scenarios. Every entry
 *   has both fields populated, so the submission always reaches the server and is
 *   rejected there. Usable from both the UI and the API.
 * - `EMPTY_LOGIN_ATTEMPT` — the blank-credentials case, kept separate because the
 *   browser blocks it client-side (the form never submits) while a direct HTTP
 *   request still reaches the server. API-only.
 *
 * Format: `.ts` with `as const` exports. Static data files are TypeScript only;
 * they may export only literal values -- no runtime imports, no functions, no
 * computed values.
 */

export const INVALID_EMAILS = [
    '',
    'plaintext',
    'missing-at-sign.com',
    'missing@domain',
    '@missing-local.com',
    'double@@at.com',
    'spaces in@email.com',
    'invalid@.com',
    'invalid@domain',
    'invalid@domain..com',
    'user@domain,com',
    'user name@domain.com',
] as const;

export const INVALID_PASSWORDS = [
    '',
    '123',
    'short',
    'NoNumber!',
    'nouppercase123!',
    'NOLOWERCASE123!',
    'NoSpecialChar123',
    '   spaces123!',
    'trailing ',
    ' leading',
] as const;

export const INVALID_LOGIN_ATTEMPTS = [
    {
        description: 'known username with wrong password',
        username: 'Admin',
        password: 'WrongPassword123!',
    },
    {
        description: 'known username with another incorrect password',
        username: 'Admin',
        password: 'IncorrectPass456$',
    },
    {
        description: 'unknown username with valid-looking password',
        username: 'not-a-user',
        password: 'ValidPassword123!',
    },
    {
        description: 'email-shaped username',
        username: 'admin@test.com',
        password: 'SecurePass789#',
    },
    {
        description: 'unknown username with short password',
        username: 'nosuchuser',
        password: '123',
    },
    {
        description: 'whitespace-padded username',
        username: '  Admin  ',
        password: 'admin123',
    },
] as const;

export const EMPTY_LOGIN_ATTEMPT = {
    description: 'empty username and password',
    username: '',
    password: '',
} as const;
