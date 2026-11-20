# The analyser

The analyser explains why a CI build's tests failed. It sorts the failing tests into groups by cause, gives each group a verdict and backs the verdict with evidence from the build.

It only reads. It never reruns tests, starts builds, pushes or changes anything. It works from what the builds left behind and from the commits between them.

An evaluation loop checks it. A mutator plants a fault in the app among harmless commits, CI runs the suite on the last passing app commit and on the faulty one, and the mutator writes an answer card. A fresh analyser explains the failing build, and the scorer in this folder compares its answer with the card.

## What's here

- `failing-tests.ts`: prints the id of every failing test in a Playwright JSON report.
- `score.ts`: the scorer.
- `*.test.ts`: unit tests for both, run with `npm run test:analyser`.
- The analyser itself is the skill `.claude/skills/failure-analyser/`, with a copy at `.agents/skills/failure-analyser/`.

## Inputs

The analyser gets three things:

- the failing build's run id,
- the last passing build's run id,
- the URL of the app repo the builds ran, such as `https://github.com/s-petrov8/orangehrm`.

The test repo is always `s-petrov8/why-is-my-test-red`, and both builds are runs of its `orangehrm-suite.yml` workflow.

Each build uploads one artifact per run, `evidence-run-N`, with:

- `json-report/results.json`: the Playwright JSON report.
- `playwright-report/`: the HTML report, with traces.
- `test-results/`: per failing test, its error context, screenshot, video and trace.
- `app-logs/containers.log`: the app and database container logs, with timestamps.
- `app-logs/orangehrm/`: OrangeHRM's own logs.
- `app-logs/build-info.json`: which code ran, with `ohrm_repo`, `ohrm_ref`, `ohrm_sha`, `ohrm_version` and `test_sha`. A build from an image tag has empty `ohrm_repo`, `ohrm_ref` and `ohrm_sha`. When the file is missing, the run's log and `gh run view <id> --json headSha` give the same facts.

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
    "passing_build": 0,
    "groups": [
        {
            "tests": ["<test id>"],
            "verdict": "code change",
            "commit": "<sha>",
            "flake": false,
            "explanation": "<two or three plain sentences>",
            "evidence": ["<one concrete item from the logs, report or diff>"]
        }
    ]
}
```

- `failing_build`, `passing_build`: the two run ids.
- `groups`: every failing test of the failing build, each in exactly one group. A group holds the tests that failed for one cause.
- `verdict`: `code change`, `test script problem`, `infra problem` or `undetermined`.
- `commit`: for a code change, the app commit that broke the tests; for a test script problem caused by a test-repo commit, that commit; otherwise `null`.
- `flake`: `true` when the group's tests both pass and fail on the same code. It is a flag beside the verdict, not a verdict.
- `explanation`: what went wrong, in plain words. For an intended app change the test didn't follow, it says to update the test if the change was intended.
- `evidence`: concrete items, such as an error line, a log line with its timestamp, or a file and hunk from the diff.

### Verdicts

- **Code change**: a change to the application since the last passing build broke the test, including dependency updates. An intended change the test didn't follow, such as a renamed button, is a code change too.
- **Test script problem**: the test itself is at fault, including a change to the test code and test data collisions.
- **Infra problem**: something outside the code and the test broke it, such as the environment or a third-party service.
- **Undetermined**: the evidence does not support any other verdict.

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
- `tests missing`: some of the fault's tests are in no group.
- `tests split across groups`: the fault's tests are in more than one group.
- `extra tests in the group`: the group also holds a test from another cause.
- `undetermined`: the group's verdict is undetermined. It counts as not found, but apart from wrong answers.
- `wrong verdict`: the group's verdict differs from the card's.
- `wrong commit`: a code change group names no commit, or a different one.

**The known flake** is the `AND semantics` test in `tests/app/api/employeeSearch.spec.ts`. When a card lists it in `flake_tests`, it failed in that build and must be its own group with verdict `test script problem`. The report shows that row with the same reasons, but it is not a fault and is not counted in the totals. It is never one of a fault's tests, so a fault group that also holds it has extra tests.

The report also lists every answered test that is in neither `failing_tests` nor `flake_tests` of the build's cards, the flake included when no card says it failed, and every answer whose build has no card.

Totals: faults, found, wrong, undetermined and no answer.

```bash
node analyser/score.ts <cards-dir> <answers-dir> [output.md]
```

It reads every `*.json` file in the two folders, prints the markdown report and, given a third argument, also writes it to that file. A malformed card or answer, such as a card with the flake in `failing_tests` or another test in `flake_tests`, or two answers for one build, stops it with exit code 2 and a message naming the file.
