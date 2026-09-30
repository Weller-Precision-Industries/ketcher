import { expect, type Locator, type Page } from '@playwright/test';
import type { RobotutorProbe } from '../harness/main';
import { ketFacts, type KetFacts } from './facts';

declare global {
  interface Window {
    __robotutor: RobotutorProbe;
  }
}

export type Point = { x: number; y: number };

/** Opens the harness and waits for a Ketcher instance that is still registered. */
export async function openHarness(
  page: Page,
  options: { hide?: readonly string[]; strict?: boolean } = {},
) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const query = new URLSearchParams();
  if (options.hide?.length) query.set('hide', options.hide.join(','));
  if (options.strict) query.set('strict', '1');
  await page.goto(`/index.html?${query}`);
  await page.waitForFunction(
    () => {
      const probe = window.__robotutor;
      if (!probe?.ketcher) return false;
      try {
        return probe.provider.getKetcher(probe.ketcher.id) === probe.ketcher;
      } catch {
        return false;
      }
    },
    null,
    { timeout: 60_000 },
  );
  return { pageErrors };
}

export const exportKet = (page: Page) =>
  page.evaluate(() => window.__robotutor.ketcher!.getKet());

export async function load(page: Page, ket: string): Promise<string> {
  return page.evaluate(async (input) => {
    await window.__robotutor.ketcher!.setMolecule(input);
    return window.__robotutor.ketcher!.getKet();
  }, ket);
}

export const facts = async (page: Page): Promise<KetFacts> =>
  ketFacts(await exportKet(page));

export const history = (page: Page) =>
  page.evaluate(() =>
    (
      window.__robotutor.ketcher!.editor as unknown as {
        historySize(): { undo: number; redo: number };
      }
    ).historySize(),
  );

export const tool = (page: Page, testId: string) =>
  page.getByTestId(testId).filter({ visible: true }).first();
export const canvas = (page: Page) =>
  page.locator('[data-testid=ketcher-canvas][data-canvasmode=molecules-mode]');

export async function canvasPoint(
  page: Page,
  dx: number,
  dy: number,
): Promise<Point> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('Ketcher canvas is not visible');
  return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
}

/** Ketcher resolves click targets from hover state, so arrive before pressing. */
export async function clickAt(page: Page, point: Point) {
  await page.mouse.move(point.x - 6, point.y - 6);
  await page.mouse.move(point.x, point.y, { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
}

export async function dragBetween(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/** Ketcher's hotkeys listen on its root element, so the canvas must hold focus. */
export async function focusCanvas(page: Page) {
  await tool(page, 'select-rectangle').click();
  await clickAt(page, await canvasPoint(page, 0, 190));
}

export async function centreOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function expectNoDialog(page: Page) {
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
