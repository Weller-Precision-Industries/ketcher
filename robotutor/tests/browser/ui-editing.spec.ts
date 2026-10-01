import { expect, test } from '@playwright/test';
import { HIGHLIGHT_COLOR } from '../../contract/assumptions';
import { ketFacts } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';
import {
  canvas,
  canvasPoint,
  centreOf,
  clickAt,
  dragBetween,
  exportKet,
  focusCanvas,
  load,
  openHarness,
  tool,
} from '../../contract/page';

/** Compact per-fragment description: "C,C,O(-1)|0-1:1,1-2:1". */
async function fragments(page: import('@playwright/test').Page) {
  const ket = JSON.parse(await exportKet(page));
  return ket.root.nodes
    .filter((node: { $ref?: string }) => node.$ref)
    .map((node: { $ref: string }) => {
      const molecule = ket[node.$ref];
      const atoms = molecule.atoms.map(
        (atom: { label: string; charge?: number }) =>
          `${atom.label}${atom.charge ? `(${atom.charge})` : ''}`,
      );
      const bonds = (molecule.bonds ?? []).map(
        (bond: { type: number; atoms: number[] }) =>
          `${bond.atoms.join('-')}:${bond.type}`,
      );
      return `${atoms.join(',')}|${bonds.join(',')}`;
    })
    .sort();
}

test('atom tools place atoms exactly where clicked; bond drags join; charge tools apply', async ({
  page,
}) => {
  await openHarness(page);
  const [a, b, c, d] = await Promise.all(
    [-60, -20, 20, 120].map((dx) => canvasPoint(page, dx, 0)),
  );
  await tool(page, 'C-button').click();
  await clickAt(page, a);
  await clickAt(page, b);
  await tool(page, 'O-button').click();
  await clickAt(page, c);
  await tool(page, 'N-button').click();
  await clickAt(page, d);
  await tool(page, 'bonds').click();
  await dragBetween(page, a, b);
  await dragBetween(page, b, c);
  await tool(page, 'charge-minus').click();
  await clickAt(page, c);
  await tool(page, 'charge-plus').click();
  await clickAt(page, d);
  expect(await fragments(page)).toEqual(['C,C,O(-1)|0-1:1,1-2:1', 'N(1)|']);

  await tool(page, 'bonds').click();
  await dragBetween(page, c, d);
  expect(await fragments(page)).toEqual(['C,C,O(-1),N(1)|0-1:1,1-2:1,2-3:1']);

  await tool(page, 'undo').click();
  expect(await fragments(page)).toEqual(['C,C,O(-1)|0-1:1,1-2:1', 'N(1)|']);
  await tool(page, 'redo').click();
  expect(await fragments(page)).toEqual(['C,C,O(-1),N(1)|0-1:1,1-2:1,2-3:1']);
  await focusCanvas(page);
  await page.keyboard.press('Control+z');
  expect(await fragments(page)).toEqual(['C,C,O(-1)|0-1:1,1-2:1', 'N(1)|']);
  await focusCanvas(page);
  await page.keyboard.press('Control+Shift+z');
  expect(await fragments(page)).toEqual(['C,C,O(-1),N(1)|0-1:1,1-2:1,2-3:1']);
});

test('clicking a bond with the bond tool raises its order; erase removes an atom and its bonds', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.ethanol.ket);
  await page.evaluate((color) => {
    const editor = window.__robotutor.ketcher!.editor as unknown as {
      highlights: { create(h: object): void };
    };
    editor.highlights.create({
      atoms: [0],
      bonds: [0],
      rgroupAttachmentPoints: [],
      color,
    });
  }, HIGHLIGHT_COLOR);
  const atom = await centreOf(
    canvas(page).locator(`svg rect[fill="${HIGHLIGHT_COLOR}"]`).first(),
  );
  const bond = await centreOf(
    canvas(page).locator(`svg path[fill="${HIGHLIGHT_COLOR}"]`).first(),
  );
  await tool(page, 'bonds').click();
  await clickAt(page, bond);
  expect(await fragments(page)).toEqual(['C,C,O|0-1:2,1-2:1']);
  await tool(page, 'erase').click();
  await clickAt(page, atom);
  expect(await fragments(page)).toEqual(['C,O|0-1:1']);
});

test('touch editing works at phone width', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await openHarness(page);
  await load(page, KET_FIXTURES.ethanol.ket);
  // Ketcher's toolbars need ~490px; OLMS clips them inside its own container, and
  // its suite checks page overflow. Here only guard against the minimum growing.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(520);
  await tool(page, 'N-button').tap();
  const box = await canvas(page).boundingBox();
  await page.touchscreen.tap(
    box!.x + box!.width / 2 + 60,
    box!.y + box!.height / 2 + 90,
  );
  expect(ketFacts(await exportKet(page)).atoms).toContain('N c0 i- r0 s-');
  await context.close();
});
