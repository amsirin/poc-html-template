// Visual-diff harness: render HTML via headless Chrome, compare vs baseline PDF.
// Usage: node tools/visual-diff/diff.js <html-path> <pdf-path> [out-dir]

import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { execSync } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from 'fs';
import { join, resolve } from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DPI = 150;

// CSS injected into the page before screenshot: strips PoC dev-preview styling
// so the diff measures the actual content layout, not debug affordances.
const PROD_OVERRIDE_CSS = `
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .fwd-doc { max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: #fff !important; }
  .fwd-section { border: none !important; padding: 0 !important; margin: 0 !important; background: none !important; }
  .fwd-section::before { display: none !important; }
  .fwd-paragraph { padding: 0 !important; margin: 0 !important; background: none !important; border: none !important; }
  .fwd-paragraph::before { display: none !important; }
  [data-field]:empty::before { display: none !important; content: none !important; }
  .fwd-image { border: none !important; background: none !important; }
  .fwd-image[data-src-field]:not([src])::before { display: none !important; content: none !important; }
  /* Prod mode: elements whose data-show-if resolved false are removed, not dimmed. */
  [data-show-if][data-eval="false"] { display: none !important; }
  /* Letterhead spans full page width, no gap above. */
  .fwd-letterhead { display: block; margin: 0; padding: 0; }
  .fwd-letterhead img { display: block; width: 100%; height: auto; }
  @page { size: A4; margin: 0; }
`;

async function main() {
  const [htmlPath, pdfPath, outDir = './tools/visual-diff/output'] = process.argv.slice(2);
  if (!htmlPath || !pdfPath) {
    console.error('Usage: node tools/visual-diff/diff.js <html-path> <pdf-path> [out-dir]');
    process.exit(1);
  }
  if (!existsSync(htmlPath)) throw new Error(`HTML not found: ${htmlPath}`);
  if (!existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);
  if (!existsSync(CHROME_PATH)) throw new Error(`Chrome not found at: ${CHROME_PATH}`);

  mkdirSync(outDir, { recursive: true });
  cleanArtifacts(outDir);

  console.log(`\n[1/3] Rasterising baseline PDF @ ${DPI} DPI`);
  execSync(
    `pdftoppm -png -r ${DPI} "${resolve(pdfPath)}" "${join(outDir, 'baseline')}"`,
    { stdio: 'inherit' }
  );
  const baselineFiles = listPages(outDir, 'baseline-');
  console.log(`  → ${baselineFiles.length} page(s)`);

  console.log(`\n[2/3] Rendering HTML via headless Chrome → PDF → PNG`);
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  try {
    const page = await browser.newPage();
    const htmlUrl = 'file://' + resolve(htmlPath);
    await page.goto(htmlUrl, { waitUntil: 'networkidle0' });
    await page.addStyleTag({ content: PROD_OVERRIDE_CSS });
    // Wait for base64-embedded @font-face fonts to actually decode. Without
    // this, Chrome may PDF-render with fallback fonts even though @font-face
    // is declared (base64 decode happens async).
    await page.evaluate(() => document.fonts.ready);
    // Small settle to let preview.js finish DOM mutations
    await new Promise(r => setTimeout(r, 200));
    const htmlPdfPath = join(outDir, 'html-rendered.pdf');
    await page.pdf({
      path: htmlPdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
  execSync(
    `pdftoppm -png -r ${DPI} "${join(outDir, 'html-rendered.pdf')}" "${join(outDir, 'rendered')}"`,
    { stdio: 'inherit' }
  );
  const renderedFiles = listPages(outDir, 'rendered-');
  console.log(`  → ${renderedFiles.length} page(s)`);

  console.log(`\n[3/3] Pixel-diffing pages`);
  const pageCount = Math.max(baselineFiles.length, renderedFiles.length);
  const results = [];
  for (let i = 0; i < pageCount; i++) {
    const bName = baselineFiles[i];
    const rName = renderedFiles[i];
    const pageNo = i + 1;
    if (!bName || !rName) {
      console.log(`  Page ${pageNo}: page-count mismatch (baseline=${!!bName}, rendered=${!!rName})`);
      results.push({ page: pageNo, error: 'page count mismatch', hasBaseline: !!bName, hasRendered: !!rName });
      continue;
    }
    const baseline = PNG.sync.read(readFileSync(join(outDir, bName)));
    const rendered = PNG.sync.read(readFileSync(join(outDir, rName)));
    const w = baseline.width;
    const h = baseline.height;
    const renderedNorm = normaliseSize(rendered, w, h);
    const diff = new PNG({ width: w, height: h });
    const numDiff = pixelmatch(baseline.data, renderedNorm.data, diff.data, w, h, {
      threshold: 0.1,
      alpha: 0.3,
      diffColor: [255, 0, 0],
      diffColorAlt: [0, 128, 255],
    });
    const total = w * h;
    const pageSimilarity = ((1 - numDiff / total) * 100).toFixed(2);

    // Content-only similarity: restrict to pixels that carry ink in either image.
    // Page-level similarity is dominated by shared white background — content
    // similarity is what actually tracks visual fidelity of the drawing.
    const inkStats = computeInkStats(baseline, renderedNorm, w, h);
    const contentSimilarity = inkStats.inkUnion
      ? ((1 - inkStats.diffInInkUnion / inkStats.inkUnion) * 100).toFixed(2)
      : '100.00';

    // Grid similarity: coarse structural match, tolerant of sub-cell shifts.
    // Answers "does the same region of the page have roughly the same amount
    // of ink?" — closer to how a human judges visual similarity.
    const gridSim = gridSimilarity(baseline, renderedNorm, w, h, 40);

    const diffPath = join(outDir, `diff-${String(pageNo).padStart(2, '0')}.png`);
    writeFileSync(diffPath, PNG.sync.write(diff));
    console.log(
      `  Page ${pageNo}: page ${pageSimilarity}% | content ${contentSimilarity}% ` +
        `| grid ${gridSim.toFixed(2)}% ` +
        `| ink baseline=${inkStats.inkBaseline.toLocaleString()} rendered=${inkStats.inkRendered.toLocaleString()}`
    );
    results.push({
      page: pageNo,
      pageSimilarity: Number(pageSimilarity),
      contentSimilarity: Number(contentSimilarity),
      gridSimilarity: Number(gridSim.toFixed(2)),
      numDiffPixels: numDiff,
      totalPixels: total,
      inkBaseline: inkStats.inkBaseline,
      inkRendered: inkStats.inkRendered,
      inkUnion: inkStats.inkUnion,
      diffInInkUnion: inkStats.diffInInkUnion,
      width: w,
      height: h,
      baseline: bName,
      rendered: rName,
      diff: `diff-${String(pageNo).padStart(2, '0')}.png`,
    });
  }

  const scored = results.filter(r => typeof r.pageSimilarity === 'number');
  const avgPage = scored.length ? scored.reduce((s, r) => s + r.pageSimilarity, 0) / scored.length : 0;
  const avgContent = scored.length ? scored.reduce((s, r) => s + r.contentSimilarity, 0) / scored.length : 0;
  const avgGrid = scored.length ? scored.reduce((s, r) => s + r.gridSimilarity, 0) / scored.length : 0;

  const report = {
    htmlPath: resolve(htmlPath),
    pdfPath: resolve(pdfPath),
    dpi: DPI,
    overallPageSimilarity: Number(avgPage.toFixed(2)),
    overallContentSimilarity: Number(avgContent.toFixed(2)),
    overallGridSimilarity: Number(avgGrid.toFixed(2)),
    pageCount,
    results,
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log(`\n─────────────────────────────────────`);
  console.log(`Page similarity:    ${avgPage.toFixed(2)}%  (whole-page pixel match — dominated by white bg)`);
  console.log(`Content similarity: ${avgContent.toFixed(2)}%  (strict pixel match over ink — punishes any shift)`);
  console.log(`Grid similarity:    ${avgGrid.toFixed(2)}%  (40×40 cell density — matches human visual judgment)`);
  console.log(`Report:  ${join(outDir, 'report.json')}`);
  console.log(`Diffs:   ${outDir}/diff-*.png (red = drift)`);
}

// Grid similarity: split each image into N×N cells, compute ink density per
// cell, similarity = 1 - mean(|density_baseline - density_rendered|).
// This is tolerant of sub-cell position shifts, so it tracks "same content in
// roughly the same place" rather than "same pixel exactly."
function gridSimilarity(baseline, rendered, w, h, n) {
  const cellW = w / n;
  const cellH = h / n;
  let totalDiff = 0;
  let cells = 0;
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      const x0 = Math.floor(cx * cellW);
      const y0 = Math.floor(cy * cellH);
      const x1 = Math.min(Math.floor((cx + 1) * cellW), w);
      const y1 = Math.min(Math.floor((cy + 1) * cellH), h);
      let bInk = 0;
      let rInk = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          if (isInk(baseline.data, idx)) bInk++;
          if (isInk(rendered.data, idx)) rInk++;
          total++;
        }
      }
      if (total === 0) continue;
      totalDiff += Math.abs(bInk / total - rInk / total);
      cells++;
    }
  }
  return cells ? (1 - totalDiff / cells) * 100 : 100;
}

// A pixel is "ink" if any RGB channel is meaningfully darker than white.
// Threshold at <250 catches near-white anti-alias but excludes true background.
function isInk(data, idx) {
  return data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250;
}

function computeInkStats(baseline, rendered, w, h) {
  let inkBaseline = 0;
  let inkRendered = 0;
  let inkUnion = 0;
  let diffInInkUnion = 0;
  const b = baseline.data;
  const r = rendered.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const bInk = isInk(b, idx);
      const rInk = isInk(r, idx);
      if (bInk) inkBaseline++;
      if (rInk) inkRendered++;
      if (bInk || rInk) {
        inkUnion++;
        // Consider it a diff if the pixels differ enough that either ink
        // presence differs OR the colors are visibly apart.
        const dr = Math.abs(b[idx] - r[idx]);
        const dg = Math.abs(b[idx + 1] - r[idx + 1]);
        const db = Math.abs(b[idx + 2] - r[idx + 2]);
        if (bInk !== rInk || dr + dg + db > 60) diffInInkUnion++;
      }
    }
  }
  return { inkBaseline, inkRendered, inkUnion, diffInInkUnion };
}

function cleanArtifacts(dir) {
  for (const f of readdirSync(dir)) {
    if (
      (f.startsWith('baseline-') || f.startsWith('rendered-') || f.startsWith('diff-')) &&
      f.endsWith('.png')
    ) {
      unlinkSync(join(dir, f));
    }
    if (f === 'html-rendered.pdf') unlinkSync(join(dir, f));
  }
}

function listPages(dir, prefix) {
  return readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.png')).sort();
}

// Pad or crop `src` PNG onto a white canvas of exact (w × h). This lets us
// compare pages that have slightly different dimensions without stretching.
function normaliseSize(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x < src.width && y < src.height) {
        const s = (y * src.width + x) * 4;
        out.data[idx] = src.data[s];
        out.data[idx + 1] = src.data[s + 1];
        out.data[idx + 2] = src.data[s + 2];
        out.data[idx + 3] = src.data[s + 3];
      } else {
        out.data[idx] = 255;
        out.data[idx + 1] = 255;
        out.data[idx + 2] = 255;
        out.data[idx + 3] = 255;
      }
    }
  }
  return out;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
