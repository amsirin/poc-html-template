// Visual-diff harness (PDFreactor version): render HTML via a running PDFreactor
// Web Service on localhost:9423, then diff vs baseline PDF.
//
// Usage: node tools/visual-diff/diff-pdfreactor.js <html-path> <pdf-path> [out-dir]
//
// Prerequisite: PDFreactor Web Service running locally at http://localhost:9423
// (see README for `docker run realobjects/pdfreactor` command). License is
// mounted into the container from ../.pdfreactor/license.xml.

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { execSync } from 'child_process';
import http from 'http';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from 'fs';
import { join, resolve, dirname } from 'path';
import { URL } from 'url';

const PDFREACTOR_URL = process.env.PDFREACTOR_URL || 'http://localhost:9423';
const DPI = 150;

// Rows to blank at the very top/bottom of both baseline and rendered PNGs.
// Removes PDFreactor eval-license header/footer strips (~17 rows top+bottom)
// AND Exstream demo-watermark top strip (~25 rows). Content margin at 150 DPI
// A4 is ~75 px, so 45 rows leaves a comfortable buffer over real content.
const WATERMARK_TOP_ROWS = 45;
const WATERMARK_BOTTOM_ROWS = 45;

// Node 16 doesn't have global fetch. Use built-in http module directly.
function httpPost(urlStr, body, headers) {
  return new Promise((resolvePromise, rejectPromise) => {
    const u = new URL(urlStr);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolvePromise({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', rejectPromise);
    req.write(body);
    req.end();
  });
}

// Inline all relative <img src="./..."> as base64 data URIs. PDFreactor Docker
// can't read the host filesystem for file:// paths, and mounting the output
// dir per template is fragile; inlining side-steps the whole issue.
function inlineImages(htmlContent, htmlPath) {
  const htmlDir = dirname(resolve(htmlPath));
  return htmlContent.replace(
    /<img([^>]*?)src=["']\.\/([^"']+)["']([^>]*)>/g,
    (match, pre, relPath, post) => {
      const absPath = join(htmlDir, relPath);
      if (!existsSync(absPath)) {
        console.warn(`  WARN: image not found for inlining: ${absPath}`);
        return match;
      }
      const ext = (relPath.split('.').pop() || 'png').toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                 : ext === 'svg' ? 'image/svg+xml'
                 : 'image/png';
      const b64 = readFileSync(absPath).toString('base64');
      return `<img${pre}src="data:${mime};base64,${b64}"${post}>`;
    }
  );
}

async function renderWithPdfreactor(htmlPath) {
  let htmlContent = readFileSync(htmlPath, 'utf8');
  htmlContent = inlineImages(htmlContent, htmlPath);

  const config = {
    document: htmlContent,
    // Keep JS off — our HTML has no runtime JS logic.
    javaScriptSettings: { disabled: true },
  };

  const body = JSON.stringify(config);
  const res = await httpPost(
    `${PDFREACTOR_URL}/service/rest/convert.pdf`,
    body,
    { 'Content-Type': 'application/json', 'Accept': 'application/pdf' }
  );

  if (res.status !== 200) {
    const preview = res.body.toString('utf8').slice(0, 500);
    throw new Error(`PDFreactor error (${res.status}): ${preview}`);
  }
  return res.body;
}

async function main() {
  const [htmlPath, pdfPath, outDir = './tools/visual-diff/output-pdfreactor'] = process.argv.slice(2);
  if (!htmlPath || !pdfPath) {
    console.error('Usage: node tools/visual-diff/diff-pdfreactor.js <html-path> <pdf-path> [out-dir]');
    process.exit(1);
  }
  if (!existsSync(htmlPath)) throw new Error(`HTML not found: ${htmlPath}`);
  if (!existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);

  mkdirSync(outDir, { recursive: true });
  cleanArtifacts(outDir);

  console.log(`\n[1/3] Rasterising baseline PDF @ ${DPI} DPI`);
  execSync(
    `pdftoppm -png -r ${DPI} "${resolve(pdfPath)}" "${join(outDir, 'baseline')}"`,
    { stdio: 'inherit' }
  );
  const baselineFiles = listPages(outDir, 'baseline-');
  console.log(`  → ${baselineFiles.length} page(s)`);

  console.log(`\n[2/3] Rendering HTML via PDFreactor @ ${PDFREACTOR_URL}`);
  const pdfBytes = await renderWithPdfreactor(htmlPath);
  const htmlPdfPath = join(outDir, 'html-rendered.pdf');
  writeFileSync(htmlPdfPath, pdfBytes);
  execSync(
    `pdftoppm -png -r ${DPI} "${htmlPdfPath}" "${join(outDir, 'rendered')}"`,
    { stdio: 'inherit' }
  );
  let renderedFiles = listPages(outDir, 'rendered-');
  console.log(`  → ${renderedFiles.length} page(s)`);

  // PDFreactor evaluation license injects an "Evaluation Version" info page.
  // On single-page HTML it lands at the end; on multi-page HTML it can land
  // mid-document (observed after page 1 on 5-page SI templates). Detect by
  // page-text signature so position doesn't matter.
  const evalPageIndices = detectEvalPages(htmlPdfPath, renderedFiles.length);
  if (evalPageIndices.length) {
    console.log(`  (Dropping ${evalPageIndices.length} PDFreactor eval page(s) at rendered index ${evalPageIndices.map(i => i + 1).join(', ')})`);
    renderedFiles = renderedFiles.filter((_, i) => !evalPageIndices.includes(i));
  }

  console.log(`\n[3/3] Pixel-diffing pages`);
  const pageCount = baselineFiles.length;
  if (renderedFiles.length > pageCount) {
    console.log(`  (Skipping ${renderedFiles.length - pageCount} trailing rendered page(s) beyond baseline)`);
  }
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
    maskWatermarkBands(baseline, w, h);
    maskWatermarkBands(renderedNorm, w, h);
    const diff = new PNG({ width: w, height: h });
    const numDiff = pixelmatch(baseline.data, renderedNorm.data, diff.data, w, h, {
      threshold: 0.1,
      alpha: 0.3,
      diffColor: [255, 0, 0],
      diffColorAlt: [0, 128, 255],
    });
    const total = w * h;
    const pageSimilarity = ((1 - numDiff / total) * 100).toFixed(2);
    const inkStats = computeInkStats(baseline, renderedNorm, w, h);
    const contentSimilarity = inkStats.inkUnion
      ? ((1 - inkStats.diffInInkUnion / inkStats.inkUnion) * 100).toFixed(2)
      : '100.00';
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
    engine: 'pdfreactor',
    pdfreactorUrl: PDFREACTOR_URL,
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
  console.log(`Engine:             PDFreactor`);
  console.log(`Page similarity:    ${avgPage.toFixed(2)}%  (whole-page pixel match — dominated by white bg)`);
  console.log(`Content similarity: ${avgContent.toFixed(2)}%  (strict pixel match over ink — punishes any shift)`);
  console.log(`Grid similarity:    ${avgGrid.toFixed(2)}%  (40×40 cell density — matches human visual judgment)`);
  console.log(`Report:  ${join(outDir, 'report.json')}`);
  console.log(`Diffs:   ${outDir}/diff-*.png (red = drift)`);
}

// (identical helpers below — kept in-file so this script has no local deps)

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

function isInk(data, idx) {
  return data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250;
}

function computeInkStats(baseline, rendered, w, h) {
  let inkBaseline = 0, inkRendered = 0, inkUnion = 0, diffInInkUnion = 0;
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

// Paint the top/bottom watermark bands white on a PNG in place. Removes
// PDFreactor eval-license header/footer strips (rendered) and Exstream
// demo-watermark top strip (baseline) so they don't contribute to ink stats
// or pixel diff.
function maskWatermarkBands(png, w, h) {
  const data = png.data;
  const topCap = Math.min(WATERMARK_TOP_ROWS, h);
  for (let y = 0; y < topCap; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  const bottomStart = Math.max(0, h - WATERMARK_BOTTOM_ROWS);
  for (let y = bottomStart; y < h; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
}

// Return the zero-based rendered-page indices that are the PDFreactor
// evaluation-license info page. Detected by the marketing body text.
function detectEvalPages(pdfPath, expectedPages) {
  const evalSignature = 'PDF document was created by an evaluation version';
  const indices = [];
  for (let i = 1; i <= expectedPages; i++) {
    let text;
    try {
      text = execSync(`pdftotext -f ${i} -l ${i} "${pdfPath}" -`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      continue;
    }
    if (text.includes(evalSignature)) indices.push(i - 1);
  }
  return indices;
}

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
