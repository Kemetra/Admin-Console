// WCAG AA gate over every text (4.5) and boundary (3) pairing the components use.
// Side-effect free, so both .design-sync/build-bundle.mjs (the Claude Design bundle
// gate, both themes) and tests/unit/tokens-identity.test.ts (the shipped Admin
// Console tokens, RT-396) check the same list. Names are colour roles without the
// --color- prefix: [foreground, background, minimum ratio].
export const LAYERS = ['background', 'surface', 'surface-sunken'];

export const CONTRAST_PAIRS = [
  ...LAYERS.flatMap((bg) => [
    ['text', bg, 4.5], ['text-muted', bg, 4.5], ['control-border', bg, 3], ['focus-ring', bg, 3],
    ...['success', 'warning', 'danger', 'info'].map((s) => [s, bg, 4.5]),
  ]),
  ['text', 'primary-soft', 4.5], ['text-muted', 'primary-soft', 4.5], ['primary-emphasis', 'primary-soft', 4.5],
  ['primary-emphasis', 'surface', 4.5], ['primary', 'primary-soft', 3],
  ['on-primary', 'primary', 4.5], ['on-primary', 'primary-emphasis', 4.5], ['on-primary', 'danger', 4.5],
];
