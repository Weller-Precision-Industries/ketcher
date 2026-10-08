import { Atom, Bond, Struct, Vec2 } from 'domain/entities';
import { KetSerializer } from 'domain/serializers';
import { validate } from 'domain/serializers/ket/validate';
import { CoreEditor } from 'application/editor';
import {
  createPolymerEditorCanvas,
  createRenderersManager,
} from '../../../helpers/dom';
import { prepareStruct } from './fixtures/toKet';

const ket = new KetSerializer();

function buildStruct(nonbonding: Array<number | undefined>): Struct {
  const struct = new Struct();
  const ids = nonbonding.map((count, index) =>
    struct.atoms.add(
      new Atom({
        label: 'O',
        pp: new Vec2(index, 0),
        ...(count === undefined ? {} : { nonbonding: count }),
      }),
    ),
  );
  for (let i = 1; i < ids.length; i++) {
    struct.bonds.add(
      new Bond({
        type: Bond.PATTERN.TYPE.SINGLE,
        begin: ids[i - 1],
        end: ids[i],
      }),
    );
  }
  struct.initHalfBonds();
  struct.initNeighbors();
  struct.markFragments();
  return struct;
}

function serializedAtoms(struct: Struct) {
  const parsed = JSON.parse(ket.serialize(struct));
  return parsed.mol0.atoms;
}

describe('KET nonbonding electrons', () => {
  const canvas = createPolymerEditorCanvas();
  // @ts-expect-error TS6133: Instantiated for side effects (singleton registration)
  const _editor = new CoreEditor({
    canvas,
    theme: {},
    renderersContainer: createRenderersManager(),
  });

  it('omits nonbonding when it is 0 or unset', () => {
    const atoms = serializedAtoms(buildStruct([0, undefined]));
    expect(atoms).toHaveLength(2);
    atoms.forEach((atom) => expect(atom).not.toHaveProperty('nonbonding'));
  });

  it('writes nonbonding right after radical when it is positive', () => {
    const struct = buildStruct([2]);
    const oxygen = struct.atoms.get(0);
    if (!oxygen) throw new Error('missing atom');
    oxygen.radical = 2;
    const [atom] = serializedAtoms(struct);
    expect(atom.nonbonding).toBe(2);
    const keys = Object.keys(atom);
    expect(keys.indexOf('nonbonding')).toBe(keys.indexOf('radical') + 1);
  });

  it.each([2, 3, 6])('round-trips nonbonding = %i', (count) => {
    const serialized = ket.serialize(buildStruct([count, 0]));
    const restored = ket.deserialize(serialized);
    const atoms = Array.from(restored.atoms.values());
    expect(atoms.map((atom) => atom.nonbonding)).toEqual([count, 0]);
    // Display-only: lone pairs never change radical or implicit hydrogens.
    expect(atoms[0].radical).toBe(0);
    expect(ket.serialize(restored)).toBe(serialized);
  });

  it('keeps implicit hydrogens independent of nonbonding', () => {
    const plain = ket.deserialize(ket.serialize(buildStruct([0])));
    const withPairs = ket.deserialize(ket.serialize(buildStruct([4])));
    const plainAtom = plain.atoms.get(0);
    const pairAtom = withPairs.atoms.get(0);
    if (!plainAtom || !pairAtom) throw new Error('missing atom');
    plain.calcImplicitHydrogen(0);
    withPairs.calcImplicitHydrogen(0);
    expect(pairAtom.nonbonding).toBe(4);
    expect(pairAtom.implicitH).toBe(plainAtom.implicitH);
    expect(pairAtom.valence).toBe(plainAtom.valence);
  });

  it('does not add nonbonding to existing structures', () => {
    expect(ket.serialize(prepareStruct)).not.toContain('nonbonding');
  });
});

describe('KET schema: nonbonding', () => {
  const ketWithAtom = (atom: Record<string, unknown>) => ({
    root: { nodes: [{ $ref: 'mol0' }] },
    mol0: {
      type: 'molecule',
      atoms: [{ label: 'O', location: [0, 0, 0], ...atom }],
    },
  });

  it.each([0, 1, 2, 3, 6, 8])('accepts nonbonding = %i', (nonbonding) => {
    expect(validate(ketWithAtom({ nonbonding }))).toBe(true);
  });

  it.each([-1, 9, 2.5, '2'])('rejects nonbonding = %p', (nonbonding) => {
    expect(validate(ketWithAtom({ nonbonding }))).toBe(false);
  });

  it('still rejects unknown atom properties', () => {
    expect(validate(ketWithAtom({ lonePairs: 2 }))).toBe(false);
  });
});
