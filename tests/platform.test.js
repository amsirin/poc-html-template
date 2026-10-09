import assert from 'assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { execFileSync } from 'child_process';
import { ROOT, catalog, loadPackage, resolveDependencies, validatePackage, releaseReadiness,
  createLock, buildPreview, verifyPreview, renderPreview, scaffold, affectedTemplates, projectFile } from '../platform/runtime/index.js';

const selector = 'letter.ipplt@1.0.0';
const tmp = mkdtempSync(resolve(ROOT, 'output/platform-tests-'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2));
let passed = 0;
async function test(name, check) { await check(); passed++; console.log(`PASS ${name}`); }
let testTemplate;
try {
  await test('catalog exposes four distinct groups and validates five IPPLT fixtures', async () => {
    assert.deepEqual(Object.keys(catalog().groups), ['letter', 'si', 'application-form', 'policy-pack']);
    const pkg = await validatePackage(selector);
    assert.equal(Object.keys(pkg.manifest.fixtures).length, 5);
    assert.equal(pkg.dependencies.size, 8);
  });
  await test('dependencies reject version ranges, wrong kinds and cycles', () => {
    let pkg = loadPackage(selector); pkg.manifest.dependencies.rules = 'ipplt-rules@latest';
    assert.throws(() => resolveDependencies(pkg), /exactly versioned/);
    pkg = loadPackage(selector); pkg.manifest.dependencies.contract = 'ipplt-rules@1.0.0';
    assert.throws(() => resolveDependencies(pkg), /Wrong dependency kind/);
    pkg = loadPackage(selector); pkg.registry.entries['ipplt-input@1.0.0'].dependsOn = ['ipplt-rules@1.0.0'];
    assert.throws(() => resolveDependencies(pkg), /cycle/);
  });
  await test('group rejects an unapproved layout and undeclared dependency keys', () => {
    let pkg = loadPackage(selector); pkg.group.allowedProfiles = [];
    assert.throws(() => resolveDependencies(pkg), /not enabled/);
    pkg = loadPackage(selector); pkg.manifest.dependencies.randomCode = 'anything';
    assert.throws(() => resolveDependencies(pkg), /Unknown dependency kind/);
  });
  await test('manifest rejects unknown keys and files cannot escape project', () => {
    const manifest = loadPackage(selector).manifest; manifest.misspelledProperty = true;
    const path = resolve(tmp, 'invalid.json'); writeJson(path, manifest);
    assert.throws(() => loadPackage(relative(ROOT, path)), /Unknown manifest key/);
    assert.throws(() => projectFile('../package.json'), /escapes project/);
    assert.throws(() => projectFile('/etc/passwd'), /project-relative/);
  });
  await test('migration readiness does not treat synthetic parity as source acceptance', async () => {
    const pkg = await validatePackage(selector); const report = releaseReadiness(pkg);
    assert.equal(report.publishImplemented, false); assert.equal(report.localEvidenceReady, false);
    assert.ok(report.blockers.some(message => message.includes('Matching-input')));
    pkg.evidence.origin = 'new'; pkg.evidence.specificationExpectedOutputs = false;
    const native = releaseReadiness(pkg);
    assert.ok(native.blockers.some(message => message.includes('Specification-based')));
    assert.ok(!native.blockers.some(message => message.includes('Matching-input')));
  });
  await test('dependency impact includes all fixture cases of consuming packages', () => {
    const result = affectedTemplates('styles/letter-address.css');
    assert.deepEqual(result.map(item => item.template), [selector]);
    assert.equal(result[0].fixtures.length, 5);
  });
  await test('preview lock is deterministic and includes fonts, assets and executable rules', async () => {
    const pkg = await validatePackage(selector); const a = createLock(pkg); const b = createLock(pkg);
    assert.equal(a.digest, b.digest);
    for (const path of ['fonts/NotoSansThai-Regular.ttf', 'assets/pos-zlbnchg/header-banner.png', 'src/ipplt/rules.js', 'src/shared/formatters.js']) assert.ok(a.files[path]);
  });
  await test('built snapshot verifies and detects modified dependency bytes', async () => {
    const built = await buildPreview(selector); const lock = verifyPreview(built.target);
    const copy = resolve(tmp, 'bundle'); mkdirSync(copy);
    for (const path of [...Object.keys(lock.files), 'platform.lock.json']) {
      mkdirSync(dirname(resolve(copy, path)), { recursive: true });
      copyFileSync(resolve(built.target, path), resolve(copy, path));
    }
    assert.equal(verifyPreview(copy).digest, built.digest);
    writeFileSync(resolve(copy, 'styles/letter-address.css'), 'tampered');
    assert.throws(() => verifyPreview(copy), /Preview file changed/);
  });
  await test('config-driven HTML matches the native IPPLT example path for all five cases', async () => {
    // Generate expectations through the existing public example command so this
    // test also works in a checkout without saved output/ artifacts.
    execFileSync(process.execPath, [resolve(ROOT, 'src/ipplt/run-example.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, [resolve(ROOT, 'src/ipplt/run-example.js'), 'many-rows'], { stdio: 'pipe' });
    for (const fixture of ['single', 'multiple', 'no-refund', 'loan', 'many-rows']) {
      const output = await renderPreview(selector, fixture);
      assert.equal(readFileSync(output.html, 'utf8'), readFileSync(resolve(ROOT, `output/ipplt/${fixture}.html`), 'utf8'));
      const trace = JSON.parse(readFileSync(resolve(output.out, 'trace.json'), 'utf8'));
      assert.equal(trace.documentJavaScriptDisabled, true);
      assert.equal(trace.releaseReadiness.localEvidenceReady, false);
    }
  });
  await test('strict rendering fails missing bindings instead of silently printing blank', async () => {
    testTemplate = resolve(ROOT, `templates/.platform-test-${process.pid}.hbs`);
    writeFileSync(testTemplate, readFileSync(resolve(ROOT, 'templates/ipplt.hbs'), 'utf8') + '{{missingRequiredBinding}}');
    const manifest = loadPackage(selector).manifest; manifest.entry = relative(ROOT, testTemplate);
    const path = resolve(tmp, 'missing-binding.json'); writeJson(path, manifest);
    await assert.rejects(renderPreview(relative(ROOT, path)), /Command failed/);
  });
  await test('new-template scaffold supports all groups without pretending drafts are runnable', async () => {
    const fakeRoot = resolve(tmp, 'scaffold-project'); mkdirSync(resolve(fakeRoot, 'platform/groups'), { recursive: true });
    copyFileSync(resolve(ROOT, 'platform/catalog.json'), resolve(fakeRoot, 'platform/catalog.json'));
    for (const group of Object.keys(catalog().groups)) {
      copyFileSync(resolve(ROOT, `platform/groups/${group}.json`), resolve(fakeRoot, `platform/groups/${group}.json`));
      const created = scaffold(group, 'new-document', fakeRoot);
      const pkg = loadPackage(created.manifest, fakeRoot);
      assert.equal(pkg.manifest.status, 'draft'); assert.equal(pkg.manifest.dependencies.contract, null);
      assert.equal(pkg.manifest.mode, group === 'policy-pack' ? 'assemble' : 'compose');
      assert.throws(() => scaffold(group, 'new-document', fakeRoot), /refusing to overwrite/);
      await assert.rejects(validatePackage(created.manifest, fakeRoot));
      if (group === 'letter') {
        const registry = catalog(fakeRoot);
        registry.templates['letter.wrong-document@0.1.0'] = created.manifest;
        writeJson(resolve(fakeRoot, 'platform/catalog.json'), registry);
        assert.throws(() => loadPackage('letter.wrong-document@0.1.0', fakeRoot), /does not match package identity/);
      }
    }
    assert.throws(() => scaffold('letter', '../unsafe', fakeRoot), /lowercase slug/);
  });
  console.log(`\n${passed} platform test groups passed.`);
} finally {
  if (testTemplate) rmSync(testTemplate, { force: true });
  rmSync(tmp, { recursive: true, force: true });
}
