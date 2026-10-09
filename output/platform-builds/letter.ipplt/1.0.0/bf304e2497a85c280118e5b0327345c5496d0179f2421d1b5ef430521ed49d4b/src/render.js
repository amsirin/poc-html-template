// render.js — merge Handlebars template + data → self-contained HTML.
//
// Usage:  node src/render.js <template.hbs> <data.json> [--out <path>]
//
// The AUTHORING template references external CSS/fonts/images by relative path
// (small, readable). This script INLINES all those resources into the output
// HTML so PDFreactor (running in Docker) receives a fully self-contained doc.
//
// What gets inlined:
//   - <link rel="stylesheet" href="..."> → <style> block
//   - <img src="..."> (relative) → data URI (svg/png/jpg)
//   - CSS url(...) references (fonts, background images) → data URI
//
// Also loads partials from ../components/*.hbs and registers Handlebars helpers.

import Handlebars from 'handlebars';
import bwipjs from 'bwip-js';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- CLI parse ---
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node src/render.js <template.hbs> <data.json> [--out <path>]');
  process.exit(1);
}
const templatePath = resolve(args[0]);
const dataPath = resolve(args[1]);
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0
  ? resolve(args[outIdx + 1])
  : join(ROOT, 'output', basename(templatePath, '.hbs') + '.html');

// --- Handlebars setup ---
const partialsDir = join(ROOT, 'components');
if (existsSync(partialsDir)) {
  for (const f of readdirSync(partialsDir)) {
    if (extname(f) !== '.hbs') continue;
    const name = basename(f, '.hbs');
    Handlebars.registerPartial(name, readFileSync(join(partialsDir, f), 'utf-8'));
  }
}

Handlebars.registerHelper('formatPercent', (n) => {
  const num = Number(n);
  return Number.isNaN(num) ? String(n ?? '') : num.toFixed(2);
});
Handlebars.registerHelper('formatCurrency', (n) => {
  const num = Number(n);
  return Number.isNaN(num) ? String(n ?? '')
    : num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});
Handlebars.registerHelper('eq', function (a, b, options) {
  if (a === b) return options.fn(this);
  return options.inverse ? options.inverse(this) : '';
});

// Barcode helper — {{{barcode value [bcid=code39]}}} → inline SVG.
// TRIPLE-STASH `{{{ }}}` required so SVG isn't HTML-escaped.
// Default is Code 39 (star-delimited, alphanumeric). Override via hash args:
//   {{{barcode value bcid="code128" height=12 scale=2}}}
Handlebars.registerHelper('barcode', function (value, options) {
  const hash = (options && options.hash) || {};
  const opts = {
    bcid: hash.bcid || 'code39',
    text: String(value),
    scale: hash.scale ?? 3,
    height: hash.height ?? 10,
    includetext: hash.includetext ?? false,
    textxalign: hash.textxalign || 'center',
  };
  try {
    let svg = bwipjs.toSVG(opts);
    // Letter barcodes use a shared physical box. Default SVG aspect fitting
    // would shrink the bars vertically when the encoded value gets longer.
    // Opt in only for this component; other barcode/QR helpers keep their ratio.
    if (hash.fit === 'box') svg = svg.replace('<svg ', '<svg preserveAspectRatio="none" ');
    return new Handlebars.SafeString(svg);
  } catch (err) {
    console.warn(`  WARN: barcode generation failed for "${value}": ${err.message}`);
    return new Handlebars.SafeString(`<!-- barcode error: ${err.message} -->`);
  }
});

// --- Resource inlining helpers ---
function mimeFor(ext) {
  ext = ext.toLowerCase().replace(/^\./, '');
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'ttf') return 'font/ttf';
  if (ext === 'otf') return 'font/otf';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function toDataUri(absPath) {
  const ext = extname(absPath);
  const mime = mimeFor(ext);
  if (mime === 'image/svg+xml') {
    // SVG can inline as UTF-8 for smaller output + no encoding cost
    const svg = readFileSync(absPath, 'utf-8').replace(/[\r\n\t]+/g, ' ');
    return `data:${mime};utf8,${encodeURIComponent(svg)}`;
  }
  const b64 = readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

// Inline url(...) references inside a CSS string
function inlineCssUrls(cssText, cssBaseDir) {
  return cssText.replace(
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/g,
    (match, urlRef) => {
      if (urlRef.startsWith('data:') || urlRef.startsWith('http')) return match;
      const absPath = resolve(cssBaseDir, urlRef);
      if (!existsSync(absPath)) {
        console.warn(`  WARN: CSS url not found: ${absPath}`);
        return match;
      }
      return `url('${toDataUri(absPath)}')`;
    }
  );
}

// Inline <link rel="stylesheet" href="...relative..."> into <style> blocks,
// with url(...) inside the CSS also inlined.
function inlineCssLinks(html, htmlBaseDir) {
  return html.replace(
    /<link\s+([^>]*?)rel=["']stylesheet["']([^>]*?)>/gi,
    (match, pre, post) => {
      const attrs = pre + post;
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
      if (!hrefMatch) return match;
      const href = hrefMatch[1];
      if (href.startsWith('http') || href.startsWith('data:')) return match;
      const absPath = resolve(htmlBaseDir, href);
      if (!existsSync(absPath)) {
        console.warn(`  WARN: CSS link not found: ${absPath}`);
        return match;
      }
      const cssBaseDir = dirname(absPath);
      let css = readFileSync(absPath, 'utf-8');
      css = inlineCssUrls(css, cssBaseDir);
      return `<style>\n/* inlined from ${href} */\n${css}\n</style>`;
    }
  );
}

// Inline <img src="...relative...">
function inlineImgSrcs(html, htmlBaseDir) {
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/g,
    (match, pre, src, post) => {
      if (src.startsWith('http') || src.startsWith('data:')) return match;
      const absPath = resolve(htmlBaseDir, src);
      if (!existsSync(absPath)) {
        console.warn(`  WARN: image not found: ${absPath}`);
        return match;
      }
      return `<img${pre}src="${toDataUri(absPath)}"${post}>`;
    }
  );
}

// --- Compile + render + inline ---
const templateSrc = readFileSync(templatePath, 'utf-8');
const template = Handlebars.compile(templateSrc, { noEscape: false, strict: args.includes('--strict') });
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

let html = template(data);

// Resolve resource base — templates reference `../styles/...` and
// `../assets/...` — those `..` are relative to the templates/ dir.
const htmlBaseDir = dirname(templatePath);
html = inlineCssLinks(html, htmlBaseDir);
html = inlineImgSrcs(html, htmlBaseDir);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf-8');

// --- Report ---
const lineCount = html.split('\n').length;
console.log(`Rendered:  ${outPath}`);
console.log(`Size:      ${(html.length / 1024).toFixed(1)} KB   (${lineCount} lines with inlined assets)`);
console.log(`Template:  ${basename(templatePath)}  (${templateSrc.split('\n').length} lines source)`);
console.log(`Data:      ${basename(dataPath)}`);
console.log('');
console.log('Next: node tools/visual-diff/diff-pdfreactor.js \\');
console.log(`         ${outPath} \\`);
console.log(`         baselines/<matching-baseline>.pdf \\`);
console.log(`         output/<slug>-diff`);
