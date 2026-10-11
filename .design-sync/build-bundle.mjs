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
// Deterministic: same source in, same bytes out. Nothing here is uploaded by
// itself; DesignSync uploads ./ds-bundle.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design', 'claude-design-system');
const OUT = join(ROOT, 'ds-bundle');
const cfg = JSON.parse(readFileSync(join(ROOT, '.design-sync', 'config.json'), 'utf8'));

if (existsSync(OUT)) {
  if (!existsSync(join(OUT, '.ds-build-meta.json'))) throw new Error(`refusing to rm ${OUT}: not a prior bundle`);
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(join(OUT, 'tokens'), { recursive: true });
mkdirSync(join(OUT, 'preview'), { recursive: true });
// Tokens-only contract: components/ exists but stays empty (an empty dir uploads nothing).
mkdirSync(join(OUT, 'components'), { recursive: true });

// Styles: designs receive only the styles.css @import closure.
cpSync(join(SRC, 'colors_and_type.css'), join(OUT, 'tokens', 'colors_and_type.css'));
cpSync(join(SRC, 'components.css'), join(OUT, 'tokens', 'components.css'));
writeFileSync(join(OUT, 'styles.css'),
  '/* Retail Tower Design System: the closure every generated design receives. */\n' +
  '@import "./tokens/colors_and_type.css";\n' +
  '@import "./tokens/components.css";\n');

// Card chrome: cards link it; it pulls styles.css so cards render exactly what designs get.
const chrome = readFileSync(join(SRC, 'preview', '_card.css'), 'utf8')
  .replace(/^@import url\("\.\.\/colors_and_type\.css"\);\n@import url\("\.\.\/components\.css"\);\n/m,
           '@import url("../styles.css");\n');
if (!chrome.includes('@import url("../styles.css");')) throw new Error('card chrome imports did not match');
writeFileSync(join(OUT, 'preview', '_card.css'), chrome);

// Cards: preview/<file>.html, copied byte-for-byte (they already link ./_card.css).
const cards = [];
for (const f of readdirSync(join(SRC, 'preview')).filter((f) => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(SRC, 'preview', f), 'utf8');
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
const conventions = readFileSync(join(ROOT, cfg.readmeHeader), 'utf8').trimEnd();
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

console.log(`[OK] ds-bundle: ${cards.length} cards in ${groups.length} groups, styles.css + 2 token files, README ${conventions.length} char header`);
