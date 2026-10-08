import { Vec2 } from 'domain/entities/vec2';
import { layoutNonbondingElectrons } from 'application/render/restruct/nonbondingElectrons';

const RIGHT = new Vec2(1, 0);
const LEFT = new Vec2(-1, 0);
const UP = new Vec2(0, -1);

describe('layoutNonbondingElectrons', () => {
  it('returns nothing for 0 electrons', () => {
    expect(layoutNonbondingElectrons(0, [])).toEqual([]);
  });

  it('groups electrons into pairs plus one single dot', () => {
    const groups = layoutNonbondingElectrons(5, []);
    expect(groups.map((g) => g.electrons)).toEqual([2, 2, 1]);
    expect(new Set(groups.map((g) => g.side)).size).toBe(3);
  });

  it('uses all four sides for an octet', () => {
    const groups = layoutNonbondingElectrons(8, []);
    expect(groups.map((g) => g.side).sort()).toEqual([
      'down',
      'left',
      'right',
      'up',
    ]);
  });

  it('caps at 8 electrons', () => {
    const groups = layoutNonbondingElectrons(12, []);
    expect(groups.reduce((sum, g) => sum + g.electrons, 0)).toBe(8);
  });

  it('places pairs away from a single bond', () => {
    // Terminal F bonded to the right: 3 pairs avoid the right side.
    const groups = layoutNonbondingElectrons(6, [RIGHT]);
    expect(groups.map((g) => g.side)).not.toContain('right');
    expect(groups[0].side).toBe('left');
  });

  it('places pairs away from two horizontal bonds', () => {
    // Water-like O with bonds left and right: 2 pairs go up and down.
    const groups = layoutNonbondingElectrons(4, [LEFT, RIGHT]);
    expect(groups.map((g) => g.side).sort()).toEqual(['down', 'up']);
  });

  it('prefers the side farthest from angled bonds', () => {
    // Bonds down-left and down-right (120 degree apart): first pair goes up.
    const bonds = [new Vec2(-0.866, 0.5), new Vec2(0.866, 0.5)];
    const [first] = layoutNonbondingElectrons(2, bonds);
    expect(first.side).toBe('up');
  });

  it('treats the radical mark as occupying the top', () => {
    const [first] = layoutNonbondingElectrons(2, [UP]);
    expect(first.side).toBe('down');
  });
});
