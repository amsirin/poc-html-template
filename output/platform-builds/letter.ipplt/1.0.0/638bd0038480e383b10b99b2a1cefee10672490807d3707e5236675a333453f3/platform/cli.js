#!/usr/bin/env node
import { resolve } from 'path';
import { catalog, loadPackage, validatePackage, releaseReadiness, buildPreview, verifyPreview, renderPreview, scaffold, affectedTemplates } from './runtime/index.js';

const [command, selector, ...args] = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return undefined; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${name}`); return args[i + 1]; };
try {
  let result;
  switch (command) {
    case 'list': result = { groups: Object.keys(catalog().groups), templates: catalog().templates }; break;
    case 'inspect': result = loadPackage(selector).manifest; break;
    case 'impact': result = affectedTemplates(selector); break;
    case 'validate': {
      const pkg = await validatePackage(selector);
      result = { valid: true, template: pkg.manifest.id, fixtures: Object.keys(pkg.manifest.fixtures), dependencies: [...pkg.dependencies.keys()] }; break;
    }
    case 'readiness': {
      result = releaseReadiness(await validatePackage(selector));
      if (!result.localEvidenceReady) process.exitCode = 2;
      break;
    }
    case 'build': result = await buildPreview(selector); break;
    case 'verify': result = { verified: true, digest: verifyPreview(resolve(selector)).digest }; break;
    case 'render': result = await renderPreview(selector, flag('--fixture') || 'single', args.includes('--pdf')); break;
    case 'new': result = scaffold(selector, flag('--id')); break;
    default: throw new Error('Usage: platform list | inspect/validate/readiness/build <template@version or manifest> | render <template> [--fixture name] [--pdf] | verify <bundle-dir> | new <group> --id <slug>');
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
