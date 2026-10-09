# Handoff — poc-html-template

เขียนเมื่อ 2026-09-24 (Asia/Bangkok). เก็บใน project ตามคำสั่งผู้ใช้ “write in poc-html-template” ซึ่งเจาะจงตำแหน่งแทน default temporary directory ของ skill `handoff`

## อัปเดตล่าสุด 2026-10-03 — developer platform structure

ผู้ใช้ขอออกแบบโครงสร้างรองรับ migration และการสร้าง template หลัง migration และแก้ scope ว่า **ทั้งหมด800templates, Letterประมาณ300, ทีมdeveloperทั้งหมดไม่มีBA**. เพิ่ม [PLATFORM_BLUEPRINT.md](PLATFORM_BLUEPRINT.md) และ [platform/README.md](platform/README.md): target monorepo, groups, standard packages, native/migration flows, rule/data/format/layout/assembly separation, developer Git/CLI/CI lifecycle และ production roadmap. ไม่ถือว่า deadline/SLAเดิมยืนยันใหม่

มี runnable slice ใน `platform/`: CLI list/inspect/validate/render/readiness/impact/build/verify/new, exact-version catalog, group definitionsทั้ง4, IPPLTmanifest/evidence, digest-addressed preview snapshotและtrace. แยก `src/ipplt/rules.js`/`src/shared/formatters.js`; rendererรองรับoptional --strict โดยplatformบังคับใช้. IPPLTเดิมยังรันเหมือนเดิม. Draft scaffoldsทั้ง4อยู่ output/platform-drafts. SI/form profiles และ Policy Pack assembly ยังไม่implemented; ไม่มี production publisher/API/queue/registry หรือ BA editor

Validation:15IPPLTgroupsและ11platformgroupsผ่าน. PlatformHTML5casesเหมือนnative path; PDF5casesสร้างสำเร็จผ่านPDFreactor (sandboxEPERMรอบแรก แล้วรันผ่านapproval). PNG6documentpagesเหมือนIPPLTเดิมทั้งหมด,จำนวนหน้าเดิม,40rowsครบ. SnapshotCLIรันHTMLตรงกัน. POS/DIS defaultHTMLเหมือนเดิม ไม่รันPDFdiffใหม่. หลักฐาน `output/platform-validation/results.json`. readinessออกcode2โดยตั้งใจเพราะIPPLTยังdraftและmissing-source/matching-input/business/visual/operational acceptance; localflagsไม่ใช่authenticatedapproval. impactตรวจเฉพาะregisteredpackagesปัจจุบันมีIPPLTเท่านั้น; POS/DISยังต้องmanualregressionจนกว่าจะregister

## อัปเดต 2026-10-03 — standard business variables

ผู้ใช้ไม่ต้องการใช้ชื่อตัวแปร Exstream บน platform ใหม่. Implement ที่ IPPLT แล้ว: primary fixtures เป็น standard JSON v1 (`document`, `recipient`, `application`, `refund`, `agent`, `contact`), contract validator ตรวจ types/version/unknown fields, core ใช้ 7 semantic decisions ไม่มี source field/rule IDs. Parallel payment arrays รวมเป็น items objects; address lines พร้อมแสดง. ชื่อเดิมและ 4 address normalizations อยู่เฉพาะ `src/adapters/exstream-ipplt.js`; old synthetic fixtures อยู่ `data-samples/legacy/exstream/ipplt/`. Native runner ไม่ import adapter. Template data-rule และ ruleTrace ใช้ semantic names

อ่าน [IPPLT_DATA_CONTRACT.md](IPPLT_DATA_CONTRACT.md) สำหรับ field/rule mapping, conventions และ limitations. Method codes1/B/6คงเดิมเพราะยังไม่มี dictionary ครบ; resolved amount/date/description/reference ยังต้องเตรียม upstream. Tests15groupsและ437local before/after comparisonsผ่าน. Rerender5PDFsได้ PNG hashes ของ6documentpagesเหมือนก่อนทุกไฟล์; HTMLต่างเพียงrule labels;40rowsครบ. หลักฐาน `output/ipplt-standardization/`. ไม่แก้ CSS/shared renderer/POS/DIS และไม่รัน similarity diff ใหม่; viewer scores ล่าสุดมาจากรอบ barcode ด้านล่าง

## อัปเดต 2026-10-03 — barcode profile correction

ผู้ใช้ทักว่าใช้ shared CSS แต่ barcode ยังต่างขนาด และสั่งแก้แล้ว. ตอนนี้ทุก letter ใช้ 62.2×25pt, Courier5pt/spacing2pt; partial กลางกำหนด Code39 height20mm scale2 fit="box". ลบ barcodeHeight จาก templates และ size/spacing overrides จาก DIS/flow. Renderer เพิ่ม opt-in preserveAspectRatio="none" เพื่อรักษาความสูงที่เห็นแม้ค่า barcode ยาวต่างกัน. Rules/data ไม่เปลี่ยน

Rerender ทั้งสาม letters และ IPPLT 5 cases; tests 12 groups ผ่าน, 40 rows ครบ, page counts เดิม; ตรวจภาพ 6 document pages. วัดแท่ง PDF150dpi ได้ 130×52px ทุกคู่ ยกเว้น DIS130×53px จาก raster rounding. ทั้ง 4 comparison pairs มี zero changed pixels นอกบริเวณ barcode. หลักฐาน `output/barcode-profile-validation/measurements.json`, crops เรียง POS/DIS/IPPLT. Grid ล่าสุด POS99.39 DIS99.49 IPPLTsingle96.95 loan95.50%. Viewer rebuild/open แล้ว. ยังไม่ได้ทดสอบสแกนงานพิมพ์จริง; barcode density ต่างตามความยาวข้อมูล. ผล PNG identical ของรอบก่อนด้านล่างเป็นประวัติ ไม่ใช่ผลหลังแก้ barcode

## อัปเดต 2026-10-03 — shared CSS first (ก่อนแก้ barcode)

ผู้ใช้ยืนยันให้ใช้ shared CSS ก่อน custom CSS รายเอกสาร. ทำแล้ว: `letter-address.css` ใช้จริงใน POS/DIS/IPPLT, `letter-header.css` รองรับ flow โดย default เดิมคงอยู่; เพิ่ม `letter-flow.css` และลด `ipplt.css` เหลือ 2 tokens. อ่าน [SHARED_STYLES.md](SHARED_STYLES.md). Rules/renderer ไม่เปลี่ยน. Rerender POS/DIS แล้ว PNG hashes เหมือนเดิม, Grid 99.38/99.57%. IPPLT tests 12 groups และ PDFs 5 cases ผ่าน; ตรวจภาพ 6 document pages, 40 markers ครบ. Reference Grid single96.95/loan95.49%; viewer rebuild. ยังมี spacing/agent/font/data differences จึงไม่ใช่ parity. รายละเอียดใน IPPLT_EXAMPLE/MIGRATION และ `output/shared-css-validation/after.json`. ข้อความก่อนหน้าด้านล่างเป็นประวัติ รวมถึงสถานะที่ยังไม่ได้รับอนุญาตปรับ layout ซึ่งถูกแทนที่ด้วยคำสั่งล่าสุดนี้แล้ว

## อัปเดต 2026-10-03 — IPPLT comparison viewer (ก่อน refactor)

ผู้ใช้ขอรันและเทียบใน viewer; ทำเสร็จแล้ว. รัน PDFs ทั้ง 5 synthetic cases ใหม่, diff single กับ Exstream A03 และ loan กับ A04. Grid 94.65% / 94.92%; ข้อมูลต่างกันจึงไม่ใช่ parity acceptance. Viewer เปิดใน Chrome แล้ว มี reference/rendered/diff panels และลิงก์ previews ของ cases ที่ไม่มี matching baseline. เพิ่ม `tools/review-viewer/review-context.json` และ builder รองรับ reference-only notes/ปิด sign-off เฉพาะสองคู่ดังกล่าว. POS/DIS reports ยังเป็น saved results เดิม. ตรวจภาพไฟล์ครบและ UI accessibility tree; capture screenshot ถูก OS ปฏิเสธ. ดู [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md) และ MIGRATION สำหรับผล/ข้อจำกัด. ยังไม่มีคำสั่งให้ปรับ layout ให้เหมือน baseline หรือย้ายข้อมูลลูกค้าเป็น fixtures

## อัปเดตล่าสุด 2026-10-02 — recheck DXF ที่เพิ่มมา

**งานล่าสุดเสร็จแล้ว: IPPLT Handlebars executable example.** ผู้ใช้ขอทดสอบใน PoC และดูโค้ด จึงเพิ่ม [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md), rule/view-model module, `.hbs`/CSS, 5 synthetic fixtures, tests และ standalone PDF CLI. รัน `npm run test:ipplt` ผ่าน 12 groups; `npm run example:ipplt -- --pdf` สร้าง 4 cases และ `npm run example:ipplt -- many-rows --pdf` สร้าง stress case. ตรวจภาพทั้ง 6 document pages แล้ว; 40 rows ครบตามลำดับ. Outputs อยู่ `output/ipplt/`. PDFreactor 12.7.1 ยัง evaluation และแทรก evaluation page กลาง many-rows PDF. ไม่มี similarity score/benchmark หรือ upstream formula parity. ตัวอย่างรับ resolved values; missing-source conclusions เดิมยังใช้ได้. ไม่เปลี่ยน POS/DIS/shared renderer. อ่านคู่มือตัวอย่างก่อนรัน; `src/html-to-pdf.js` สร้าง PDF โดยไม่ต้องมี baseline ได้แล้ว

**ประวัติการตัดสินใจหลัง audit:** ผู้ใช้เลือกเจาะ IPPLT และถามทางเลือกไม่ใช้ JS แล้ว. [IPPLT_RULE_REVIEW.md](IPPLT_RULE_REVIEW.md) ยืนยัน 11 rules/12 nonzero use sites resolve ครบ, 26 variables ไม่มี formula ทุกตัว, ไม่มี source mapping/วิธีเตรียม payment values และไม่มีนิยาม common header/barcode/sign-off/footer บางส่วนใน DXF นี้. ภาพ PDFs ต้นฉบับทั้ง 4 cases เป็น single-payment output ทั้งหมด; multiple-payment Exstream coverage ยังขาด. ได้เสนอ JSON/DMN/non-JS alternatives และอธิบายว่า server-side Handlebars ต่างจาก script ใน HTML; จากนั้นผู้ใช้ขอทดลอง Handlebars ตามงานล่าสุดด้านบน. ยังไม่ได้ย้าย production stack

ผู้ใช้ขอประเมินว่า DXF ที่เพิ่มมามี formulas/logic/value formatting พอสำหรับย้ายไป rules บน platform + Handlebars + PDFreactor หรือไม่. ตรวจครบ 15 DXFs และ metadata 26 PDFs แล้ว ผลอยู่ใน [DXF_CAPABILITY_REVIEW.md](DXF_CAPABILITY_REVIEW.md) และ [inventory](output/dxf-audit-2026-10-02/inventory.json). พบ 116 variable formulas (Cube 113, ZLULMSTM 3); จดหมายอื่นมี usage rules แต่ไม่มี variable formula bodies. พบ missing rule IDs ใน ZLPSP, invalid U+0004 ใน 2 DXFs และ PDF application mismatch ของ ZLULMSTM. ZLFINCHG provision source ยังขาดเหมือนเดิม

มี architecture และตัวอย่างแปล IPPLT สอง rules ในเอกสาร ทดสอบตัวอย่าง JS ด้วย synthetic cases 10 กรณีผ่าน. ยังไม่ได้พัฒนา full letter ใหม่, เปลี่ยน renderer, รัน PDFreactor หรือวัด similarity ใหม่. ตอนจบ audit แรกเสนอ IPPLT เป็นตัวอย่างถัดไป; ผู้ใช้เลือกตรวจต่อแล้วตาม follow-up ด้านบน. ข้อมูลสถานะก่อนหน้าด้านล่างเป็นประวัติ

## จุดเริ่มต้นสำหรับ session ถัดไป

ผู้ใช้ต้องการพัฒนา `poc-html-template` ต่อ งานล่าสุดคือเพิ่มจดหมายตัวที่สอง DIS_ZLAGCHG และทำเสร็จแล้ว ไม่มีงาน implementation ที่กำลังรันหรือคำถามค้างอยู่ และยังไม่ได้เลือก template/feature ถัดไป คำขอล่าสุดคือเขียน handoff เท่านั้น

อ่านตามลำดับ:

1. [AGENTS.md](AGENTS.md) — ข้อตกลงการทำงาน โดยเฉพาะตอบภาษาไทยและอัปเดตเอกสารพร้อมการเปลี่ยนแปลง
2. [README.md](README.md) — โครงสร้าง คำสั่ง และตาราง implemented letters/ผลล่าสุด
3. [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — flow Handlebars → PDF, ขั้นตอนสร้าง/แก้ template และข้อจำกัดเครื่องมือ
4. [MIGRATION.md](MIGRATION.md) — workflow, POS measured layout ในส่วน B, DIS implementation/validation ในส่วน H และ Change Log

ใช้เอกสารใน project นี้เป็นหลักสำหรับ implementation ปัจจุบัน เอกสารระดับ workspace เช่น `../CONTEXT.md` มีแนวคิดเก่าจากอีก track ที่อาจไม่ตรงกับ Handlebars PoC นี้ อย่านำมาทับพฤติกรรมปัจจุบันโดยอัตโนมัติ

## บริบทจากบทสนทนาที่ควรรู้

- ผู้ใช้ให้รัน POS แล้วขอปรับตำแหน่งและขนาดฟอนต์ให้แม่นยำถึง 98%; assistant ระบุเป้าหมายเป็น **Grid similarity** และทำเกินเป้าหมาย ผู้ใช้ตอบรับผลงาน แต่ไม่ได้มี formal business sign-off
- ผู้ใช้ถาม Handlebars และ production readiness: อธิบายว่าใช้เป็น template layer ได้ แต่ PoC ยังขาด validation, error handling, versioning และ operational controls; ยังไม่มีคำสั่งให้ implement production hardening
- ผู้ใช้ขอ flow และคู่มือ developer จึงมี `DEVELOPER_GUIDE.md` แล้ว ไม่ต้องเขียนใหม่
- เมื่อผู้ใช้สั่ง “develop next letter” เลือก DIS_ZLAGCHG จาก PDF จดหมายอีกไฟล์ที่มีใน workspace แจ้งแล้วว่าไม่มี matching DXF และพัฒนาจาก PDF เป็น PoC
- ไม่ได้แก้ implementation ของ sibling `../poc-translator/`; เคยใช้ startup script ของ PDFreactor ที่อยู่ใน sibling เท่านั้น

## สถานะและหลักฐานที่ให้ใช้ต่อ

งาน source/asset/schema และรายละเอียดผลตรวจถูกบันทึกไว้ใน README และ MIGRATION แล้ว ไม่คัดลอกซ้ำที่นี่:

- [POS diff report](output/pos-zlbnchg-diff/report.json) และ [PDF](output/pos-zlbnchg-diff/html-rendered.pdf)
- [DIS diff report](output/dis-zlagchg-diff/report.json) และ [PDF](output/dis-zlagchg-diff/html-rendered.pdf)
- [DIS synthetic long-name fixture](data-samples/dis-zlagchg.long-name.json) และ [PDF](output/dis-zlagchg-long-name.pdf) — ไม่มี matching baseline จึงไม่มี similarity score
- [Review viewer](tools/review-viewer/index.html) — build ล่าสุดแสดงสอง baseline reports และเปิดให้ผู้ใช้แล้ว

การตรวจ POS regression หลังแยก shared components ได้ภาพ rendered PNG hash ตรงกับก่อนแก้ รายละเอียดอยู่ใน MIGRATION ส่วน H ผลทั้งหมดเป็นการรันวันที่ 2026-09-23; ในวันเขียน handoff ตรวจเฉพาะ saved reports/เอกสาร ไม่ได้รัน pipeline หรือยืนยันสถานะ service ใหม่

งานค้างเชิง PoC ได้แก่ reuse percentage และ time-per-template benchmark; ข้อจำกัดเรื่องข้อมูลหลายกรณี, DXF, font parity, code scanning และ production อยู่ใน MIGRATION ส่วน H / DEVELOPER_GUIDE ส่วน 6–7 อย่าอ้างว่าปิดงานเหล่านี้แล้วเพราะ Grid สูง

## ข้อควรรู้เชิงปฏิบัติสำหรับ agent

- Working directory คือ project นี้; workspace root อยู่เหนือขึ้นไปหนึ่งระดับ ตอนตรวจครั้งก่อน `git status` รายงานว่าไม่ใช่ Git repository จึงไม่มี commit/branch/PR สำหรับงานนี้ ตรวจอีกครั้งก่อนใช้ Git
- `src/render.js` สร้าง HTML เท่านั้น; PDF generation ปัจจุบันอยู่ใน diff harness และต้องมี baseline ดูคำสั่งจริงใน README อย่าคาดว่า `npm run render` โดยไม่มี arguments จะ batch ทุก template
- PDFreactor เคยทำงานที่ `http://localhost:9423` และสร้าง evaluation page; อย่านับหน้านี้เป็น document overflow แต่ต้องตรวจจำนวนหน้าเอกสารจริงด้วย
- Sandbox เคยบล็อกการเชื่อมต่อ localhost ด้วย EPERM. ใช้ execution approval/escalation ตาม environment เมื่อจำเป็น ไม่เปลี่ยน implementation เพื่อหลบข้อจำกัด
- `/usr/bin/python3` และ Homebrew Python 3.13 ที่ลองไม่มี `pdfplumber`; ใช้ Poppler (`pdftohtml`, `pdftotext`, `pdftoppm`, `pdfimages`) สำเร็จ รายละเอียดหน่วย XML และ normalization อยู่ใน MIGRATION
- ผลชั่วคราวใน `/tmp/dis-zlagchg/` และ `/tmp/pos-*` อาจหายได้ ไม่ใช่ artifacts ที่ต้องพึ่งพา. Synthetic DIS PDF ถูกสร้างผ่าน REST API โดยตรงในรอบตรวจ ไม่ได้เพิ่ม PDF-only CLI ลง project
- Partial/header extraction มีผลทั้ง POS/DIS; หากแก้ shared layer ให้ regression ทั้งสอง template. ส่วน app-download ใช้ใน DIS และ signature ใช้ใน POS ตามที่เอกสารระบุ
- `barcode` helper คืน `SafeString` อยู่แล้ว ดังนั้น comment เก่าใน `src/render.js` ที่บอกว่าจำเป็นต้องใช้ triple braces ไม่แม่นทางเทคนิค คู่มืออธิบายไว้แล้ว; ไม่ได้แก้ runtime ใน session นี้

## การต่อยอดที่เป็นไปได้ — ยังไม่ได้รับคำสั่งให้ทำ

เริ่มจากเป้าหมายใหม่ของผู้ใช้ ไม่เลือกงาน production overhaul เอง หากผู้ใช้ให้ทำ template ถัดไป ให้สำรวจ inputs ก่อน: ณ handoff เดิม สองไฟล์ใน `../Document/Letter/` ถูกทำแล้ว แต่การสำรวจเพิ่มเติมวันที่ 2026-09-24 พบ POS_ZLFINCHG อีก 10 PDFs และ POS_ZLFSURI อีก 2 PDFs รวมถึง DXF เพิ่ม (ดู `INPUT_REVIEW.md`); ยังไม่ได้ implement กลุ่มใหม่ ส่วนเอกสารประเภทอื่นอยู่ใน `../Document/SI/`, `../Document/SI_ECommerce/`, `../Document/Base_Plan/` และ DXF มีจำกัดใน `../DXF/`

เมื่อจะพัฒนาต่อ รักษาหลักการตรวจภาพและข้อความควบคู่ metrics; ไม่ปรับ masks/threshold เพื่อให้คะแนนผ่าน และไม่ใช้ภาพทั้งหน้าแทน semantic template

## Suggested skills

ให้ agent ถัดไปเรียกผ่าน Skill tool หากมี หรืออ่าน `SKILL.md` ตามเครื่องมือที่ environment รองรับ เฉพาะเมื่อเกี่ยวข้องกับงาน:

- `anthropic-skills:pdf` — อ่าน/วัด PDF, extract text/images และตรวจผล render; ใช้แล้วใน session นี้
- `engineering:documentation` — ดูแลคู่มือและ Change Log ให้ตรงกับ implementation; ใช้แล้วใน session นี้
- `diagnosing-bugs` — เมื่อพบปัญหา layout/rendering ที่ต้องวิเคราะห์อย่างเป็นระบบ
- `handoff` — เมื่อต้องส่งต่องานอีกครั้ง; source ที่ผู้ใช้ระบุคือ `/Users/amber/.codex/skills/handoff/SKILL.md`

ไม่ต้องเรียกทุก skill ตั้งแต่เริ่ม และไม่ต้อง spawn sub-agents เว้นแต่ผู้ใช้หรือ applicable instructions อนุญาตตามกติกาของ session

## Follow-up 2026-09-24 — input discovery

อ่าน handoff/คู่มือและตรวจ inputs ใหม่แล้ว ผลอยู่ใน [INPUT_REVIEW.md](INPUT_REVIEW.md). รัน DXF inspector สำเร็จสำหรับ APP_ZLFINCHG และ APP_LTULFSU001 และ extract ข้อความ POS_ZLFINCHG ทั้ง 10 PDFs ด้วย Poppler. ยังไม่ได้เลือกขอบเขตจากผู้ใช้, แก้ template หรือรัน PDFreactor ใหม่; มีคำถามเรื่องงานถัดไปและขอบเขต POS_ZLFINCHG รอคำตอบอยู่.

### Clarification หลังสำรวจ inputs

ผู้ใช้ยืนยัน POS_ZLFINCHG ทั้ง 10 PDFs มาจาก template เดียวกัน คำถามเดิมให้เลือกทำ 2 หรือ 12 หน้าไม่ใช่การแบ่ง template ที่ถูกต้อง ตรวจ DXF พบ normal letter + pass-through RiderProvision ผ่าน `F_Placeholder_MainPlanRiderProvisionNewDuplex`. PDF 12 หน้า = letter 2 + OPD Plus 1 + blank filler 1 + ADD Plus 8. รายละเอียดและข้อจำกัด source mapping อยู่ใน `INPUT_REVIEW.md`; implementation ใหม่ยังไม่เริ่ม

### ทิศทางล่าสุด: ข้าม POS_ZLFINCHG

ผู้ใช้สั่งข้าม POS_ZLFINCHG และถามความต่าง POS_ZLFSURI สอง PDFs. ตรวจแล้วพบ 1 หน้าไม่มีหักเงินกู้ กับ 2 หน้ามีหักเงินกู้และใบเสร็จเพิ่ม. PDF Title ทั้งคู่คือ APP_LTZLFSURI001 แต่ DXF ที่มี APP_LTULFSU001 เป็นคนละ application (ส่วนที่สองขายหน่วยลงทุน). ยังไม่พบ matching DXF จึงอธิบาย output ได้แต่ยังไม่ยืนยันกฎประกอบใบเสร็จ ดู INPUT_REVIEW.md

### ทิศทางล่าสุด: กลับ ZLFINCHG พร้อม spec

ผู้ใช้ให้กลับมาวิเคราะห์ `Spec/Template_Spec_APP_ZLFINCHG.xlsx` เทียบ DXF. อ่านครบทุก sheet แล้ว พบ `VariableFormula!E8` เรียก `SET_RIDER_PROVISSION_LA()` และ `XmlMap!F146` รับ external plan ของ added rider. ยังไม่มี function body หรือสูตรเติม placeholder; loop เก่าที่เรียก FG_Add_Rider_LA อยู่ใน comment. ดู INPUT_REVIEW.md สำหรับ cell references และสิ่งที่ต้อง export ต่อ. ยังไม่ได้เริ่ม implementation
