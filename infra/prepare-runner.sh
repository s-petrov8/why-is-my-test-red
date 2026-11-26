#!/usr/bin/env bash
# Decrypts the script in RUNNER_PREP with RUNNER_PREP_KEY and starts it in the background,
# in its own process group, with its output discarded. It prints nothing, so every build's
# log reads the same. The group's id goes to $RUNNER_TEMP/runner-prep.pgid, so a later step
# can stop whatever is still running before the job ends. The runner clears $RUNNER_TEMP.
# RUNNER_PREP is base64 of `openssl enc -aes-256-cbc -pbkdf2 -salt`; empty means nothing to start.
set -euo pipefail

if [[ -z "${RUNNER_PREP:-}" ]]; then
    exit 0
fi

if [[ -z "${RUNNER_PREP_KEY:-}" ]]; then
    echo "runner_prep is set but the RUNNER_PREP_KEY secret is not." >&2
    exit 1
fi

script="$(mktemp "${RUNNER_TEMP:-/tmp}/prep.XXXXXX")"
if ! printf '%s' "$RUNNER_PREP" |
    openssl enc -d -aes-256-cbc -pbkdf2 -a -A -pass env:RUNNER_PREP_KEY > "$script" 2>/dev/null; then
    rm -f "$script"
    echo "runner_prep could not be decrypted with RUNNER_PREP_KEY." >&2
    exit 1
fi

# A background child is not a group leader, so setsid keeps its pid, which becomes the group id.
setsid bash "$script" > /dev/null 2>&1 < /dev/null &
echo "$!" > "${RUNNER_TEMP:-/tmp}/runner-prep.pgid"
