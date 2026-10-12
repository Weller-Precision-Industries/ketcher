/****************************************************************************
 * Copyright 2021 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ***************************************************************************/

import { Vec2 } from 'domain/entities/vec2';
import { normalizeNonbondingElectrons } from 'domain/entities/atom';

export type NonbondingSide = 'up' | 'down' | 'left' | 'right';

export interface NonbondingGroup {
  side: NonbondingSide;
  /** 2 for a lone pair, 1 for an unpaired electron. */
  electrons: 1 | 2;
}

/** Canvas directions (y grows downwards) of the four dot positions. */
export const NONBONDING_SIDE_DIRECTIONS: Record<NonbondingSide, Vec2> = {
  up: new Vec2(0, -1),
  down: new Vec2(0, 1),
  left: new Vec2(-1, 0),
  right: new Vec2(1, 0),
};

/** Tie-break order when several sides are equally free. */
const SIDE_PREFERENCE: NonbondingSide[] = ['up', 'down', 'right', 'left'];

function angleBetween(a: Vec2, b: Vec2): number {
  const lengths = a.length() * b.length();
  if (lengths === 0) return Math.PI;
  const cos = Math.max(-1, Math.min(1, Vec2.dot(a, b) / lengths));
  return Math.acos(cos);
}

/**
 * Splits nonbonding electrons into pairs (plus one single electron if the
 * count is odd) and assigns every group to one of the four sides around the
 * atom label. Sides that are angularly farthest from the occupied directions
 * (bonds, implicit-hydrogen label, radical mark) are used first; pairs take
 * the best sides and the single electron the next one.
 */
export function layoutNonbondingElectrons(
  nonbonding: number,
  occupiedDirections: Vec2[],
): NonbondingGroup[] {
  const count = normalizeNonbondingElectrons(nonbonding);
  if (count === 0) return [];

  const pairs = Math.floor(count / 2);
  const singles = count % 2;

  const rankedSides = SIDE_PREFERENCE.map((side, preference) => {
    const direction = NONBONDING_SIDE_DIRECTIONS[side];
    const clearance = occupiedDirections.reduce(
      (min, occupied) => Math.min(min, angleBetween(direction, occupied)),
      Math.PI,
    );
    // Quantize to ~1 degree so near-symmetric layouts fall back to the
    // deterministic preference order instead of floating-point noise.
    return { side, clearance: Math.round(clearance * 60), preference };
  }).sort((a, b) => b.clearance - a.clearance || a.preference - b.preference);

  const groups: NonbondingGroup[] = [];
  for (let i = 0; i < pairs; i++) {
    groups.push({ side: rankedSides[i].side, electrons: 2 });
  }
  if (singles) {
    groups.push({ side: rankedSides[pairs].side, electrons: 1 });
  }
  return groups;
}
