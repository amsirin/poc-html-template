# CCM Template Migration — Step-by-Step Guide

**Living document** — update this file every time the migration process, tooling, or conventions change. See `Change Log` at the bottom.

**Audience**: dev migrating Exstream templates → semantic HTML for the CCM PoC.

**Prerequisite reading**: `README.md` (project overview + folder layout).

**Developer workflow**: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) อธิบาย flow จาก Handlebars ถึง PDF พร้อมขั้นตอนสร้าง template ใหม่และแก้ของเดิม รวมถึง output paths, regression scope และข้อจำกัดของ PoC

---

## A. Prerequisites (setup ครั้งเดียว)

```bash
cd poc-html-template
npm install
```

- **Node.js** ≥ 16 (v20 LTS แนะนำ)
- **PDFreactor Docker** ต้องรันอยู่ที่ `http://localhost:9423`
  - Start: `bash ../poc-translator/.pdfreactor/start.sh`
  - Check: `curl -s http://localhost:9423/service/rest/version`
- **fonts/** มี NotoSansThai ครบ (copy จาก `~/Documents/ccm/Font/NotoSansThai/`)
- POS signature captions ใช้ `fonts/AngsanaNew.ttf` (copy จาก `../Font/angsa.ttf`) ที่ 14pt; `@font-face` อยู่ใน template-specific CSS และ render.js ฝังฟอนต์ใน output HTML
- **assets/** มี FWD logo + placeholder signatures/seal SVG

---

## B. Per-template workflow (ทำซ้ำ 800 ครั้ง)

### Step 1 — เตรียม input files

```bash
# Copy DXF (จาก Exstream export)
cp /path/to/APP_<xxx>.dxf DXF/

# Copy PDF baseline (จาก Exstream render ด้วย sample data)
cp /path/to/<baseline>.pdf baselines/<slug>.pdf
```

**Naming convention**: `<slug>` = lowercase, dash-separated, ไม่มี space
- ตัวอย่าง: `pos-zlbnchg`, `dis-zlagchg`, `si-esave105`, `si-eretire90-5`

### Step 1.5 — Extract embedded images จาก baseline PDF (สำคัญมาก)

Exstream ฝัง **image สำเร็จรูป** ใน PDF สำหรับ: header banner (ชื่อบริษัท + logo), FWD seal, signatures, product logos. ใช้ image จริงเลย → **Grid/Content matching ดีกว่าการสร้าง SVG หรือ HTML ใหม่มาก** และเร็วกว่า design manual.

```bash
# List embedded images (RGB + smask pattern)
pdfimages -list baselines/<slug>.pdf

# Extract all layers
mkdir -p /tmp/<slug>-images
pdfimages -all baselines/<slug>.pdf /tmp/<slug>-images/img

# Composite RGB + smask (alpha channel) into proper PNG
# Exstream stores color layer + alpha mask separately; each image pair needs
# combined. Pattern: img-N (RGB) + img-N+1 (smask) → composed-N.png
magick /tmp/<slug>-images/img-000.png /tmp/<slug>-images/img-001.png \
  -alpha off -compose CopyOpacity -composite \
  assets/<slug>/header-banner.png
# ...repeat for each pair (002+003, 004+005, ...)
```

**Rules**:
- Header banner (company info + logo baked in one image) → **use as image, not HTML text**. Baseline uses image; matching text would drift.
- Signatures + seal → **use as image** (they're image assets even in Exstream source).
- Product-specific logos → **use as image**.
- Barcode → separate — see gotcha in Section E (needs to regenerate per customer).

**Time budget**: 5-10 นาที per template (mostly compositing pairs)

**Trade-off** ที่ต้องรู้:
- Image-based header = **ไม่ editable** (ถ้าบริษัทเปลี่ยนที่อยู่ต้อง regenerate จาก Exstream ก่อน)
- Rare event (~ ปีละครั้ง) → acceptable trade-off สำหรับ 800-template scale

### Step 2 — Inspect DXF

```bash
node src/dxf-inspect.js DXF/APP_<xxx>.dxf
```

Output จะบอก:
- **Variables** (data placeholders) — เช่น `U_Owner_Name`, `U_Policy_Number`
- **Element counts** — `fo:block`, `fo:table`, `dxf:condition` count → gauge complexity
- **Sample values** จาก `display-string` attribute — เอาไปทำ sample JSON ได้เลย

**Time budget**: 3-5 นาที

### Step 3 — ออกแบบ data schema (`.sample.json`)

Map DXF variables → semantic JSON field names. **อย่า copy ชื่อ Exstream ตรงๆ** — ใช้ชื่อ semantic ที่ dev อ่านเข้าใจง่าย (เช่น `U_Owner_Name` → `recipient.name`).

```jsonc
// data-samples/<slug>.sample.json
{
  "recipient": {
    "title": "คุณ",
    "name": "...",                        // ← U_Owner_Name
    "addressLines": ["...", "...", "..."] // ← U_Addrs1..4
  },
  "policy": {
    "number": "...",                      // ← U_Policy_Number
    "planName": "..."                     // ← U_Plan_Name
  }
}
```

**แนะนำ**: comment ท้าย JSON ด้วย mapping table เพื่อให้ dev คนถัดมาตามได้:
```jsonc
{
  "_dxfMapping": {
    "recipient.name": "U_Owner_Name",
    "policy.number": "U_Policy_Number"
  }
}
```

**Time budget**: 10-20 นาที (ขึ้นกับจำนวน variables)

### Step 4 — Author HTML template

```bash
# Copy template ที่คล้ายกันเป็น scaffold (แนะนำเมื่อ pattern ตรงกัน)
cp templates/pos-zlbnchg.hbs templates/<slug>.hbs
```

โครงสร้างมาตรฐาน:

```handlebars
{{! templates/<slug>.hbs }}
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <link rel="stylesheet" href="../styles/brand.css">
  <link rel="stylesheet" href="../styles/typography.css">
  <link rel="stylesheet" href="../styles/layout.css">
  <link rel="stylesheet" href="../styles/<slug>.css">   {{! optional per-template }}
</head>
<body>
  <article class="page">
    {{> page-header}}                     {{! shared component }}

    <p class="letter-date">{{printDate}}</p>

    <h1 class="text-subject">{{subject}}</h1>
    <p>เรียน {{recipient.title}} {{recipient.name}}</p>

    {{! ...body ตามที่เห็นใน baseline PDF... }}

    {{#each policy.beneficiaries}}
    <li>{{this.name}} — อัตราส่วน {{formatPercent this.percentage}}%</li>
    {{/each}}

    {{#eq change.type "beneficiary"}}
      <p>เปลี่ยนแปลงผู้รับผลประโยชน์</p>
    {{/eq}}

    {{> signature-block}}                 {{! shared component }}
    {{> page-footer}}                     {{! shared component }}
  </article>
</body>
</html>
```

**Handlebars helpers ที่มีอยู่แล้วใน render.js**:
| Helper | Purpose | Example |
|---|---|---|
| `{{var}}` | Plain value | `{{policy.number}}` |
| `{{formatPercent n}}` | 2-decimal % | `{{formatPercent 33.5}}` → `33.50` |
| `{{formatCurrency n}}` | Thai currency | `{{formatCurrency 1234.5}}` → `1,234.50` |
| `{{#each items}}` | Loop | `{{#each beneficiaries}}<li>{{this.name}}</li>{{/each}}` |
| `{{#eq a b}}` | Conditional | `{{#eq status "active"}}...{{/eq}}` |
| `{{#if var}}` | Truthy check | `{{#if policy.hasRider}}...{{/if}}` |
| `{{> partial}}` | Include component | `{{> page-header}}` |

**Time budget**: 30-90 นาที (ถ้า reuse component หมด: 15-30 นาที)

### Step 5 — Render

```bash
node src/render.js templates/<slug>.hbs data-samples/<slug>.sample.json
# Output → output/<slug>.html
```

เช็ค warning ใน console (missing image, CSS not found) — resolve ก่อนไปขั้นต่อไป

### Step 6 — Pixel diff vs Exstream baseline

```bash
node tools/visual-diff/diff-pdfreactor.js \
  output/<slug>.html \
  baselines/<slug>.pdf \
  output/<slug>-diff
```

Output console แสดง 3 metrics ต่อหน้า:
- **Grid similarity** (target ≥ 96%) — โครงตรงกับ baseline
- **Content similarity** — strict pixel match เฉพาะบริเวณหมึก ไม่ใช่การตรวจข้อความครบถ้วน; ผล POS ล่าสุด 17.39% แม้ Grid 99.38% จึงต้องตรวจภาพและข้อความแยกต่างหาก
- **Page similarity** (baseline)

### Step 7 — Review + iterate

```bash
npm run viewer   # เปิด browser ที่ index.html
```

Viewer แสดง **triptych**: Baseline / Rendered / Diff (red = drift) พร้อม metrics + click-to-zoom

**Diagnose**:
- **Grid < 95%** → structure ยัง drift → แก้ CSS layout (margin, padding, font-size, grid gap, width)
- **Content ต่ำ** → ตรวจตำแหน่ง ขนาด สี ฟอนต์ และข้อมูลตัวอย่างก่อน ไม่ควรสรุปว่าเกิดจาก glyph drift อย่างเดียว
- **Page < 95%** → มี element ยาว/สั้น เกินไป → แก้ dimensions

**Iterate loop**:
```
edit templates/<slug>.hbs หรือ styles/<slug>.css
→ node src/render.js ...
→ node tools/visual-diff/... 
→ ตรวจ Grid % ใน console
→ npm run viewer (ถ้าอยากดู side-by-side)
→ repeat ถึง Grid ≥ 96%
```

**Time budget**: 30-120 นาที (iterations)

#### POS measured layout (2026-09-23)

ใช้ `pdftohtml -xml -hidden -i -f 1 -l 1` ตรวจ font specs และตำแหน่งข้อความของ baseline/ผล render; รันโดยไม่ใส่ `-i` เพื่อดู image boxes. ค่าเริ่มต้นของ XML ใช้ scale 1.5 จึงหารด้วย 1.5 เพื่อแปลงเป็น PDF pt. ตรวจภาพจริงประกอบ เพราะ bounding boxes ของฟอนต์ต่างกันไม่เท่ากับตำแหน่งหมึกจริง

- Header image: 594 × 100.6pt ที่มุมบนซ้าย; คงพื้นที่ flow 85pt และวางวันที่แบบ `position: relative` เพื่อให้วันที่อยู่เหนือพื้นขาวของภาพ
- ที่อยู่: normal 10pt, line-height 13.44pt; เว้นหลังชื่อ 4.56pt. Subject: black 12pt. Policy value column เริ่มห่างจาก label 100pt
- Barcode: วางที่ x=235.8pt, กรอบ 62.2 × 25pt; helper ใช้ height=20 เพื่อให้ aspect ratio ของ SVG ตัวอย่างพอดีกับกรอบ ยังคงสร้างจากข้อมูลทุกครั้ง
- Signatures: Angsana New 14pt; ปรับขนาดภาพและ anchor ตาม baseline แทนการบังคับทุกภาพให้สูงเท่ากัน. Seal อยู่ที่ x=244pt, y=551.3pt, ขนาด 93.6 × 93.5pt
- Contact: 10pt, line-height 13.44pt ที่ y=689pt. Footer: 10pt ที่ y=796.5pt ไม่มีเส้นคั่น
- การปรับอยู่ใน `styles/pos-zlbnchg.css` และ barcode call ของ POS; shared CSS และ sample JSON ไม่ได้เปลี่ยน

**Validation ล่าสุด:** Grid **99.38%**, Page **97.47%**, Content **17.39%**; หนึ่งหน้าเอกสาร + หนึ่ง evaluation page ที่เครื่องมือแยกออก. ตรวจภาพ render/diff และเทียบจำนวนอักขระข้อความหลัง NFKD normalization/ตัด whitespace กับ PDF ก่อนแก้แล้วตรงกัน (ตรวจนี้ไม่ยืนยันลำดับข้อความหรือความถูกต้องเทียบ baseline)

**ข้อจำกัด:** sample JSON ยังมีชื่อ/ที่อยู่และค่า barcode ต่างจาก baseline; glyph ของ Noto ต่างจาก embedded Exstream font. คะแนน Grid สูงไม่ใช่การยืนยันข้อความถูกต้องหรือ business sign-off. Fixed anchors และขนาด barcode นี้ตรวจเฉพาะ sample ปัจจุบัน ต้องตรวจใหม่เมื่อข้อมูลยาวขึ้นหรือผู้รับผลประโยชน์มีหลายรายการ

### Step 8 — Component extraction (สำคัญมากช่วงแรก)

ก่อน commit ถามตัวเอง:
- Element ไหนใน template นี้ **ซ้ำ** กับ template อื่น? → extract เป็น `components/<name>.hbs`
- CSS class ไหน **generic**? → ย้ายไป `styles/brand.css` หรือ `layout.css`
- Data pattern ไหน **ใช้ซ้ำ**ได้? → ทำเป็น partial + shared schema

**Rule of 3**: ถ้าเห็น pattern เดียวกันในตัวที่ 3 → extract ทันที ไม่ต้องรอ

**ยิ่ง extract มากช่วง template แรกๆ (1-30) → template ที่ 31-800 เร็วขึ้น 3-5 เท่า**

### Step 9 — Sign-off + commit

- เปิด viewer → click ✓ Pass ที่ template card
- Git commit:
  - `templates/<slug>.hbs`
  - `data-samples/<slug>.sample.json`
  - `styles/<slug>.css` (ถ้ามี)
  - `components/<new>.hbs` (ถ้ามี extract ใหม่)
  - `styles/{brand,typography,layout}.css` (ถ้าเพิ่ม shared class)
- ไป template ถัดไป

---

## C. Component reuse strategy สำหรับ scale 800 templates

**Implemented ณ 2026-09-23:** POS/DIS ใช้ `page-header.hbs`, `address-with-barcode.hbs` และ `styles/letter-header.css` ร่วมกัน. ส่วน `app-download.hbs` ใช้ใน DIS; signature/footer ใช้ใน POS. ยังไม่ได้วัด reuse percentage หรือ time-per-template benchmark จึงยังไม่ยืนยัน PoC criteria สองข้อนี้

### Phase 1 — Foundation (templates 1-30, ~2 เดือน)

**Goal**: สร้าง component library + CSS design system ให้ครบ

**Build core components** (ตัวอย่าง):
- `page-header.hbs` — company info + FWD logo
- `page-footer.hbs` — doc code + page number
- `signature-block.hbs` — 3-column signer/seal/witness
- `address-block.hbs` — recipient address + optional barcode
- `policy-details-table.hbs` — dl grid layout
- `barcode-block.hbs` — barcode SVG/PNG + human-readable
- `benefit-list.hbs` — bulleted with percentage right-aligned
- `contact-info-para.hbs` — FWD contact line

**Build shared CSS**:
- `brand.css` — colors, spacing, page margin tokens
- `typography.css` — @font-face + text classes (subject, heading, small, muted)
- `layout.css` — page setup, common structural (dl.details, ul.plain, page-footer)

**Time per template**: 2-4 ชม. (สร้าง + extract component)

### Phase 2 — Rapid migration (templates 31-800, ~7 เดือน)

**Workflow**:
1. Look at baseline PDF → identify pattern (letter / SI / statement / ...)
2. Copy closest existing template as scaffold
3. Change data schema + Handlebars variable references
4. Small template-specific CSS tweaks
5. Iterate to Grid ≥ 96%

**Time per template**: 30-90 นาที (reuse หนัก)

### Feasibility math

```
Phase 1: 30 templates × 3 ชม.  = 90 dev-hours
Phase 2: 770 templates × 1 ชม. = 770 dev-hours
Total:                          ≈ 860 dev-hours
                                = 5 dev-months (full-time 1 dev)
Target:                         9 เดือน — มี buffer 4 เดือน
```

Feasibility depend on:
- Component reuse effectiveness (ถ้า < 60% reuse → time doubles)
- Baseline PDF availability (ถ้าไม่มี ต้อง generate เอง)
- Business logic complexity (rare conditions ทำให้ช้าลง)

---

## D. Handle Exstream conditions

DXF `<dxf:condition>` = business rule. แปลงเป็น Handlebars:

### Case 1: Show/hide section
```handlebars
{{#if policy.hasRider}}
  <section class="rider-details">...</section>
{{/if}}
```

### Case 2: Branching by value
```handlebars
{{#eq policy.type "Life"}}
  <p>ประกันชีวิต...</p>
{{/eq}}
{{#eq policy.type "Health"}}
  <p>ประกันสุขภาพ...</p>
{{/eq}}
```

### Case 3: Complex rule (>1 condition ซ้อน)
- **Option A**: Preprocess ใน render.js (คำนวณ boolean/derived field ใส่ใน data ก่อนส่งเข้า template)
- **Option B**: Register custom Handlebars helper — เพิ่มใน `src/render.js` เช่น:
  ```javascript
  Handlebars.registerHelper('showRiderSection', function(policy, options) {
    if (policy.hasRider && policy.type !== 'BasicLife') return options.fn(this);
    return options.inverse(this);
  });
  ```

---

## E. Common gotchas + fixes

| ปัญหา | สาเหตุ | Fix |
|---|---|---|
| PDFreactor render ไม่เจอ image | Docker เข้าถึงไฟล์ host ไม่ได้ผ่าน relative path | `render.js` inline เป็น data URI แล้ว (automatic) |
| CSS ไม่ apply | `<link href>` relative ไม่ถูก resolve ใน Docker | `render.js` inline `<link>` เป็น `<style>` (automatic) |
| Content similarity ต่ำ | ตำแหน่ง/ขนาด/สี/ฟอนต์หรือข้อมูลอาจต่างจาก baseline | ตรวจภาพและข้อความก่อน; POS ล่าสุด 17.39% แม้ Grid 99.38%. อย่าใช้คะแนนนี้ยืนยันข้อความครบถ้วน |
| Thai text wrap position ต่าง | CSS flow วิเคราะห์ line break ต่างจาก Exstream | ปรับ `max-width` ของ container ให้ตรงกับ baseline dimensions |
| Barcode ไม่ตรง | placeholder text ไม่ใช่ barcode จริง | ใช้ helper `{{{barcode value bcid="code39" height=12 scale=2}}}` — `bwip-js` generate inline SVG per customer. ต้อง triple-stash `{{{ }}}` เพื่อไม่ให้ HTML-escape SVG. Supports Code 39 / Code 128 / QR / EAN / etc. |
| Signature/seal ไม่ตรง | ใช้ SVG placeholder | Extract จาก baseline PDF ผ่าน `pdfimages` + ImageMagick composite (ดู Step 1.5). Production: ดึงจาก Exstream asset library หรือ signature service |
| PDFreactor eval watermark | Evaluation license | Mask ใน `visual-diff/` (automatic); prod ต้องซื้อ enterprise license |
| Font weight ต่างจาก baseline | ตัวหนา Handlebars อาจ default 700 vs baseline 500 | เพิ่ม class ใน `typography.css` แล้วใช้ specific weight |
| Grid ยัง < 95% แม้ CSS ปรับแล้ว | Element ที่ Exstream ใช้ absolute position | เพิ่ม `position: absolute; top: Xpt; left: Ypt` ใน template-specific CSS |

---

## F. QA sign-off ตอน production

ส่วนนี้เป็น workflow เป้าหมาย ยังไม่มี CI batch runner หรือระบบ approval กลางใน PoC ปัจจุบัน คำสั่ง render/diff ต้องระบุ template, sample และ baseline ทีละรายการ; `npm run viewer` เปิดไฟล์ local บน macOS ไม่ใช่คำสั่ง publish เว็บไซต์ Viewer ยังใช้ local file URLs จึงต้องปรับก่อนเผยแพร่เป็นเว็บ

**Tester workflow** (aligned กับ user requirement "apple-to-apple automate test"):

1. Dev commit template → CI ที่ต้องพัฒนาเพิ่มวนรันแต่ละ template/sample เช่น:
   ```bash
   npm run render -- templates/<slug>.hbs data-samples/<slug>.sample.json
   npm run diff -- output/<slug>.html baselines/<slug>.pdf output/<slug>-diff
   node tools/review-viewer/build.js
   ```
2. CI publish viewer URL (static hosting) → tester รีวิว
3. Tester click ✓ Pass / ✗ Fail ที่แต่ละ template card
4. Fail templates → back to dev (fail reason ใน note)
5. Pass ครบทุก template → deploy

**Threshold ที่ควร lock กับ business**:
- Grid similarity ≥ **96%** = "โครงเหมือน ตาคนแยกไม่ออก"
- Content similarity ≥ **40%** = proposed visual threshold ที่ POS ปัจจุบันยังไม่ผ่าน; ไม่ได้แปลว่า "ข้อความครบถ้วน" ต้องมี text/data validation แยกต่างหาก
- Page similarity ≥ **95%** = "layout ครอบครุมพื้นที่ถูก"

---

## G. Quick reference commands

```bash
# Inspect DXF
node src/dxf-inspect.js DXF/APP_<xxx>.dxf

# Render template + data
node src/render.js templates/<slug>.hbs data-samples/<slug>.sample.json
npm run render -- templates/<slug>.hbs data-samples/<slug>.sample.json

# Pixel diff
node tools/visual-diff/diff-pdfreactor.js output/<slug>.html baselines/<slug>.pdf output/<slug>-diff

# Build + open viewer
npm run viewer

# Full pipeline (chain สำหรับ CI)
node src/render.js templates/<slug>.hbs data-samples/<slug>.sample.json && \
node tools/visual-diff/diff-pdfreactor.js output/<slug>.html baselines/<slug>.pdf output/<slug>-diff && \
node tools/review-viewer/build.js
```

---

## H. จดหมาย DIS_ZLAGCHG (template ตัวที่สอง)

**Scope:** จดหมายแจ้งเปลี่ยนตัวแทนผู้ให้บริการ สร้างจาก baseline ใน `Document/Letter/` แล้ว copy เป็น `baselines/dis-zlagchg.pdf`. ไม่พบ DXF ของแบบนี้ใน inputs จึงเป็น manual reconstruction จาก PDF; ยังไม่ยืนยัน business conditions/data contract ของต้นฉบับนอกเหนือจาก sample ที่เห็น

### Files และ data contract

- `templates/dis-zlagchg.hbs`: semantic paragraphs และ closing section; ใช้ explicit `<br>` ตามบรรทัดของ baseline โดยข้อความยังเป็น HTML text และข้อมูลยาวสามารถ wrap เพิ่มได้
- `styles/dis-zlagchg.css`: body 10pt/13.44pt, left margin 54pt, measured positions; body และ closing อยู่ใน flow เพื่อให้เลื่อนตามเนื้อหาที่ยาวขึ้น. Barcode ยังใช้ fixed anchor ภายใน address block
- `data-samples/dis-zlagchg.sample.json`: masked values ตาม baseline; `recipient.{title,name,addressLines}`, `policy.number`, `barcode.{value,displayText}`, `agent.{title,name,phoneNumber}`, `contact`, `company`, `appDownload`, `printDate`, `subject`
- `agent.phoneNumber` เป็น string ว่างใน sample เพราะ baseline ไม่มีเบอร์หลังคำว่า โทร; template แสดงค่าต่อท้ายเมื่อมีข้อมูล ไม่ได้เติมเบอร์สมมติใน baseline sample
- `assets/dis-zlagchg/header-banner.png` และ `app-qr.jpg`: extract embedded images ด้วย `pdftohtml -xml` จาก baseline. QR เป็น static app-download asset; ยังไม่ได้ decode หรือยืนยันปลายทาง/การสแกนจริง ส่วน policy barcode สร้าง Code 39 ด้วย bwip-js ทุก render
- `components/address-with-barcode.hbs`: extract จาก POS และใช้กับ DIS; postcode เป็น optional เพื่อรองรับ DIS ที่รวม postcode ใน address line สุดท้าย. เดิมรับ parameter `barcodeHeight`; ถูกแทนที่ด้วย profile กลางวันที่ 2026-10-03 ตาม Barcode profile correction ด้านล่าง
- `styles/letter-header.css`: ย้าย header geometry จาก POS เป็น shared stylesheet โดยคงค่าเดิม. `app-download.hbs` เป็น partial ใหม่สำหรับ panel ดาวน์โหลดแอป แต่ CSS panel ยังอยู่ใน DIS stylesheet

คง wording ที่เห็นใน baseline เช่น “แก่ทาน” และ “แอปพลิเคชั่น” โดยไม่แก้ถ้อยคำธุรกิจเอง. ไม่มี visible page-number footer หรือ signature ใน DIS baseline จึงไม่เพิ่ม POS footer/signature เข้าไป. ไม่จำลอง hidden white spacer text ของ Exstream

### Run

```bash
node src/render.js templates/dis-zlagchg.hbs data-samples/dis-zlagchg.sample.json
node tools/visual-diff/diff-pdfreactor.js output/dis-zlagchg.html baselines/dis-zlagchg.pdf output/dis-zlagchg-diff
node tools/review-viewer/build.js
```

### Validation ที่รันจริง 2026-09-23

| Case | ผล |
|---|---|
| DIS baseline sample | Grid **99.57%**, Page **97.41%**, Content **15.99%**; หนึ่ง document page และหนึ่ง evaluation page ที่ถูกแยกออกจาก diff |
| POS shared-component regression | Grid **99.38%**, Page **97.47%**, Content **17.39%** เท่าเดิม; SHA-1 ของ rendered page PNG ก่อน/หลังตรงกัน |
| DIS long-name fixture | เพิ่ม address line, ชื่อผู้รับ/ตัวแทนยาว และ populated phone; ส่ง HTML เข้า PDFreactor REST API โดยตรงเพราะไม่มี matching baseline. ได้หนึ่ง document page + หนึ่ง evaluation page; ตรวจภาพแล้วไม่พบ overlap/clipping ใน fixture นี้ |
| Data/resource checks | สอง DIS HTML ไม่มี unresolved Handlebars bindings หรือ local stylesheet/image refs ที่ยังไม่ฝัง; มี barcode SVG. PDF variant มี policy/phone ที่คาดหวัง ไม่มี undefined/null output |
| Text comparison | จำนวนอักขระ visible text ของ DIS baseline/rendered ตรงกันหลังกรอง white spacers/eval text, map PUA tone marks ของ baseline, NFKD normalize และแก้ duplicate Sara Am ใน text extraction. เป็น character-count check ไม่ยืนยันลำดับข้อความ; ตรวจภาพร่วมด้วย |
| Viewer | Build สำเร็จ พบสอง baseline reports: POS และ DIS |

ไฟล์ synthetic variant: `data-samples/dis-zlagchg.long-name.json`; ผลที่สร้างในรอบนี้: `output/dis-zlagchg-long-name.html` และ `output/dis-zlagchg-long-name.pdf`. ไม่คำนวณ similarity ให้ variant นี้เพราะไม่มี matching Exstream baseline

**ข้อจำกัดที่เหลือ:** ยังไม่มี DXF/ข้อมูลทุก branch, font glyph ต่างจาก Exstream, QR/barcode scan ยังไม่ตรวจ, layout สำหรับข้อมูลยาวกว่าสอง fixtures และหลายหน้ายังไม่ยืนยัน. Fixed barcode anchor อาจชน address ที่ยาวมาก; ต้องทดสอบตามขอบเขตข้อมูลจริง. ยังไม่มี business sign-off, reuse percentage หรือ benchmark เวลาอย่างเป็นระบบ

---

## I. Inputs และ DXF capability review

การสำรวจ 2026-09-24 พบ POS_ZLFINCHG 10 PDFs และ POS_ZLFSURI 2 PDFs เพิ่มจาก inputs ใน handoff เดิม พร้อม DXF ใหม่สองไฟล์ ดู [INPUT_REVIEW.md](INPUT_REVIEW.md) สำหรับหลักฐานเดิม

การตรวจ 2026-10-02 ครอบคลุม 15 DXFs และ metadata ของ 26 letter PDFs แล้ว ดู [DXF_CAPABILITY_REVIEW.md](DXF_CAPABILITY_REVIEW.md) และ [inventory](output/dxf-audit-2026-10-02/inventory.json). DXF มี usage rules, formatting และบางไฟล์มี formulas; ต้องตรวจ rule references, per-use format overrides, function/lookup dependencies และ application matching ก่อนแปลง. Inspector เดิมยังไม่รายงานส่วนเหล่านี้ครบ

แนวทางที่เสนอในรอบ audit คือ input mapping → calculation/rule layer → view model → Handlebars HTML/CSS → PDFreactor พร้อม document assembly สำหรับ attachments/duplex. ณ รอบ audit ยังไม่ได้ implement runtime layer หรือ full letter ใหม่; ตัวอย่าง IPPLT สอง rules ในเอกสารผ่าน synthetic cases 10 กรณี. หลังจากนั้นผู้ใช้ขอทดลอง Handlebars แล้ว ผล implementation อยู่ในส่วน J ด้านล่าง

Follow-up IPPLT อยู่ใน [IPPLT_RULE_REVIEW.md](IPPLT_RULE_REVIEW.md): แยก static rule completeness ออกจาก upstream calculation/full-output completeness, trace array row driver และ format overrides, ตรวจภาพ 4 PDFs และเปรียบเทียบ non-JS alternatives. ทางเลือก JSON condition configuration สอดคล้อง Design เดิม; DMN/Java/.NET/XSLT ยังเป็นข้อเสนอ ไม่ใช่ runtime ที่เปลี่ยนแล้ว

## J. IPPLT executable Handlebars example (2026-10-02)

ผู้ใช้ขอทดสอบ Handlebars และดูโค้ด จึงเพิ่ม [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md) พร้อม `src/ipplt/view-model.js`, `templates/ipplt.hbs`, CSS, fixtures และ runner. ทั้ง 11 visibility rules ประเมินก่อนเข้า Handlebars; ไม่มี script ใน HTML. Input รับค่าที่เตรียมแล้ว จึงไม่อนุมานสูตร payment ที่ขาดใน DXF

- รัน `npm run test:ipplt`: 12 test groups ผ่าน ครอบคลุมทุก rule IDs, validation, escaping, precision และ repetition
- รัน `npm run example:ipplt -- --pdf`: single/multiple/no-refund/loan แต่ละ case มี 1 document page + 1 evaluation page
- รัน `npm run example:ipplt -- many-rows --pdf`: 40 rows อยู่ครบและเรียงถูกต้องใน 2 document pages; evaluation page อยู่ physical page 2 ของ PDF 3 หน้า
- ดูภาพเอกสารครบ 6 หน้าและตรวจ selected PDF text fields/branches; ผล page checks อยู่ `output/ipplt/validation.json`. ไม่มี baseline similarity หรือ performance benchmark เพราะ inputs เป็น synthetic
- เพิ่ม standalone `src/html-to-pdf.js` / `npm run pdf -- <html> <pdf>` ไม่ต้องมี baseline; ปิด document JS, ตรวจ response signature/status, deadline 60 วินาที. Diff harness เดิมยังใช้เมื่อมี matching baseline
- Header ใช้ asset POS, barcode/sign-off/footer เป็น composition ของ PoC; formatting รับ decimal string สองหลักและยังไม่พิสูจน์ Exstream mask parity. รายละเอียด source gaps และ assumptions อยู่ในคู่มือตัวอย่าง

ไม่แก้ shared renderer/partials/CSS หรือ templates POS/DIS. ไม่ได้รัน PDF regression ของสองแบบเดิมในรอบนี้ และไม่ถือว่าปิด upstream mapping/formula dependencies ของ IPPLT แล้ว

### Viewer follow-up 2026-10-03

รัน synthetic PDFs ทั้ง 5 ใหม่ และ reference diff ของ single/A03 กับ loan/A04 สำเร็จ. Grid/Page/Content = **94.65/96.77/0.52%** และ **94.92/96.56/1.32%** ตามลำดับ. แต่ละคู่ตรวจ 1 document page หลังแยก 1 evaluation page; A03 มี Poppler warnings แต่คำสั่งสำเร็จ. เนื่องจากข้อมูลต่างกัน คะแนนไม่ใช้ยืนยัน template parity. ไม่เปลี่ยน diff metrics/masks/thresholds

Viewer อ่าน optional `review-context.json` เพื่อแสดง notes/reference-only labels, navigation และ PDF preview links; ไม่แสดง sign-off สำหรับ reference-only comparisons. POS/DIS reports เดิมไม่รันใหม่. ตรวจไฟล์ภาพครบ 12 references, legacy sign-offs 2 ชุด และ Chrome accessibility tree แสดงทั้งสอง IPPLT panels. Screenshot capture ถูก OS ปฏิเสธ. รายละเอียดและ reports อยู่ใน [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md)

### Shared-CSS follow-up 2026-10-03

ใช้ shared CSS ก่อน per-document exceptions ตามคำสั่งผู้ใช้. `letter-header.css` และ `letter-address.css` ใช้ร่วมกันจริงทั้ง POS/DIS/IPPLT; profiles เปลี่ยน geometry ผ่าน CSS variables. `layout.css` คือ fixed-page family, `letter-flow.css` คือ flow family สำหรับ IPPLT (ใช้เพียง family เดียวต่อ template). IPPLT profile เหลือ label width และ signoff offset. ดู [SHARED_STYLES.md](SHARED_STYLES.md) สำหรับลำดับโหลดและขั้นตอนเลือก component/token/exception

ปรับ IPPLT header origin, address geometry และ body line-height ใน family กลาง; agent ยังเป็น flow content. ไม่เปลี่ยน rules/view-model/renderer. Rerender + diff POS/DIS ได้ PNG hashes เหมือนก่อน refactor และ Grid 99.38/99.57%. Tests IPPLT ผ่าน 12 groups; rerender 5 cases, ตรวจภาพทั้ง 6 document pages, 40 row markers ครบตามลำดับ. 4 primary cases หน้าเอกสาร 1 หน้า, many-rows 2 หน้า; evaluation page 1 หน้าต่อ PDF (many-rows แทรก physical page 2)

Reference diff ล่าสุด single/A03 Page97.62 Content5.84 Grid96.95%; loan/A04 Page97.27 Content5.04 Grid95.49%. Rebuild viewer แล้ว. Hash evidence: `output/shared-css-validation/after.json`. ข้อมูล/font/spacing/agent position ยังต่าง; ไม่ใช่ parity acceptance. A03 Poppler warnings เดิมยังเกิดแต่ exit0; masks/thresholds เดิมไม่เปลี่ยน. ไม่ได้ตรวจ browser AX ซ้ำรอบนี้

### Barcode profile correction 2026-10-03

ผู้ใช้สั่งแก้ barcode ที่ยังต่างขนาดหลัง shared-CSS refactor. สาเหตุคือ width/letter-spacing overrides ใน DIS/flow, source heights20/18/12mm และ SVG aspect fitting. ปัจจุบันใช้ profile กลางใน address partial (Code39, height20mm, scale2, fit="box") และ letter-address.css (62.2×25pt, Courier5pt/spacing2pt), ไม่มี per-template barcodeHeight หรือ size override. Renderer เพิ่ม preserveAspectRatio="none" เฉพาะ helper ที่ opt in fit="box"; barcode อื่นใช้พฤติกรรมเดิม. Position tokens คงตาม address layout

Fresh verification: rules tests12groupsผ่าน; rerender POS/DIS/IPPLT5cases และตรวจภาพ6documentpages, page countsเดิม,40orderedrowsครบ. วัดแท่งจาก150dpi PNG: POS130×52px,DIS130×53px,IPPLTsingle/loan130×52px; tolerance2px สำหรับ raster rounding. เปรียบเทียบก่อน/หลัง4คู่ไม่มี changed pixels นอก barcode ROI. หลักฐาน `output/barcode-profile-validation/measurements.json`. ผล identical PNG hashes ใน shared-CSS refactor เป็นประวัติก่อนแก้นี้

Grid ล่าสุด POS99.39,DIS99.49,IPPLTsingle96.95,IPPLTloan95.50%. Viewer rebuild/open ใหม่พร้อม notes; masks/thresholdsไม่เปลี่ยน. IPPLTยังเป็นdifferent-data reference comparison. ขนาดกล่องเหมือนกันแต่ module width/density เปลี่ยนตามความยาวข้อมูล; ยังไม่มีการทดสอบสแกนงานพิมพ์จริง

### Standard business variables 2026-10-03

ผู้ใช้ต้องการเลิกใช้ Exstream variable names ใน platform ใหม่. IPPLT native flow ใช้ standard JSON v1 และ lowerCamelCase business groups: document/recipient/application/refund/agent/contact. Runtime contract ตรวจ version, required types และ unknown keys; ไม่มี source field names ใน core/primary fixtures/template. Seven decisions ใช้ semantic names ใน flags/ruleTrace/data-rule. Four source address conditions ย้ายไป migration adapter; source payment arrays แปลงเป็น item objects และ code fragments แปลงเป็น references เต็ม. Native runner ไม่ import adapter. เอกสาร [IPPLT_DATA_CONTRACT.md](IPPLT_DATA_CONTRACT.md) ระบุทุก field, source mapping26variables และ rule provenance11rules

Old synthetic payloads เก็บที่ `data-samples/legacy/exstream/ipplt/`; adapter อยู่ `src/adapters/exstream-ipplt.js`. Input ใหม่ไม่ต้องใช้ adapter. Method codes คงเดิมโดยไม่เดาความหมาย enum; count ยังไม่ผูกกับ items.length และยังรับ resolved upstream values. การทำมาตรฐานรอบนี้เป็น IPPLT PoC ไม่ใช่การทำ full platform catalog หรือย้าย POS/DIS contracts

Fresh validation:15testgroupsผ่าน;437local old/new visible view-model comparisonsผ่าน (ไม่นับ hidden code strings/ruleTrace IDs). Rerender5casesแล้ว HTMLต่างเพียงdata-rule names; PNG hashes ของ6documentpagesเหมือนก่อนทุกไฟล์, page countsเดิม,40row markersครบตามลำดับ. หลักฐาน `output/ipplt-standardization/rule-parity.json` และ `visual-parity.json`. ไม่ใช่การรันเทียบ Exstream engine; ไม่รัน similarity diff/POS/DIS ใหม่เพราะไม่แก้ shared renderer/CSS/components

## K. Developer platform structure and standard authoring flow (2026-10-03)

Scopeล่าสุดคือประมาณ800templatesรวมทุกกลุ่ม โดยLetterประมาณ300; ทีมdeveloperทั้งหมดไม่มีBA. เพิ่ม [PLATFORM_BLUEPRINT.md](PLATFORM_BLUEPRINT.md) สำหรับ target structure และ developer-only Git/CLI/CI workflow. MigrationจากDXF/PDFและการสร้างใหม่ใช้ package contractเดียวกัน แต่ evidenceต่างกัน: migratedต้องmatching-input source acceptance/approved deviations; newใช้specification expected outputs. แยกsourceadapter/contract/calculation/rules/formatting/presentation/layout/assembly/delivery และpin dependenciesก่อนrelease

Executableexampleอยู่ [platform/README.md](platform/README.md): group definitionsLetter/SI/ApplicationForm/PolicyPack, catalog, IPPLTmanifest, validation/preview/scaffold/impact/readiness/previewbuild/hashverify. Referencesใช้exactversions; buildcopy declaredsources/fonts/assets/package-lockลงpreview snapshotตามdigest. ยังไม่ใช่signedimmutableproductionrelease. NativeIPPLTไม่ใช้Exstreamfields และreuseexistingauditedtemplate/CSS; แยกrulesและformattermodulesเพื่อลดcoupling. Rendererเพิ่มoptional --strict โดยค่าปริยายเดิมไม่เปลี่ยน; platformใช้strictbindings

15IPPLTtestsและ11platformtestgroupsผ่าน; platformHTML5casesเหมือนnativeexample. PDF5casesสร้างใหม่ผ่านplatformและPNG6documentpagesเหมือนของเดิมทุกไฟล์,40markersครบ/จำนวนหน้าเดิม. RenderจากverifiedsnapshotCLIได้HTMLเหมือนกัน. POS/DISHTMLdefaultเหมือนเดิม;ไม่รันsimilaritydiffใหม่. หลักฐาน `output/platform-validation/results.json`. Sandboxบล็อกlocalhostรอบแรก(EPERM)แล้วรันผ่านapprovalสำเร็จ

สร้างdraftscaffoldsทั้ง4groupsแล้ว; SI/formcapabilitiesและPolicyPackassemblyยังไม่implemented,ไม่มีproductionpublish/authenticatedapproval/routing/API/queue. readinessIPPLTreportออกcode2ตามmissingacceptanceจริง ไม่ได้ทำให้งานpreviewหยุด. impactanalysisใช้เฉพาะregisteredcatalogปัจจุบันIPPLT; existingPOS/DISยังต้องmanualregression. แผนprojectไม่ถือว่าทั้ง800templatesmigratedหรือproductionacceptedแล้ว

## Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-09-23 | Initial version. Documented workflow through Phase 1 POC scaffold. Steps A-G defined. Component reuse strategy set for 800 templates in 9 months. | POC established; user requested written migration guide. |
| 2026-09-23 | Added **Step 1.5 — Extract embedded images**. `pdfimages -all` + ImageMagick `-compose CopyOpacity` composite RGB+smask into proper PNG. Updated `page-header.hbs` to accept `company.headerImagePath` (image-mode vs semantic-mode). POS test: Content sim 0.53 → 2.03 (**+1.5 pp, 4× lift**) after switching header banner + seal + signatures to real extracted images. Grid held ≈ 94%. | User noticed placeholder SVG images didn't match Exstream baseline; extracting real embedded images is a big fidelity + speed win. |
| 2026-09-23 | Added **`{{{barcode}}}` Handlebars helper** in `render.js` — uses `bwip-js` to generate Code 39 (default), Code 128, QR, and others as inline SVG per render. Updated POS template + CSS. Metrics essentially flat (Grid 94.03 → 93.65, Content 2.03 → 1.95, Page 96.45 → 96.11 — within noise from SVG positioning). Functional correctness > pixel match: barcode now encodes real customer value each render, no longer static placeholder text. | Baseline PDFs use real barcodes (Code 39) that change per customer. Cropping from baseline PDF only works for THAT sample; production needs per-customer generation. `bwip-js` is pure-JS, no native deps. |
| 2026-09-23 | **Vertical margin tuning + pinned contact-info**. Per-section margin overrides in `styles/pos-zlbnchg.css` matched to baseline y-coord measurements. Body font 11pt → 10pt (matches Exstream). `contact-info` moved to `position: absolute; bottom: 55pt` so it stays on page 1 even when signature block pushes near the bottom. Final POS metrics: **Grid 94.95% (target 95% hit)**, Content 2.25%, Page 96.43%. All content on one A4 page. | User request: tune vertical margins per section to hit Grid ≥ 95%. Iterated ~10 configs; sweet spot at sig-block margin-top: 30pt with pinned contact-info. Trade-off: more margin → higher Grid but page 3 overflow; less margin → 1-page fit but Grid 94.1-94.3. Pinned contact-info + measured section spacing gets both. |
| 2026-09-23 | **Precise baseline measurement + pinned sections → Grid 96.16%**. Used pdfplumber to extract exact y-coord + font-size + left-x of every text row in baseline PDF (39 unique rows). Discovered baseline uses: `page-margin-x: 63pt` (not 55pt), `body-para text-indent: 36pt` (not 2em), `line-height: 1.3` (not 1.5), banner height ~85pt (not 98pt which was aspect-ratio derived). Applied all 4 corrections + pinned `.signature-block` and `.contact-info` at absolute baseline y-coords (525pt / 692pt). Rendered y-coords now match baseline within 5pt: date 94/94, address 125/125, subject 224/224, salutation 246/249, body1 271/273. Final: **Grid 96.16%**, Content 1.29%, Page 96.23%. | User request: iterate to Grid 96%+. pdfplumber-measured baseline positions removed guesswork. Absolute positioning for signature + contact info removes error accumulation from flow margins. |

| 2026-09-23 | Re-ran the existing POS sample through `src/render.js`, `tools/visual-diff/diff-pdfreactor.js`, and `tools/review-viewer/build.js`; all exited successfully. PDFreactor reported version 12.7.1 (18291). Fresh metrics: **Grid 96.80%, Content 1.55%, Page 96.09%**. Generated PDF contains one document page plus one detected evaluation page excluded from comparison. Regenerated HTML, PDF, diff report/images, and viewer. | User requested running the project. No template or rendering-code changes in this run; the difference from historical metrics has not been investigated. Visual/text correctness and business sign-off remain unverified. |

| 2026-09-23 | Re-ran the POS sample on user request: HTML render, PDFreactor diff, and review viewer build all exited successfully. Fresh results: **Grid 96.80%, Content 1.55%, Page 96.09%**, matching the previous saved run. Compared one document page after excluding one detected evaluation page. Regenerated output artifacts and viewer; no template or rendering-code changes. | Confirm the project runs in the current session. Visual/text correctness and business sign-off remain unverified; these image metrics do not establish text completeness. |

| 2026-09-23 | Measured POS baseline text/image boxes with Poppler; corrected header scale, date/address/barcode positions, subject color, policy columns, paragraph spacing, signature boxes and captions, contact/footer font sizes. Added local Angsana New font for 14pt signature captions; retained sample data. Fresh render/diff/viewer succeeded: **Grid 99.38%, Content 17.39%, Page 97.47%** (previous 96.80% / 1.55% / 96.09%). One document page and one excluded evaluation page. Visually checked final render; normalized extracted text character counts match pre-change PDF. | User requested more accurate positions/font sizes with a 98% target; Grid target exceeded without changing diff metrics or masks. First iteration exposed header/date overlap, corrected before final verification. Sample-data differences, Noto glyph differences and longer-data layout remain limitations; no business sign-off claimed. |

| 2026-09-23 | Added `DEVELOPER_GUIDE.md` with generation flow diagrams, CLI/output reference, new-template and modification workflows, validation guidance and proposed production flow. Linked from README/migration guide; corrected README baseline path and clarified that batch CI/published review are future work. | User requested a written developer workflow from Handlebars to PDF. Documentation checked against current source and local links; no code behavior changed and no new PDF render or similarity measurement performed. |

| 2026-09-23 | Added DIS_ZLAGCHG letter from the supplied PDF (no matching DXF), masked sample, long-name/phone fixture, extracted header and app QR, and app-download partial. Extracted shared address/barcode partial and letter-header CSS for POS/DIS. Fresh DIS results: **Grid 99.57%, Page 97.41%, Content 15.99%**. POS regression unchanged at **99.38% / 97.47% / 17.39%**, with identical rendered PNG hash. Visually checked both DIS cases; baseline visible-text character counts match after documented extraction normalization; rebuilt two-template viewer. | User requested developing the next letter. Reuse verified without changing POS appearance. PDF-only reconstruction, limited fixtures and unverified code scanning/business sign-off are documented in section H. |

> **How to update this doc**: when a step changes (new tooling, new convention, new gotcha discovered), edit the affected section AND add a row to the Change Log with date + one-line reason. Don't delete old rows — history helps future dev understand why choices were made.

| 2026-09-24 | Added input discovery notes in `INPUT_REVIEW.md` and corrected stale input availability in `HANDOFF.md`. DXF inspection succeeded for financial change (66 variables) and full surrender (43 variables); text extraction covered 10 financial-change PDFs (nine 2-page, one 12-page), with documented Poppler warnings. | User requested continuing from handoff; discovered additional inputs. Template scope remains pending; no rendering changes or new similarity results. |

| 2026-09-24 | Corrected POS_ZLFINCHG analysis after user confirmed all 10 PDFs originate from one template. Traced normal letter and pass-through rider-provision document in DXF; checked 12-page composition (2 letter + 1 OPD + 1 filler + 8 ADD), including visual check of filler page. Documented missing placeholder-population logic. | Model variations through conditions and attachments, not separate templates by page count. No rendering implementation changed. |

| 2026-09-24 | Inspected both POS_ZLFSURI PDFs and candidate surrender DXF after user skipped POS_ZLFINCHG. PDFs have one page without loan deduction versus two pages including loan repayment receipt; both identify APP_LTZLFSURI001. Available APP_LTULFSU001 instead contains unit-redemption detail as its second document. Updated input review/handoff to record application mismatch and unverified receipt-selection logic. | Distinguish observed output differences from source rules; no new template or PDFreactor validation. |

| 2026-09-24 | Read all four ZLFINCHG spec worksheets and cross-checked DXF. Identified added-rider external-plan mapping and active SET_RIDER_PROVISSION_LA call in VariableFormula!E8; distinguished commented legacy loop from active code. Function implementation and placeholder assignment remain absent. | User requested reassessing placeholder logic using spec; documented precise remaining dependency without claiming complete selection logic. No workbook/code/render changes. |

| 2026-10-02 | Audited 15 DXFs and metadata for 26 letter PDFs; recorded 116 variable formulas, usage-rule/format evidence, two XML control-character failures, ZLPSP unresolved rules, and PDF application mismatches. Added capability review/inventory and IPPLT two-rule example (10 synthetic cases passed); proposed mapping/rules/formatters/Handlebars/PDFreactor/assembly separation. Restored misplaced input-review heading to section I. | User requested rechecking newly supplied DXFs for platform migration. Original DXFs unchanged; two files normalized only in memory for discovery. No new runtime template, Exstream execution, PDFreactor run or similarity validation. |

| 2026-10-02 | Deep-audited IPPLT: 11 rule bodies resolve at 12 nonzero use sites; all 26 variable formulas empty; traced array-count driver and formatting overrides. Extracted/rasterized/visually reviewed all four one-page PDFs, identifying single-payment outputs and common components absent from this DXF. Documented missing upstream contracts and JSON configuration, DMN, typed backend and XSLT alternatives with official references. | User selected IPPLT and requested non-JavaScript options. Static reference checks passed; no new business-equivalence, rule-engine execution, template or PDFreactor validation. Existing runtime/architecture unchanged. |

| 2026-10-02 | Implemented the IPPLT Handlebars example with 11 source-linked visibility rules, validated resolved inputs, exact two-decimal string formatting, five synthetic fixtures, flow layout, and tests. Added standalone HTML-to-PDF CLI with document JS disabled. Twelve test groups passed; PDFreactor 12.7.1 generated four one-page cases and a two-page 40-row case; visually checked all six document pages and verified 40 row markers. | User requested a runnable PoC/code example. Fixed missing optional partial fields found by strict template test. Evaluation pages retained (including middle-page injection); no baseline similarity, upstream-formula equivalence or performance claim. Shared POS/DIS implementation unchanged. |

| 2026-10-03 | Re-rendered five IPPLT examples, ran single/A03 and loan/A04 reference diffs (Grid 94.65%/94.92%), rebuilt/opened viewer with reference-only notes, anchors, PDF links and no sign-off for mismatched-data comparisons. Verified 12 image files and Chrome accessibility panels; OS denied additional screenshot capture. | User requested running and comparing in viewer. Scores combine data/layout differences and do not establish parity. Diff algorithm and historical POS/DIS results unchanged. |

| 2026-10-03 | Extracted shared address/barcode CSS for POS/DIS/IPPLT; reused header geometry; added flow family and reduced IPPLT CSS to two profile tokens. Fresh POS/DIS PNG hashes identical; IPPLT 12 test groups, five PDFs/six document pages and 40 ordered rows verified. Reference Grid now 96.95%/95.49%; rebuilt viewer. | User requested shared CSS before document overrides for maintainability. Kept source rules and diff algorithm unchanged; documented remaining layout/data differences. |

| 2026-10-03 | Standardized letter barcode profile at 62.2x25pt; removed document size/spacing/generation overrides and added opt-in SVG box fitting. Fresh PDF ink measurements agree within 1 raster pixel; all four comparison pairs have zero changed pixels outside the barcode region. IPPLT rules/page/40-row checks passed; viewer refreshed. | User requested fixing inconsistent barcode sizes despite shared CSS. Barcode positions remain layout-specific; printed scan acceptance is unverified. |

| 2026-10-03 | Standardized native IPPLT input with versioned business fields, object-based refund items and semantic rule names. Isolated source variables/address normalization/reference assembly in an optional Exstream adapter; archived old synthetic fixtures. Fifteen test groups and 437 local parity cases passed; all six regenerated document PNGs are identical. | User requested standard platform variables independent of Exstream. Existing business code values and unresolved upstream formulas remain explicit; no shared layout or renderer changes. |

| 2026-10-03 | Added developer-only platform blueprint for 800 templates including about300Letters, plus runnable catalog/group/package CLI with validation, strict preview, impact, scaffolding and hash-verified preview snapshots. Separated IPPLT rules/formatter modules. Fifteen existing and11platform test groups passed; five platform PDFs match six existing document-page images,40rows intact; snapshot HTML and POS/DIS default HTML unchanged. | User requested a maintainable project and standard future template-creation flow; clarified developer-only team and total scope. SI/form/pack runtime and authenticated production publication remain planned. |
