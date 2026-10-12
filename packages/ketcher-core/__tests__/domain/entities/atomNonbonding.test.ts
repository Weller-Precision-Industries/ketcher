import {
  Atom,
  type AtomAttributes,
  MAX_NONBONDING_ELECTRONS,
  normalizeNonbondingElectrons,
} from 'domain/entities/atom';

describe('Atom nonbonding electrons', () => {
  it('defaults to 0 and is registered in attrlist', () => {
    expect(new Atom({ label: 'O' }).nonbonding).toBe(0);
    expect(Atom.attrlist.nonbonding).toBe(0);
    expect(Atom.attrGetDefault('nonbonding')).toBe(0);
  });

  it('survives clone and appears in the attribute hash', () => {
    const atom = new Atom({ label: 'N', nonbonding: 3, radical: 2 });
    const clone = atom.clone();
    expect(clone).not.toBe(atom);
    expect(clone.nonbonding).toBe(3);
    expect(clone.radical).toBe(2);
    expect(Atom.getAttrHash(atom).nonbonding).toBe(3);
    const fromHash = new Atom({
      ...Atom.getAttrHash(atom),
      label: atom.label,
    } as AtomAttributes);
    expect(fromHash.nonbonding).toBe(3);
  });

  it('is independent of radical and valence', () => {
    const plain = new Atom({ label: 'O' });
    const withPairs = new Atom({ label: 'O', nonbonding: 4 });
    expect(withPairs.radical).toBe(0);
    plain.calcValence(0);
    withPairs.calcValence(0);
    expect(withPairs.implicitH).toBe(plain.implicitH);
    expect(withPairs.valence).toBe(plain.valence);
  });

  it('makes a carbon not plain', () => {
    expect(
      new Atom({ label: 'C', isotope: null, charge: null }).isPlainCarbon(),
    ).toBe(true);
    expect(
      new Atom({
        label: 'C',
        isotope: null,
        charge: null,
        nonbonding: 2,
      }).isPlainCarbon(),
    ).toBe(false);
  });

  it.each([
    [0, 0],
    [2, 2],
    [8, 8],
    [9, MAX_NONBONDING_ELECTRONS],
    [-3, 0],
    [2.7, 2],
    ['4', 4],
    [NaN, 0],
    [undefined, 0],
    [null, 0],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeNonbondingElectrons(input)).toBe(expected);
  });
});
