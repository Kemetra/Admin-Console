// Off-script design-sync layout builder for the Retail Tower Design System (RT-392).
//
// This repo is an app, not a component library, and its shipped React components
// still carry the retired dark/navy/gold identity, so the converter's
// compiled-components path does not apply (owner decision, 2026-10-11). This
// script assembles the upload contract from the hand-authored source bundle in
// design/claude-design-system/ instead: a tokens + CSS-vocabulary design system
// with an empty component bundle and 20 reference cards in a flat preview/ folder
// (the layout the app registers for hand-authored systems, as in the POS Pulse
// project; components/ stays empty so no card is mistaken for a React component).
//
//   node .design-sync/build-bundle.mjs            -> ./ds-bundle
//   node .ds-sync/package-validate.mjs ./ds-bundle  (the gate; must exit 0)
//
// .ds-sync/ is gitignored: `/design-sync` stages the validator there at the start
// of each run, so the gate exists only during a sync.
//
// Deterministic: same source in, same bytes out. Every text input is read with its
// line endings normalised to LF, so a CRLF checkout (core.autocrlf=true) builds the
// same bundle as an LF one. Nothing here is uploaded by itself; DesignSync uploads
// ./ds-bundle.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design', 'claude-design-system');
const OUT = join(ROOT, 'ds-bundle');
const readLF = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cfg = JSON.parse(readLF(join(ROOT, '.design-sync', 'config.json')));

// A code span names a class when it is `.x` or `element.x`, or a bare identifier
// in the class table (table rows only; `aria-*` spans are attributes).
function classInSpan(span, tableRow) {
  const m = /^\.([a-z][\w-]*)$/.exec(span) ?? /^(?:label|input|select|tr)\.([a-z][\w-]*)$/.exec(span);
  if (m) return m[1];
  return tableRow && /^(?!aria-)[a-z][\w-]*$/.test(span) ? span : null;
}

function classesNamedIn(md) {
  const fromSpans = md.split('\n').flatMap((line) =>
    [...line.matchAll(/`([^`]+)`/g)].map(([, span]) => classInSpan(span, line.startsWith('| '))));
  const fromAttrs = [...md.matchAll(/class="([^"]+)"/g)].flatMap(([, list]) => list.split(/\s+/));
  return new Set([...fromSpans, ...fromAttrs].filter(Boolean));
}

// Every token named in full; a `--x-1`…`--x-9` range names each step in between.
function tokensNamedIn(md) {
  const tokens = new Set([...md.matchAll(/(?<![\w-])--[a-z][a-z0-9-]*/g)].map((m) => m[0]));
  for (const [, stem, from, to] of md.matchAll(/`(--[a-z-]+-)(\d+)`…`\1(\d+)`/g)) {
    for (let i = Number(from); i <= Number(to); i++) tokens.add(`${stem}${i}`);
  }
  return tokens;
}

// Every token and class conventions.md names must exist in the CSS designs receive.
// Without this, a rename in components.css ships a README that teaches the design
// agent a class that no longer styles anything. Comments are stripped first, so a
// name that survives only in a comment does not count as defined.
function checkConventionNames(md, tokensCss, componentsCss) {
  const defined = new Set([...stripComments(tokensCss).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const selectors = stripComments(componentsCss);
  const tokens = tokensNamedIn(md);
  const classes = classesNamedIn(md);
  const missing = [
    ...[...tokens].filter((t) => !defined.has(t)),
    ...[...classes].filter((c) => !new RegExp(`\\.${escapeRe(c)}(?![\\w-])`).test(selectors)).map((c) => `.${c}`),
  ];
  if (missing.length) throw new Error(`conventions.md names undefined token(s)/class(es): ${missing.join(', ')}`);
  return { tokens: tokens.size, classes: classes.size };
}

if (existsSync(OUT)) {
  if (!existsSync(join(OUT, '.ds-build-meta.json'))) throw new Error(`refusing to rm ${OUT}: not a prior bundle`);
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(join(OUT, 'tokens'), { recursive: true });
mkdirSync(join(OUT, 'preview'), { recursive: true });
// Tokens-only contract: components/ exists but stays empty (an empty dir uploads nothing).
mkdirSync(join(OUT, 'components'), { recursive: true });

// Styles: designs receive only the styles.css @import closure.
const tokensCss = readLF(join(SRC, 'colors_and_type.css'));
const componentsCss = readLF(join(SRC, 'components.css'));
writeFileSync(join(OUT, 'tokens', 'colors_and_type.css'), tokensCss);
writeFileSync(join(OUT, 'tokens', 'components.css'), componentsCss);
writeFileSync(join(OUT, 'styles.css'),
  '/* Retail Tower Design System: the closure every generated design receives. */\n' +
  '@import "./tokens/colors_and_type.css";\n' +
  '@import "./tokens/components.css";\n');

// Card chrome: cards link it; it pulls styles.css so cards render exactly what designs get.
const chrome = readLF(join(SRC, 'preview', '_card.css'))
  .replace(/^@import url\("\.\.\/colors_and_type\.css"\);\n@import url\("\.\.\/components\.css"\);\n/m,
           '@import url("../styles.css");\n');
if (!chrome.includes('@import url("../styles.css");')) throw new Error('card chrome imports did not match');
writeFileSync(join(OUT, 'preview', '_card.css'), chrome);

// Cards: preview/<file>.html, copied with LF endings (they already link ./_card.css).
const cards = [];
for (const f of readdirSync(join(SRC, 'preview')).filter((f) => f.endsWith('.html')).sort()) {
  const html = readLF(join(SRC, 'preview', f));
  const m = /^<!-- @dsCard group="([^"]+)" name="([^"]+)" subtitle="([^"]+)" viewport="(\d+)x(\d+)" -->/.exec(html);
  if (!m) throw new Error(`${f}: line 1 is not a full @dsCard marker`);
  const [, group, name] = m;
  if (!html.includes('<link rel="stylesheet" href="_card.css">')) throw new Error(`${f}: stylesheet link not found`);
  writeFileSync(join(OUT, 'preview', f), html);
  cards.push({ group, name, file: f });
}

// Empty component bundle with the header the app's self-check parses. No React
// components ship until the light-first token migration lands in the app.
const header = { namespace: cfg.globalName, components: [], sourceHashes: {}, inlinedExternals: [], source: 'retail-tower-console design/claude-design-system (off-script, tokens + CSS vocabulary)' };
writeFileSync(join(OUT, '_ds_bundle.js'),
  `/* @ds-bundle: ${JSON.stringify(header).replace(/\*\//g, '*\\/')} */\n` +
  `(function(){var g=typeof window!=='undefined'?window:globalThis;g[${JSON.stringify(cfg.globalName)}]=g[${JSON.stringify(cfg.globalName)}]||{};})();\n`);

// README = the conventions header (the design agent's system-prompt slot) + a short body.
const conventions = readLF(join(ROOT, cfg.readmeHeader)).trimEnd();
const named = checkConventionNames(conventions, tokensCss, componentsCss);
const groups = [...new Set(cards.map((c) => c.group))];
const body = [
  '', '---', '', '## Reference cards', '',
  'Rendered examples of the vocabulary above, under `preview/<card>.html`. They are',
  'reference renders, not importable components: there is no React component bundle yet.', '',
  ...groups.flatMap((g) => [`- **${g}:** ` + cards.filter((c) => c.group === g).map((c) => `${c.name} (\`preview/${c.file}\`)`).join(', ')]),
  '', 'Authority: Retail Tower UX/UI Constitution UX-01…UX-13 (Confluence RETAIL); colour values approved',
  'in RT-392 (2026-10-11). Source of truth: Kemetra/Admin-Console `design/claude-design-system/`.', '',
].join('\n');
writeFileSync(join(OUT, 'README.md'), conventions + '\n' + body);

// Upload fence + local-only build metadata.
writeFileSync(join(OUT, '_ds_needs_recompile'), JSON.stringify({ by: 'design-sync-cli' }) + '\n');
writeFileSync(join(OUT, '.ds-build-meta.json'), JSON.stringify({ componentCount: 0, cardCount: cards.length, shape: 'package', offScript: true }, null, 2) + '\n');

console.log(`[OK] ds-bundle: ${cards.length} cards in ${groups.length} groups, styles.css + 2 token files, README ${conventions.length} char header (${named.tokens} tokens + ${named.classes} classes checked)`);
