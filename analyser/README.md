# The analyser

The analyser explains why a CI build's tests failed. It sorts the failing tests into groups by cause, gives each group a verdict and backs the verdict with evidence from the build.

It only reads. It never reruns tests, starts builds, pushes or changes anything. It works from what the builds left behind, the CI history and the commits between builds.

An evaluation loop checks it. A mutator plants a fault in the app among harmless commits, CI runs the suite on the last passing app commit and on the faulty one, and the mutator writes an answer card. A fresh analyser explains the failing build, and the scorer in this folder compares its answer with the card.

## What's here

- `failing-tests.ts`: prints the id of every failing test in a Playwright JSON report.
- `score.ts`: the scorer.
- `*.test.ts`: unit tests for both, run with `npm run test:analyser`.
- The analyser itself is the skill `.claude/skills/failure-analyser/`, with a copy at `.agents/skills/failure-analyser/`.

## Inputs

The analyser gets one thing: the failing build's run id. The test repo is always `s-petrov8/why-is-my-test-red`, and every build is a run of its `orangehrm-suite.yml` workflow.

It reads the app repo URL and the app commit from the failing build's `app-logs/build-info.json`. For each failing test it finds the last earlier build where that test passed, by walking up to 30 earlier runs of the workflow, newest first, and compares the code of the two builds. Different tests can have different last passing builds.

Each build uploads one artifact per run, `evidence-run-N`, with:

- `json-report/results.json`: the Playwright JSON report.
- `playwright-report/`: the HTML report, with traces.
- `test-results/`: per failing test, its error context, screenshot, video and trace.
- `app-logs/containers.log`: the app and database container logs, with timestamps.
- `app-logs/orangehrm/`: OrangeHRM's own logs.
- `app-logs/build-info.json`: which code ran, with `ohrm_repo`, `ohrm_ref`, `ohrm_sha`, `ohrm_version` and `test_sha`. A build from an image tag has empty `ohrm_repo`, `ohrm_ref` and `ohrm_sha`. When the file is missing, the run's log and `gh run view <id> --json headSha` give most of the same facts, but the comparison is weaker: the log records the app ref, which pins the commit only when it is a full sha.

## Test ids

Cards, answers and the scorer name a test the same way:

```text
<spec path from the repo root> > <describe titles> > <test title>
```

The parts are joined with `>` and a space on each side, the project name is left out, and a test outside any `describe` has just the path and the title. For example:

```text
tests/app/api/employeeSearch.spec.ts > api/v2/pim/employees GET > should combine the name and employee id filters with AND semantics
```

`failing-tests.ts` prints these ids for every test Playwright marks as unexpected (failed or timed out), except one interrupted because the whole run stopped:

```bash
node analyser/failing-tests.ts evidence-run-1/json-report/results.json
```

The mutator and the analyser both use it, so their ids always match.

## Analyser answer

One JSON file per failing build, `answer.json` in the analyser's working folder:

```json
{
    "failing_build": 0,
    "groups": [
        {
            "tests": ["<test id>"],
            "verdict": "code change",
            "commit": "<sha>",
            "confidence": 0.9,
            "leaning": null,
            "last_passed": {
                "run_id": 0,
                "ohrm_sha": "<sha>",
                "test_sha": "<sha>"
            },
            "flake": false,
            "explanation": "<two or three plain sentences>",
            "evidence": ["<one concrete item from the logs, report or diff>"]
        }
    ]
}
```

- `failing_build`: the run id of the build explained.
- `groups`: every failing test of the failing build, each in exactly one group. A group holds the tests that failed for one cause.
- `verdict`: `code change`, `test script problem`, `infra problem` or `undetermined`.
- `commit`: for a code change, the app commit that broke the tests; for a test script problem caused by a test-repo commit, that commit; otherwise `null`, and always `null` when the verdict is `undetermined`.
- `confidence`: how strongly the evidence supports the verdict, from 0 to 1. The threshold is 0.7: below it the verdict is `undetermined`, and at or above it `leaning` is `null`.
- `leaning`: always present. When the confidence is below 0.7, the verdict the evidence leaned towards, as `{ "verdict": "...", "commit": "<sha or null>" }`, or `null` when it leaned nowhere; otherwise `null`.
- `last_passed`: the last earlier build where the group's tests passed, as `{ "run_id", "ohrm_sha", "test_sha" }`, or `null` when none was found within 30 runs. `test_sha` is always set; `ohrm_sha` is `null` when that build ran a released image and its exact commit isn't recorded. When the group's tests passed last in different builds, it is the newest of them by creation time, since the commit that broke them all came after it. That holds only while the newer build also ran newer code: CI can run any branch or app ref, so when the builds' commits aren't in ancestor order, the evidence says so and the confidence is lower. Each test whose own last pass differs from `last_passed` gets an evidence line with its run and commits.
- `flake`: `true` when the group's tests both pass and fail on the same code. It is a flag beside the verdict, not a verdict.
- `explanation`: what went wrong, in plain words. For an intended app change the test didn't follow, it says to update the test if the change was intended.
- `evidence`: concrete items, such as an error line, a log line with its timestamp, or a file and hunk from the diff.

### Verdicts

- **Code change**: a change to the application since the last passing build broke the test, including dependency updates. An intended change the test didn't follow, such as a renamed button, is a code change too.
- **Test script problem**: the test itself is at fault, including a change to the test code and test data collisions.
- **Infra problem**: something outside the code and the test broke it, such as the environment or a third-party service.
- **Undetermined**: the evidence does not support any other verdict with a confidence of 0.7 or more.

## Analyser reasoning

Beside `answer.json`, the analyser writes `reasoning.md`, in plain words and no more than about 40 lines. Under one heading per group, it lists each candidate cause it considered, such as a commit, an infra event or the test data, with one or two lines on what pointed to it and what ruled it in or out. It is for a person checking the verdicts; the scorer doesn't read it.

## Answer card

One JSON file per fault, written by the mutator and kept off GitHub:

```json
{
    "fault_id": "<id>",
    "kind": "app_bug",
    "verdict": "code change",
    "commit": "<sha of the commit that holds the fault>",
    "passing_build": { "run_id": 0, "ohrm_ref": "<sha>" },
    "failing_build": { "run_id": 0, "ohrm_ref": "<sha>" },
    "failing_tests": ["<test id>"],
    "flake_tests": [],
    "what": "<what was changed, in one sentence>",
    "file": "<path of the changed file>"
}
```

- `kind`: what was planted, such as `app_bug`, `test_bug` or `infra`.
- `verdict`: the right verdict for the fault.
- `commit`: the commit that holds the fault. `null` for an infra problem.
- `failing_tests`: the ids of the tests the fault turns red, as `failing-tests.ts` prints them. Never the known flake.
- `flake_tests`: the ids of the known-flake tests that failed in the same build, as `failing-tests.ts` prints them. An empty list when none failed.

## Scoring

The scorer uses no AI, so the same answers always get the same score. It matches a card to an answer by the failing build's run id.

A fault is **found** when one group holds exactly the card's failing tests, no more and no fewer, the group's verdict is the card's verdict, and, for a code change, the group's commit matches the card's: one is a prefix of the other, at least 7 characters long, ignoring case.

Otherwise the row gives the first reason that applies:

- `no answer`: no answer has the card's failing build.
- `tests split across groups`: the fault's tests are in more than one group, whether or not some are also in no group.
- `tests missing`: some of the fault's tests are in no group.
- `extra tests in the group`: the group also holds a test from another cause.
- `breaks confidence rule`: the group says a verdict other than `undetermined` at a confidence below 0.7, or has a `leaning` at 0.7 or above. Such a group is invalid, and the scorer's `CONFIDENCE_THRESHOLD` matches the skill's.
- `undetermined`: the group's verdict is undetermined. It counts as not found, but apart from wrong answers.
- `wrong verdict`: the group's verdict differs from the card's.
- `wrong commit`: a code change group names no commit, or a different one.

**The known flake** is the `AND semantics` test in `tests/app/api/employeeSearch.spec.ts`. When a card lists it in `flake_tests`, it failed in that build and must be its own group with verdict `test script problem`. The report shows that row with the same reasons, but it is not a fault and is not counted in the totals. It is never one of a fault's tests, so a fault group that also holds it has extra tests.

The report also lists every answered test that is in neither `failing_tests` nor `flake_tests` of the build's cards, the flake included when no card says it failed, and every answer whose build has no card.

Totals: faults, found, wrong, undetermined and no answer.

Beside each fault the report prints the confidence of the groups holding its tests and, when set, their leaning. Neither changes the score: only the tests, the verdict and the commit decide it.

```bash
node analyser/score.ts <cards-dir> <answers-dir> [output.md]
```

It reads every `*.json` file in the two folders, prints the markdown report and, given a third argument, also writes it to that file. A malformed card or answer, such as a card with the flake in `failing_tests` or another test in `flake_tests`, a group without `confidence` from 0 to 1, without the `leaning` key or without `last_passed`, a `last_passed` without `test_sha` or without the `ohrm_sha` key, or a `commit` on an `undetermined` group, or two answers for one build, stops it with exit code 2 and a message naming the file.
