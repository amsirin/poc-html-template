# สำรวจ inputs เพิ่มเติม — 2026-09-24

เอกสารนี้บันทึกการตรวจไฟล์จริงหลังอ่าน handoff ไม่ใช่ผล validation ของ template ใหม่

**อัปเดต 2026-10-02:** มี DXF เพิ่มเป็น 15 ไฟล์ และ PDF/Letter 26 ตัวอย่างใน 12 กลุ่มแล้ว ดู [DXF_CAPABILITY_REVIEW.md](DXF_CAPABILITY_REVIEW.md) สำหรับผลตรวจล่าสุด. พบ matching PDF ของ APP_LTULFSU001 ในกลุ่ม ZLFSUR แต่ ZLFSURI ยังไม่ตรง; ZLFINCHG provision dependency ยังขาด. เนื้อหาด้านล่างเป็นหลักฐานการตรวจวันที่เดิม

## Inputs ที่เพิ่มจาก handoff เดิม

| กลุ่ม | Reference PDF | DXF | สถานะ |
|---|---|---|---|
| POS_ZLFINCHG | 10 ไฟล์ใน `../Document/Letter/` | `../DXF/APP_ZLFINCHG.dxf` | Inspector ระบุ FinancialChange Letter, 66 variables |
| POS_ZLFSURI | 2 ไฟล์ใน `../Document/Letter/` | ยังไม่พบ `APP_LTZLFSURI001.dxf` | PDF metadata ระบุ APP_LTZLFSURI001; APP_LTULFSU001 ที่มีเป็นคนละ application |

## POS_ZLFINCHG ที่ตรวจแล้ว

- รัน `pdftotext -layout` กับ PDFs ทั้ง 10 ไฟล์สำเร็จ: 9 ไฟล์มี 2 หน้า และ 1 ไฟล์มี 12 หน้า ตาม page separators ของข้อความที่ extract
- กรณี 2 หน้าเป็นการต่ออายุกรมธรรม์ มีตารางความคุ้มครองและรายการยอดเงิน โดยบางกรณีเริ่มรายละเอียดการต่ออายุบนหน้าที่สอง จึงไม่ควรใช้ตำแหน่ง fixed ของจดหมายหน้าเดียวโดยตรง
- กรณี 12 หน้ามีการเพิ่มและยกเลิกสัญญาเพิ่มเติม รวมถึงข้อความเงื่อนไขแนบท้าย ต้องตรวจขอบเขตและ DXF เพิ่มก่อนอ้างว่ารองรับทั้งชุด
- Poppler แสดง warning `Illegal character ')'` สำหรับ 9 ไฟล์ แต่คืน exit code 0 และ extract ข้อความได้ มีอักขระ Thai PUA และการเรียงสระ/วรรณยุกต์ผิดจาก extraction จึงต้องตรวจภาพประกอบก่อนถอดข้อความเข้า template
- ยังไม่ได้ตรวจภาพทุกหน้า, extract assets, map business conditions, เตรียม sample หรือสร้าง template ใหม่ และยังไม่ได้รัน PDFreactor/diff ใหม่

## การยืนยันจากผู้ใช้และ DXF

ผู้ใช้ยืนยันว่า PDFs ทั้ง 10 ไฟล์เป็น output ของ template เดียวกัน จึงต้องวิเคราะห์เป็น data/condition variants ของ APP_ZLFINCHG ไม่แบ่ง template ตามจำนวนหน้า ข้อเสนอเดิมให้เลือก 2 หรือ 12 หน้าถูกแทนที่ด้วยความเข้าใจนี้

ตรวจ DXF แบบ XML เพิ่มเติมพบ:

- `DOC_ZLFINCHG` เป็น `document-type="normal"` (บรรทัด 805)
- `DOC_ZLFINCHG_RiderProvision_LA` เป็น `document-type="pass-through"` และรับเอกสารผ่าน `F_Placeholder_MainPlanRiderProvisionNewDuplex` (บรรทัด 2180–2182)
- ส่วน pass-through ตั้ง `back-page-type="blank"`, `duplex-mode="yes-no"` และมี `page-positions="pass-through-filler-auto"` (บรรทัด 2185)
- Rule 84910/84911 แสดงส่วนและแถวเพิ่ม rider เมื่อ `DRV_AddRider_Name_List` มีข้อมูล; 84914/84915 ทำเช่นเดียวกันสำหรับ `DRV_LapseRider_Name_List`
- Rule 86936 แสดงรายละเอียดต่ออายุสำหรับ transaction TA85/TZO1/TZN7/TV26; เป็นคนละ conditional content กับการเพิ่ม/ยกเลิก rider

### องค์ประกอบ PDF 12 หน้า

| หน้า PDF | เนื้อหาที่ตรวจจาก text extraction |
|---|---|
| 1–2 | จดหมายเปลี่ยนแปลงกรมธรรม์ มีเพิ่มและยกเลิก rider |
| 3 | บันทึกสลักหลัง OPD Plus 1 หน้า |
| 4 | หน้าไม่มีเนื้อหาสัญญา เหลือเพียง reference header; ตรวจ PNG แล้ว |
| 5–12 | สัญญาและสรุปความคุ้มครอง ADD Plus เลขหน้าภายใน 1/8 ถึง 8/8 |

จึงรวม 2 + 1 + 1 + 8 = 12 หน้า หน้า 4 สอดคล้องกับ filler สำหรับ duplex ตาม DXF; ยังไม่ได้รัน Exstream เพื่อพิสูจน์ขั้นตอน insertion โดยตรง ส่วน 9 PDFs ที่เหลือมีจดหมาย 2 หน้าโดยไม่มีชุดแนบนี้

**ขอบเขตหลักฐาน:** DXF ประกาศ placeholder แต่ไม่ได้แสดง logic ที่ populate ค่า/เลือกไฟล์ provision; usage rule 85754 ของ pass-through มี CDATA ว่าง จึงยังระบุไม่ได้ว่าต้นทางเลือกไฟล์ใดด้วย rule ใดจาก export นี้เพียงอย่างเดียว ห้ามสมมติว่า rule 84910 เป็นเงื่อนไขแนบไฟล์โดยตรง เพราะหลักฐานนั้นควบคุมข้อความ/ตารางในจดหมาย

## แนวทาง implementation ต่อ

ใช้ template เดียวรองรับ conditional sections, repeating rows, dynamic pagination และขั้นประกอบ provision attachments/duplex fillers ตามข้อมูล ต้องใช้ทั้ง 10 outputs เป็น reference cases และตามหาแหล่งข้อมูล/ไฟล์ provision ที่ป้อน placeholder ก่อนยืนยันครบ workflow

ต้องรักษา semantic tables/loops/conditions, ตรวจข้อความและจำนวนหน้าจริงควบคู่ metrics และ regression POS/DIS หากแก้ shared components. ผลคะแนน POS/DIS เดิมเป็นผลวันที่ 2026-09-23 ไม่ใช่ผลการสำรวจครั้งนี้


## POS_ZLFSURI — ตรวจหลังผู้ใช้สั่งข้าม POS_ZLFINCHG

- `pdfinfo` ยืนยัน PDFs สองไฟล์มี 1 และ 2 หน้า โดยทั้งคู่มี Title `APP_LTZLFSURI001`
- กรณี 1 หน้า: จดหมายเวนคืน ไม่มีรายการหักเงินกู้ และยอดเงินสดสุทธิเท่ากับยอดก่อนหัก
- กรณี 2 หน้า: หน้าแรกมีรายการหักเงินกู้/เงินกู้อัตโนมัติ หน้าที่สองเป็นจดหมายพร้อมใบเสร็จชำระเงินกู้ ยอดชำระตรงกับรายการหักหน้าแรก จึงเป็นหน้าคนละประเภทที่เพิ่มเข้ามา ไม่ใช่ข้อความหน้าแรก overflow
- ข้ออนุมานจาก outputs: การชำระหนี้จากมูลค่าเวนคืนสัมพันธ์กับการเพิ่มใบเสร็จ แต่สองตัวอย่างไม่เพียงพอยืนยันเงื่อนไขต้นฉบับทั้งหมด
- DXF ที่มีคือ `APP_LTULFSU001` ไม่ตรงกับ PDF Title. XML มี `DOC_EMAIL_Content`, `DOC_SURRENDER_1` และ `DOC_SURRENDER_2`; ส่วนหลังเป็นรายละเอียดขายหน่วยลงทุน ไม่ใช่ใบเสร็จเงินกู้
- Rule 85370 ของ APP_LTULFSU001 ตรวจ `U_Surrender_Debt_Amount <> 0` สำหรับแถวหนี้สิน แต่ห้ามใช้กฎนี้อ้างเป็นเงื่อนไขเพิ่มใบเสร็จของ APP_LTZLFSURI001
- ต้องมี DXF APP_LTZLFSURI001 หรือกฎประกอบ output ที่เกี่ยวข้องเพื่อยืนยัน logic เพิ่มใบเสร็จ ยังไม่ได้ implement template หรือรัน PDFreactor
- Validation ครั้งนี้: parse XML, อ่าน rules/document content, `pdftotext -layout` และ `pdfinfo` ทั้งสอง PDFs; กรณีหนึ่งมี Poppler warning `Illegal character '>'` แต่คำสั่งคืน exit code 0. ไม่ได้ตรวจภาพทุกหน้า


## กลับมาวิเคราะห์ ZLFINCHG ด้วย XLSX spec

อ่าน `../Spec/Template_Spec_APP_ZLFINCHG.xlsx` ครบ 4 worksheets ผ่าน XML ใน ZIP (read-only): Applications, XmlMap (228 data rows), VariableFormula (7 formulas), DataFile (6 data rows)

หลักฐานใหม่:

- `XmlMap!D146:F146`: `/ZLFINCHG/Add_Rider/Add_Rider_Ext_Plan` → `DRV_AddRider_ExtPlan_List`; rows 145/147/148 map ชื่อ/ทุน/วันที่มีผลของ rider ที่เพิ่ม
- `VariableFormula!B8/E8`: `FX_ZLFINCHG_Summary_EndorsementSummary` เรียก `SET_RIDER_PROVISSION_LA()` หลัง loop เปรียบเทียบทุนก่อน/หลัง ส่วน loop ที่เรียก `FG_Add_Rider_LA(idy,idy)` อยู่ใน block comment จึงไม่ใช่ active logic
- ไม่พบ implementation ของ `SET_RIDER_PROVISSION_LA` ใน workbook หรือ DXF. Workbook มีชื่อฟังก์ชันนี้เพียงจุดเรียกเดียว และไม่มีชื่อ placeholder ในเนื้อหา workbook
- DXF บรรทัด 2180 ยืนยันปลายทางเป็น pass-through document ที่รับ `F_Placeholder_MainPlanRiderProvisionNewDuplex`
- ดังนั้นเห็น input mapping, จุดเรียกฟังก์ชันจัด provision และปลายทาง document แล้ว แต่ยังไม่เห็นกฎ mapping plan → provision, เงื่อนไขเลือก/เรียง/เว้นหน้า และคำสั่งเติมค่า placeholder. ความเชื่อมโยงว่าฟังก์ชันนี้เป็นผู้เติม placeholder เป็นข้ออนุมานที่ยังต้องตรวจ source
- `VariableFormula!E7` มี `SP_PIP_MAIN_ATTACHMENT_KEY` แต่ในบริบท trigger `REF_ODBC_SP_GET_FACEPAGE_DATA` เพื่อเตรียมตาราง/หมายเหตุ ไม่ใช่หลักฐานเพียงพอสำหรับการเลือก provision PDF

สิ่งที่ต้องตามต่ออย่างเจาะจง: export function body `SET_RIDER_PROVISSION_LA()` พร้อม functions/reference lookups ที่มันเรียก และ formula ของ `F_Placeholder_MainPlanRiderProvisionNewDuplex` หากมี การตรวจรอบนี้ไม่ได้แก้ workbook หรือ implement/render template

หมายเหตุสถานที่ inputs ปัจจุบัน: พบ PDFs ใน `../PDF/Letter/`; เส้นทาง `../Document/Letter/` ในบันทึกก่อนหน้าเป็นตำแหน่ง ณ เวลาตรวจเดิม
