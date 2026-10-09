# IPPLT — ความครบของ DXF และทางเลือกไม่ใช้ JavaScript

ตรวจ 2026-10-02. Source: [APP_IntegralLife_IPPLT.dxf](../DXF/APP_IntegralLife_IPPLT.dxf). รายการ declarations/rules/references พร้อม SHA-256 อยู่ใน [source-inventory.json](output/ipplt-audit-2026-10-02/source-inventory.json)

**Implementation follow-up:** ผู้ใช้ขอทดลอง Handlebars แล้ว มี [IPPLT_EXAMPLE.md](IPPLT_EXAMPLE.md) พร้อมโค้ด rules/template, synthetic fixtures และ PDFs. ผลตรวจ source ด้านล่างยังใช้ได้: ตัวอย่างรับ resolved values จึงไม่ได้ปิดช่องว่าง upstream formulas/common composition. Validation ของตัวอย่างแยกจากการตรวจ source รอบนี้

## ข้อสรุป

**Rules ที่ประกาศและอ้างถึงภายใน DXF นี้ครบ แต่สูตรเตรียมข้อมูลและองค์ประกอบของ PDF ทั้งฉบับยังไม่ครบใน export นี้**

| สิ่งที่ตรวจ | ผล |
|---|---|
| XML ต้นฉบับ | Parse ผ่าน ไม่ต้อง normalize |
| Usage-rule definitions | 11 bodies ไม่ว่าง; 12 จุดใช้งาน nonzero IDs resolve ครบ |
| Rule input identifiers | Resolve เป็นตัวแปรที่ประกาศหรือ constructs/`Replace` ที่เห็นใน rule ครบ |
| Variables | 26: 25 `constant`, 1 `fileonly`; 3 เป็น arrays |
| Variable formulas | **0/26**: `formula=""` และ `is-a-formula="false"` ทุกตัว |
| Variable references | ทั้ง variable-use และ row-count reference resolve ครบ |
| Documents/pages | 1 normal document `DOC_IPPLT`, 1 page definition, 4 paragraphs; ไม่พบ pass-through document |
| Input mapping/derived values | ไม่ได้ให้ source paths หรือสูตรเตรียม payment/date values ในไฟล์นี้ |
| Full output components | PDF มีองค์ประกอบที่ไม่พบนิยามใน DXF นี้ เช่น logo/header, barcode, sign-off, policy/page footer |
| PDF fixtures | 4 ไฟล์ Title ตรง application; ทุกไฟล์ 1 หน้า; ไม่มีตัวอย่าง numbered multiple-refund list ที่เห็นใน output |

ตัวเลข 11/11 หมายถึง static reference closure ภายในไฟล์ ไม่ใช่ 100% business-rule coverage, production completeness หรือยืนยันว่ารันเทียบ Exstream แล้ว. `constant` ใน export ไม่ใช่เหตุผลให้ hard-code design/sample values เป็นข้อมูลจริง

## Rules ทั้ง 11 และตำแหน่งใช้งาน

ทุก rule ตั้ง `default-include="false"`. แถวต่อไปนี้ย่อคำสั่งตาม source โดยไม่เปลี่ยนเงื่อนไขให้ตรงความคาดหมายทางธุรกิจ

| Rule | เงื่อนไข include | ส่วนที่ควบคุม | Definition / use lines |
|---|---|---|---|
| 9145 | `U_Agent_Full_Name <> ""` | กล่องตัวแทน/สาขาทั้งกล่อง | 176 / 298 |
| 9357 | `U_Addrs1 <> "" AND U_Addrs1 <> "-"` | Address line 1 | 185 / 404 |
| 9358 | `U_Addrs2 <> "" AND U_Addrs2 <> "-"` | Address line 2 | 194 / 409 |
| 9359 | `Replace(U_Addrs3,"-","") <> "" OR Replace(U_Addrs4,"-","") <> ""` | แถวรวม address 3/4 | 203 / 414 |
| 9360 | `U_Province_Long_Des <> "" OR U_PostCode <> ""` | จังหวัด/รหัสไปรษณีย์ | 212 / 423 |
| 9361 | count = 1 และ method เป็น `1`, `B` หรือ `6` | บรรทัดรหัส `NB_` + product line + `D` + `U_Payment_Amount_INT` | 221 / 445 |
| 9362 | count > 1 และ `U_Payment_Amount_Draft <> ""` | บรรทัดรหัสที่ใช้ draft amount string | 232 / 456 |
| 8385 | `IL_U_LoanReferenceNumber <> ""` | แถวเลขบัญชีเงินกู้ | 241 / 576 |
| 8359 | amount > 0 และ count = 1 | ข้อความคืนเงิน + `U_Payment_Method_One_TemplateShow` | 250 / 605 |
| 8381 | amount > 0 และ count > 1 | ข้อความคืนเงินแบบหลายรายการ **และ** block ตารางรายการ | 259 / 615, 625 |
| 8360 | amount > 0 | Whitespace block หลังส่วนคืนเงิน ไม่ใช่ข้อความธุรกิจเพิ่ม | 268 / 652 |

ในตาราง count = `IL_DRV_Check_Multi_Payment`, method = `IL_DRV_PaymentMethodStr`, amount = `U_Payment_Amount`.

รายละเอียดที่ต้องรักษาเมื่อย้าย:

- Rules 9361/9362 **ไม่ได้ตรวจยอดเงิน > 0** อย่าเติมเงื่อนไขนี้เพียงเพราะ refund paragraph ตรวจยอดเงิน
- 9359 ใช้ `Replace` เพื่อตรวจการ include; ไม่ได้สั่งให้แก้ข้อความที่พิมพ์เป็นค่าที่ replace แล้ว และไม่ได้ใช้ trim. ต้องตรวจ null/space/replace behavior ก่อนเลือก semantics ฝั่งใหม่
- ชื่อที่เห็นใน design inline บางแห่งไม่ตรง binding จริง เช่น address 3 แสดง placeholder caption `<Addrs2>` แต่ `varuse-variable` อ้าง `U_Addrs3`. ใช้ binding เป็นหลัก
- ไม่พบ custom business-function call ใน usage rules ชุดนี้; การทำให้ `Replace`, empty string, numeric comparison ทำงานเท่าต้นทางยังต้องยืนยันด้วย fixtures

## Multiple-payment list และรูปแบบค่า

แถวที่บรรทัด 632 ตั้ง `auto-row-process="variable-count"` และ `auto-row-ref-var="Variable|6227|IL_DRV_PaymentDetail_PaymentMethod"`.

- จำนวนแถวขับด้วย array `IL_DRV_PaymentDetail_PaymentMethod`
- คอลัมน์ที่พิมพ์ใช้ `IL_DRV_No_List` กับ `U_Payment_Method_One_Template_List` แบบ automatic array use
- การแสดง block ใช้ count จาก `IL_DRV_Check_Multi_Payment` แยกจาก array ที่ขับจำนวนแถว
- ต้องได้กฎสร้าง/เรียง/จัดแนวทั้ง 3 arrays และ count; **ยังสรุปไม่ได้ว่า count = array length** ในทุกกรณี. การแปลงเป็น array of objects ต้องรักษาความสัมพันธ์เดิม

`U_Payment_Amount` เป็น float, variable format `12`, `num-digits="2"`; use sites บรรทัด 608/618 มี `varuse-format="0"`, custom mask `###,###,###,##0.##`, digits 2. PDFs ทั้งสี่แสดงยอดแบบสองทศนิยม แต่มีเพียงตัวอย่างยอดลงท้าย `.00`; จึงยังไม่พิสูจน์ fractional rounding หรือความหมายของ optional mask digits. ไม่ควรประกาศว่ามีครบแล้วเพียงเพราะอ่าน format attributes ได้

`U_Print_Date` เป็น **string** ไม่ใช่ date variable ที่มี formula. ข้อความ payment detail และ amount fragments ที่ใช้สร้างรหัสก็เป็น strings จึงยังไม่ทราบ formatting/lookup ต้นทาง

## สูตร/ข้อมูลที่ยังต้องหา

| กลุ่ม | ตัวแปรสำคัญ | สิ่งที่ต้องได้เพิ่ม |
|---|---|---|
| จำนวนเงิน | `U_Payment_Amount` | Source mapping หรือวิธีคำนวณยอดคืน รวมถึง precision/rounding |
| จำนวนและประเภทการคืน | `IL_DRV_Check_Multi_Payment`, `IL_DRV_PaymentMethodStr` | วิธีนับ การจัดกลุ่ม และ code mapping; ไม่เดาความหมาย `1/B/6` จากตัวอักษร |
| รหัสใต้ address | `U_Payment_Amount_INT`, `U_Payment_Amount_Draft`, `IL_DRV_ProductLine` | วิธีเตรียม amount strings, scale/leading zeros และ product-line mapping |
| ข้อความวิธีคืนเงิน | `U_Payment_Method_One_TemplateShow`, `U_Payment_Method_One_Template_List` | สูตร/lookup สร้างข้อความ รายละเอียดบัญชี และวันดำเนินการ; ไม่สร้างข้อความจากการเดา field names |
| รายการซ้ำ | `IL_DRV_PaymentDetail_PaymentMethod`, `IL_DRV_No_List` และ detail list | Row alignment, ordering, empty rows, count semantics |
| วันที่/ชื่อ/ที่อยู่ | `U_Print_Date`, name/address fields | Input paths, date/calendar convention, normalization และ defaults |
| องค์ประกอบร่วม | Header/logo, barcode, sign-off, footer | Shared resources/composition logic, barcode payload และ symbology, page numbering |

ค้น variable declarations ชื่อเดียวกันของ 9 fields หลัก (amount/count/fragments/detail lists/date) ใน DXF ทั้ง 15 ไฟล์แล้วไม่พบ formula ที่เติมช่องว่างนี้; ไม่ใช่การพิสูจน์ว่าไม่มี upstream source ในระบบ Exstream. โฟลเดอร์ Spec ปัจจุบันมี workbook ZLFINCHG และ IPMRF แต่ไม่มี IPPLT workbook ตามชื่อไฟล์; ไม่ได้เปิดอ่าน workbook ใหม่ในรอบนี้

ควร export **IPPLT input mapping/variable formulas/shared functions/reference lookups + common page components** และ input XML/JSON ที่สร้าง PDFs ทั้ง 4. ถ้าระบบต้นทางจะส่งค่าที่คำนวณครบมาอยู่แล้ว platform ใหม่สามารถรับ resolved-value contract ได้ โดยระบุว่าการคำนวณยังเป็นหน้าที่ของระบบต้นทาง

## PDF cases ที่ตรวจจริง

อ่าน metadata, extract text และดูภาพครบทั้ง 4 หน้าของ 4 PDFs ใน `../PDF/Letter/IPPLT/` โดยใช้ case suffix A01–A04 เท่านั้นในรายงาน เพื่อไม่บันทึกข้อมูลลูกค้าเพิ่ม

| Case | ข้อความคืนเงินที่สังเกต | Loan-reference row | รหัสใต้ address |
|---|---|---|---|
| A01 | คืนเข้าบัตรเครดิต; ข้อความหนึ่งรายการ | ไม่แสดง | ไม่แสดง |
| A02 | คืนผ่านพร้อมเพย์; ข้อความหนึ่งรายการ | ไม่แสดง | ไม่แสดง |
| A03 | คืนเข้าบัญชีธนาคาร; ข้อความหนึ่งรายการ | ไม่แสดง | ไม่แสดง |
| A04 | คืนให้ธนาคารเพื่อชำระเงินกู้; ข้อความหนึ่งรายการ | แสดง | แสดง |

รูปแบบสอดคล้องกับ single-payment branch หากใช้ source/version เดียวกัน แต่ยังไม่มี runtime payload ยืนยันค่าที่ทำให้แต่ละ rule ผ่าน. ไม่มี output ตัวอย่าง multiple-payment list, zero amount, absent-agent หรือ address edge cases เพียงพอให้ยืนยัน branch coverage

DXF ไม่มี graphic/barcode elements หรือ definitions ของ company header/logo, sign-off และ policy/page footer ที่ปรากฏใน PDFs. อาจมาจาก shared composition/post-processing หรือคนละ export revision; ยังระบุเจ้าของขั้นตอนนั้นไม่ได้จากไฟล์นี้. Page title ตรงกันช่วยจับคู่ application แต่ไม่รับรอง revision เดียวกัน

## ทางเลือกไม่ใช้ JS

แยกความต้องการสองแบบ: (1) ผู้ดูแล template ไม่เขียน JS แต่ runtime อาจใช้ Node อยู่ หรือ (2) document-generation runtime ไม่ใช้ JavaScript/Node เลย. ทั้งสองแบบทำได้ และทุกแบบยังต้องใช้ source ที่ขาดข้างต้น

### A. Condition builder → JSON config → Java/.NET evaluator

เหมาะกับ IPPLT และสอดคล้องกับ [letter-group configuration design](../Design/letter-group-configuration-design.md) ที่มี `eq/ne/in/gt/all/any` และ registered formatters อยู่แล้ว. ผู้ดูแลเลือก field/operator/value ผ่าน UI; เก็บเป็น data configuration ส่วน evaluator เขียนครั้งเดียวด้วย Java หรือ C# ก็ได้

ตัวอย่างเชิงออกแบบสำหรับ rule 8359 (schema illustrative; ยังไม่ได้ implement evaluator):

```json
{
  "id": "ipplt.showSinglePayment",
  "sourceRule": "APP_IntegralLife_IPPLT:8359",
  "when": {
    "op": "all",
    "args": [
      { "op": "gt", "left": { "field": "U_Payment_Amount" }, "right": { "value": 0 } },
      { "op": "eq", "left": { "field": "IL_DRV_Check_Multi_Payment" }, "right": { "value": 1 } }
    ]
  }
}
```

ข้อดี: ใช้ UI/domain vocabulary ของ CCM ได้ตรง และ rules ง่ายมีโครงสร้างชัด. ภาระ: ทีมต้องดูแล schema, type/null semantics, validation, evaluator และ tests เอง. JSON เป็นรูปแบบเก็บข้อมูล **ไม่ใช่ rule engine สำเร็จรูป**. `Replace` ใน rule 9359 ต้องเป็น registered operation ที่ทดสอบแล้ว; `present` อาจไม่เท่ากับ `<> ""`

### B. DMN decision tables + FEEL

เหมาะเมื่อ business analysts ต้องอ่าน/แก้ decision tables และใช้เครื่องมือมาตรฐานร่วมกัน. เช่น Apache KIE/Drools DMN หรือบริการ DMN ที่เลือกใช้; FEEL เป็นภาษาของ decision model ไม่ใช่ JavaScript. รองรับ typed decisions/expressions แต่ต้องจัดการ missing/null และ engine compatibility. [เอกสาร Apache KIE DMN](https://kie.apache.org/docs/10.1.x/drools/drools/DMN/index.html)

ตัวอย่าง decision เฉพาะ refund-paragraph mode ภายใต้ validated finite amount และ nonnegative integer count:

| Amount | Count | ผล |
|---|---|---|
| > 0 | 1 | SINGLE |
| > 0 | > 1 | MULTIPLE |
| <= 0 | ทุกค่าใน domain | NONE |
| > 0 | 0 | NONE |

เลือก UNIQUE สำหรับ decision ตัวอย่างนี้เพราะ rows ไม่ทับกัน. ไม่ใช้ตาราง UNIQUE อันเดียวครอบทั้ง 11 rules เพราะกล่องที่อยู่/ตัวแทน/คืนเงินอาจแสดงพร้อมกัน. แยก decisions หรือเลือก multi-hit policy ที่สอดคล้องกับผลลัพธ์; UNIQUE อย่างเดียวไม่ได้รับประกันว่าครอบคลุม inputs ทุกค่า. [DMN hit policies](https://docs.camunda.io/docs/components/modeler/dmn/decision-table-hit-policy/)

ข้อดี: มี notation/editor และแยกกฎจาก template ชัด. ภาระ: ต้องดูแล engine/model lifecycle และแปลง semantics; mapping, DB lookups, Thai formatting และ layout ยังมี adapter/component ของตนเอง ไม่ใช่ลาก DXF เข้าแล้วได้ระบบครบ

### C. Typed rules ใน Java / C# / Python

เหมาะถ้า developers เป็นเจ้าของ logic และบริษัทมี stack อยู่แล้ว. เขียน functions/units tests ด้วยภาษานั้น ใช้ decimal arithmetic และส่ง flags/rows ไป template. เลี่ยง JS ได้ แต่ยังเป็นการเขียนโค้ดต่อ business rule และไม่ตอบโจทย์ผู้ใช้ธุรกิจแก้ logic เองโดยตรง

### D. XSLT + XPath → HTML

เหมาะเมื่อ source เป็น XML และทีมมีทักษะ XSLT. ทำ mapping, conditions, loops และสร้าง HTML ก่อนส่ง PDFreactor ได้; ไม่จำเป็นต้องมี Handlebars. ความสามารถนี้เป็นไปตาม [W3C XSLT](https://www.w3.org/TR/xslt-30/). ภาระคือความเชี่ยวชาญในการดูแล stylesheet และยังต้อง port Exstream rules/functions เอง; DXF ที่มี FO-like tags ไม่ได้เป็น XSLT ที่นำไปรันได้ทันที

## Template engine และ PDFreactor

หากเปลี่ยนเฉพาะ rule authoring ใช้ Handlebars เดิมต่อได้. หากต้องการเลิก Node ใน document-generation runtime มีสองทาง:

- ใช้ Handlebars implementation บน Java/.NET และทดสอบ helpers/escaping/partial compatibility; เอกสารทางการระบุว่ามี implementations ภาษาอื่น แต่ไม่ได้รับรองว่า custom helpers เดิมใช้ได้ตรง ๆ. [Handlebars installation](https://handlebarsjs.com/guide/installation/)
- ใช้ Java + FreeMarker สร้าง HTML/CSS พร้อม `if/list` และ template reuse. เป็นตัวเลือกที่เหมาะเมื่อเลือก Java อยู่แล้ว. [FreeMarker manual](https://freemarker.apache.org/docs/dgui_quickstart_template.html)

PDFreactor Web Service รับงานผ่าน REST ที่ไม่ผูกกับภาษา จึงเรียกจาก Java, .NET, Python หรือภาษาอื่นได้. [PDFreactor Web Service manual](https://www.pdfreactor.com/product/doc_html/manual-ws.html)

สำหรับ IPPLT เสนอ **A** ถ้าจะต่อยอด configuration workbench เดิม; เลือก **B** ถ้าต้องการ decision-model tooling มาตรฐานสำหรับกฎธุรกิจหลาย templates. ถ้าต้องไม่มี Node runtime และเลือก Java: `input mapping → JSON evaluator หรือ DMN → view model → FreeMarker → HTML/CSS → PDFreactor REST`.

ข้อเสนอนี้ยังไม่เปลี่ยน architecture ที่บันทึกไว้ใน `Design/pdfreactor-platform-architecture.md` ซึ่งปัจจุบันเสนอ TypeScript/Node. ยังไม่ได้เลือก engine/stack หรือสร้าง runtime ใหม่

## Validation รอบนี้

- Parse IPPLT ต้นฉบับ, resolve rule/variable references และตรวจ identifiers ใน rule bodies สำเร็จ; บันทึก source metadata โดยไม่คัดลอก display/sample values
- Cross-DXF declaration search สำเร็จ; สองไฟล์ที่มี U+0004 ถูก normalize เฉพาะ memory สำหรับค้นตามข้อจำกัด audit เดิม
- `pdfinfo` จาก audit รอบก่อนยืนยัน 4 matching titles/one-page outputs; รอบนี้ extract text และ rasterize ทั้ง 4 ใหม่ exit 0 แล้วดูภาพครบ. A01–A03 มี Poppler warnings, A04 ไม่มี
- ไม่มี Exstream execution, full-branch fixture test, DMN/evaluator execution, template implementation หรือ PDFreactor render ใหม่. ผล synthetic JS 10 cases ใน review ก่อนหน้าไม่ใช่ validation ของตัวเลือก non-JS รอบนี้
