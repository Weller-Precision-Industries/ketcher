import { describe, expect, it } from 'vitest';
import { ketFacts, type KetDocument } from '../../contract/facts';
import { KET_FIXTURES } from '../../contract/fixtures';

const parse = (ket: string) => JSON.parse(ket) as KetDocument;
type Molecule = {
  atoms: Array<Record<string, unknown>>;
  bonds: Array<{ type: number; atoms: [number, number]; stereo?: number }>;
};
const molecule = (document: KetDocument) => document.mol0 as Molecule;

describe('ketFacts', () => {
  it('sees a bond moved between atoms with identical properties', () => {
    // L-alanine: atoms 0 (methyl C) and 3 (carboxyl C) have the same atom facts.
    const corrupt = parse(KET_FIXTURES.lAlanine.ket);
    const bonds = molecule(corrupt).bonds;
    const carbonyl = bonds.findIndex((bond) => bond.type === 2);
    bonds[carbonyl] = { ...bonds[carbonyl], atoms: [0, 4] };
    const original = ketFacts(KET_FIXTURES.lAlanine.ket);
    const moved = ketFacts(corrupt);
    expect(moved.atoms).toEqual(original.atoms);
    expect(moved.bonds).not.toEqual(original.bonds);
  });

  it('ignores atom order, bond order and coordinates', () => {
    const document = parse(KET_FIXTURES.lAlanine.ket);
    const { atoms, bonds } = molecule(document);
    const order = atoms.map((_, index) => index).reverse();
    const position = new Map(order.map((from, to) => [from, to]));
    molecule(document).atoms = order.map((from) => ({
      ...atoms[from],
      location: [from * 3, -from, 0],
    }));
    molecule(document).bonds = [...bonds].reverse().map((bond) => ({
      ...bond,
      atoms: bond.atoms.map((index) => position.get(index)) as [number, number],
    }));
    expect(ketFacts(document)).toEqual(ketFacts(KET_FIXTURES.lAlanine.ket));
  });

  it('keeps wedge direction', () => {
    const document = parse(KET_FIXTURES.lAlanine.ket);
    const wedge = molecule(document).bonds.find((bond) => bond.stereo);
    wedge!.atoms.reverse();
    expect(ketFacts(document).bonds).not.toEqual(
      ketFacts(KET_FIXTURES.lAlanine.ket).bonds,
    );
  });
});
