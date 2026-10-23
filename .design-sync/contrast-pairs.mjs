// WCAG AA gate over every text (4.5) and boundary (3) pairing the components use,
// plus every data-viz mark (RT-822). Side-effect free, so both
// .design-sync/build-bundle.mjs (the Claude Design bundle gate, both themes) and
// tests/unit/tokens-identity.test.ts (the shipped Admin Console tokens, RT-396)
// check the same list. Names are colour roles without the --color- prefix:
// [foreground, background, minimum ratio].
export const LAYERS = ['background', 'surface', 'surface-sunken'];

// Data-viz marks (RT-822, UX-13) on every layer. A categorical slot and every
// sequential or diverging step a reader must find is a graphical mark (3:1). The
// receding ends hold the 2:1 ordinal floor: sequential step 1 (near zero) and
// step 1 of each diverging arm (next to the midpoint). The midpoint is the
// neutral "nothing" and has no minimum.
export const VIZ_CATEGORICAL = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `viz-cat-${i}`);
export const VIZ_SEQUENTIAL = [1, 2, 3, 4, 5].map((i) => `viz-seq-${i}`);
export const VIZ_DIVERGING = [
  'viz-div-neg-3', 'viz-div-neg-2', 'viz-div-neg-1', 'viz-div-mid',
  'viz-div-pos-1', 'viz-div-pos-2', 'viz-div-pos-3',
];
const vizMinimum = (role) => (/^viz-(seq|div-(neg|pos))-1$/.test(role) ? 2 : 3);

export const CONTRAST_PAIRS = [
  ...LAYERS.flatMap((bg) => [
    ['text', bg, 4.5], ['text-muted', bg, 4.5], ['control-border', bg, 3], ['focus-ring', bg, 3],
    ...['success', 'warning', 'danger', 'info'].map((s) => [s, bg, 4.5]),
  ]),
  ['text', 'primary-soft', 4.5], ['text-muted', 'primary-soft', 4.5], ['primary-emphasis', 'primary-soft', 4.5],
  ['primary-emphasis', 'surface', 4.5], ['primary', 'primary-soft', 3],
  ['on-primary', 'primary', 4.5], ['on-primary', 'primary-emphasis', 4.5], ['on-primary', 'danger', 4.5],
  ...LAYERS.flatMap((bg) =>
    [...VIZ_CATEGORICAL, ...VIZ_SEQUENTIAL, ...VIZ_DIVERGING.filter((r) => r !== 'viz-div-mid')]
      .map((role) => [role, bg, vizMinimum(role)])),
];
