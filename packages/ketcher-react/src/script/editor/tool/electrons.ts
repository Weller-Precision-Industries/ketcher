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
  fromAtomsAttrs,
  FunctionalGroup,
  MAX_NONBONDING_ELECTRONS,
} from 'ketcher-core';
import type Editor from '../Editor';
import type { Tool } from './Tool';

export const ELECTRONS_TOOL_NAME = 'electrons';

type ElectronClickModifiers = Pick<MouseEvent, 'shiftKey' | 'altKey'>;

/**
 * Next nonbonding electron count for a click with the electron tool:
 * plain click adds a pair (+2), Shift+click adds one electron (+1) and
 * Alt+click removes one electron (-1). Result is clamped to 0..8.
 */
export function getNextNonbondingCount(
  current: number | undefined,
  modifiers: ElectronClickModifiers,
): number {
  const value = Number.isFinite(current) ? Number(current) : 0;
  let delta = 2;
  if (modifiers.altKey) {
    delta = -1;
  } else if (modifiers.shiftKey) {
    delta = 1;
  }
  return Math.min(MAX_NONBONDING_ELECTRONS, Math.max(0, value + delta));
}

/**
 * Adds or removes explicit nonbonding (lone-pair) electrons on atoms, for
 * Lewis structures. Clicking empty canvas does nothing.
 */
class ElectronsTool implements Tool {
  private readonly editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
    this.editor.selection(null);
  }

  mousemove(event) {
    const molecule = this.editor.render.ctab.molecule;
    const ci = this.editor.findItem(event, ['atoms']);
    const atom = ci && ci.map === 'atoms' ? molecule.atoms.get(ci.id) : null;
    if (ci && atom && this.isEditableAtom(ci.id, atom)) {
      this.editor.hover(ci);
    } else {
      this.editor.hover(null, null, event);
    }
    return true;
  }

  click(event) {
    const restruct = this.editor.render.ctab;
    const molecule = restruct.molecule;
    const ci = this.editor.findItem(event, ['atoms']);
    if (!ci || ci.map !== 'atoms') return true;

    const atom = molecule.atoms.get(ci.id);
    if (!atom || !this.isEditableAtom(ci.id, atom)) return true;

    const nonbonding = getNextNonbondingCount(atom.nonbonding, event);
    if (nonbonding === (atom.nonbonding ?? 0)) return true;

    this.editor.hover(ci);
    this.editor.update(fromAtomsAttrs(restruct, ci.id, { nonbonding }, null));
    return true;
  }

  private isEditableAtom(atomId: number, atom: Atom): boolean {
    const molecule = this.editor.render.ctab.molecule;
    // Atom lists, R-group labels and atoms hidden inside contracted
    // functional groups / superatom leaving groups have no drawable label.
    if (atom.atomList || atom.rglabel) return false;
    if (Atom.isSuperatomLeavingGroupAtom(molecule, atomId)) return false;
    if (
      FunctionalGroup.isAtomInContractedFunctionalGroup(
        atom,
        molecule.sgroups,
        molecule.functionalGroups,
      )
    ) {
      return false;
    }
    return true;
  }
}

export default ElectronsTool;
