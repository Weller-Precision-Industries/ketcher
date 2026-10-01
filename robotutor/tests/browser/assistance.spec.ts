import { expect, test } from '@playwright/test';
import {
  CSS_HIDDEN_TEST_IDS,
  DIALOG_SHORTCUTS,
  HIDDEN_BUTTON_HOTKEYS,
  HIDDEN_BUTTON_TEST_IDS,
  OLMS_HIDDEN_BUTTONS,
} from '../../contract/assumptions';
import { ketFacts } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';
import {
  canvas,
  exportKet,
  expectNoDialog,
  focusCanvas,
  load,
  openHarness,
  tool,
} from '../../contract/page';

test('the buttons config hides every control OLMS withholds', async ({
  page,
}) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  for (const testId of HIDDEN_BUTTON_TEST_IDS) {
    await expect(
      page.getByTestId(testId).filter({ visible: true }),
      testId,
    ).toHaveCount(0);
  }
});

test('controls OLMS hides by data-testid still exist under those exact ids', async ({
  page,
}) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  for (const testId of CSS_HIDDEN_TEST_IDS) {
    await expect(tool(page, testId), testId).toBeVisible();
  }
});

test('hotkeys of hidden buttons stay inert', async ({ page }) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  const expected = ketFacts(KET_FIXTURES.benzeneKekule.ket);
  // One chord per fresh load: pressed in sequence, Alt+A (aromatize) and
  // Ctrl+Alt+A (dearomatize) would undo each other and hide a regression.
  for (const chord of HIDDEN_BUTTON_HOTKEYS) {
    await load(page, KET_FIXTURES.benzeneKekule.ket);
    await focusCanvas(page);
    await page.keyboard.press(chord);
    await expectNoDialog(page);
    expect(ketFacts(await exportKet(page)), chord).toEqual(expected);
  }
});

test('the same hotkeys act when the buttons are shown, so the inert check is meaningful', async ({
  page,
}) => {
  await openHarness(page);
  await load(page, KET_FIXTURES.benzeneKekule.ket);
  await focusCanvas(page);
  await page.keyboard.press('Alt+a');
  await expect
    .poll(async () =>
      JSON.parse(await exportKet(page))
        .mol0.bonds.map((bond: { type: number }) => bond.type)
        .join(''),
    )
    .toBe('444444');
});

for (const chord of DIALOG_SHORTCUTS) {
  test(`${chord} still opens its dialog, so OLMS must keep swallowing it`, async ({
    page,
  }) => {
    await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
    await focusCanvas(page);
    await page.keyboard.press(chord);
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });
}

test('hotkeys resolve by physical key (event.code), as the OLMS blocker assumes', async ({
  page,
}) => {
  await openHarness(page, { hide: OLMS_HIDDEN_BUTTONS });
  await focusCanvas(page);
  // Ctrl+O typed on a Cyrillic layout: key is "щ", the physical key is still KeyO.
  await canvas(page).evaluate((element) => {
    const target = document.activeElement ?? element;
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyO',
        key: 'щ',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('valence warnings follow the showValenceWarnings option', async ({
  page,
}) => {
  await openHarness(page);
  const warning = canvas(page).locator('svg path[stroke="#ff0000"]');
  await load(page, KET_FIXTURES.pentavalentCarbonDraft.ket);
  await expect(warning).toHaveCount(1);
  await page.evaluate(() =>
    window.__robotutor.ketcher!.editor.setOptions(
      JSON.stringify({ showValenceWarnings: false }),
    ),
  );
  await load(page, KET_FIXTURES.pentavalentCarbonDraft.ket);
  await expect(warning).toHaveCount(0);
});
