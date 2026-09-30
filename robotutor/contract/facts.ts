/**
 * Coordinate- and order-independent chemical facts of a KET document. Deliberately
 * independent of the OLMS adapter: the contract checks Ketcher, not OLMS code.
 */
type KetAtom = {
  label: string;
  location: number[];
  charge?: number | null;
  isotope?: number | null;
  radical?: number | null;
  stereoLabel?: string | null;
};
type KetBond = {
  type: number;
  atoms: [number, number];
  stereo?: number | null;
};
type KetNode = { $ref?: string; type?: string; data?: { mode?: string } };
export type KetDocument = { root: { nodes: KetNode[] } } & Record<
  string,
  unknown
>;

export type KetFacts = {
  atoms: string[];
  bonds: string[];
  arrows: string[];
  pluses: number;
  otherNodes: string[];
};

const atomFact = (atom: KetAtom) =>
  [
    atom.label,
    `c${atom.charge ?? 0}`,
    `i${atom.isotope ?? '-'}`,
    `r${atom.radical ?? 0}`,
    `s${atom.stereoLabel ?? '-'}`,
  ].join(' ');

export function ketFacts(raw: string | KetDocument): KetFacts {
  const document = (
    typeof raw === 'string' ? JSON.parse(raw) : raw
  ) as KetDocument;
  const facts: KetFacts = {
    atoms: [],
    bonds: [],
    arrows: [],
    pluses: 0,
    otherNodes: [],
  };
  for (const node of document.root.nodes) {
    if (node.$ref) {
      const target = document[node.$ref] as {
        type?: string;
        atoms?: KetAtom[];
        bonds?: KetBond[];
      };
      if (target?.type !== 'molecule') {
        facts.otherNodes.push(`ref:${String(target?.type)}`);
        continue;
      }
      const atoms = target.atoms ?? [];
      facts.atoms.push(...atoms.map(atomFact));
      for (const bond of target.bonds ?? []) {
        const [begin, end] = bond.atoms.map((index) => atomFact(atoms[index]));
        // Wedge direction matters: keep begin/end order only for stereo bonds.
        const ends = bond.stereo ? [begin, end] : [begin, end].sort();
        facts.bonds.push(
          `${bond.type}/${bond.stereo ?? 0}: ${ends.join(' -> ')}`,
        );
      }
    } else if (node.type === 'arrow') {
      facts.arrows.push(node.data?.mode ?? '?');
    } else if (node.type === 'plus') {
      facts.pluses += 1;
    } else {
      facts.otherNodes.push(`node:${String(node.type)}`);
    }
  }
  facts.atoms.sort();
  facts.bonds.sort();
  facts.arrows.sort();
  facts.otherNodes.sort();
  return facts;
}

/** All atom locations of a KET document in node order, as [x, y]. */
export function ketLocations(raw: string): Array<[number, number]> {
  const document = JSON.parse(raw) as KetDocument;
  return document.root.nodes.flatMap((node) => {
    const target = node.$ref
      ? (document[node.$ref] as { type?: string; atoms?: KetAtom[] })
      : undefined;
    return target?.type === 'molecule'
      ? (target.atoms ?? []).map(
          (atom) => [atom.location[0], atom.location[1]] as [number, number],
        )
      : [];
  });
}
