// DXF XML inspector — prints structure summary so a dev can understand what's
// in a template before hand-authoring the semantic HTML.
//
// Usage: node src/dxf-inspect.js ../DXF/APP_LTPOSZLBNCHG001.dxf
//
// Prints:
//   - Template basic (name, description, folder)
//   - Variable declarations (data placeholders) — grouped by folder
//   - fo:block hierarchy summary (rough content outline)
//   - Any dxf:condition rule expressions (business logic)
//
// This is a READ-ONLY diagnostic. It does not emit HTML. Use it to plan the
// template structure and identify the placeholder set for the .sample.json.

import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

const dxfPath = process.argv[2];
if (!dxfPath) {
  console.error('Usage: node src/dxf-inspect.js <dxf-path>');
  process.exit(1);
}

const xml = readFileSync(dxfPath, 'utf-8');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  preserveOrder: false,
  removeNSPrefix: false,
});

const doc = parser.parse(xml);
const app = doc['dlg:application'];
if (!app) {
  console.error('Not a valid Exstream DXF — missing <dlg:application> root');
  process.exit(1);
}

// --- Basic template info ---
const basic = app['dlg:basic'];
console.log('=== Template basic ===');
if (basic) {
  console.log(`  Name:        ${basic['dlg:name'] ?? '(unknown)'}`);
  console.log(`  Description: ${basic['dlg:description'] ?? '(none)'}`);
  console.log(`  Folder:      ${basic['@_folder'] ?? '(unknown)'}`);
  console.log(`  OID:         ${basic['@_oid'] ?? '(unknown)'}`);
}

// --- Variables (data placeholders) ---
const decls = app['fo:declarations'];
const varsWrapper = decls?.['dlg:variables'];
const varList = varsWrapper?.['dlg:variable'] ?? [];
const vars = Array.isArray(varList) ? varList : [varList].filter(Boolean);

const byFolder = new Map();
for (const v of vars) {
  const vBasic = v['dlg:basic'];
  if (!vBasic) continue;
  const name = vBasic['dlg:name'] ?? '(anon)';
  const folder = vBasic['@_folder'] ?? '(root)';
  const display = v['@_display-string'] ?? '';
  const dataType = v['@_data-type'] ?? 'string';
  if (!byFolder.has(folder)) byFolder.set(folder, []);
  byFolder.get(folder).push({ name, display, dataType });
}

console.log(`\n=== Variables (${vars.length} total) ===`);
for (const [folder, list] of byFolder) {
  console.log(`\n  [${folder}]  (${list.length})`);
  for (const v of list) {
    const preview = v.display ? `  ← "${v.display}"` : '';
    console.log(`    ${v.name}  (${v.dataType})${preview}`);
  }
}

// --- Structural summary ---
// Count top-level fo:block / fo:table / dlg:section etc. across the doc.
// A rough content outline for the dev.
function walkCount(node, counts) {
  if (Array.isArray(node)) {
    for (const n of node) walkCount(n, counts);
    return;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_') || key === '#text') continue;
      counts[key] = (counts[key] ?? 0) + 1;
      walkCount(node[key], counts);
    }
  }
}

const counts = {};
walkCount(app, counts);
const interesting = [
  'fo:page-sequence', 'fo:flow', 'fo:block', 'fo:table', 'fo:table-row',
  'fo:table-cell', 'fo:external-graphic', 'fo:list-block', 'fo:list-item',
  'dxf:section', 'dxf:content', 'dxf:condition', 'dxf:rule',
  'dlg:paragraph', 'dlg:frame', 'dlg:paragraph-block',
];
console.log('\n=== Element counts (formatting + structure) ===');
for (const k of interesting) {
  if (counts[k]) console.log(`  ${k.padEnd(30)} ${counts[k]}`);
}
console.log('\n  All element kinds (top 30):');
const all = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [k, n] of all) {
  console.log(`    ${k.padEnd(40)} ${n}`);
}

console.log('\nDone.  Use the variable list above to design your data-samples/*.sample.json,');
console.log('and use the element counts to gauge template complexity before authoring.');
