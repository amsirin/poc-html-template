# CCM PoC — HTML Template Migration

Migrate Exstream templates to **semantic, maintainable HTML** that developers can edit, then render to PDF via PDFreactor. Confirmed scope: about **800 templates, including about 300 Letters**, plus SI, Application Form and Policy Pack. Use a developer-only Git/CLI/CI workflow for migration and future template creation; no delivery deadline is newly committed here.

**Sibling `poc-translator/` is untouched** — this is a separate track.

## Developer documentation

- [PLATFORM_BLUEPRINT.md](PLATFORM_BLUEPRINT.md) — Target project structure, shared/group capabilities, developer authoring and migration flows, acceptance, release/versioning and production roadmap.
- [platform/README.md](platform/README.md) — Runnable configuration-driven IPPLT package, scaffold commands for four groups, change-impact checks and preview build/hash verification.

- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — Thai guide with Handlebars → PDF flow diagrams, commands, and step-by-step workflows for creating or modifying templates. Distinguishes current PoC behavior from proposed production work.
- [MIGRATION.md](MIGRATION.md) — DXF migration, asset extraction, layout measurements, validation results, and change history.
- [DXF_CAPABILITY_REVIEW.md](DXF_CAPABILITY_REVIEW.md) — 2026-10-02 audit of all 15 DXFs: recoverable rules/formulas/formats, missing dependencies, PDF application matching, and proposed rules → Handlebars → PDFreactor architecture. Includes an IPPLT rule example; no new full letter implemented.
- [IPPLT_RULE_REVIEW.md](IPPLT_RULE_REVIEW.md) — Detailed IPPLT rule/reference audit, missing upstream formulas/common output components, all four PDF cases, and non-JavaScript rule/template options.
- [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md) — Runnable Handlebars example with standard business data, separate decisions, five synthetic fixtures, tests, and PDF outputs.
- [IPPLT_DATA_CONTRACT.md](IPPLT_DATA_CONTRACT.md) — Standard variable names, versioned input contract, migration-only Exstream adapter, field/rule mapping and parity evidence.

## Approach

See [SHARED_STYLES.md](SHARED_STYLES.md) for the shared-CSS-first convention, page families, profile tokens and regression checks.

Letter barcodes now use one shared Code 39 profile and a 62.2 × 25pt box across POS, DIS and IPPLT. Templates pass data only; SVG fitting prevents differing text lengths from shrinking the bar height. Barcode positions still follow each address layout. Printed scanner acceptance remains unverified.

```
Exstream DXF (XML)               PDF baseline (Exstream renders)
      │                                  │
      ▼                                  ▼
  dxf-inspect.js               tools/visual-diff/diff-pdfreactor.js
      │                                  ▲
      ▼                                  │
  Semantic HTML template ──► + JSON data ─► Handlebars merge ─► PDFreactor ─► PDF
  (templates/*.hbs)                                                          │
  + shared components                                                        │
  + shared CSS                                                               │
                                                                     Grid / Content
                                                                        metrics
```

## Layout

- `templates/` — Handlebars `.hbs` per document type. **Dev edits these.**
- `components/` — partials for header, address/barcode, footer, signature block, and app download panel.
- `styles/` — brand tokens, typography, page setup. **One place to change design system.**
- `fonts/` — @font-face sources referenced by URL (not base64-inlined).
  Authoring CSS uses relative URLs; the render step embeds font files in output HTML. POS uses Noto Sans Thai for body text and `AngsanaNew.ttf` (copied from `../Font/angsa.ttf`) at 14pt for signature captions.
- `data-samples/` — baseline samples and explicitly labeled synthetic fixtures; native IPPLT inputs are in `data-samples/ipplt/`. Archived source-shaped fixtures are under `data-samples/legacy/exstream/ipplt/` and are used only to test the migration adapter.
- `baselines/` — Exstream PDF baselines to diff against.
- `output/` — merged HTML + rendered PDF + diff reports.
- `src/` — DXF inspection, HTML rendering, standalone PDF conversion (`html-to-pdf.js`), and IPPLT contract/rules/example runner (`ipplt/`). Migration adapters live in `adapters/`; the native IPPLT runner does not import them. Comparison remains in `tools/visual-diff/`.
- `platform/` — developer CLI/runtime, exact-version catalog, document groups and package manifests. Preview snapshots/scaffolds/traces go under `output/platform-*`; production publication is not implemented.

## Platform example

```bash
npm run platform -- validate letter.ipplt@1.0.0
npm run platform -- render letter.ipplt@1.0.0 --fixture single --pdf
npm run platform -- impact styles/letter-address.css
npm run platform -- build letter.ipplt@1.0.0
npm run platform -- new letter --id new-notice
npm run test:platform
```

IPPLT is the runnable package. SI/Application Form/Policy Pack have group definitions and draft scaffolds; their rendering/assembly capabilities still need implementation. `readiness` intentionally reports that IPPLT is not production accepted. See [platform/README.md](platform/README.md) for complete commands and verified limitations.
- `tools/visual-diff/` — copied from poc-translator, reused for automate pixel-diff.

## Getting started

```
cd poc-html-template
npm install
node src/dxf-inspect.js ../DXF/APP_LTPOSZLBNCHG001.dxf
node src/render.js templates/pos-zlbnchg.hbs data-samples/pos-zlbnchg.sample.json
node tools/visual-diff/diff-pdfreactor.js output/pos-zlbnchg.html baselines/pos-zlbnchg.pdf output/pos-zlbnchg-diff
node tools/review-viewer/build.js
```

`src/render.js` produces HTML. The diff command calls PDFreactor and saves the generated PDF at `output/pos-zlbnchg-diff/html-rendered.pdf`; it requires a running PDFreactor service and Poppler. Open `tools/review-viewer/index.html` for comparison, or run `npm run viewer` on macOS to rebuild and open it.

## Implemented letters

| Template | Purpose | Source | Last validated Grid / Page / Content |
|---|---|---|---|
| `pos-zlbnchg` | Beneficiary change confirmation | DXF + PDF | 99.38% / 97.47% / 17.39% |
| `dis-zlagchg` | Servicing agent change notification | PDF only; no matching DXF supplied | 99.57% / 97.41% / 15.99% |

Both baseline samples were rendered and reviewed on 2026-09-23. Each has one document page plus one PDFreactor evaluation page. These metrics are visual comparisons, not business approval or text-accuracy percentages. Component reuse percentage and time-per-template benchmark have not yet been measured.

Run the second letter:

```bash
node src/render.js templates/dis-zlagchg.hbs data-samples/dis-zlagchg.sample.json
node tools/visual-diff/diff-pdfreactor.js output/dis-zlagchg.html baselines/dis-zlagchg.pdf output/dis-zlagchg-diff
node tools/review-viewer/build.js
```

POS, DIS and IPPLT share `page-header`, `address-with-barcode`, `styles/letter-header.css` and `styles/letter-address.css`. POS/DIS use the fixed-page family; IPPLT uses `letter-flow.css` with only two document profile tokens in `ipplt.css`. DIS also has a synthetic `data-samples/dis-zlagchg.long-name.json` fixture for long names, an extra address line and a populated agent phone. It has no matching baseline; see [MIGRATION.md](MIGRATION.md) for validation and limitations.

## IPPLT executable example (2026-10-02)

```bash
npm run test:ipplt
npm run example:ipplt -- --pdf
npm run example:ipplt -- many-rows --pdf
```

Outputs are under `output/ipplt/`. Omit `--pdf` to build HTML without PDFreactor. Native inputs use `schemaVersion: "1.0"` and business groups (`document`, `recipient`, `application`, `refund`, `agent`, `contact`). Seven semantic decisions live in `src/ipplt/view-model.js`; four legacy address rules live only in the optional adapter. Templates and rule traces use semantic names instead of source IDs. Fifteen test groups and 437 local before/after comparisons passed; all six document-page PNGs match the pre-standardization output exactly. Four primary cases have one document page and the 40-row case has two, plus one evaluation page in each PDF. This remains a synthetic PoC with missing upstream formulas; see [IPPLT_DATA_CONTRACT.md](IPPLT_DATA_CONTRACT.md) and [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md).

Standalone PDF generation without a baseline: `npm run pdf -- output/ipplt/single.html output/ipplt/single.pdf`.

The [review viewer](tools/review-viewer/index.html) now includes IPPLT single/A03 and loan/A04 reference comparisons (2026-10-03). Their inputs differ, so the viewer labels them reference-only and disables sign-off; Grid scores 94.65% / 94.92% are not parity results. Other synthetic cases are linked as PDF previews. Notes are configured in `tools/review-viewer/review-context.json`; rebuild with `node tools/review-viewer/build.js`. Existing POS/DIS reports remain historical.

## Success criteria for POC

- **2 templates** built as semantic HTML (~300-500 lines each)
- **Component reuse** ≥ 30% between the two templates
- **Grid similarity** ≥ 95% vs Exstream baseline (poc-translator achieves 98.74% avg — target here is close, not identical)
- **Time-per-template benchmark** to extrapolate 800 in 9 months

## What this POC does NOT try to do

- **Pixel-perfect font glyph match** — same Google Noto Sans Thai UI fallback as poc-translator; Stage 2 CFF-font gap is out of scope
- **Replace Exstream authoring UI** — dev writes HTML by hand + Handlebars data binding, informed by DXF structure. No visual designer
- **Automate 100% of template migration** — DXF gives structure, dev applies semantic + component reuse manually. Automation ratio is measured in POC report, not assumed
# poc-html-template
