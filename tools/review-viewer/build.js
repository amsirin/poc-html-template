// Build a side-by-side review viewer for reviewer sign-off.
// Reads report.json files from ../../output/*-diff/ directories and emits an
// index.html with baseline / rendered / diff triptychs, metrics, click-to-zoom,
// and localStorage-backed sign-off buttons.
//
// Adapted from poc-translator/tools/review-viewer/build.js. Differences:
//   - scans output/*-diff/ (this POC's diff output convention)
//   - only PDFreactor engine for now (Chrome comparison optional)
//   - viewer written to tools/review-viewer/index.html
//
// Usage:
//   node tools/review-viewer/build.js

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const DIFF_ROOT = join(REPO_ROOT, 'output');
const OUT_DIR = SCRIPT_DIR;
const contextPath = join(SCRIPT_DIR, 'review-context.json');
const reviewContext = existsSync(contextPath)
  ? JSON.parse(readFileSync(contextPath, 'utf8')) : {};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function findReviewDirs() {
  if (!existsSync(DIFF_ROOT)) return [];
  const entries = readdirSync(DIFF_ROOT, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && /-diff$/.test(e.name))
    .map(e => join(DIFF_ROOT, e.name))
    .filter(d => existsSync(join(d, 'report.json')));
}

function loadReport(dir) {
  const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
  return {
    dir,
    dirName: basename(dir),
    engine: report.engine || 'pdfreactor',
    htmlPath: report.htmlPath,
    pdfPath: report.pdfPath,
    templateId: basename(dir).replace(/-diff$/, ''),
    context: reviewContext.comparisons?.[basename(dir).replace(/-diff$/, '')],
    overall: {
      page: report.overallPageSimilarity,
      content: report.overallContentSimilarity,
      grid: report.overallGridSimilarity,
    },
    pages: (report.results || []).map(r => ({
      page: r.page,
      baseline: r.baseline ? join(dir, r.baseline) : null,
      rendered: r.rendered ? join(dir, r.rendered) : null,
      diff: r.diff ? join(dir, r.diff) : null,
      page_sim: r.pageSimilarity,
      content_sim: r.contentSimilarity,
      grid_sim: r.gridSimilarity,
    })),
  };
}

function fileUrl(p) {
  return p ? 'file://' + resolve(p) : null;
}

function ratingClass(pct, thresholds = [95, 85]) {
  if (pct == null) return 'na';
  if (pct >= thresholds[0]) return 'good';
  if (pct >= thresholds[1]) return 'warn';
  return 'bad';
}

function fmt(n) {
  return n == null ? '—' : n.toFixed(2) + '%';
}

function buildHtml(reports) {
  const groupedByTemplate = new Map();
  for (const r of reports) {
    const key = r.templateId;
    if (!groupedByTemplate.has(key)) groupedByTemplate.set(key, []);
    groupedByTemplate.get(key).push(r);
  }
  const templates = [...groupedByTemplate.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const rows = templates.map(([tid, engines]) => ({ tid, engines }));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>CCM PoC HTML Template — Visual Review</title>
<style>
  :root {
    --bg: #f5f5f5;
    --panel: #fff;
    --line: #ddd;
    --ink: #1a1a1a;
    --muted: #666;
    --good: #2c8a2c;
    --warn: #b47a00;
    --bad: #b93a3a;
    --accent: #E87722;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg); color: var(--ink);
  }
  h1 { margin: 0 0 8px; font-size: 24px; }
  h1 .accent { color: var(--accent); }
  h2 { margin: 32px 0 12px; font-size: 18px; }
  .subtitle { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .review-note { background: #fff5dc; border-left: 4px solid #b47a00; padding: 12px; font-size: 13px; line-height: 1.6; }
  .navigation, .preview-links { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0 24px; font-size: 13px; }
  a { color: #8a4600; }
  .template { scroll-margin-top: 16px; }
  .legend {
    display: inline-flex; gap: 16px; align-items: center;
    padding: 8px 16px; background: var(--panel);
    border: 1px solid var(--line); border-radius: 6px;
    font-size: 13px; margin-bottom: 24px;
  }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .swatch.good { background: var(--good); }
  .swatch.warn { background: var(--warn); }
  .swatch.bad { background: var(--bad); }

  .template {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .template-header {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px;
  }
  .template-id { font-size: 15px; font-weight: 600; font-family: 'SF Mono', Menlo, monospace; }
  .metrics-grid {
    display: grid;
    grid-template-columns: 110px repeat(3, 1fr);
    gap: 8px 16px; margin: 12px 0;
    font-size: 13px;
    max-width: 600px;
  }
  .metrics-grid > div { padding: 4px 8px; border-radius: 4px; }
  .metrics-grid .engine-label { font-weight: 600; color: var(--muted); }
  .metrics-grid .metric-header { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .metric-cell { font-family: 'SF Mono', Menlo, monospace; text-align: right; }
  .metric-cell.good { background: rgba(44, 138, 44, 0.1); color: var(--good); }
  .metric-cell.warn { background: rgba(180, 122, 0, 0.1); color: var(--warn); }
  .metric-cell.bad  { background: rgba(185, 58, 58, 0.1); color: var(--bad); }
  .metric-cell.na   { background: transparent; color: var(--muted); }

  .triptychs { display: flex; flex-direction: column; gap: 32px; margin-top: 12px; }
  .triptych-title { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .triptych {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .pane {
    background: #fafafa;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 8px;
    text-align: center;
    position: relative;
  }
  .pane-label {
    font-size: 12px; color: var(--muted); margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
  }
  .pane img {
    max-width: 100%; height: auto; display: block; margin: 0 auto;
    border: 1px solid #ccc; cursor: zoom-in;
    background: #fff;
  }
  .pane.diff .pane-label { color: var(--bad); }
  .missing { padding: 24px; color: var(--muted); font-size: 13px; }

  .modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    display: none; align-items: center; justify-content: center;
    z-index: 100; cursor: zoom-out;
  }
  .modal.open { display: flex; }
  .modal img { max-width: 95vw; max-height: 95vh; box-shadow: 0 4px 40px rgba(0,0,0,0.4); }

  .signoff {
    display: flex; gap: 8px; margin-top: 16px;
    padding-top: 12px; border-top: 1px solid var(--line);
    font-size: 13px; align-items: center;
  }
  .signoff button {
    padding: 6px 12px; border: 1px solid var(--line);
    background: var(--panel); border-radius: 4px; cursor: pointer;
    font-size: 13px;
  }
  .signoff button.pass { color: var(--good); border-color: var(--good); }
  .signoff button.fail { color: var(--bad); border-color: var(--bad); }
  .signoff button.pass.active { background: var(--good); color: white; }
  .signoff button.fail.active { background: var(--bad); color: white; }
  .signoff-note { color: var(--muted); font-size: 12px; margin-left: 8px; }

  .empty {
    padding: 40px; text-align: center; color: var(--muted);
    background: var(--panel); border: 1px dashed var(--line); border-radius: 8px;
  }
</style>
</head>
<body>
  <h1>CCM PoC — <span class="accent">HTML Template</span> Migration Review</h1>
  <p class="subtitle">Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} · ${templates.length} template(s) · Click any image to zoom · Sign-off is stored in this browser's localStorage.</p>
  <nav class="navigation">${rows.map(({ tid }) => `<a href="#${escapeHtml(tid)}">${escapeHtml(tid)}</a>`).join('')}</nav>
  ${(reviewContext.previews || []).length ? `<p>IPPLT examples without a matching Exstream baseline — preview only, no similarity score:</p>
  <div class="preview-links">${reviewContext.previews.map(p => `<a href="${escapeHtml(fileUrl(resolve(REPO_ROOT, p.path)))}">${escapeHtml(p.label)}</a>`).join('')}</div>` : ''}

  <div class="legend">
    <span><span class="swatch good"></span>≥95%</span>
    <span><span class="swatch warn"></span>85–95%</span>
    <span><span class="swatch bad"></span>&lt;85%</span>
  </div>

${templates.length === 0
  ? '<div class="empty">No diff reports found. Run <code>node src/render.js</code> and <code>node tools/visual-diff/diff-pdfreactor.js</code> first.</div>'
  : rows.map(row => renderTemplate(row)).join('\n')}

  <div class="modal" id="modal" onclick="this.classList.remove('open')">
    <img id="modal-img" src="" alt="">
  </div>

<script>
  document.querySelectorAll('.pane img').forEach(img => {
    img.addEventListener('click', () => {
      const modal = document.getElementById('modal');
      document.getElementById('modal-img').src = img.src;
      modal.classList.add('open');
    });
  });

  const KEY_PREFIX = 'ccm-html-signoff:';
  document.querySelectorAll('.signoff').forEach(el => {
    const tid = el.dataset.template;
    const stored = localStorage.getItem(KEY_PREFIX + tid);
    if (stored === 'pass' || stored === 'fail') {
      el.querySelector('button.' + stored).classList.add('active');
    }
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.classList.contains('pass') ? 'pass' : 'fail';
        el.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        if (localStorage.getItem(KEY_PREFIX + tid) === val) {
          localStorage.removeItem(KEY_PREFIX + tid);
        } else {
          btn.classList.add('active');
          localStorage.setItem(KEY_PREFIX + tid, val);
        }
      });
    });
  });
</script>
</body>
</html>`;
}

function renderTemplate({ tid, engines }) {
  const referenceOnly = engines.some(e => e.context?.referenceOnly);
  const notes = engines.filter(e => e.context?.note).map(e =>
    `<p class="review-note">${escapeHtml(e.context.note)}</p>`).join('');
  const metricRows = [];
  for (const e of engines) {
    const pc = ratingClass(e.overall.page);
    const cc = ratingClass(e.overall.content);
    const gc = ratingClass(e.overall.grid);
    metricRows.push(`
    <div class="engine-label">${e.engine}</div>
    <div class="metric-cell ${pc}">${fmt(e.overall.page)}</div>
    <div class="metric-cell ${cc}">${fmt(e.overall.content)}</div>
    <div class="metric-cell ${gc}">${fmt(e.overall.grid)}</div>`);
  }

  const triptychs = engines.flatMap(e =>
    e.pages.map((p, idx) => `
    <div>
      <div class="triptych-title">${e.engine} · page ${p.page}${e.pages.length > 1 ? ` (${idx + 1} of ${e.pages.length})` : ''} · content ${fmt(p.content_sim)} · grid ${fmt(p.grid_sim)}</div>
      <div class="triptych">
        <div class="pane">
          <div class="pane-label">${e.context?.referenceOnly ? 'Reference (Exstream; different input data)' : 'Baseline (Exstream)'}</div>
          ${p.baseline ? `<img src="${fileUrl(p.baseline)}" alt="baseline">` : '<div class="missing">no baseline</div>'}
        </div>
        <div class="pane">
          <div class="pane-label">Rendered (${e.engine})</div>
          ${p.rendered ? `<img src="${fileUrl(p.rendered)}" alt="rendered">` : '<div class="missing">no rendered</div>'}
        </div>
        <div class="pane diff">
          <div class="pane-label">Diff (red = drift)</div>
          ${p.diff ? `<img src="${fileUrl(p.diff)}" alt="diff">` : '<div class="missing">no diff</div>'}
        </div>
      </div>
    </div>`)
  );

  return `
  <div class="template" id="${escapeHtml(tid)}">
    <div class="template-header">
      <div class="template-id">${tid}</div>
    </div>
    ${notes}
    <div class="preview-links">${engines.map(e => `<a href="${escapeHtml(fileUrl(e.pdfPath))}">Open Exstream PDF</a><a href="${escapeHtml(fileUrl(join(e.dir, 'html-rendered.pdf')))}">Open generated PDF</a>`).join('')}</div>
    <div class="metrics-grid">
      <div></div>
      <div class="metric-header">Page</div>
      <div class="metric-header">Content</div>
      <div class="metric-header">Grid</div>
      ${metricRows.join('')}
    </div>
    <div class="triptychs">
      ${triptychs.join('\n')}
    </div>
    ${referenceOnly ? '<p class="review-note">Reference comparison only — different input data. Metrics do not establish template parity; Pass/Fail sign-off is unavailable.</p>' : `<div class="signoff" data-template="${tid}">
      <span>Reviewer sign-off:</span>
      <button class="pass">✓ Pass</button>
      <button class="fail">✗ Fail</button>
      <span class="signoff-note">Stored in browser only — for POC review</span>
    </div>`}
  </div>`;
}

// ─── Main ────────────────────────────────────────────────────────────────
const dirs = findReviewDirs();
console.log(`Found ${dirs.length} diff report(s):`);
dirs.forEach(d => console.log('  ' + basename(d)));
const reports = dirs.map(loadReport);
const html = buildHtml(reports);
mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, 'index.html');
writeFileSync(outPath, html);
console.log(`\nViewer written: ${outPath}`);
console.log(`Open with:      open "${outPath}"`);
