import { expect, test } from '@playwright/test';
import { ketFacts } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';
import { exportKet, history, load, openHarness } from '../../contract/page';

/**
 * For these inputs Ketcher resolves setMolecule without loading anything and
 * without rejecting or calling errorHandler. The OLMS session verifies every
 * load because of this. If upstream starts rejecting or reporting instead, this
 * test fails: update the OLMS adapter's error mapping and this contract together.
 */
const unsupported = {
  'unknown bond type': JSON.stringify({
    root: { nodes: [{ $ref: 'mol0' }] },
    mol0: {
      type: 'molecule',
      atoms: [
        { label: 'C', location: [0, 0, 0] },
        { label: 'C', location: [1, 0, 0] },
      ],
      bonds: [{ type: 99, atoms: [0, 1] }],
    },
  }),
  'unknown node type': JSON.stringify({
    root: { nodes: [{ type: 'banana' }] },
  }),
};

for (const [name, ket] of Object.entries(unsupported)) {
  test(`${name}: setMolecule resolves silently and leaves the canvas unchanged`, async ({
    page,
  }) => {
    await openHarness(page);
    await load(page, KET_FIXTURES.ethanol.ket);
    const undoBefore = (await history(page)).undo;
    const errorsBefore = await page.evaluate(
      () => window.__robotutor.errors.length,
    );
    const outcome = await page.evaluate(async (input) => {
      try {
        await window.__robotutor.ketcher!.setMolecule(input);
        return 'resolved';
      } catch (error) {
        return `rejected: ${String(error)}`;
      }
    }, ket);
    expect(outcome).toBe('resolved');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__robotutor.errors.length)).toBe(
      errorsBefore,
    );
    expect(ketFacts(await exportKet(page))).toEqual(
      ketFacts(KET_FIXTURES.ethanol.ket),
    );
    expect((await history(page)).undo).toBe(undoBefore);
  });
}
