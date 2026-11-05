# Robotutor fork maintenance

## Responsibility

Preserve fork history while preparing upstream candidates for explicit review and
trusted build qualification. Maintenance does not change editor behavior or
publish application packages.

## Public interfaces

`.robotutor/sync.mjs` remains the command entrypoint and preserves its exported
constants and functions for existing lifecycle consumers. `sync-local.mjs` owns
bounded process execution, the local merge transaction and receipt.
`sync-github.mjs` owns workflow filtering, review proposals and build requests
through a supplied command runner. The CLI owns token admission, push ordering
and final reporting.

## Dependencies

Node built-ins, Git and authenticated GitHub CLI at execution time. Importing the
modules performs no command or network activity. The maintenance tests replace
all command execution and filesystem/reporting effects.

## Dependents

The existing Robotutor sync workflow invokes the unchanged CLI. The OLMS-V2
bootstrap installs all three runtime files. `npm --prefix robotutor run
test:maintenance` exercises the CLI contract without built editor packages.

## Assumptions and constraints

OLMS-V2/scripts/ketcher-fork remains the installer source until OLM-2618 transfers
it. Keep the runtime and characterization copies paired through review PRs.
Repository/default-branch checks, inherited-workflow filtering, clean checkout,
no force-push and manual review are preserved. A dispatched build is not a passing
build. No module pins, packages, workflows or repository settings change as part
of the responsibility split.
