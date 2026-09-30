/**
 * Everything the OLMS chemistry editor adapter relies on from Ketcher, as data.
 * Each entry names the test that pins it; when upstream breaks one, that test
 * fails in the upstream-sync PR before OLMS ever consumes the change.
 * OLMS source of truth: src/features/chemistry-editor/{assistance-profile,ketcher-session,ketcher-editor}.ts
 */

/** Ketcher `buttons` config names OLMS hides in assessed profiles. */
export const OLMS_HIDDEN_BUTTONS = [
  'layout',
  'clean',
  'arom',
  'dearom',
  'cip',
  'check',
  'analyse',
  'recognize',
  'miew',
  'settings',
  'help',
  'sgroup',
  'rgroup',
  'rgroup-label',
  'rgroup-fragment',
  'rgroup-attpoints',
  'create-monomer',
  'reaction-mapping-tools',
  'reaction-automap',
  'reaction-map',
  'reaction-unmap',
  'shape',
  'shape-ellipse',
  'shape-rectangle',
  'shape-line',
  'text',
  'reaction-plus',
  'arrows',
  'reaction-arrow-open-angle',
  'reaction-arrow-filled-triangle',
  'reaction-arrow-filled-bow',
  'reaction-arrow-dashed-open-angle',
  'reaction-arrow-failed',
  'reaction-arrow-both-ends-filled-triangle',
  'reaction-arrow-equilibrium-filled-half-bow',
  'reaction-arrow-equilibrium-filled-triangle',
  'reaction-arrow-equilibrium-open-angle',
  'reaction-arrow-unbalanced-equilibrium-filled-half-bow',
  'reaction-arrow-unbalanced-equilibrium-open-half-angle',
  'reaction-arrow-unbalanced-equilibrium-large-filled-half-bow',
  'reaction-arrow-unbalanced-equilibrium-filled-half-triangle',
  'reaction-arrow-elliptical-arc-arrow-filled-bow',
  'reaction-arrow-elliptical-arc-arrow-filled-triangle',
  'reaction-arrow-elliptical-arc-arrow-open-angle',
  'reaction-arrow-elliptical-arc-arrow-open-half-angle',
  'reaction-arrow-multitail',
] as const;

/** Toolbar data-testids of the buttons above that must disappear when hidden. */
export const HIDDEN_BUTTON_TEST_IDS = [
  'Layout button',
  'Clean Up button',
  'Aromatize button',
  'Dearomatize button',
  'Calculate CIP button',
  'Check Structure button',
  'Calculated Values button',
  '3D Viewer button',
  'settings-button',
  'help-button',
  'sgroup',
  'text',
  'reaction-plus',
  'arrows-drop-down-button',
] as const;

/** Controls with no `buttons` switch; OLMS hides them by these exact data-testids. */
export const CSS_HIDDEN_TEST_IDS = [
  'Add/Remove explicit hydrogens button',
  'template-lib',
  'open-file-button',
  'save-file-button',
  'images',
] as const;

/** Hotkeys of hidden buttons that must stay inert once hidden (no KET change, no dialog). */
export const HIDDEN_BUTTON_HOTKEYS = [
  'Alt+a',
  'Control+Alt+a',
  'Control+l',
  'Control+Shift+l',
  'Control+p',
  'Alt+s',
  'Alt+c',
] as const;

/**
 * Shortcuts of CSS-hidden controls that still open dialogs; OLMS swallows them,
 * matching Ketcher's physical-key (`event.code`) hotkey resolution.
 */
export const DIALOG_SHORTCUTS = ['Shift+t', 'Control+o', 'Control+s'] as const;

/** Ketcher/editor methods OLMS `asKetcherHandle` requires at runtime. */
export const KETCHER_METHODS = [
  'getKet',
  'setMolecule',
  'addFragment',
] as const;
export const EDITOR_METHODS = [
  'struct',
  'undo',
  'redo',
  'historySize',
  'clearHistory',
  'setOptions',
  'subscribe',
  'unsubscribe',
] as const;

/** Indigo WASM operations OLMS documents as available (and the ones it must not assume). */
export const INDIGO_OPERATIONS = [
  'convert',
  'check',
  'calculate',
  'calculateCip',
  'aromatize',
  'dearomatize',
  'layout',
  'clean2d',
  'automap',
] as const;

/** axe rule ids Ketcher is known to violate; any addition must be triaged. */
export const KNOWN_AXE_VIOLATIONS = [
  'button-name',
  'color-contrast',
  'label',
] as const;

export const HIGHLIGHT_COLOR = '#e8590c';
