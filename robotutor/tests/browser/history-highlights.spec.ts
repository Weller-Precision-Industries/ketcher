import { expect, test } from '@playwright/test';
import { HIGHLIGHT_COLOR } from '../../contract/assumptions';
import { ketFacts } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';
import {
  canvas,
  exportKet,
  history,
  load,
  openHarness,
} from '../../contract/page';

test('setMolecule and addFragment are single undo steps; clearHistory empties history', async ({
  page,
}) => {
  await openHarness(page);
  expect(await history(page)).toEqual({ undo: 0, redo: 0 });
  await load(page, KET_FIXTURES.ethanol.ket);
  expect(await history(page)).toEqual({ undo: 1, redo: 0 });
  await page.evaluate(() =>
    (
      window.__robotutor.ketcher!.editor as unknown as { clearHistory(): void }
    ).clearHistory(),
  );
  expect(await history(page)).toEqual({ undo: 0, redo: 0 });
  await page.evaluate(
    (ket) => window.__robotutor.ketcher!.addFragment(ket),
    KET_FIXTURES.nitromethane.ket,
  );
  expect(await history(page)).toEqual({ undo: 1, redo: 0 });
  await page.evaluate(() => window.__robotutor.ketcher!.editor.undo());
  expect(ketFacts(await exportKet(page))).toEqual(
    ketFacts(KET_FIXTURES.ethanol.ket),
  );
  await page.evaluate(() => window.__robotutor.ketcher!.editor.redo());
  expect(ketFacts(await exportKet(page)).atoms).toHaveLength(7);
});

test('highlights render in the given colour, stay out of KET and out of history', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.lAlanine.ket);
  const before = await history(page);
  const created = await page.evaluate((color) => {
    const editor = window.__robotutor.ketcher!.editor as unknown as {
      highlights: {
        create(h: object): void;
        getAll(): Array<{ highlight: { atoms: number[]; bonds: number[] } }>;
      };
    };
    editor.highlights.create({
      atoms: [0],
      bonds: [0],
      rgroupAttachmentPoints: [],
      color,
    });
    return editor.highlights.getAll().map((entry) => entry.highlight);
  }, HIGHLIGHT_COLOR);
  expect(created).toEqual([
    expect.objectContaining({ atoms: [0], bonds: [0] }),
  ]);
  await expect(
    canvas(page).locator(
      `svg [fill="${HIGHLIGHT_COLOR}"], svg [stroke="${HIGHLIGHT_COLOR}"]`,
    ),
  ).toHaveCount(2);
  expect(await exportKet(page)).not.toContain(HIGHLIGHT_COLOR);
  expect(await history(page)).toEqual(before);
  await page.evaluate(() =>
    (
      window.__robotutor.ketcher!.editor as unknown as {
        highlights: { clear(): void };
      }
    ).highlights.clear(),
  );
  await expect(
    canvas(page).locator(
      `svg [fill="${HIGHLIGHT_COLOR}"], svg [stroke="${HIGHLIGHT_COLOR}"]`,
    ),
  ).toHaveCount(0);
});

test('highlight ids are model atom ids that follow load order', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.acetateAmmonium.ket);
  const labels = await page.evaluate(() =>
    [...window.__robotutor.ketcher!.editor.struct().atoms.entries()].map(
      ([id, atom]) => `${id}:${atom.label}`,
    ),
  );
  expect(labels).toEqual(['0:C', '1:C', '2:O', '3:O', '4:N']);
});
