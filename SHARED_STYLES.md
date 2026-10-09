# Shared CSS first

ใช้ CSS ส่วนกลางก่อนเพิ่ม CSS รายเอกสาร ตามข้อตกลงวันที่ 2026-10-03. Handlebars รับผิดชอบเนื้อหาและการแสดง sections; CSS รับผิดชอบรูปแบบ; business rules อยู่ใน view-model. ไม่มี JavaScript สำหรับจัดตำแหน่งใน HTML

## ชั้นของ styles

| ชั้น | ไฟล์ | หน้าที่ / ผู้ใช้ปัจจุบัน |
|---|---|---|
| Brand | `brand.css`, `typography.css` | สี ฟอนต์ และขนาดตัวอักษร / ทุก template |
| Page family | `layout.css` **หรือ** `letter-flow.css` | fixed-page สำหรับ POS/DIS; flow และ pagination สำหรับ IPPLT |
| Components | `letter-header.css`, `letter-address.css` | header, address และ barcode / POS, DIS, IPPLT ใช้ร่วมกันจริง |
| Document profile | `ipplt.css` เป็นต้น | override CSS variables เท่าที่มีความต่างจาก family |

อย่าโหลด page families สองชุดใน template เดียว. POS/DIS ยังมี specialized CSS ของ signature, app panel และ fixed anchors; ไม่ได้ย้ายทุก selector มาเป็นส่วนกลางในครั้งนี้. `letter-flow.css` เป็น family ที่พร้อมให้จดหมาย flow แบบถัดไปใช้ โดยปัจจุบันมี IPPLT เป็นผู้ใช้แรก

## ตัวอย่าง IPPLT ที่รันจริง

ลำดับ stylesheet ใน `templates/ipplt.hbs` คือ brand → typography → header → address → flow → IPPLT profile. Family ใช้ class บน body เพื่อ scope styles และให้ variables สืบทอดถึง running footer ได้

```html
<body class="letter-flow ipplt-letter">
  <div class="running-footer">...</div>
  <article class="letter-flow__content">
    {{> page-header}}
    <p class="letter-date">{{printDate}}</p>
    {{> address-with-barcode}}
    <section class="letter-details">...</section>
  </article>
</body>
```

ทั้งไฟล์ `styles/ipplt.css` เหลือ profile นี้:

```css
.ipplt-letter {
  --details-label-width: 85pt;
  --signoff-left: 270pt;
}
```

Header/address ใช้ selectors กลาง ไม่มีการ copy ไปแต่ละ template. ตัวอย่าง DIS เปลี่ยนตำแหน่งผ่าน `--barcode-left`, `--barcode-top` และ `--address-margin` โดยยังใช้ implementation เดียวกับ POS/IPPLT. ขนาด barcode และ letter-spacing ใช้ profile กลางเดียวกัน ไม่มี size override ราย family/document

Barcode profile อยู่ใน `letter-address.css` (62.2 × 25pt, Courier New 5pt, letter-spacing 2pt) และ `address-with-barcode.hbs` (Code 39, source height20mm, scale2, fit="box"). Template ส่งเฉพาะข้อมูล. Renderer ใช้ `preserveAspectRatio="none"` เมื่อ helper ได้ `fit="box"` เพื่อให้แท่งเต็มกล่องแม้ข้อความยาวต่างกัน; barcode helpers อื่นที่ไม่ opt in ยังคงรักษาสัดส่วนตามเดิม. ความหนาแนวนอนของแต่ละแท่งขึ้นกับจำนวนตัวอักษร; ยังไม่ได้รับรองการสแกนจากงานพิมพ์จริง

## เมื่อต้องปรับหรือเพิ่มจดหมาย

1. เลือก family และ partial ที่มีอยู่ก่อน. Flow family มี subject, salutation, paragraph, details/list tables, payment code, closing, agent และ running footer แล้ว
2. ถ้าต่างแค่ค่า ให้ใช้ token ใน profile; ถ้าไม่มี token ให้เพิ่มชื่อที่มีความหมายใน shared component พร้อม default ที่รักษาผู้ใช้เดิม
3. ถ้าต่างด้านโครงสร้าง ให้เพิ่ม reusable component/variant เมื่อมีความต้องการจริง. CSS เฉพาะเอกสารใช้สำหรับความต่างที่ source/reference ยืนยัน พร้อมบันทึกเหตุผลใน migration guide; ไม่แก้ด้วย inline style หรือ `!important`
4. การแก้ shared header/address ต้อง render POS, DIS และ IPPLT ทั้ง 5 cases. การแก้ flow family ต้องตรวจ IPPLT ทั้ง 5 รวม many-rows. เทียบภาพ ข้อความ จำนวนหน้า และ row markers; คะแนน Grid อย่างเดียวไม่พอ

Flow family ใช้ A4 margin ด้านข้าง 63pt และด้านล่าง 48pt; หน้าแรกเว้นที่ให้ banner ใน content ส่วนหน้าต่อไปมี top margin 40pt. มี minimum address slot แต่ปล่อยให้เนื้อหาที่ยาวขยายได้. Agent อยู่หลัง closing บนหน้าสุดท้ายตาม flow ไม่ได้ pin ที่พิกัดของ Exstream. Longer names/addresses และ composition แบบอื่นยังต้องเพิ่ม fixtures ก่อนรับรอง production

## ผลตรวจ 2026-10-03 (shared-CSS refactor ก่อนแก้ barcode profile)

- POS/DIS: rerender และ diff ใหม่; SHA-256 ของ rendered page PNG เหมือนก่อน refactor ทั้งสองไฟล์. Grid คงเดิม 99.38% / 99.57%
- IPPLT: rules tests ผ่าน 12 groups; 4 primary cases ยังเป็น 1 หน้าเอกสาร; 40 rows ครบตามลำดับใน 2 หน้า. ทุก PDF มี evaluation page เพิ่ม 1 หน้า; ตรวจภาพเอกสารทั้ง 6 หน้าแล้ว ไม่พบ overlap ใน fixtures นี้
- Reference comparison: single/A03 Grid 94.65 → 96.95%, loan/A04 94.92 → 95.49%. ข้อมูลเป็น synthetic ต่างจาก reference จึงไม่ใช่ parity acceptance. ยังมีความต่างของ spacing, agent position, fonts และข้อมูล
- รายละเอียด hashes/page counts อยู่ `output/shared-css-validation/after.json`; viewer แสดงผลล่าสุด. ไม่เปลี่ยน source rules, diff masks หรือ thresholds

## Barcode profile correction — 2026-10-03 (ล่าสุด)

หลังผู้ใช้ทักว่า barcode ยังต่างกัน จึงลบ width/letter-spacing overrides และ per-template `barcodeHeight`, รวม generation ใน partial และแก้ SVG fitting. ใช้ขนาดกลางเดิมของ POS 62.2 × 25pt ให้ทั้งสาม letters. รอบนี้ POS/DIS มี pixels เปลี่ยนเฉพาะ barcode; ผล identical hashes ด้านบนเป็นประวัติรอบก่อน

วัดแท่งจากภาพ PDF 150dpi: POS 130×52px, DIS 130×53px, IPPLT single/loan 130×52px (คลาดเคลื่อนระดับ raster 1px). เปรียบเทียบก่อน/หลังทั้ง 4 คู่ไม่พบ pixels เปลี่ยนนอกบริเวณ barcode. Tests 12 groups ผ่าน; IPPLT ทั้ง 5 PDFs จำนวนหน้าคงเดิมและ 40 rows ครบ; ตรวจภาพ 6 document pages แล้ว. Grid ล่าสุด POS99.39, DIS99.49, IPPLTsingle96.95, IPPLTloan95.50%. หลักฐานอยู่ `output/barcode-profile-validation/measurements.json`; ภาพ crop เรียง POS/DIS/IPPLT อยู่ `barcode-crops.png` ใน folder เดียวกัน. Rebuild viewer ด้วยผลล่าสุดแล้ว
