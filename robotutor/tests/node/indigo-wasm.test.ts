import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { INDIGO_OPERATIONS } from '../../contract/assumptions';

type StringMap = { set(key: string, value: string): void };
type Indigo = Record<string, unknown> & {
  version(): string;
  MapStringString: new () => StringMap;
  convert(structure: string, format: string, options: StringMap): string;
  check(structure: string, types: string, options: StringMap): string;
};

const require = createRequire(import.meta.url);
const standalone = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'packages',
      'ketcher-standalone',
      'package.json',
    ),
    'utf8',
  ),
);
const indigoVersion: string = standalone.dependencies['indigo-ketcher'];
let indigo: Indigo;

beforeAll(async () => {
  const root = dirname(require.resolve('indigo-ketcher'));
  // @ts-expect-error untyped Emscripten module
  const { default: create } = await import('indigo-ketcher/binaryWasmNoRender');
  indigo = await create({
    wasmBinary: readFileSync(
      join(root, `indigo-ketcher-norender-${indigoVersion}.wasm`),
    ),
  });
});

const json = () => {
  const options = new indigo.MapStringString();
  options.set('output-content-type', 'application/json');
  return options;
};
const convert = (structure: string, format: string) =>
  JSON.parse(indigo.convert(structure, format, json())).struct as string;

describe(`indigo-ketcher ${indigoVersion} as the server-side subset (OLMS OLM-1711)`, () => {
  it('matches the version ketcher-standalone pins and exposes the documented operations', () => {
    expect(indigo.version().startsWith(indigoVersion.replace(/-.*/, ''))).toBe(
      true,
    );
    const exposed = Object.keys(indigo).filter(
      (key) => typeof indigo[key] === 'function',
    );
    expect(INDIGO_OPERATIONS.filter((name) => !exposed.includes(name))).toEqual(
      [],
    );
  });

  it('converts to KET preserving formal charges and gives order-independent InChIKeys', () => {
    const ket = JSON.parse(convert('C[N+](=O)[O-]', 'ket'));
    expect(
      ket.mol0.atoms.map((atom: { charge?: number }) => atom.charge ?? 0),
    ).toEqual([0, 1, 0, -1]);
    expect(convert('OC(=O)C', 'chemical/x-inchi-key')).toBe(
      convert('CC(O)=O', 'chemical/x-inchi-key'),
    );
  });

  it('reports check() findings as prose keyed by category with atom indexes', () => {
    const report = JSON.parse(
      indigo.check('C(C)(C)(C)(C)C', 'valence', json()),
    );
    expect(report).toEqual({
      valence: 'Structure contains atoms with unusual valence: (0)',
    });
  });

  it('throws on unparseable input instead of returning a structure', () => {
    expect(() =>
      indigo.convert('this is not chemistry', 'ket', json()),
    ).toThrow();
  });
});
