// Builds harness.html: renders the shipped --color-viz-* tokens straight from the
// worktree's src/styles/tokens.css (no copies of the values), in swatches and in
// the chart forms they are meant for. Open with #dark for the dark theme.
import { writeFileSync } from "node:fs";

const TOKENS = "file:///C:/Users/Shaaban/Documents/GitHub/admin-console/.claude/worktrees/rt-822-dataviz-tokens-34c2a9/src/styles/tokens.css";
const cat = [1, 2, 3, 4, 5, 6, 7, 8];
const names = ["indigo", "olive", "magenta", "orange", "cyan", "crimson", "violet", "green"];
const seq = [1, 2, 3, 4, 5];
const div = ["neg-3", "neg-2", "neg-1", "mid", "pos-1", "pos-2", "pos-3"];

const swatch = (t, label) =>
  `<div class="sw"><div class="chip" style="background:var(--color-viz-${t})"></div><code>${t}</code><span class="hex" data-t="--color-viz-${t}"></span>${label ? `<span>${label}</span>` : ""}</div>`;

// Grouped bars: 3 groups x 8 series, 2px surface gap, 4px rounded data end.
function bars() {
  const vals = [[42, 55, 38, 61, 47, 33, 52, 40], [50, 44, 58, 39, 63, 48, 35, 57], [36, 60, 45, 52, 41, 56, 49, 31]];
  const W = 18, gap = 2, groupGap = 28, H = 140;
  let x = 30, out = "";
  vals.forEach((g, gi) => {
    g.forEach((v, i) => {
      const h = v * 2;
      out += `<path d="M${x},${H} v${-h + 4} q0,-4 4,-4 h${W - 8} q4,0 4,4 v${h - 4} z" style="fill:var(--color-viz-cat-${i + 1})"/>`;
      x += W + gap;
    });
    out += `<text x="${x - (W + gap) * 4}" y="${H + 16}" class="axis" text-anchor="middle">Store ${gi + 1}</text>`;
    x += groupGap;
  });
  return `<svg width="560" height="170" role="img" aria-label="Grouped bars, 8 series"><line x1="24" x2="560" y1="140" y2="140" class="base"/>${out}</svg>`;
}

// Lines: 8 series, 2px, direct end labels for the first four.
function lines() {
  let out = "";
  cat.forEach((c, i) => {
    const pts = Array.from({ length: 10 }, (_, k) => [30 + k * 52, 150 - (20 + ((i * 17 + k * (9 + i) * 7) % 110))]);
    out += `<polyline fill="none" stroke-width="2" style="stroke:var(--color-viz-cat-${c})" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    out += `<circle r="4" cx="${pts[9][0]}" cy="${pts[9][1]}" style="fill:var(--color-viz-cat-${c});stroke:var(--color-surface);stroke-width:2"/>`;
    out += `<text x="${pts[9][0] + 8}" y="${pts[9][1] + 4}" class="lbl">${names[i]}</text>`;
  });
  return `<svg width="560" height="170" role="img" aria-label="Lines, 8 series"><line x1="24" x2="520" y1="150" y2="150" class="base"/>${out}</svg>`;
}

// Stacked 100% bar, 2px gaps.
function stack() {
  const w = [18, 14, 12, 16, 10, 12, 9, 9];
  let x = 0, out = "";
  w.forEach((p, i) => { const ww = p * 5; out += `<rect x="${x}" y="0" width="${ww - 2}" height="28" style="fill:var(--color-viz-cat-${i + 1})"/>`; x += ww; });
  return `<svg width="510" height="28" role="img" aria-label="Stacked bar">${out}</svg>`;
}

// Heat strip (sequential) and diverging bar.
const heat = () => `<div class="strip">${[1, 1, 2, 3, 2, 4, 5, 5, 4, 3, 2, 1, 3, 4, 5].map((s) => `<div style="background:var(--color-viz-seq-${s})"></div>`).join("")}</div>`;
const diverging = () => {
  const v = [-3, -2, -1, 0, 1, 2, 3, 2, -1, -2];
  return `<svg width="420" height="130" role="img" aria-label="Diverging bars"><line x1="0" x2="420" y1="65" y2="65" class="base"/>${v.map((d, i) => {
    const t = d === 0 ? "mid" : d < 0 ? `neg-${-d}` : `pos-${d}`;
    const h = d === 0 ? 4 : Math.abs(d) * 18;
    const y = d < 0 ? 65 : 65 - h;
    return `<rect x="${10 + i * 40}" y="${d === 0 ? 63 : y}" width="30" height="${h}" style="fill:var(--color-viz-div-${t})"/>`;
  }).join("")}</svg>`;
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RT-822 data-viz tokens</title>
<link rel="stylesheet" href="${TOKENS}">
<style>
  body{padding:16px 20px;background:var(--color-surface)}
  h1{font-size:var(--text-screen-title);margin:0 0 4px} h2{font-size:var(--text-section-title);margin:16px 0 8px}
  p.meta{color:var(--color-text-muted);font-size:var(--text-meta);margin:0}
  .row{display:flex;flex-wrap:wrap;gap:10px}
  .sw{display:flex;flex-direction:column;width:96px;font-size:var(--text-meta);color:var(--color-text-muted)}
  .sw code{color:var(--color-text)} .chip{height:40px;border-radius:var(--radius-sm);margin-bottom:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
  .panel{background:var(--color-background);border:1px solid var(--color-border);border-radius:var(--radius-object);padding:10px}
  .sunken{background:var(--color-surface-sunken)}
  .axis,.lbl{font-size:12px;fill:var(--color-text-muted)} .lbl{fill:var(--color-text)}
  .base{stroke:var(--color-control-border);stroke-width:1}
  .strip{display:flex;gap:2px}.strip div{width:30px;height:30px;border-radius:2px}
  @media (forced-colors: active){.chip,.strip div{forced-color-adjust:none}}
</style></head><body>
<h1>RT-822 data-viz tokens <span class="meta" id="mode"></span></h1>
<p class="meta">Rendered from src/styles/tokens.css. Charts sit on background / sunken layers; the page is the surface layer.</p>
<h2>Categorical (fixed order, never cycled)</h2><div class="row">${cat.map((i) => swatch(`cat-${i}`, names[i - 1])).join("")}</div>
<h2>Sequential (1 = least) and diverging (orange below, violet above)</h2>
<div class="row">${seq.map((i) => swatch(`seq-${i}`)).join("")}</div>
<div class="row" style="margin-top:8px">${div.map((t) => swatch(`div-${t}`)).join("")}</div>
<h2>In use</h2>
<div class="grid">
  <div class="panel">${bars()}</div>
  <div class="panel sunken">${lines()}</div>
  <div class="panel sunken">${stack()}<div style="height:14px"></div>${heat()}</div>
  <div class="panel">${diverging()}</div>
</div>
<script>
  if (location.hash === "#dark") document.documentElement.dataset.theme = "dark";
  document.getElementById("mode").textContent = "— " + (location.hash === "#dark" ? "dark" : "light")
    + (matchMedia("(forced-colors: active)").matches ? ", forced colours" : "");
  for (const el of document.querySelectorAll(".hex")) el.textContent = getComputedStyle(document.documentElement).getPropertyValue(el.dataset.t).trim();
</script>
</body></html>`;
writeFileSync(new URL("./harness.html", import.meta.url), html);
console.log("ok");
