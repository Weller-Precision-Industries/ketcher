/**
 * Contract fixtures shared with OLMS (src/features/chemistry-editor/fixtures.ts).
 * Every document except the invalid draft was exported by Ketcher 3.18.0 /
 * Indigo 1.46.0 from its `source` SMILES (coordinates rounded to 4 dp). Tests
 * compare chemical facts, never these coordinates. Keep the documents identical.
 */
export type KetFixture = {
  source: string;
  title: string;
  description: string;
  ket: string;
};

const ket = (document: unknown) => JSON.stringify(document);

export const KET_FIXTURES = {
  ethanol: {
    source: 'SMILES CCO',
    title: 'Ethanol',
    description: 'Neutral single-fragment baseline.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [13.7382, -10.0688, 0] },
          { label: 'C', location: [14.6042, -10.5688, 0] },
          { label: 'O', location: [15.4702, -10.0688, 0] },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 1, atoms: [1, 2] },
        ],
        stereoFlagPosition: { x: 15.4702, y: 9.0688, z: 0 },
      },
    }),
  },
  acetateAmmonium: {
    source: 'SMILES CC(=O)[O-].[NH4+]',
    title: 'Acetate and ammonium',
    description:
      'Formal charges on two separate species that must stay unjoined.',
    ket: ket({
      ket_version: '2.0.0',
      root: {
        nodes: [{ $ref: 'mol0' }, { $ref: 'mol1' }],
        connections: [],
        templates: [],
      },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [13.1644, -10.9938, 0] },
          { label: 'C', location: [13.1644, -9.9938, 0] },
          { label: 'O', location: [12.2983, -9.4938, 0] },
          { label: 'O', location: [14.0304, -9.4938, 0], charge: -1 },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 2, atoms: [1, 2] },
          { type: 1, atoms: [1, 3] },
        ],
        stereoFlagPosition: { x: 14.0304, y: 8.4938, z: 0 },
      },
      mol1: {
        type: 'molecule',
        atoms: [{ label: 'N', location: [16.0304, -10.9938, 0], charge: 1 }],
        stereoFlagPosition: { x: 16.0304, y: 9.9938, z: 0 },
      },
    }),
  },
  ethylRadical: {
    source: 'SMILES [CH2]C',
    title: 'Ethyl radical',
    description: 'Doublet radical centre.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [14.0199, -10.2375, 0], radical: 2 },
          { label: 'C', location: [15.0199, -10.2375, 0] },
        ],
        bonds: [{ type: 1, atoms: [0, 1] }],
        stereoFlagPosition: { x: 15.0199, y: 9.2375, z: 0 },
      },
    }),
  },
  carbon13Methane: {
    source: 'SMILES [13CH4]',
    title: 'Carbon-13 methane',
    description: 'Isotope label.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [{ label: 'C', location: [14.4922, -10.2438, 0], isotope: 13 }],
        stereoFlagPosition: { x: 14.4922, y: 9.2438, z: 0 },
      },
    }),
  },
  lAlanine: {
    source: 'SMILES C[C@H](N)C(=O)O',
    title: 'L-alanine',
    description: 'Wedge stereo bond with absolute stereo label.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [13.6042, -11.5535, 0] },
          { label: 'C', location: [14.1042, -10.6875, 0], stereoLabel: 'abs' },
          { label: 'N', location: [13.6042, -9.8215, 0] },
          { label: 'C', location: [15.1042, -10.6875, 0] },
          { label: 'O', location: [15.6042, -11.5535, 0] },
          { label: 'O', location: [15.6042, -9.8215, 0] },
        ],
        bonds: [
          { type: 1, atoms: [1, 0], stereo: 6 },
          { type: 1, atoms: [1, 2] },
          { type: 1, atoms: [1, 3] },
          { type: 2, atoms: [3, 4] },
          { type: 1, atoms: [3, 5] },
        ],
        stereoFlagPosition: { x: 15.6042, y: 8.8215, z: 0 },
      },
    }),
  },
  benzeneKekule: {
    source: 'SMILES C1=CC=CC=C1',
    title: 'Benzene (Kekule)',
    description: 'Alternating bonds that must not be aromatized on load.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [15, -9.359, 0] },
          { label: 'C', location: [14, -9.359, 0] },
          { label: 'C', location: [13.5, -10.225, 0] },
          { label: 'C', location: [14, -11.091, 0] },
          { label: 'C', location: [15, -11.091, 0] },
          { label: 'C', location: [15.5, -10.225, 0] },
        ],
        bonds: [
          { type: 2, atoms: [0, 1] },
          { type: 1, atoms: [1, 2] },
          { type: 2, atoms: [2, 3] },
          { type: 1, atoms: [3, 4] },
          { type: 2, atoms: [4, 5] },
          { type: 1, atoms: [5, 0] },
        ],
        stereoFlagPosition: { x: 15.5, y: 8.359, z: 0 },
      },
    }),
  },
  nitromethane: {
    source: 'SMILES C[N+](=O)[O-]',
    title: 'Nitromethane',
    description: 'Charge-separated contributor used by resonance tasks.',
    ket: ket({
      ket_version: '2.0.0',
      root: { nodes: [{ $ref: 'mol0' }], connections: [], templates: [] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [14.3827, -10.9938, 0] },
          { label: 'N', location: [14.3827, -9.9938, 0], charge: 1 },
          { label: 'O', location: [13.5167, -9.4938, 0] },
          { label: 'O', location: [15.2487, -9.4937, 0], charge: -1 },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 2, atoms: [1, 2] },
          { type: 1, atoms: [1, 3] },
        ],
        stereoFlagPosition: { x: 15.2487, y: 8.4937, z: 0 },
      },
    }),
  },
  esterification: {
    source: 'SMILES CCO.CC(=O)O>>CC(=O)OCC.O',
    title: 'Fischer esterification',
    description:
      'Reaction with plus signs and positional reactant/product roles.',
    ket: ket({
      ket_version: '2.0.0',
      root: {
        nodes: [
          { $ref: 'mol0' },
          { $ref: 'mol1' },
          { $ref: 'mol2' },
          { $ref: 'mol3' },
          {
            type: 'arrow',
            data: {
              mode: 'open-angle',
              pos: [
                { x: 14.0915, y: -10.1875, z: 0 },
                { x: 15.0915, y: -10.1875, z: 0 },
              ],
            },
          },
          { type: 'plus', location: [10.1094, -10.1875, 0], prop: {} },
          { type: 'plus', location: [20.8056, -10.1875, 0], prop: {} },
        ],
        connections: [],
        templates: [],
      },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [7.1274, -9.9375, 0] },
          { label: 'C', location: [7.9934, -10.4375, 0] },
          { label: 'O', location: [8.8594, -9.9375, 0] },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 1, atoms: [1, 2] },
        ],
        stereoFlagPosition: { x: 8.8594, y: 8.9375, z: 0 },
      },
      mol1: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [12.2255, -10.9375, 0] },
          { label: 'C', location: [12.2255, -9.9375, 0] },
          { label: 'O', location: [11.3594, -9.4375, 0] },
          { label: 'O', location: [13.0915, -9.4375, 0] },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 2, atoms: [1, 2] },
          { type: 1, atoms: [1, 3] },
        ],
        stereoFlagPosition: { x: 13.0915, y: 8.4375, z: 0 },
      },
      mol2: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [16.0915, -10.9375, 0] },
          { label: 'C', location: [16.9575, -10.4375, 0] },
          { label: 'O', location: [16.9575, -9.4375, 0] },
          { label: 'O', location: [17.8235, -10.9375, 0] },
          { label: 'C', location: [18.6896, -10.4375, 0] },
          { label: 'C', location: [19.5556, -10.9375, 0] },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 2, atoms: [1, 2] },
          { type: 1, atoms: [1, 3] },
          { type: 1, atoms: [3, 4] },
          { type: 1, atoms: [4, 5] },
        ],
        stereoFlagPosition: { x: 19.5556, y: 8.4375, z: 0 },
      },
      mol3: {
        type: 'molecule',
        atoms: [{ label: 'O', location: [22.3056, -10.1875, 0] }],
        stereoFlagPosition: { x: 22.3056, y: 9.1875, z: 0 },
      },
    }),
  },
  pentavalentCarbonDraft: {
    source: 'hand-authored KET',
    title: 'Pentavalent carbon draft',
    description:
      'Scientifically invalid draft that must stay editable and unfixed.',
    ket: ket({
      root: { nodes: [{ $ref: 'mol0' }] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [0, 0, 0] },
          { label: 'C', location: [1.0, 0.0, 0] },
          { label: 'C', location: [0.309, 0.9511, 0] },
          { label: 'C', location: [-0.809, 0.5878, 0] },
          { label: 'C', location: [-0.809, -0.5878, 0] },
          { label: 'C', location: [0.309, -0.9511, 0] },
        ],
        bonds: [
          { type: 1, atoms: [0, 1] },
          { type: 1, atoms: [0, 2] },
          { type: 1, atoms: [0, 3] },
          { type: 1, atoms: [0, 4] },
          { type: 1, atoms: [0, 5] },
        ],
      },
    }),
  },
} satisfies Record<string, KetFixture>;

export type KetFixtureId = keyof typeof KET_FIXTURES;
