import ElectronsTool, { getNextNonbondingCount } from './electrons';

jest.mock('ketcher-core', () => ({
  MAX_NONBONDING_ELECTRONS: 8,
  fromAtomsAttrs: jest.fn((_restruct, id, attrs, reset) => ({
    id,
    attrs,
    reset,
  })),
  Atom: { isSuperatomLeavingGroupAtom: jest.fn(() => false) },
  FunctionalGroup: { isAtomInContractedFunctionalGroup: jest.fn(() => false) },
}));

const getCoreMock = () => jest.requireMock('ketcher-core');

type MockAtom = {
  nonbonding?: number;
  atomList?: unknown;
  rglabel?: string | null;
};

function createEditor(
  atoms: Map<number, MockAtom>,
  item: { map: string; id: number } | null,
) {
  const restruct = {
    molecule: {
      atoms,
      sgroups: new Map(),
      functionalGroups: new Map(),
    },
  };
  return {
    selection: jest.fn(),
    hover: jest.fn(),
    update: jest.fn(),
    findItem: jest.fn(() => item),
    render: { ctab: restruct },
  };
}

const click = (overrides: Partial<MouseEvent> = {}) =>
  ({ shiftKey: false, altKey: false, ...overrides } as MouseEvent);

describe('getNextNonbondingCount', () => {
  it.each([
    [0, {}, 2],
    [6, {}, 8],
    [8, {}, 8],
    [7, {}, 8],
    [0, { shiftKey: true }, 1],
    [8, { shiftKey: true }, 8],
    [3, { altKey: true }, 2],
    [0, { altKey: true }, 0],
    [undefined, {}, 2],
  ])('from %p with %p gives %p', (current, modifiers, expected) => {
    expect(
      getNextNonbondingCount(current as number | undefined, click(modifiers)),
    ).toBe(expected);
  });

  it('Alt wins over Shift', () => {
    expect(
      getNextNonbondingCount(4, click({ altKey: true, shiftKey: true })),
    ).toBe(3);
  });
});

describe('ElectronsTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds a pair through the atom-attributes action', () => {
    const atoms = new Map([[1, { nonbonding: 2 }]]);
    const editor = createEditor(atoms, { map: 'atoms', id: 1 });
    const tool = new ElectronsTool(editor as never);

    tool.click(click());

    expect(getCoreMock().fromAtomsAttrs).toHaveBeenCalledWith(
      editor.render.ctab,
      1,
      { nonbonding: 4 },
      null,
    );
    expect(editor.update).toHaveBeenCalledTimes(1);
  });

  it('adds one electron with Shift and removes one with Alt', () => {
    const atoms = new Map([[1, { nonbonding: 3 }]]);
    const editor = createEditor(atoms, { map: 'atoms', id: 1 });
    const tool = new ElectronsTool(editor as never);

    tool.click(click({ shiftKey: true }));
    tool.click(click({ altKey: true }));

    const calls = getCoreMock().fromAtomsAttrs.mock.calls;
    expect(calls.map((call) => call[2])).toEqual([
      { nonbonding: 4 },
      { nonbonding: 2 },
    ]);
  });

  it('does nothing on empty canvas or bonds', () => {
    const atoms = new Map([[1, { nonbonding: 0 }]]);
    const emptyEditor = createEditor(atoms, null);
    new ElectronsTool(emptyEditor as never).click(click());
    const bondEditor = createEditor(atoms, { map: 'bonds', id: 1 });
    new ElectronsTool(bondEditor as never).click(click());

    expect(emptyEditor.update).not.toHaveBeenCalled();
    expect(bondEditor.update).not.toHaveBeenCalled();
    expect(getCoreMock().fromAtomsAttrs).not.toHaveBeenCalled();
  });

  it('does not create an undo step when the count is unchanged', () => {
    const atoms = new Map([
      [1, { nonbonding: 8 }],
      [2, { nonbonding: 0 }],
    ]);
    const full = createEditor(atoms, { map: 'atoms', id: 1 });
    new ElectronsTool(full as never).click(click());
    const empty = createEditor(atoms, { map: 'atoms', id: 2 });
    new ElectronsTool(empty as never).click(click({ altKey: true }));

    expect(full.update).not.toHaveBeenCalled();
    expect(empty.update).not.toHaveBeenCalled();
  });

  it('ignores atom lists and R-group labels', () => {
    const atoms = new Map<number, MockAtom>([
      [1, { nonbonding: 0, atomList: {} }],
      [2, { nonbonding: 0, rglabel: '1' }],
    ]);
    const listEditor = createEditor(atoms, { map: 'atoms', id: 1 });
    new ElectronsTool(listEditor as never).click(click());
    const rgEditor = createEditor(atoms, { map: 'atoms', id: 2 });
    new ElectronsTool(rgEditor as never).click(click());

    expect(listEditor.update).not.toHaveBeenCalled();
    expect(rgEditor.update).not.toHaveBeenCalled();
  });
});
