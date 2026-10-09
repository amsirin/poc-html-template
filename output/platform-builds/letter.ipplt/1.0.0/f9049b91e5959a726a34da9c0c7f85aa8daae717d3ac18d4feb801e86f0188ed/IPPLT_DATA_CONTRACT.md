# Standard platform data — IPPLT v1

ใช้ชื่อทางธุรกิจใน platform, rules และ template. ชื่อ field/เลข rule ของ Exstream อยู่เฉพาะ migration adapter, archived synthetic fixtures และเอกสาร mapping. ตัวอย่างหลัก `data-samples/ipplt/*.json` ไม่ต้องผ่าน Exstream แล้ว

```text
New producer → standard JSON v1 → validation → business rules → view model → Handlebars → PDF
Legacy input → Exstream adapter ────────┘
```

## Naming standard

- ใช้ lowerCamelCase และแยก objects ตามความหมาย: `document`, `recipient`, `application`, `refund`, `agent`, `contact`
- ชื่อบอกชนิดและหน้าที่ เช่น `fullName`, `phoneNumber`, `totalAmount`, `methodCode`, `dateText`; ไม่มีชื่อ producer, technical prefix หรือหมายเลข rule
- Collection ใช้ array ของ objects เช่น `refund.items`; ไม่ใช้ parallel arrays ที่ต้องจับคู่ index ข้ามตัวแปร
- แยกข้อมูลกับรูปแบบแสดงผล: input amount เป็น decimal string; view model จึงค่อยเพิ่ม comma. `dateText` ระบุชัดว่าเป็นวันที่จัดรูปแบบแล้ว ไม่แอบอ้างว่าเป็น ISO date
- มี `schemaVersion: "1.0"`; runtime ปฏิเสธชื่อ field ที่ไม่รู้จักและชนิดไม่ตรง เพื่อจับ typo/สัญญาข้อมูลคนละรุ่น
- ใช้ convention นี้กับเอกสารถัดไป; การเปลี่ยนครั้งนี้ implement ที่ IPPLT เท่านั้น ยังไม่ได้ย้าย contracts ของ POS/DIS หรือสร้าง platform variable catalog UI

## Input ที่ใช้จริง

ดู JSON เต็มที่ [single.json](data-samples/ipplt/single.json). ทุก object/field ในตารางต้องมี ยกเว้น `_note` ซึ่งเป็น metadata ของ fixture และไม่ถูกพิมพ์

| Field | ชนิด / ความหมาย |
|---|---|
| `schemaVersion` | string `"1.0"` |
| `document.dateText` | string วันที่แสดงผลที่เตรียมแล้ว |
| `document.reference` | string รหัสอ้างอิงใน footer |
| `document.barcodeValue` | string 1–24 ตัว: A–Z, 0–9, hyphen |
| `recipient.fullName` | string ชื่อผู้รับรวมคำนำหน้าถ้ามี |
| `recipient.address.lines` | string[] บรรทัดที่ต้องแสดงจริง ไม่มี source placeholder processing ใน core |
| `application.number` | string เลขใบคำขอ; ไม่แปลงเลขอ้างอิงเป็น number |
| `application.insuredName`, `application.planName` | strings |
| `application.loanAccountNumber` | string; `""` ถ้าไม่มี |
| `agent.fullName` | string; `""` ทำให้ไม่แสดง agent section |
| `agent.branch.code`, `agent.branch.name` | strings |
| `refund.totalAmount` | decimal string เช่น `"12500.00"`; 2 decimals, ไม่เกิน 15 integer digits, รองรับค่าลบโดยไม่ปัดเศษ |
| `refund.paymentCount` | nonnegative safe integer; business count ที่ส่งมา แยกจากจำนวน items |
| `refund.methodCode` | string รหัสช่องทางตาม business code set เดิม |
| `refund.references.single`, `refund.references.batch` | strings รหัสเต็มพร้อมพิมพ์; batch ว่างหมายถึงไม่มี batch reference |
| `refund.description` | string รายละเอียดการคืนเงินหนึ่งรายการที่เตรียมแล้ว |
| `refund.items` | object[] เรียงตามลำดับที่ต้องแสดง |
| `refund.items[].sequence` | positive safe integer หมายเลขรายการที่ส่งมา ไม่บังคับเรียง 1..N |
| `refund.items[].methodCode` | string รหัสช่องทางของรายการ |
| `refund.items[].description` | string รายละเอียดของรายการที่เตรียมแล้ว |
| `contact.phoneNumber` | string |

Validation อยู่ใน [contract.js](src/ipplt/contract.js). ไม่ trim ข้อความหรือเปลี่ยนค่า whitespace เงียบ ๆ; optional business values ใช้ empty string ตาม contract v1. ไม่มีการบังคับ `paymentCount === items.length` เพราะยังไม่มีหลักฐานว่าความหมายเท่ากันใน source. ยังไม่คำนวณ total จาก items เนื่องจาก items เป็น resolved descriptions และไม่มี row amount contract

## ขอบเขตของ rules และ template

Core [rules.js](src/ipplt/rules.js) ประเมิน 7 decisions ด้วยชื่อ เช่น `showSinglePayment`, `showMultiplePayments`, `showLoan`; [view-model.js](src/ipplt/view-model.js) เตรียม presentation และ [formatters.js](src/shared/formatters.js) จัดรูปแบบจำนวนเงิน. อีก 4 source rules เป็น address normalization จึงอยู่ใน adapter; producer ใหม่ส่ง address lines สำเร็จรูปได้เลย

```js
showSinglePayment: positive && refund.paymentCount === 1,
showMultiplePayments: positive && refund.paymentCount > 1,
```

Template รับ view model ที่เตรียมสำหรับแสดงผล เช่น `recipient.name`, `recipient.addressLines`, `payment.amount`, `payment.rows` และ `flags.showMultiplePayments`. ชื่อ input กับ view model ไม่จำเป็นต้องเหมือนกัน เพราะ view model เป็นสัญญาของ shared presentation components; ทั้งสองชั้นไม่มี Exstream field names. `ruleTrace` และ `data-rule` ใช้ชื่อ decisions เดียวกัน ไม่ใช้เลข source rule

```js
import { buildIppltViewModel } from './src/ipplt/view-model.js';
const model = buildIppltViewModel(standardInput); // native producer: no adapter
```

Legacy-only import:

```js
import { adaptExstreamIpplt } from './src/adapters/exstream-ipplt.js';
const standardInput = adaptExstreamIpplt(legacyInput);
const model = buildIppltViewModel(standardInput);
```

Runner หลักไม่ import adapter. Old payload ไม่ถูกรับอัตโนมัติเป็น native input. Native producer จะใช้ Node, Java หรือระบบอื่นเพื่อสร้าง JSON ตาม contract นี้ได้; ตัวอย่างปัจจุบันยังใช้ Node + Handlebars

## Migration mapping: 26 source variables

| Exstream input | Standard field / boundary transformation |
|---|---|
| `U_Agent_Full_Name` | `agent.fullName` |
| `IL_DRV_AgentbranchCode`, `IL_DRV_Agentbranchname` | `agent.branch.code`, `agent.branch.name` |
| `U_Print_Date` | `document.dateText` |
| `U_Owner_Name` | `recipient.fullName` |
| `U_Addrs1`, `U_Addrs2`, `U_Addrs3`, `U_Addrs4`, `U_Province_Long_Des`, `U_PostCode` | `recipient.address.lines`; adapter ใช้ suppression/join behavior เดิมและเก็บ displayed whitespace |
| `IL_DRV_ApplicationNumber` | `application.number` |
| `U_Insure_Name`, `U_Plan_Name` | `application.insuredName`, `application.planName` |
| `IL_U_LoanReferenceNumber` | `application.loanAccountNumber` |
| `U_Payment_Amount` | `refund.totalAmount` |
| `IL_DRV_Check_Multi_Payment` | `refund.paymentCount` |
| `IL_DRV_PaymentMethodStr` | `refund.methodCode` |
| `IL_DRV_ProductLine`, `U_Payment_Amount_INT`, `U_Payment_Amount_Draft` | adapter ประกอบ `refund.references.single/batch` ด้วยสูตรเดิม; native producer ส่งรหัสเต็ม ไม่ต้องส่ง fragments. ถ้า draft fragment ว่าง ให้ batch เป็น `""` |
| `U_Payment_Method_One_TemplateShow` | `refund.description` |
| `IL_DRV_PaymentDetail_PaymentMethod`, `IL_DRV_No_List`, `U_Payment_Method_One_Template_List` | ตรวจ parallel arrays ยาวเท่ากันก่อนสร้าง `refund.items[]` ด้วย `methodCode`, `sequence`, `description` |
| `V_FWD_PhoneNumber` | `contact.phoneNumber` |

`presentation.barcodeValue/footerReference` เดิมอยู่นอก DXF; map เป็น `document.barcodeValue/reference`. ข้อมูล source เก็บเฉพาะ synthetic archive ที่ `data-samples/legacy/exstream/ipplt/`

| Source rule | ตำแหน่งใหม่ |
|---|---|
| 9145 | `showAgent` |
| 9357–9360 | address normalization ใน adapter |
| 9361 | `showSingleCode` |
| 9362 | `showMultipleCode` |
| 8385 | `showLoan` |
| 8359 | `showSinglePayment` |
| 8381 | `showMultiplePayments` |
| 8360 | `showPaymentSpacing` |

รหัส method `1`, `B`, `6` ยังคงอยู่ใน rule เพราะยังไม่มี dictionary ครบที่ยืนยันความหมายทุก code. ไม่ตั้งชื่อ enum จากการเดา. การเปลี่ยน variable names ไม่ได้ทำให้ upstream amount/date/detail formulas ที่ขาดกลายเป็นครบ; standard contract v1 รับ resolved values ตามเดิม

## Verification 2026-10-03

- `npm run test:ipplt`: 15 groups ผ่าน รวม native contract, source adapter, branch/edge cases, array mapping, escaping และ source-name isolation
- เทียบ old/new local view models 437 cases ผ่าน: amount/count/method/batch combinations และ fixtures ทั้ง 5. ไม่ใช่การรันเทียบ Exstream engine; ไม่นับ hidden reference strings กับ ruleTrace IDs เป็น visible output
- Rerender PDFs ทั้ง 5; PNG hashes ของ document pages ทั้ง 6 เหมือนก่อนเปลี่ยนทุกไฟล์. HTML ทั้ง 5 เปลี่ยนเพียง `data-rule` labels. 40 row markers ครบครั้งเดียวตามลำดับ และจำนวนหน้าคงเดิม
- หลักฐานอยู่ `output/ipplt-standardization/rule-parity.json` และ `visual-parity.json`. ไม่รัน POS/DIS หรือ similarity diff ใหม่ในรอบนี้ เพราะไม่ได้แก้ shared renderer/CSS/components; ผล viewer scores เป็นผลจากรอบ barcode correction
