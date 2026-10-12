import IonBracketsTool, {
  connectedAtomIds,
  findBracketSgroup,
} from './ionBrackets';

jest.mock('ketcher-core', () => ({
  fromSgroupAddition: jest.fn((_restruct, type, atoms) => ({
    add: { type, atoms },
  })),
  fromSgroupDeletion: jest.fn((_restruct, id) => ({ remove: id })),
  SGroup: { TYPES: { GEN: 'GEN' } },
  Atom: { isSuperatomLeavingGroupAtom: jest.fn(() => false) },
  FunctionalGroup: { isAtomInContractedFunctionalGroup: jest.fn(() => false) },
}));

const getCoreMock = () => jest.requireMock('ketcher-core');

type MockAtom = { atomList?: unknown; rglabel?: string | null };
type MockSgroup = { type: string; atoms: number[] };

/** Sulfate-like ion 0..4 (0 central) plus a lone sodium 5. */
const BONDS: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
];

function createStruct(
  sgroups: Array<[number, MockSgroup]> = [],
  atomOverrides: Array<[number, MockAtom]> = [],
) {
  const atoms = new Map<number, MockAtom>(
    [0, 1, 2, 3, 4, 5].map((id) => [id, {}]),
  );
  atomOverrides.forEach(([id, atom]) => atoms.set(id, atom));
  const bonds = new Map(
    BONDS.map(([begin, end], id) => [id, { begin, end }] as const),
  );
  let nextSgroupId = 10;
  return {
    atoms,
    bonds,
    sgroups: Object.assign(new Map(sgroups), { newId: () => nextSgroupId++ }),
    functionalGroups: new Map(),
    atomGetNeighbors: (aid: number) =>
      BONDS.flatMap(([a, b]) => {
        if (a === aid) return [{ aid: b }];
        if (b === aid) return [{ aid: a }];
        return [];
      }),
  };
}

function createEditor(
  molecule: ReturnType<typeof createStruct>,
  item: { map: string; id: number } | null,
) {
  return {
    selection: jest.fn(),
    hover: jest.fn(),
    update: jest.fn(),
    findItem: jest.fn(() => item),
    render: { ctab: { molecule } },
  };
}

describe('connectedAtomIds', () => {
  it('collects the whole structure from any of its atoms', () => {
    const struct = createStruct();
    expect(connectedAtomIds(struct as never, 3)).toEqual([0, 1, 2, 3, 4]);
    expect(connectedAtomIds(struct as never, 5)).toEqual([5]);
  });
});

describe('findBracketSgroup', () => {
  it('matches only a GEN S-group over exactly those atoms', () => {
    const struct = createStruct([
      [1, { type: 'SUP', atoms: [0, 1, 2, 3, 4] }],
      [2, { type: 'GEN', atoms: [0, 1, 2] }],
      [3, { type: 'GEN', atoms: [4, 3, 2, 1, 0] }],
    ]);
    expect(findBracketSgroup(struct as never, [0, 1, 2, 3, 4])).toBe(3);
    expect(findBracketSgroup(struct as never, [5])).toBeNull();
  });
});

describe('IonBracketsTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('brackets the whole structure when an atom is clicked', () => {
    const editor = createEditor(createStruct(), { map: 'atoms', id: 2 });
    new IonBracketsTool(editor as never).click({});

    expect(getCoreMock().fromSgroupAddition).toHaveBeenCalledWith(
      editor.render.ctab,
      'GEN',
      [0, 1, 2, 3, 4],
      {},
      10,
      [],
    );
    expect(editor.update).toHaveBeenCalledWith({
      add: { type: 'GEN', atoms: [0, 1, 2, 3, 4] },
    });
  });

  it('brackets from a bond, and a single-atom ion', () => {
    const struct = createStruct();
    new IonBracketsTool(
      createEditor(struct, { map: 'bonds', id: 3 }) as never,
    ).click({});
    new IonBracketsTool(
      createEditor(struct, { map: 'atoms', id: 5 }) as never,
    ).click({});

    const calls = getCoreMock().fromSgroupAddition.mock.calls;
    expect(calls.map((call) => call[2])).toEqual([[0, 1, 2, 3, 4], [5]]);
  });

  it('removes the brackets when a bracketed structure is clicked', () => {
    const editor = createEditor(
      createStruct([[7, { type: 'GEN', atoms: [0, 1, 2, 3, 4] }]]),
      { map: 'atoms', id: 1 },
    );
    new IonBracketsTool(editor as never).click({});

    expect(getCoreMock().fromSgroupDeletion).toHaveBeenCalledWith(
      editor.render.ctab,
      7,
    );
    expect(getCoreMock().fromSgroupAddition).not.toHaveBeenCalled();
    expect(editor.update).toHaveBeenCalledWith({ remove: 7 });
  });

  it('does nothing on empty canvas or a structure with an atom list', () => {
    const empty = createEditor(createStruct(), null);
    new IonBracketsTool(empty as never).click({});
    const query = createEditor(createStruct([], [[3, { atomList: {} }]]), {
      map: 'atoms',
      id: 0,
    });
    new IonBracketsTool(query as never).click({});

    expect(empty.update).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });
});
