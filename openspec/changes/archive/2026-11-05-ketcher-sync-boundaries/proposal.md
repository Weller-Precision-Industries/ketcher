# Separate Robotutor sync responsibilities

## Why

The sync entrypoint mixes a disposable local Git transaction with remote workflow
policy and review/build requests. OLM-2992 characterizes these effects before
separating their owners; OLM-2618 retains the later tooling-transfer decision.

## What changes

Keep the CLI and public exports stable. Extract local preparation and a GitHub
adapter, and pair their installed files with the authoritative OLMS-V2 installer.
Add offline command-boundary coverage to the existing Robotutor test command.

## Impact

Maintenance scripts and their tests/documentation only. No editor, package,
workflow, publication, settings, consumer pin or authority changes.
