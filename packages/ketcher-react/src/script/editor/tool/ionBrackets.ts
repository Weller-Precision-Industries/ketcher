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

import {
  Atom,
  fromSgroupAddition,
  fromSgroupDeletion,
  FunctionalGroup,
  SGroup,
} from 'ketcher-core';
import type Editor from '../Editor';
import type { Tool } from './Tool';

export const ION_BRACKETS_TOOL_NAME = 'ion-brackets';

type StructLike = Pick<
  Editor['render']['ctab']['molecule'],
  'atoms' | 'sgroups' | 'atomGetNeighbors'
>;

/** Ids of every atom bonded, directly or not, to `atomId`, ascending. */
export function connectedAtomIds(struct: StructLike, atomId: number): number[] {
  const seen = new Set<number>([atomId]);
  const queue = [atomId];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    (struct.atomGetNeighbors(current) ?? []).forEach(({ aid }) => {
      if (!seen.has(aid)) {
        seen.add(aid);
        queue.push(aid);
      }
    });
  }
  return [...seen].sort((a, b) => a - b);
}

/** Id of the generic (GEN) S-group whose atoms are exactly `atomIds`, or null. */
export function findBracketSgroup(
  struct: StructLike,
  atomIds: readonly number[],
): number | null {
  const wanted = new Set(atomIds);
  let found: number | null = null;
  struct.sgroups.forEach((sgroup, id) => {
    if (found !== null || sgroup.type !== SGroup.TYPES.GEN) return;
    const atoms = sgroup.atoms as number[];
    if (
      atoms.length === wanted.size &&
      atoms.every((atomId) => wanted.has(atomId))
    ) {
      found = id;
    }
  });
  return found;
}

/**
 * Puts square brackets around a whole structure, for ions in Lewis structures:
 * clicking an atom or bond adds a generic (GEN) S-group over every atom
 * connected to it, and clicking a bracketed structure removes its brackets.
 * It creates no other S-group type and asks for no attributes. The ion's
 * charge stays on its atoms, since KET has no charge on brackets.
 */
class IonBracketsTool implements Tool {
  private readonly editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
    this.editor.selection(null);
  }

  mousemove(event) {
    const atomIds = this.structureAt(event);
    if (atomIds) {
      this.editor.hover({ map: 'atoms', id: atomIds[0] });
    } else {
      this.editor.hover(null, null, event);
    }
    return true;
  }

  click(event) {
    const atomIds = this.structureAt(event);
    if (!atomIds) return true;

    const restruct = this.editor.render.ctab;
    const existing = findBracketSgroup(restruct.molecule, atomIds);
    this.editor.update(
      existing === null
        ? fromSgroupAddition(
            restruct,
            SGroup.TYPES.GEN,
            atomIds,
            {},
            restruct.molecule.sgroups.newId(),
            [],
          )
        : fromSgroupDeletion(restruct, existing),
    );
    return true;
  }

  /** Atom ids of the structure under the cursor, or null when it can't be bracketed. */
  private structureAt(event): number[] | null {
    const molecule = this.editor.render.ctab.molecule;
    const ci = this.editor.findItem(event, ['atoms', 'bonds']);
    if (!ci) return null;

    let atomId: number | undefined;
    if (ci.map === 'atoms') atomId = ci.id;
    else if (ci.map === 'bonds') atomId = molecule.bonds.get(ci.id)?.begin;
    if (atomId === undefined || !molecule.atoms.has(atomId)) return null;

    const atomIds = connectedAtomIds(molecule, atomId);
    return atomIds.every((id) => this.isBracketableAtom(id)) ? atomIds : null;
  }

  private isBracketableAtom(atomId: number): boolean {
    const molecule = this.editor.render.ctab.molecule;
    const atom = molecule.atoms.get(atomId);
    // Atom lists, R-group labels and atoms hidden inside contracted
    // functional groups / superatom leaving groups are not plain ion atoms.
    if (!atom || atom.atomList || atom.rglabel) return false;
    if (Atom.isSuperatomLeavingGroupAtom(molecule, atomId)) return false;
    return !FunctionalGroup.isAtomInContractedFunctionalGroup(
      atom,
      molecule.sgroups,
      molecule.functionalGroups,
    );
  }
}

export default IonBracketsTool;
