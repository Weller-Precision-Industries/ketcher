import { expect, type Page, test } from '@playwright/test';
import {
  LEWIS_HIDDEN_BUTTONS,
  MAX_NONBONDING_ELECTRONS,
  NONBONDING_ELECTRON_TEST_ID,
  OLMS_HIDDEN_BUTTONS,
  RETROSYNTHETIC_ARROW_TEST_ID,
} from '../../contract/assumptions';
import { KET_FIXTURES } from '../../contract/fixtures';
import {
  canvas,
  centreOf,
  clickAt,
  exportKet,
  history,
  load,
  openHarness,
  type Point,
  tool,
} from '../../contract/page';

/**
 * Lewis-structure behaviour OLMS relies on (OLM-1712): the fork's `nonbonding`
 * KET atom field, the electron tool, and one-step undoable atom attribute edits
 * (lone electrons, charge, atom map) built from ketcher-core's own actions.
 */

type LewisAtom = {
  label: string;
  charge?: number;
  nonbonding?: number;
  mapping?: number;
};

async function atoms(page: Page): Promise<LewisAtom[]> {
  const ket = JSON.parse(await exportKet(page));
  return ket.mol0.atoms.map(
    ({ label, charge, nonbonding, mapping }: LewisAtom) => ({
      label,
      ...(charge ? { charge } : {}),
      ...(nonbonding !== undefined ? { nonbonding } : {}),
      ...(mapping !== undefined ? { mapping } : {}),
    }),
  );
}

const nonbonding = async (page: Page) =>
  (await atoms(page)).map((atom) => atom.nonbonding ?? 0);

const withNonbonding = (counts: number[]) => {
  const document = JSON.parse(KET_FIXTURES.nitriteLewisSkeleton.ket);
  document.mol0.atoms.forEach((atom: LewisAtom, index: number) => {
    if (counts[index]) atom.nonbonding = counts[index];
  });
  return JSON.stringify(document);
};

/** Canvas centre of a model atom: Ketcher tags each atom label with its model id. */
const atomPoint = (page: Page, atomId: number): Promise<Point> =>
  centreOf(
    canvas(page)
      .locator(`[data-testid="atom"][data-atom-id="${atomId}"]`)
      .first(),
  );

async function clickWith(page: Page, point: Point, modifier?: 'Shift' | 'Alt') {
  if (modifier) await page.keyboard.down(modifier);
  await clickAt(page, point);
  if (modifier) await page.keyboard.up(modifier);
}

test('ketcher-core exports the nonbonding limit OLMS detects the fork build by', async ({
  page,
}) => {
  await openHarness(page);
  expect(
    await page.evaluate(() => window.__robotutor.core.MAX_NONBONDING_ELECTRONS),
  ).toBe(MAX_NONBONDING_ELECTRONS);
});

test('nonbonding electrons survive load → getKet, are omitted when zero and draw one dot each', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.nitriteLewisSkeleton.ket);
  expect(await atoms(page)).toEqual([
    { label: 'N' },
    { label: 'O' },
    { label: 'O', charge: -1 },
  ]);
  await expect(
    canvas(page).getByTestId(NONBONDING_ELECTRON_TEST_ID),
  ).toHaveCount(0);

  await load(page, withNonbonding([2, 4, 6]));
  expect(await nonbonding(page)).toEqual([2, 4, 6]);
  await expect(
    canvas(page).getByTestId(NONBONDING_ELECTRON_TEST_ID),
  ).toHaveCount(12);
  // Display-only: the field never changes charges or implicit hydrogens.
  expect(await atoms(page)).toEqual([
    { label: 'N', nonbonding: 2 },
    { label: 'O', nonbonding: 4 },
    { label: 'O', charge: -1, nonbonding: 6 },
  ]);
});

test('the electron tool adds a pair, Shift adds one, Alt removes one; each click is one undo step', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.nitriteLewisSkeleton.ket);
  const nitrogen = await atomPoint(page, 0);
  const before = (await history(page)).undo;

  await tool(page, 'electrons').click();
  await clickWith(page, nitrogen);
  expect(await nonbonding(page)).toEqual([2, 0, 0]);
  await clickWith(page, nitrogen, 'Shift');
  expect(await nonbonding(page)).toEqual([3, 0, 0]);
  await clickWith(page, nitrogen, 'Alt');
  expect(await nonbonding(page)).toEqual([2, 0, 0]);
  expect((await history(page)).undo).toBe(before + 3);

  // Clamped at 8; a click that changes nothing adds no undo step.
  for (let i = 0; i < 5; i++) await clickWith(page, nitrogen);
  expect(await nonbonding(page)).toEqual([8, 0, 0]);
  expect((await history(page)).undo).toBe(before + 6);

  for (let i = 0; i < 4; i++) await tool(page, 'undo').click();
  expect(await nonbonding(page)).toEqual([3, 0, 0]);
  await tool(page, 'undo').click();
  await tool(page, 'undo').click();
  expect(await nonbonding(page)).toEqual([0, 0, 0]);
  await tool(page, 'redo').click();
  expect(await nonbonding(page)).toEqual([2, 0, 0]);
});

test('one Action of lone-electron, charge and atom-map edits is a single undo step', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.nitriteLewisSkeleton.ket);
  const before = (await history(page)).undo;

  // Exactly what OLMS `atomAttributeEditor` does for `setAtomAttributes`.
  await page.evaluate(() => {
    const { Action, fromAtomsAttrs } = window.__robotutor.core;
    const editor = window.__robotutor.ketcher!.editor as unknown as {
      render: { ctab: Parameters<typeof fromAtomsAttrs>[0] };
      update(action: InstanceType<typeof Action>): void;
    };
    const action = new Action();
    for (const [id, attrs] of [
      [0, { nonbonding: 2, aam: 1 }],
      [1, { nonbonding: 4, aam: 2 }],
      [2, { nonbonding: 6, charge: 0, aam: 3 }],
    ] as const) {
      action.mergeWith(fromAtomsAttrs(editor.render.ctab, id, attrs, null));
    }
    editor.update(action);
  });
  const edited = [
    { label: 'N', nonbonding: 2, mapping: 1 },
    { label: 'O', nonbonding: 4, mapping: 2 },
    { label: 'O', nonbonding: 6, mapping: 3 },
  ];
  expect(await atoms(page)).toEqual(edited);
  expect((await history(page)).undo).toBe(before + 1);

  await tool(page, 'undo').click();
  expect(await atoms(page)).toEqual([
    { label: 'N' },
    { label: 'O' },
    { label: 'O', charge: -1 },
  ]);
  await tool(page, 'redo').click();
  expect(await atoms(page)).toEqual(edited);
});

test('the electron button follows the buttons config, and the retrosynthetic arrow keeps its test id', async ({
  page,
}) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  await expect(
    page.getByTestId('electrons').filter({ visible: true }),
  ).toHaveCount(0);

  await openHarness(page, { hide: LEWIS_HIDDEN_BUTTONS });
  await expect(tool(page, 'electrons')).toBeVisible();
  // With the arrows before it hidden, the retrosynthetic arrow is the arrow
  // group's default tool; OLMS can only hide it by this data-testid.
  await expect(tool(page, RETROSYNTHETIC_ARROW_TEST_ID)).toBeVisible();
});
