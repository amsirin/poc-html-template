# IPPLT: ตัวอย่าง Handlebars ที่รันได้

เพิ่ม 2026-10-02 ตามคำขอให้ทดลอง Handlebars และดูโค้ด; ปรับ 2026-10-03 ให้ native inputs ใช้ชื่อธุรกิจมาตรฐาน. เก็บ behavior เดิมด้วย 7 decisions ใน core และ 4 address normalizations ใน legacy adapter. ใช้ **ข้อมูลสังเคราะห์ที่เตรียมค่าแล้ว** ไม่ได้คำนวณยอดคืนเงินหรือสร้าง payment-detail wording จาก upstream inputs ที่ยังไม่มีสูตร. ดู [contract และ mapping](IPPLT_DATA_CONTRACT.md)

## เปิดโค้ดตามลำดับ

1. [single.json](data-samples/ipplt/single.json) — standard input v1 แบ่ง `document`, `recipient`, `application`, `refund`, `agent`, `contact`; ไม่มี source variable names
2. [contract.js](src/ipplt/contract.js), [rules.js](src/ipplt/rules.js), [formatters.js](src/shared/formatters.js) และ [view-model.js](src/ipplt/view-model.js) — validate standard input → ประเมิน 7 decisions ด้วยชื่อธุรกิจ → สร้าง flags/rows/display values. [Exstream adapter](src/adapters/exstream-ipplt.js) ใช้เฉพาะตอนรับข้อมูลเดิม
3. [ipplt.hbs](templates/ipplt.hbs) — จดหมาย HTML + `#if`/`#each`, เรียก shared partials; ไม่มี `<script>`
4. [letter-flow.css](styles/letter-flow.css) — shared flow layout, tables และ running footer; [ipplt.css](styles/ipplt.css) เหลือ 2 profile tokens ตาม [SHARED_STYLES.md](SHARED_STYLES.md)
5. [run-example.js](src/ipplt/run-example.js) — เขียน view model แล้วใช้ `src/render.js` เดิม merge/inlining
6. [html-to-pdf.js](src/html-to-pdf.js) — ส่ง self-contained HTML ให้ PDFreactor REST โดยปิด document JavaScript; ไม่ต้องมี baseline

```text
standard JSON v1 → validate + evaluateIppltRules → view model
            → Handlebars → self-contained HTML/CSS → PDFreactor → PDF
```

ใน rules module:

```js
showSinglePayment: positive && refund.paymentCount === 1,
showMultiplePayments: positive && refund.paymentCount > 1,
```

ใน Handlebars:

```handlebars
{{#if flags.showMultiplePayments}}
<table class="letter-list">
  <tbody>
    {{#each payment.rows}}
    <tr><td>{{number}}.</td><td>{{detail}}</td></tr>
    {{/each}}
  </tbody>
</table>
{{/if}}
```

การตัดสินใจทางธุรกิจจบก่อน render; Handlebars ทำเฉพาะการแสดงผล. `ruleTrace` และ `data-rule` ใช้ชื่อ decisions เช่น `showSinglePayment`; เลข source rule อยู่ในเอกสาร mapping เท่านั้น. Escaping ของข้อความใช้ Handlebars ปกติ; raw markup มีเฉพาะ barcode SVG จาก helper ที่ระบบควบคุม

## คำสั่ง

จาก `poc-html-template/` (ใช้ dependencies เดิม ไม่เพิ่ม package):

```bash
npm run test:ipplt
npm run example:ipplt
npm run example:ipplt -- --pdf
```

คำสั่งแรกทดสอบ rules/template; คำสั่งที่สองสร้าง HTML ทั้ง 4 cases โดยไม่ใช้ service; คำสั่งที่สามสร้าง HTML/PDF ทั้ง 4 cases โดยต้องมี PDFreactor ที่ `http://localhost:9423` หรือกำหนด `PDFREACTOR_URL`

เลือก case หรือทดสอบการขึ้นหน้าต่อเนื่อง:

```bash
npm run example:ipplt -- multiple --pdf
npm run example:ipplt -- many-rows --pdf
```

กรณีแก้ standard JSON แล้วต้องการรันเองทีละขั้น ให้อ่าน pattern ใน runner: `buildIppltViewModel(input)` → เขียน JSON ที่เตรียมแล้ว → `render.js`. **อย่าส่ง input JSON เข้า `render.js` ตรง ๆ** เพราะ template รับ view model. Legacy payload ต้องเรียก `adaptExstreamIpplt(input)` ก่อน; ไม่มี auto-detect หรือ dependency ต่อ adapter ใน runner หลัก

CLI สร้าง PDF อย่างเดียวสำหรับ HTML ที่ฝัง resources แล้ว:

```bash
npm run pdf -- output/ipplt/single.html output/ipplt/single.pdf
```

CLI ตรวจ HTTP status/PDF signature, มี deadline 60 วินาที และเขียนไฟล์เมื่อได้ PDF สำเร็จ. ยังไม่มี retry/job queue หรือ production resource validation. ใช้ REST endpoint `/service/rest/convert.pdf` และ `javaScriptSettings: { disabled: true }`

## ตัวอย่างและผลตรวจจริง (รอบแรก; ผล standardization ล่าสุดอยู่ท้ายเอกสาร)

| Case | สิ่งที่พิสูจน์ | ผล PDF |
|---|---|---|
| [single](output/ipplt/single.pdf) | แสดง single-payment paragraph; ไม่แสดง multiple-payment list | 1 หน้าเอกสาร + 1 evaluation page |
| [multiple](output/ipplt/multiple.pdf) | แสดงข้อความหลายรายการ + ตาราง 2 แถว + draft code | 1 หน้าเอกสาร + 1 evaluation page |
| [no-refund](output/ipplt/no-refund.pdf) | ยอดศูนย์ซ่อน refund sections; ชื่อตัวแทนว่างซ่อน agent; address placeholders ถูก suppress ตาม rules | 1 หน้าเอกสาร + 1 evaluation page |
| [loan](output/ipplt/loan.pdf) | แสดงเลขเงินกู้และ code สำหรับ method `1` | 1 หน้าเอกสาร + 1 evaluation page |
| [many-rows](output/ipplt/many-rows.pdf) | ตาราง 40 แถวขึ้นหน้าต่อเนื่องโดยไม่ chunk หน้าใน JS | 2 หน้าเอกสาร + 1 evaluation page |

ผลวันที่ 2026-10-02 จาก PDFreactor **12.7.1 (18291)**:

- `npm run test:ipplt` ผ่าน **12 test groups**: branches ของทั้ง 11 rules, zero/negative/tiny-positive amounts, address/agent/loan edge cases, independent array driver, validation, exact decimal formatting, escaping, input immutability และ Handlebars repetition
- สร้าง HTML/PDF ทั้ง 5 cases สำเร็จ; HTML ไม่มี script elements หรือ unresolved `{{...}}`
- ดูภาพหน้าเอกสารครบ **6 หน้า**; ข้อความ/ตาราง/closing/footer ไม่ทับกันใน fixtures ที่ตรวจ
- Extract PDF text ยืนยัน loan/code, multiple-payment details และ suppression ของ zero/agent case. `ROW-001` ถึง `ROW-040` อยู่ครบ เรียงตามลำดับ และไม่ซ้ำ
- ใน many-rows evaluation page ถูกแทรกเป็น physical page 2; เอกสารจริงอยู่ physical pages 1 และ 3 และพิมพ์เลขหน้า 1/2. ห้ามสมมติว่า evaluation page อยู่ท้ายเสมอ
- บันทึก page classification/ผลตรวจที่ [validation.json](output/ipplt/validation.json); PNGs/text/view-model JSON อยู่ข้าง PDF ใน `output/ipplt/`

ครั้งแรก strict template test พบ optional `recipient.title/postcode` ของ shared partial ไม่ถูกส่งมา จึงเพิ่ม empty fields ใน view model แล้วรันผ่าน. การเรียก localhost ใน sandbox ต้องใช้ execution approval ตาม environment; ไม่ได้เปลี่ยน service URL เพื่อหลบข้อจำกัด

## ขอบเขตที่ต้องเข้าใจ

- นี่เป็นตัวอย่าง executable PoC ไม่ใช่ IPPLT migration ที่เทียบ Exstream ครบ. อ่าน missing-source list ใน [IPPLT_RULE_REVIEW.md](IPPLT_RULE_REVIEW.md)
- `refund.totalAmount` รับ **decimal string สองตำแหน่ง** ภายใต้ contract ของตัวอย่าง; ใช้ BigInt ตรวจ `> 0` และ format string โดยไม่ใช้ floating-point rounding. ไม่อ้างว่าเทียบเท่า Exstream float/custom mask ทุกค่า; ไม่มีการคำนวณยอดรวมหรือแก้ input amounts
- `refund.paymentCount` ไม่ถูกคำนวณจาก `refund.items.length`. Native input ใช้ item objects; legacy adapter เท่านั้นที่รับ 3 parallel arrays และตรวจความยาวเท่ากัน. Source behavior เมื่อ arrays ไม่ตรงกันยังไม่ทราบ
- Legacy address normalization ใช้การลบ hyphen ทุกตัวเฉพาะตอนตรวจเงื่อนไขตาม interpretation ของ source `Replace` ที่ยังต้องยืนยันกับ source engine. Native input ส่ง `recipient.address.lines` ที่ต้องพิมพ์โดยตรง; ไม่มี placeholder suppression ใน core
- ใช้ shared header asset จาก POS และเลือก Code 39/barcode contract, sign-off, footer และ flow layout สำหรับตัวอย่าง. ไม่ได้พิสูจน์ common composition, barcode symbology/scanning หรือ layout parity ของ IPPLT
- ไม่มี matching-data baseline จึง **ไม่มี similarity score ที่ใช้ยืนยัน parity** และยังไม่ได้ benchmark performance. วันที่ 2026-10-03 เพิ่ม reference comparison สำหรับดูภาพตามรายละเอียดด้านล่าง
- ตัวอย่างจำนวนมากตรวจ 40 แถวข้อความสั้น ไม่ใช่การรับรองทุกความยาวชื่อ/ที่อยู่/row content. รอบแรกไม่ได้เปลี่ยน POS/DIS; รอบ shared-CSS follow-up ด้านล่างย้าย address/barcode ไปส่วนกลางและรัน regression ใหม่แล้ว

## เปิดเทียบใน viewer — 2026-10-03 (ผลก่อน refactor)

รัน HTML/PDF ทั้ง 5 synthetic cases ใหม่ และ diff สองคู่ที่มีรูปแบบใกล้เคียงกัน: single กับ Exstream A03 และ loan กับ A04. **ข้อมูลไม่ตรงกัน** จึงใช้ดูความต่างของภาพเท่านั้น ไม่ใช่ baseline acceptance หรือ business-rule validation

| คู่เทียบ | Page | Content | Grid |
|---|---:|---:|---:|
| single / A03 (historical) | 96.77% | 0.52% | 94.65% |
| loan / A04 (historical) | 96.56% | 1.32% | 94.92% |

แต่ละคู่มี Exstream 1 หน้าและ generated 1 document page + 1 evaluation page; diff ตัด evaluation page ออกจากการเปรียบเทียบ. A03 มี Poppler illegal-character warnings แต่ pipeline exit 0. ความต่างรวมทั้งชื่อ/ที่อยู่/วันที่/จำนวนเงิน ข้อความ และตำแหน่ง layout; ไม่เปลี่ยน masks/threshold เพื่อปรับคะแนน

[Review viewer](tools/review-viewer/index.html) มี navigation ไปสองคู่ IPPLT, ภาพ reference/rendered/diff, หมายเหตุข้อมูลไม่ตรงกัน และลิงก์ PDF ต้นฉบับ/ผลลัพธ์. Multiple/no-refund/many-rows มี preview links โดยไม่มีคะแนน. ปิด Pass/Fail เฉพาะ reference-only comparisons; POS/DIS ใช้ saved reports เดิมและยังมีปุ่มเหมือนเดิม

Context อยู่ใน `tools/review-viewer/review-context.json`; build ใหม่ด้วย `node tools/review-viewer/build.js`. ตรวจ generated viewer มีภาพ 12 ไฟล์ที่เปิดอ่านได้และ sign-off เฉพาะ POS/DIS, เปิดใน Chrome และตรวจ accessibility tree ว่ามี comparison panels/metrics/links ครบ. การตรวจ screenshot เพิ่มเติมถูก OS ปฏิเสธสิทธิ์ capture จึงไม่ได้บันทึก screenshot ของ browser รอบนี้

## Shared-CSS follow-up — 2026-10-03 (ก่อนแก้ barcode profile)

ผู้ใช้ยืนยันให้ใช้ shared CSS ก่อน custom CSS รายเอกสาร. Header/address/barcode ใช้ส่วนกลางจริงทั้งสาม letters; flow layout อยู่ `letter-flow.css`; `ipplt.css` เหลือ 2 variables. ดู [แนวทางและ code example](SHARED_STYLES.md). ไม่มีการเปลี่ยน rules/view-model/renderer

Rerender ทั้ง 5 cases และตรวจภาพทั้ง 6 document pages; จำนวนหน้าคงเดิม และ ROW-001–040 ครบครั้งเดียวตามลำดับ. Tests ผ่าน 12 groups. POS/DIS rerender/diff ใหม่แล้ว: Grid 99.38% / 99.57% และ PNG hashes เหมือนก่อน refactor

| Reference comparison ล่าสุด | Page | Content | Grid |
|---|---:|---:|---:|
| [single / A03](output/ipplt-single-reference-diff/report.json) | 97.62% | 5.84% | 96.95% |
| [loan / A04](output/ipplt-loan-reference-diff/report.json) | 97.27% | 5.04% | 95.49% |

Date/address/subject ของ single อยู่ใกล้ reference ขึ้น แต่ไม่ได้ตรงทั้งหน้า: flow spacing และ agent position ยังต่าง; synthetic inputs/font metrics ยังต่างจากต้นฉบับ. Agent ตาม flow บนหน้าสุดท้ายเพื่อไม่ทับเนื้อหาในหลายหน้า. Viewer rebuild ด้วยผลล่าสุด; คะแนนยังเป็น reference-only. ผล browser AX/screenshot ที่กล่าวด้านบนเป็นการตรวจรอบก่อน ไม่ได้ตรวจซ้ำในรอบนี้

## Barcode profile correction - 2026-10-03 (latest)

All three letters now use the shared 62.2x25pt barcode box and one Code39 generation profile. The partial accepts data only; fit="box" prevents SVG aspect fitting from shrinking longer barcodes vertically. See [SHARED_STYLES.md](SHARED_STYLES.md).

Fresh IPPLT reference results: single Page97.58/Content5.72/Grid96.95%; loan Page97.22/Content4.93/Grid95.50%. POS Grid99.39%, DIS99.49%. Actual bars measured 130x52 pixels for POS/IPPLT and 130x53 for DIS at150dpi. All four pairs changed only within the barcode region; evidence is in `output/barcode-profile-validation/measurements.json`. Five IPPLT PDFs retain their document-page counts, all40row markers are present in order,12test groups pass, and all6document pages were visually inspected. Viewer rebuilt/opened; browser AX was not rechecked. Physical scanner acceptance is still unverified.

## Standard business variables - 2026-10-03 (latest)

Primary fixtures now use standard input v1. The native runner has no Exstream adapter dependency. Read [IPPLT_DATA_CONTRACT.md](IPPLT_DATA_CONTRACT.md) for variable conventions, all field/rule mappings and native/legacy examples. Source-shaped fixtures moved to `data-samples/legacy/exstream/ipplt/`. Seven core decisions use semantic names; four legacy address conditions live only in the adapter.

Fresh verification: 15 test groups passed, plus 437 local old/new visible view-model comparisons. All five HTML files differ only in semantic data-rule labels; the six document-page PNG hashes are identical after PDFreactor rerender. Page counts and all 40 row markers remain correct. Evidence: `output/ipplt-standardization/`. No new baseline similarity/POS/DIS run; previous viewer metrics remain historical barcode-correction results.
