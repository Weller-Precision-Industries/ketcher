import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  KNOWN_AXE_VIOLATIONS,
  OLMS_HIDDEN_BUTTONS,
} from '../../contract/assumptions';
import { KET_FIXTURES } from '../../contract/fixtures';
import { load, openHarness } from '../../contract/page';

test('toolbar controls stay keyboard reachable', async ({ page }) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  await page.locator('body').focus();
  const reached = new Set<string>();
  for (let step = 0; step < 45; step += 1) {
    await page.keyboard.press('Tab');
    const testId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? null,
    );
    if (testId) reached.add(testId);
  }
  for (const testId of [
    'bonds',
    'erase',
    'charge-plus',
    'charge-minus',
    'C-button',
    'O-button',
    'period-table',
  ]) {
    expect(reached, testId).toContain(testId);
  }
});

test('accessibility violations do not grow beyond the known upstream set', async ({
  page,
}) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  await load(page, KET_FIXTURES.lAlanine.ket);
  const results = await new AxeBuilder({ page })
    .include('.Ketcher-root')
    .analyze();
  const ids = results.violations.map((violation) => violation.id);
  expect(
    ids.filter(
      (id) => !(KNOWN_AXE_VIOLATIONS as readonly string[]).includes(id),
    ),
  ).toEqual([]);
});
