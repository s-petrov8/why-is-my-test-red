/**
 * Fixed passwords for the password policy test. Strength depends on the exact value,
 * so these aren't generated. Each invalid value breaks one rule and the password
 * check names only that rule; `rule` is its key in `PasswordRules`.
 */

/** The longest password the policy allows. */
export const LONGEST_VALID_PASSWORD =
    'Vq7#mZt2Lp9xRw4KsY8nBc3HdJ6fGu1TeA5oQi0WlXv7MrN2zPy9CbS4kDj8hUf!';

export const INVALID_PASSWORDS = [
    {
        description: 'seven characters',
        password: 'Vq7#mZt',
        rule: 'TOO_SHORT',
    },
    {
        description: 'sixty-five characters',
        password:
            'Vq7#mZt2Lp9xRw4KsY8nBc3HdJ6fGu1TeA5oQi0WlXv7MrN2zPy9CbS4kDj8hUf!a',
        rule: 'TOO_LONG',
    },
    {
        description: 'no upper-case letter',
        password: 'vq7#mzt2lp9xrw4ksy8nbc3h',
        rule: 'NO_UPPER_CASE',
    },
    {
        description: 'no lower-case letter',
        password: 'VQ7#MZT2LP9XRW4KSY8NBC3H',
        rule: 'NO_LOWER_CASE',
    },
    {
        description: 'no digit',
        password: 'Vqt#mZtLpkxRwQKsYynBcJHd',
        rule: 'NO_DIGIT',
    },
    {
        description: 'no special character',
        password: 'Vq7mZt2Lp9xRw4KsY8nBc3Hd',
        rule: 'NO_SPECIAL_CHARACTER',
    },
    {
        description: 'a space',
        password: 'Vq7#mZt2 Lp9xRw4KsY8nBc3H',
        rule: 'CONTAINS_SPACE',
    },
    {
        description: 'every character class in eight characters, too guessable',
        password: 'Vq7#mZt2',
        rule: 'GUESSABLE',
    },
] as const;
