import { expect, test } from '@playwright/test';
import { EDITOR_METHODS, KETCHER_METHODS } from '../../contract/assumptions';
import { KET_FIXTURES } from '../../contract/fixtures';
import { load, openHarness } from '../../contract/page';

test('boots from same-origin assets only, with a module Indigo worker and WASM', async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const { pageErrors } = await openHarness(page);
  await load(page, KET_FIXTURES.esterification.ket);
  const origin = new URL(baseURL!).origin;
  expect(
    requests.filter(
      (url) => !url.startsWith('data:') && new URL(url).origin !== origin,
    ),
  ).toEqual([]);
  expect(requests.some((url) => /indigoWorker-[\w-]+\.js$/.test(url))).toBe(
    true,
  );
  expect(
    requests.some((url) =>
      /indigo-ketcher-[\d.]+(-rc\.\d+)?-[\w-]+\.wasm$/.test(url),
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('a remount unregisters the old instance and registers the new one (OLMS binds only registered ones)', async ({
  page,
}) => {
  // Production builds do not double-mount under StrictMode; an explicit remount
  // exercises the same ketcher-react teardown OLMS guards against in development.
  await openHarness(page);
  await page.evaluate(() =>
    (
      window as unknown as { __robotutorRemount: () => void }
    ).__robotutorRemount(),
  );
  // ketcher-react calls onInit twice for the remounted instance; key on ids instead.
  await page.waitForFunction(
    () => new Set(window.__robotutor.inits).size === 2,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const probe = window.__robotutor;
        const registered = (id: string) => {
          try {
            probe.provider.getKetcher(id);
            return true;
          } catch {
            return false;
          }
        };
        return {
          first: registered(probe.inits[0]),
          last: registered(probe.inits.at(-1)!),
        };
      }),
    )
    .toEqual({ first: false, last: true });
});

test('exposes every Ketcher and editor method the OLMS adapter checks at runtime', async ({
  page,
}) => {
  await openHarness(page);
  const missing = await page.evaluate(
    ([ketcherMethods, editorMethods]) => {
      const ketcher = window.__robotutor.ketcher as unknown as Record<
        string,
        unknown
      >;
      const editor = ketcher.editor as Record<string, unknown>;
      const highlights = editor.highlights as Record<string, unknown>;
      return [
        ...ketcherMethods.filter((name) => typeof ketcher[name] !== 'function'),
        ...editorMethods
          .filter((name) => typeof editor[name] !== 'function')
          .map((name) => `editor.${name}`),
        ...['create', 'clear', 'getAll']
          .filter((name) => typeof highlights?.[name] !== 'function')
          .map((name) => `highlights.${name}`),
      ];
    },
    [KETCHER_METHODS, EDITOR_METHODS] as const,
  );
  expect(missing).toEqual([]);
});

test('editor change events fire on edits and stop after unsubscribe', async ({
  page,
}) => {
  await openHarness(page);
  const counts = await page.evaluate(async (ket) => {
    const ketcher = window.__robotutor.ketcher!;
    const editor = ketcher.editor as unknown as {
      subscribe(event: string, handler: () => void): unknown;
      unsubscribe(event: string, subscription: unknown): void;
    };
    let changes = 0;
    const subscription = editor.subscribe('change', () => (changes += 1));
    await ketcher.setMolecule(ket);
    const whileSubscribed = changes;
    editor.unsubscribe('change', subscription);
    await ketcher.setMolecule(ket);
    return { whileSubscribed, afterUnsubscribe: changes - whileSubscribed };
  }, KET_FIXTURES.ethanol.ket);
  expect(counts.whileSubscribed).toBeGreaterThan(0);
  expect(counts.afterUnsubscribe).toBe(0);
});
