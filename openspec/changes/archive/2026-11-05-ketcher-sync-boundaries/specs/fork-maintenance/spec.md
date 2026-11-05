# Fork maintenance

## ADDED Requirements

### Requirement: Preserve the guarded sync lifecycle

The refactored CLI SHALL preserve repository and fork/default-branch refusal,
workflow pagination and filtering, local history preparation, workflow-token
admission, push/proposal/build ordering and failure reports.

#### Scenario: Current upstream

- WHEN upstream is already incorporated
- THEN the base commit is dispatched for a trusted build without a push or PR
- AND the report states that qualification has not yet passed.

#### Scenario: Proposal creation fails

- WHEN candidate push succeeds but proposal creation or update fails
- THEN the trusted build is still requested
- AND the compare fallback is reported before the CLI fails.

### Requirement: Maintain paired installation

The installer SHALL copy all runtime modules and preserve the existing entrypoint
exports. Its fork copy SHALL have identical runtime and characterization content
until OLM-2618 transfers the source authority.

#### Scenario: Offline verification

- WHEN the maintenance suite runs
- THEN every Git and GitHub command is stubbed and unexpected calls fail
- AND no live workflow, repository setting or remote branch is modified.
