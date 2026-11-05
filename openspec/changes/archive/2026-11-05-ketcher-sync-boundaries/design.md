# Design

`sync.mjs` composes the existing lifecycle. `sync-local.mjs` owns bounded command
execution and local merge preparation. `sync-github.mjs` binds a supplied runner
to workflow validation, proposal creation/update and trusted-build dispatch.

Preserve ordering: validate fork, disable inherited active workflows, prepare
local candidate, reject unsupported workflow pushes, push, propose, dispatch,
report. Proposal create/update failure still dispatches and then reports the
compare fallback before failing; listing/push/dispatch failures still stop.

OLMS-V2 bootstrap installs every runtime import. The same Node characterization
suite runs against both copies. Local history/conflict tests remain in OLMS-V2
until the separately owned migration transfers the tooling.
