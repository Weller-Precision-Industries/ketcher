import { expect, test } from '@playwright/test';
import { ketFacts, ketLocations } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';
import { load, openHarness } from '../../contract/page';

for (const [id, fixture] of Object.entries(KET_FIXTURES)) {
  test(`${id}: load then getKet preserves every chemical fact`, async ({
    page,
  }) => {
    await openHarness(page);
    const exported = await load(page, fixture.ket);
    expect(ketFacts(exported)).toEqual(ketFacts(fixture.ket));
  });
}

test('does not aromatize, repair or add hydrogens on load', async ({
  page,
}) => {
  await openHarness(page);
  expect(
    await page.evaluate(
      () => window.__robotutor.ketcher!.editor.options()['dearomatize-on-load'],
    ),
  ).toBe(false);
  const benzene = JSON.parse(await load(page, KET_FIXTURES.benzeneKekule.ket));
  expect(benzene.mol0.bonds.map((bond: { type: number }) => bond.type)).toEqual(
    [2, 1, 2, 1, 2, 1],
  );
  const draft = JSON.parse(
    await load(page, KET_FIXTURES.pentavalentCarbonDraft.ket),
  );
  expect(
    draft.mol0.bonds.filter((bond: { atoms: number[] }) =>
      bond.atoms.includes(0),
    ),
  ).toHaveLength(5);
  expect(
    draft.mol0.atoms.every((atom: { label: string }) => atom.label === 'C'),
  ).toBe(true);
});

test('re-centres by translation only, and the model stores y downwards', async ({
  page,
}) => {
  await openHarness(page);
  const exported = await load(page, KET_FIXTURES.esterification.ket);
  const before = ketLocations(KET_FIXTURES.esterification.ket);
  const after = ketLocations(exported);
  const [dx, dy] = [after[0][0] - before[0][0], after[0][1] - before[0][1]];
  after.forEach(([x, y], index) => {
    expect(x - before[index][0]).toBeCloseTo(dx, 3);
    expect(y - before[index][1]).toBeCloseTo(dy, 3);
  });
  const model = await page.evaluate(() =>
    [...window.__robotutor.ketcher!.editor.struct().atoms.values()].map(
      (atom) => [atom.pp.x, atom.pp.y],
    ),
  );
  model.forEach(([x, y], index) => {
    expect(x).toBeCloseTo(after[index][0], 6);
    expect(y).toBeCloseTo(-after[index][1], 6);
  });
});

test('addFragment appends without disturbing what is already on the canvas', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.ethanol.ket);
  const combined = await page.evaluate(async (ket) => {
    await window.__robotutor.ketcher!.addFragment(ket);
    return window.__robotutor.ketcher!.getKet();
  }, KET_FIXTURES.acetateAmmonium.ket);
  const expected = ketFacts(KET_FIXTURES.ethanol.ket);
  const fragment = ketFacts(KET_FIXTURES.acetateAmmonium.ket);
  expect(ketFacts(combined).atoms).toEqual(
    [...expected.atoms, ...fragment.atoms].sort(),
  );
  expect(ketFacts(combined).bonds).toEqual(
    [...expected.bonds, ...fragment.bonds].sort(),
  );
});
