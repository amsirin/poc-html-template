// Developer-facing preview runtime. Production publication/routing is not implemented.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, copyFileSync } from 'fs';
import { resolve, dirname, relative, isAbsolute } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { isDeepStrictEqual } from 'util';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function projectFile(path, root = ROOT) {
  check(typeof path === 'string' && path.length > 0 && !isAbsolute(path), 'Expected a project-relative file path');
  const file = resolve(root, path);
  const rel = relative(root, file);
  check(rel && !rel.startsWith('..') && !isAbsolute(rel), `Path escapes project: ${path}`);
  check(existsSync(file), `Missing file: ${path}`);
  const real = relative(realpathSync(root), realpathSync(file));
  check(real && !real.startsWith('..') && !isAbsolute(real), `Symlink escapes project: ${path}`);
  return file;
}

export function catalog(root = ROOT) { return readJson(projectFile('platform/catalog.json', root)); }

export function loadPackage(selector, root = ROOT) {
  const registry = catalog(root);
  const path = registry.templates[selector] || selector;
  const manifest = readJson(projectFile(path, root));
  const allowed = ['schemaVersion', 'id', 'version', 'group', 'mode', 'status', 'owner', 'entry', 'overrides', 'dependencies', 'fixtures', 'evidence', 'assembly', 'notes'];
  for (const key of Object.keys(manifest)) check(allowed.includes(key), `Unknown manifest key: ${key}`);
  check(manifest.schemaVersion === 'ccm.template/1.0', 'Unsupported template schemaVersion');
  check(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(manifest.id), 'Invalid template id');
  check(/^\d+\.\d+\.\d+$/.test(manifest.version), 'Use an exact semantic version');
  check(['draft', 'review', 'approved', 'retired'].includes(manifest.status), 'Invalid lifecycle status');
  check(typeof manifest.owner === 'string' && manifest.owner.length > 0, 'Template owner is required');
  check(Object.hasOwn ? Object.hasOwn(registry.groups, manifest.group) : Object.prototype.hasOwnProperty.call(registry.groups, manifest.group), 'Unknown document group');
  const group = readJson(projectFile(registry.groups[manifest.group], root));
  check(manifest.id.startsWith(`${group.id}.`), 'Template id must belong to its group');
  check(manifest.mode === group.mode, 'Template mode does not match group');
  return { root, path, manifest, group, registry };
}

export function resolveDependencies(pkg) {
  const result = new Map(); const visiting = new Set();
  function visit(id) {
    check(typeof id === 'string' && /^[a-z0-9-]+@\d+\.\d+\.\d+$/.test(id), `Dependency must be exactly versioned: ${id}`);
    check(!visiting.has(id), `Dependency cycle: ${id}`);
    if (result.has(id)) return;
    const entry = pkg.registry.entries[id];
    check(entry && Array.isArray(entry.files) && Array.isArray(entry.dependsOn), `Unregistered dependency: ${id}`);
    visiting.add(id); for (const child of entry.dependsOn) visit(child); visiting.delete(id);
    for (const file of entry.files) projectFile(file, pkg.root);
    result.set(id, entry);
  }
  const deps = pkg.manifest.dependencies;
  check(deps && typeof deps === 'object', 'Missing dependencies');
  for (const key of Object.keys(deps)) check(['renderer', 'contract', 'rules', 'preparer', 'layout', 'components', 'brand', 'formatters'].includes(key), `Unknown dependency kind: ${key}`);
  check(deps.renderer === 'handlebars-pdfreactor@1.0.0', 'This preview supports only the registered Handlebars/PDFreactor renderer');
  for (const kind of ['renderer', 'contract', 'rules', 'preparer', 'layout', 'components', 'brand']) {
    visit(deps[kind]); check(result.get(deps[kind]).kind === kind, `Wrong dependency kind for ${kind}`);
  }
  check(Array.isArray(deps.formatters), 'formatters must be an array');
  for (const id of deps.formatters) { visit(id); check(result.get(id).kind === 'formatter', `Not a formatter: ${id}`); }
  // A selected presentation module must be wired to the selected rules/contract/formatters.
  const closure = new Set();
  function collect(id) { if (closure.has(id)) return; closure.add(id); for (const child of result.get(id).dependsOn) collect(child); }
  collect(deps.preparer);
  for (const id of [deps.contract, deps.rules, ...deps.formatters]) check(closure.has(id), `Preparer does not depend on selected ${id}`);
  check(pkg.group.allowedProfiles.includes(deps.layout), `Layout is not enabled for ${pkg.group.id}`);
  return result;
}

async function plugin(pkg, dependencies, kind) {
  const entry = dependencies.get(pkg.manifest.dependencies[kind]);
  check(entry.module && entry.files.includes(entry.module), `Missing registered module for ${kind}`);
  const module = await import(pathToFileURL(projectFile(entry.module, pkg.root)).href);
  check(typeof module[entry.export] === 'function', `Missing export for ${kind}`);
  return module[entry.export];
}

export async function validatePackage(selector, root = ROOT) {
  const pkg = loadPackage(selector, root);
  check(pkg.manifest.mode === 'compose', 'Assembly execution is not implemented in this preview; see the Policy Pack blueprint');
  const dependencies = resolveDependencies(pkg);
  const entry = projectFile(pkg.manifest.entry, root);
  check(entry.endsWith('.hbs'), 'Composition entry must be a Handlebars template');
  check(!/<script\b/i.test(readFileSync(entry, 'utf8')), 'Document JavaScript is not allowed');
  check(Array.isArray(pkg.manifest.overrides), 'overrides must be an array');
  for (const file of pkg.manifest.overrides) projectFile(file, root);
  const evidence = readJson(projectFile(pkg.manifest.evidence, root));
  check(['migration', 'new'].includes(evidence.origin), 'Evidence origin must be migration or new');
  const fixtures = pkg.manifest.fixtures;
  check(fixtures && Object.keys(fixtures).length > 0, 'At least one fixture is required');
  check(Array.isArray(evidence.requiredFixtureCases) && evidence.requiredFixtureCases.length > 0, 'Required fixture cases must be declared');
  for (const name of evidence.requiredFixtureCases) check(Object.prototype.hasOwnProperty.call(fixtures, name), `Missing required fixture: ${name}`);
  const validate = await plugin(pkg, dependencies, 'contract');
  const prepare = await plugin(pkg, dependencies, 'preparer');
  const decide = await plugin(pkg, dependencies, 'rules');
  for (const [name, path] of Object.entries(fixtures)) {
    check(/^[a-z0-9-]+$/.test(name), 'Invalid fixture name');
    const data = readJson(projectFile(path, root)); validate(data);
    const vm = prepare(data);
    check(isDeepStrictEqual(vm.flags, decide(data)), `Rule wiring mismatch in fixture ${name}`);
  }
  const result = { ...pkg, dependencies, evidence, validate, prepare };
  const files = new Set(dependencyFiles(result));
  const template = readFileSync(entry, 'utf8');
  const linkedStyles = new Set([...template.matchAll(/<link\b[^>]*href=["']([^"']+)["']/g)].map(([, path]) => relative(root, resolve(dirname(entry), path))));
  for (const path of [...dependencies.get(pkg.manifest.dependencies.layout).files,
    ...dependencies.get(pkg.manifest.dependencies.brand).files, ...pkg.manifest.overrides].filter(path => path.endsWith('.css'))) {
    check(linkedStyles.has(path), `Declared style is not linked by the entry: ${path}`);
  }
  for (const path of linkedStyles) check(files.has(path), `Undeclared stylesheet: ${path}`);
  for (const path of files) {
    if (!path.endsWith('.css')) continue;
    const css = readFileSync(projectFile(path, root), 'utf8');
    for (const [, resource] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      if (resource.startsWith('data:')) continue;
      check(!/^[a-z]+:/i.test(resource), `External CSS resource: ${resource}`);
      check(files.has(relative(root, resolve(dirname(resolve(root, path)), resource))), `Undeclared CSS resource: ${resource}`);
    }
  }
  return result;
}

export function releaseReadiness(pkg) {
  const e = pkg.evidence; const blockers = [];
  if (pkg.manifest.status !== 'approved') blockers.push('Package is not approved');
  if (e.origin === 'migration' && e.matchingInputBaseline !== true) blockers.push('Matching-input source baseline acceptance is missing');
  if (e.origin === 'new' && e.specificationExpectedOutputs !== true) blockers.push('Specification-based expected outputs are missing');
  for (const key of ['rulesBusinessApproved', 'visualApproved', 'operationalApproved']) if (e[key] !== true) blockers.push(`${key} is missing`);
  check(Array.isArray(e.openIssues), 'Evidence openIssues must be an array');
  blockers.push(...e.openIssues);
  return { publishImplemented: false, localEvidenceReady: blockers.length === 0, blockers,
    note: 'Local readiness report only; authenticated approvals and a production publisher are not implemented.' };
}

export function affectedTemplates(reference, root = ROOT) {
  const registry = catalog(root);
  const result = [];
  for (const selector of Object.keys(registry.templates)) {
    const pkg = loadPackage(selector, root); const deps = resolveDependencies(pkg);
    if (deps.has(reference) || [...deps.values()].some(entry => entry.files.includes(reference)) ||
        pkg.manifest.entry === reference || pkg.manifest.overrides.includes(reference)) {
      result.push({ template: selector, fixtures: Object.keys(pkg.manifest.fixtures) });
    }
  }
  return result;
}

function dependencyFiles(pkg) {
  const files = new Set(['platform/catalog.json', 'platform/cli.js', 'platform/runtime/index.js', pkg.path,
    pkg.manifest.entry, pkg.manifest.evidence, ...pkg.manifest.overrides,
    ...Object.values(pkg.manifest.fixtures), ...Object.values(pkg.registry.groups)]);
  for (const entry of pkg.dependencies.values()) for (const file of entry.files) files.add(file);
  for (const key of ['sourceMapping', 'sourceAudit']) if (pkg.evidence[key]) files.add(pkg.evidence[key]);
  // Explicit declarations must include local JS imports. This is a static check
  // for this preview's ESM syntax, not a general-purpose bundler/parser.
  for (const file of files) {
    const full = projectFile(file, pkg.root);
    if (!file.endsWith('.js')) continue;
    const source = readFileSync(full, 'utf8');
    for (const [, specifier] of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
      const dependency = relative(pkg.root, resolve(dirname(full), specifier));
      check(files.has(dependency), `Undeclared local import: ${file} -> ${dependency}`);
    }
  }
  return [...files].sort();
}

export function createLock(pkg) {
  const files = Object.fromEntries(dependencyFiles(pkg).map(path => [path, hash(readFileSync(projectFile(path, pkg.root)))]));
  const lock = { schemaVersion: 'ccm.preview-lock/1.0', purpose: 'preview-only', template: `${pkg.manifest.id}@${pkg.manifest.version}`,
    manifest: pkg.path, dependencies: [...pkg.dependencies.keys()].sort(), files };
  return { ...lock, digest: hash(JSON.stringify(lock)) };
}

export async function buildPreview(selector, root = ROOT) {
  const pkg = await validatePackage(selector, root); const lock = createLock(pkg);
  const target = resolve(root, 'output/platform-builds', pkg.manifest.id, pkg.manifest.version, lock.digest);
  if (existsSync(target)) { verifyPreview(target); return { target, digest: lock.digest, reused: true }; }
  mkdirSync(target, { recursive: true });
  for (const file of Object.keys(lock.files)) {
    const dest = resolve(target, file); mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(projectFile(file, root), dest);
  }
  writeJson(resolve(target, 'platform.lock.json'), lock);
  verifyPreview(target);
  return { target, digest: lock.digest, reused: false };
}

export function verifyPreview(root) {
  const lock = readJson(resolve(root, 'platform.lock.json'));
  const { digest, ...payload } = lock;
  check(lock.schemaVersion === 'ccm.preview-lock/1.0' && lock.purpose === 'preview-only', 'Unsupported preview lock');
  check(digest === hash(JSON.stringify(payload)), 'Preview lock digest mismatch');
  for (const [file, expected] of Object.entries(lock.files)) check(hash(readFileSync(projectFile(file, root))) === expected, `Preview file changed: ${file}`);
  return lock;
}

export async function renderPreview(selector, fixture = 'single', pdf = false, root = ROOT) {
  const lock = existsSync(resolve(root, 'platform.lock.json')) ? verifyPreview(root) : null;
  const pkg = await validatePackage(selector, root);
  check(Object.prototype.hasOwnProperty.call(pkg.manifest.fixtures, fixture), `Unknown fixture: ${fixture}`);
  const input = readJson(projectFile(pkg.manifest.fixtures[fixture], root));
  const out = resolve(root, 'output/platform', pkg.manifest.id, pkg.manifest.version, fixture);
  mkdirSync(out, { recursive: true });
  const model = pkg.prepare(input);
  writeJson(resolve(out, 'view-model.json'), model);
  execFileSync(process.execPath, [projectFile('src/render.js', root), projectFile(pkg.manifest.entry, root),
    resolve(out, 'view-model.json'), '--out', resolve(out, 'document.html'), '--strict'], { stdio: 'pipe' });
  const html = readFileSync(resolve(out, 'document.html'), 'utf8');
  check(!/<script\b/i.test(html), 'Preview emitted document JavaScript');
  check(!/<link\b[^>]*rel=["']stylesheet/i.test(html), 'Stylesheet was not embedded');
  for (const [, resource] of html.matchAll(/\bsrc=["']([^"']+)["']/g)) check(resource.startsWith('data:'), 'Image resource was not embedded');
  const finalLock = createLock(pkg);
  if (lock) check(finalLock.digest === lock.digest, 'Bundle differs from its lock');
  if (pdf) execFileSync(process.execPath, [projectFile('src/html-to-pdf.js', root), resolve(out, 'document.html'), resolve(out, 'document.pdf')], { stdio: 'inherit' });
  writeJson(resolve(out, 'trace.json'), { template: `${pkg.manifest.id}@${pkg.manifest.version}`, mode: 'preview', fixture,
    inputSha256: hash(JSON.stringify(input)), dependencyDigest: finalLock.digest,
    nodeVersion: process.version, htmlSha256: hash(html), documentJavaScriptDisabled: true,
    decisions: model.ruleTrace, releaseReadiness: releaseReadiness(pkg),
    pdfSha256: pdf ? hash(readFileSync(resolve(out, 'document.pdf'))) : null });
  return { out, html: resolve(out, 'document.html'), pdf: pdf ? resolve(out, 'document.pdf') : null };
}

export function scaffold(groupId, slug, root = ROOT) {
  check(/^[a-z][a-z0-9-]*$/.test(slug), 'Use a lowercase slug');
  const registry = catalog(root); check(Object.prototype.hasOwnProperty.call(registry.groups, groupId), 'Unknown group');
  const group = readJson(projectFile(registry.groups[groupId], root));
  const target = resolve(root, 'output/platform-drafts', groupId, slug, '0.1.0');
  check(!existsSync(target), 'Draft already exists; refusing to overwrite');
  mkdirSync(target, { recursive: true });
  const path = name => relative(root, resolve(target, name));
  writeJson(resolve(target, 'manifest.json'), { schemaVersion: 'ccm.template/1.0', id: `${groupId}.${slug}`, version: '0.1.0',
    group: groupId, mode: group.mode, status: 'draft', owner: 'template-development',
    entry: group.mode === 'compose' ? path('template.hbs') : null, overrides: [],
    dependencies: { renderer: 'handlebars-pdfreactor@1.0.0', contract: null, rules: null, preparer: null,
      layout: group.allowedProfiles[0] || null, components: null, brand: null, formatters: [] },
    fixtures: {}, evidence: path('evidence.json'), assembly: group.mode === 'assemble' ? path('assembly.json') : null,
    notes: 'Draft scaffold only. Register reviewed dependencies and fixtures before validation/rendering.' });
  writeJson(resolve(target, 'evidence.json'), { origin: 'new', specificationExpectedOutputs: false,
    rulesBusinessApproved: false, visualApproved: false, operationalApproved: false,
    requiredFixtureCases: ['normal', 'boundary', 'overflow'], openIssues: ['Define domain contract, content, rules, profile and expected outputs.'] });
  if (group.mode === 'assemble') writeJson(resolve(target, 'assembly.json'), { schemaVersion: 'ccm.assembly/1.0', parts: [],
    missingRequiredPart: 'fail', numbering: 'must-be-specified', duplex: 'must-be-specified' });
  else writeFileSync(resolve(target, 'template.hbs'), '<!doctype html>\n<html lang="th"><head><meta charset="utf-8"><title>{{subject}}</title></head><body>{{! Compose approved components here. }}</body></html>\n');
  return { target, manifest: path('manifest.json'), capabilitiesToImplement: group.requiredCapabilities };
}
