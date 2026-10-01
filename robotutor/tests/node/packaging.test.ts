import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..', '..');
const pkg = (name: string) =>
  JSON.parse(
    readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'),
  );
const standalone = join(root, 'packages', 'ketcher-standalone');

describe('fork packages as OLMS consumes them', () => {
  it('versions ketcher-core, ketcher-react and ketcher-standalone together', () => {
    const versions = [
      'ketcher-core',
      'ketcher-react',
      'ketcher-standalone',
    ].map((name) => pkg(name).version);
    expect(new Set(versions).size).toBe(1);
  });

  it('keeps the exports OLMS imports', () => {
    expect(pkg('ketcher-standalone').exports).toHaveProperty([
      './dist/binaryWasm',
    ]);
    expect(
      existsSync(join(root, 'packages', 'ketcher-react', 'dist', 'index.css')),
    ).toBe(true);
  });

  // Regression: v3.20.0-rc.1 shipped `web-worker:./../indigoWorker` unresolved
  // here (tsconfig paths won over the rollup alias), breaking every consumer.
  it.each(['binaryWasm', 'binaryWasmNoRender'])(
    'ships a real module worker and its WASM in dist/%s',
    (variant) => {
      const dir = join(standalone, 'dist', variant);
      const main = readFileSync(join(dir, 'main.js'), 'utf8');
      expect(main).not.toMatch(/web-worker:/);
      const worker = main.match(
        /new Worker\(new URL\("(indigoWorker-[\w-]+\.js)", import\.meta\.url\), \{\s*type: 'module'/,
      );
      expect(
        worker,
        'module worker constructed from import.meta.url',
      ).not.toBeNull();
      expect(existsSync(join(dir, worker![1]))).toBe(true);
      const indigoVersion =
        pkg('ketcher-standalone').dependencies['indigo-ketcher'];
      const wasm =
        variant === 'binaryWasm'
          ? `indigo-ketcher-${indigoVersion}.wasm`
          : `indigo-ketcher-norender-${indigoVersion}.wasm`;
      expect(existsSync(join(dir, wasm)), wasm).toBe(true);
      expect(readFileSync(join(dir, worker![1]), 'utf8')).toContain(wasm);
    },
  );
});
