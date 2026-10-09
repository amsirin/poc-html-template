# Developer template platform example

This is a runnable architectural slice for an **800-template portfolio (about 300 Letters)**, maintained by developers through Git/CLI/CI. Read [PLATFORM_BLUEPRINT.md](../PLATFORM_BLUEPRINT.md) for the target structure, migration/new-authoring flows, group differences and production roadmap.

## Implemented files

```text
platform/
  cli.js                                  # developer commands
  runtime/index.js                        # validation, registry, trace, snapshots
  catalog.json                            # exact-version dependency registrations
  groups/
    letter.json
    si.json
    application-form.json
    policy-pack.json
  templates/letter/ipplt/1.0.0/
    manifest.json                         # package composition/configuration
    evidence.json                         # honest acceptance gaps
```

The IPPLT bridge package reuses existing `templates/ipplt.hbs`, `src/ipplt/contract.js`, `src/ipplt/rules.js`, `src/ipplt/view-model.js`, `src/shared/formatters.js`, shared CSS/components/assets and the five native fixtures. Rules and formatting are now separate modules; the old example commands still work. No Exstream field names enter the native pipeline.

The manifest is configuration, not request data. Its registered modules are trusted, reviewed developer code. This local PoC is not an untrusted-code sandbox or a production release service.

## Run the example

From `poc-html-template/`, using the existing dependencies:

```bash
npm run platform -- list
npm run platform -- inspect letter.ipplt@1.0.0
npm run platform -- validate letter.ipplt@1.0.0
npm run platform -- render letter.ipplt@1.0.0 --fixture single
npm run platform -- render letter.ipplt@1.0.0 --fixture many-rows --pdf
npm run platform -- impact styles/letter-address.css
npm run test:ipplt
npm run test:platform
```

`--pdf` requires the existing PDFreactor service (`PDFREACTOR_URL`, default `http://localhost:9423`). HTML-only commands do not require it. Each successful preview prints an output directory under `output/platform/<id>/<version>/<fixture>/run-*/` with `view-model.json`, `document.html`, optional `document.pdf`, and `trace.json`. Failed attempts are removed, so a failed run cannot masquerade as a newly completed preview.

The trace records input/hash, exact dependency digest, runtime Node version, decisions, output hashes and readiness limitations. It does not yet pin the PDFreactor container image, reference-data service or installed npm tree; those are production release/job requirements in the blueprint. Document JavaScript stays disabled.

Validation checks fixture contracts and rule wiring, selected dependency types/closure, exact versions, approved group layout, linked shared styles and declared CSS resources. Rendering uses strict Handlebars bindings and rejects unresolved external image/stylesheets. The existing generic renderer accepts optional `--strict`; old CLI calls keep their previous default behavior.

`impact` traverses the registered dependency graph. **Only IPPLT is registered in this example.** POS/DIS still exist as older PoC templates and need their established manual regression checks until they are registered; this command does not claim to discover every consumer in the whole workspace or all 800 templates.

## Build a preview snapshot

```bash
npm run platform -- build letter.ipplt@1.0.0
```

This prints a `target` under `output/platform-builds/<id>/<version>/<digest>/`. The snapshot preserves project-relative source/resource paths and includes `platform.lock.json`, which hashes the declared files. It is **preview-only**. The digest directory is reused only if verification succeeds; changing its contents makes verification fail.

```bash
# Replace <snapshot-directory> with the printed target.
npm run platform -- verify <snapshot-directory>
node <snapshot-directory>/platform/cli.js render letter.ipplt@1.0.0 --fixture single
```

Dependencies must be installed according to the copied package lock when using the snapshot outside this project. A successful local hash check is not a signed/authenticated release approval. Production promotion must publish the exact accepted bundle plus renderer/environment versions; there is no `publish` command in this PoC.

## Create a new template package

```bash
npm run platform -- new letter --id cancellation-notice
npm run platform -- new si --id product-illustration
npm run platform -- new application-form --id individual-application
npm run platform -- new policy-pack --id individual-policy
```

These generate draft packages under `output/platform-drafts/<group>/<id>/0.1.0/` and refuse to overwrite an existing draft. The compose groups get a `.hbs` entry; Policy Pack gets an assembly skeleton. **They deliberately do not render yet:** contract/rules/preparer/components/fixtures must be registered, and SI/form profiles plus assembly runtime are not implemented.

Developer completion steps:

1. Identify the approved specification, owner and required variants. Keep `origin: "new"`; use `origin: "migration"` only when there is source-system migration evidence.
2. Define or reuse a canonical data contract; create pure rules, a presentation module and fixtures. Preserve the platform dependency interfaces (`validate(input)`, `decide(input)`, `prepare(input)` with `flags`/`ruleTrace`) or extend the runtime deliberately with tests.
3. Register exact-version dependencies in `catalog.json`, including all local imports/resources. Select a group-enabled layout. Add complex new capabilities through reviewed runtime/component extensions, not unregistered expressions.
4. Compose approved Handlebars partials/styles. Add only justified overrides. References in `.hbs` are resolved relative to its entry path by the current renderer; update relative paths if moving the scaffold.
5. Fill `manifest.json` and required cases in `evidence.json`. Move the finished package to the intended `platform/templates/<group>/<id>/<version>/` location, update its project-relative paths, and register its manifest under `catalog.templates`.
6. Validate, preview and test before peer review. An accepted new document uses specification-based expected outputs; a migrated document uses matching-input source evidence plus approved deviations.
7. Build the reviewed artifact. Production publication, promotion and routing remain future platform work; do not treat a successful preview as deployment.

## Acceptance readiness

```bash
npm run platform -- readiness letter.ipplt@1.0.0
```

This currently exits **2**, intentionally: IPPLT is a draft with missing matched-data Exstream acceptance, upstream definitions and approval evidence. Structural validation/preview succeeds while production readiness remains incomplete. Evidence flags are local developer-maintained metadata, not authenticated sign-offs. A future publisher must verify actual review records and their artifact hashes.

## Validation performed 2026-10-03

- Existing IPPLT tests: 15 groups passed after separating rules/formatter modules.
- Platform tests: 11 groups passed, including dependency/version/kind/cycle checks, path isolation, unknown keys, readiness, change impact, deterministic snapshot locks, tamper detection, strict missing-binding failure and all-group scaffolds.
- All five platform HTML outputs match the previous IPPLT outputs exactly. All five PDFs generated through the platform path; six document-page PNG hashes match the existing IPPLT images. Four primary cases have one document page; many-rows has two. Each PDF also has one evaluation page. All 40 rows remain present once in order.
- Rendered HTML from a verified snapshot using its own CLI matches the working example. This run used the already installed dependencies in the shared project environment; an isolated container build has not been tested.
- Evidence: [results.json](../output/platform-validation/results.json). The current build and sample PDF paths are listed there.

SI/form business data/rules/layouts and Policy Pack PDF assembly have not been implemented or rendered. No new source-system parity, production performance or release acceptance is claimed.
