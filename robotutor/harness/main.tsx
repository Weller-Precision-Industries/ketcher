/**
 * Mounts the fork's own built packages exactly the way OLMS does: ketcher-react
 * Editor, standalone Indigo (separate-binary WASM build), micromolecules only.
 * Query parameters: `hide` (comma-separated button names), `strict=1`.
 * `window.__robotutorRemount()` unmounts the editor and mounts a fresh one.
 */
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { type Ketcher, ketcherProvider } from 'ketcher-core';
import { Editor } from 'ketcher-react';
import 'ketcher-react/dist/index.css';
import { StandaloneStructServiceProvider } from 'ketcher-standalone/dist/binaryWasm';

// ketcher-react still writes webpack's `global` at runtime (OLMS shims it the same way).
(globalThis as { global?: typeof globalThis }).global ??= globalThis;

export type RobotutorProbe = {
  ketcher: Ketcher | null;
  inits: string[];
  errors: string[];
  provider: typeof ketcherProvider;
};

const params = new URLSearchParams(window.location.search);
const hidden = (params.get('hide') ?? '').split(',').filter(Boolean);
const probe: RobotutorProbe = {
  ketcher: null,
  inits: [],
  errors: [],
  provider: ketcherProvider,
};
(window as unknown as { __robotutor: RobotutorProbe }).__robotutor = probe;

function App() {
  const structServiceProvider = useMemo(
    () => new StandaloneStructServiceProvider(),
    [],
  );
  const buttons = useMemo(
    () => Object.fromEntries(hidden.map((name) => [name, { hidden: true }])),
    [],
  );
  return (
    <Editor
      staticResourcesUrl=""
      structServiceProvider={structServiceProvider}
      buttons={buttons}
      disableMacromoleculesEditor
      errorHandler={(message) => probe.errors.push(message)}
      onInit={(ketcher) => {
        probe.inits.push(ketcher.id);
        probe.ketcher = ketcher;
      }}
    />
  );
}

const root = createRoot(document.getElementById('root') as HTMLElement);
let generation = 0;
const render = () =>
  root.render(
    params.get('strict') === '1' ? (
      <StrictMode>
        <App key={generation} />
      </StrictMode>
    ) : (
      <App key={generation} />
    ),
  );
(window as unknown as { __robotutorRemount: () => void }).__robotutorRemount =
  () => {
    generation += 1;
    render();
  };
render();
