# Robotutor contract suite

Regression tests for every Ketcher behaviour the OLMS chemistry editor adapter
(`src/features/chemistry-editor/` in OLMS-V2) relies on. They run against **this
fork's own built workspace packages**, so an upstream merge that breaks OLMS fails
in the upstream-sync PR, before OLMS ever pins the new build.

```sh
nvm use                     # Node >= 24.14.1, as upstream requires
npm ci && npm run build:packages
npm run test:robotutor      # = npm --prefix robotutor ci && npm --prefix robotutor test
```

`robotutor/` is deliberately not an npm workspace: it has its own lockfile, so
upstream dependency churn cannot change the test tooling, and the only upstream
file it touches is one script line in the root `package.json`.

## Layout

| Path                      | Role                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contract/assumptions.ts` | What OLMS relies on, as data: hidden buttons, CSS-hidden test ids, blocked shortcuts, runtime methods, Indigo operations, known axe violations. Keep in sync with OLMS `assistance-profile.ts` and `ketcher-session.ts`. |
| `contract/fixtures.ts`    | The same KET documents as OLMS `fixtures.ts` (formatting differs; content must not).                                                                                                                                     |
| `contract/facts.ts`       | Coordinate- and order-independent chemical facts (independent of OLMS code).                                                                                                                                             |
| `contract/page.ts`        | Playwright helpers: open the harness, load/export, canvas geometry.                                                                                                                                                      |
| `harness/`                | Mounts `ketcher-react` + standalone Indigo (`dist/binaryWasm`) exactly as OLMS does.                                                                                                                                     |
| `tests/node/`             | Packaging, declared API surface and the Indigo WASM subset (Vitest).                                                                                                                                                     |
| `tests/browser/`          | Behaviour through the real editor and UI (Playwright, Chromium).                                                                                                                                                         |

## What is pinned

| Area            | Tests                              | Why OLMS cares                                                                                                                                                                          |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packaging       | `packaging`                        | OLMS imports `ketcher-standalone/dist/binaryWasm`; it must emit a module worker and the WASM (v3.20.0-rc.1 broke this; fixed here in `ce24ff71a`).                                      |
| API surface     | `api-surface`, `boot`              | Methods/props the adapter checks at runtime; every hidden button name still exists.                                                                                                     |
| KET fidelity    | `ket-contract`                     | Charges, radicals, isotopes, wedges, Kekulé rings, invalid drafts and reactions survive load → `getKet`; load only translates coordinates; model y is flipped.                          |
| History         | `history-highlights`               | `setMolecule`/`addFragment` are one undo step; `clearHistory` empties; highlights add none.                                                                                             |
| Highlights      | `history-highlights`, `ui-editing` | Display-only, keyed by model atom ids that follow load order.                                                                                                                           |
| Silent failures | `silent-failures`                  | Unknown bond/node types resolve without loading, rejecting or calling `errorHandler`; OLMS verifies every load because of it.                                                           |
| Assistance      | `assistance`                       | Hidden buttons and their hotkeys stay inert; CSS-hidden ids still exist; Shift+T/Ctrl+O/Ctrl+S still open dialogs; hotkeys resolve by `event.code`; valence warnings follow the option. |
| Editing UI      | `ui-editing`                       | Atom placement, bond drag/join, charges, bond order, erase, toolbar and keyboard undo/redo, touch.                                                                                      |
| Lifecycle       | `boot`                             | Same-origin assets only; a remount unregisters the old instance.                                                                                                                        |
| Accessibility   | `a11y`                             | Toolbar keyboard reach; axe violations may not grow past the known set.                                                                                                                 |
| Indigo          | `indigo-wasm`                      | Version matches the pin; documented operations exist; KET charges; stable InChIKey; `check()` format; parse errors throw.                                                               |

When a test here fails after an upstream merge, decide whether upstream broke
something (fix it on `robotutor`, ideally upstream too) or changed a behaviour OLMS
must adapt to (change the OLMS adapter and this contract in the same review).
