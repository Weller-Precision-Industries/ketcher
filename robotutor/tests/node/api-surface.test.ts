import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OLMS_HIDDEN_BUTTONS } from '../../contract/assumptions';

const packages = join(import.meta.dirname, '..', '..', '..', 'packages');
const dts = (path: string) => readFileSync(join(packages, path), 'utf8');

describe('declared API surface OLMS compiles against', () => {
  it('still accepts every button name OLMS hides', () => {
    const declared = dts(
      'ketcher-react/dist/script/builders/ketcher/ButtonName.d.ts',
    );
    const multitail = dts(
      'ketcher-core/dist/domain/constants/multitailArrow.d.ts',
    ).match(/MULTITAIL_ARROW_TOOL_NAME = "([^"]+)"/)?.[1];
    const names = new Set(
      [...declared.matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .concat(multitail ?? []),
    );
    expect(OLMS_HIDDEN_BUTTONS.filter((name) => !names.has(name))).toEqual([]);
  });

  it('keeps the Ketcher methods and editor props OLMS uses', () => {
    const ketcher = dts('ketcher-core/dist/application/ketcher.d.ts');
    for (const method of [
      'getKet(): Promise<string>',
      'setMolecule(structStr: string',
      'addFragment(structStr: string',
    ]) {
      expect(ketcher).toContain(method);
    }
    const config = dts('ketcher-react/dist/script/index.d.ts');
    for (const prop of [
      'staticResourcesUrl: string',
      'structServiceProvider: StructServiceProvider',
      'buttons?: ButtonsConfig',
      'errorHandler: (message: string) => void',
    ]) {
      expect(config).toContain(prop);
    }
    const editorProps =
      dts('ketcher-react/dist/MicromoleculesEditor.d.ts') +
      dts('ketcher-react/dist/Editor.d.ts');
    expect(editorProps).toContain('onInit?: (ketcher: Ketcher) => void');
    expect(editorProps).toContain('disableMacromoleculesEditor?: boolean');
  });

  it('keeps the concrete editor history and highlight API', () => {
    const editor = dts('ketcher-react/dist/script/editor/Editor.d.ts');
    for (const member of [
      'highlights: Highlighter',
      'historySize(): {',
      'clearHistory(): void',
      'undo(): void',
      'redo(): void',
    ]) {
      expect(editor).toContain(member);
    }
    const highlighter = dts(
      'ketcher-react/dist/script/editor/highlighter.d.ts',
    );
    for (const member of [
      'create(...args: HighlightAttributes[]): void',
      'clear(): void',
      'getAll():',
    ]) {
      expect(highlighter).toContain(member);
    }
  });

  it('still exports ketcherProvider (OLMS StrictMode guard) from ketcher-core', () => {
    expect(dts('ketcher-core/dist/index.d.ts')).toContain(
      "export * from './application/ketcherProvider'",
    );
    expect(dts('ketcher-core/dist/application/ketcherProvider.d.ts')).toContain(
      'getKetcher(',
    );
  });
});
