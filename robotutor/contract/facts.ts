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

/** cyrb53: a small deterministic string hash, so environment labels stay short. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Labels each atom by its whole connected environment (Weisfeiler-Lehman
 * refinement), so two atoms with equal properties but different neighbours get
 * different labels and moving a bond between them changes the bond facts. Each
 * component refines for as many rounds as it has atoms, which depends only on
 * that component: the facts of two separate fragments still combine by union.
 */
function environmentLabels(atoms: KetAtom[], bonds: KetBond[]): string[] {
  const neighbours: Array<Array<{ other: number; edge: string }>> = atoms.map(
    () => [],
  );
  for (const bond of bonds) {
    const [begin, end] = bond.atoms;
    const kind = `${bond.type}/${bond.stereo ?? 0}`;
    // Wedge direction matters: mark which end each atom is for stereo bonds.
    neighbours[begin].push({
      other: end,
      edge: bond.stereo ? `${kind}>` : kind,
    });
    neighbours[end].push({
      other: begin,
      edge: bond.stereo ? `${kind}<` : kind,
    });
  }
  const component = atoms.map(() => -1);
  const sizes: number[] = [];
  atoms.forEach((_, start) => {
    if (component[start] !== -1) return;
    const id = sizes.length;
    const stack = [start];
    component[start] = id;
    let size = 0;
    while (stack.length > 0) {
      const atom = stack.pop() as number;
      size += 1;
      for (const { other } of neighbours[atom]) {
        if (component[other] === -1) {
          component[other] = id;
          stack.push(other);
        }
      }
    }
    sizes.push(size);
  });
  let labels = atoms.map(atomFact);
  const rounds = Math.max(0, ...sizes);
  for (let round = 1; round <= rounds; round += 1) {
    labels = labels.map((label, atom) =>
      round > sizes[component[atom]]
        ? label
        : hash(
            `${label}|${neighbours[atom]
              .map(({ other, edge }) => `${edge}:${labels[other]}`)
              .sort()
              .join(',')}`,
          ),
    );
  }
  return labels;
}

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
      const bonds = target.bonds ?? [];
      const environment = environmentLabels(atoms, bonds);
      const endpoint = (index: number) =>
        `${atomFact(atoms[index])} #${environment[index]}`;
      facts.atoms.push(...atoms.map(atomFact));
      for (const bond of bonds) {
        const [begin, end] = bond.atoms.map(endpoint);
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
