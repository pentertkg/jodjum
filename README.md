# JoDJuM

เว็บบันทึกงานส่วนตัวภาษาไทย สร้างจากข้อกำหนด Work Log และ Dynamic Form Builder

## เริ่มใช้งาน

ต้องมี Node.js จากนั้นรัน `npm start` และเปิด http://127.0.0.1:4173
ไม่มี dependency หรือขั้นตอน build ไฟล์เว็บทั้งหมดอยู่ใน `dist/`

## ฟีเจอร์

- Dashboard รายวัน สัปดาห์ และความคืบหน้าโปรเจกต์
- เพิ่ม แก้ไข ดูรายละเอียด ทำสำเนา ลบ และย้อนกลับการเปลี่ยนแปลง
- ค้นหา กรองวันที่ โปรเจกต์ สถานะ ความสำคัญ เรียงลำดับ แบ่งหน้า และปฏิทิน
- คำนวณเวลาอัตโนมัติ Validation และเก็บแบบร่างเมื่อปิดฟอร์ม
- Reports และ Export `.xlsx` สองชีต Work Log / Summary พร้อม custom fields และฟิลด์เก่า
- Dynamic Form Builder 12 ประเภท ลากจัดลำดับ ลูกศรบนมือถือ ซ่อน/แสดง Required ค่าเริ่มต้น Placeholder Preview บันทึก/ทิ้ง/Reset
- สำรอง/นำเข้าข้อมูล JSON รวมข้อมูลและการตั้งค่า
- ฟิลด์หลัก date/project/task/status คงประเภท Required และ Visible เพื่อรักษาความถูกต้องของระบบ ฟิลด์ custom เปลี่ยนประเภทได้ ข้อมูลเก่ายังคงอยู่

## การจัดเก็บและข้อจำกัด

เวอร์ชันนี้เป็น personal MVP เก็บข้อมูลใน localStorage ของเบราว์เซอร์และ origin นั้น ไม่มี backend/database, ระบบบัญชี, การแชร์ทีม หรือซิงก์ข้ามเครื่อง การล้าง browser storage จะลบข้อมูล จึงมีการสำรอง JSON ข้อมูลบน localhost และเว็บเผยแพร่แยกกัน สามารถย้ายด้วย JSON

Excel เป็น XLSX จริง (ZIP + SpreadsheetML) ไม่ใช่ CSV เปลี่ยนนามสกุล Duration เป็นตัวเลขหน่วยนาที Summary รวมชั่วโมง ข้อความใช้ inline strings เพื่อป้องกันสูตรที่ไม่ได้ตั้งใจ

System metadata: id, user_id, user, created_at, updated_at. ข้อมูลเพิ่มเติมเก็บด้วย stable field IDs ใน custom object การลบฟิลด์เก็บ schema ใน archivedFields จึงเปิดดูและ Export ข้อมูลเดิมได้

รัน `npm run check` ตรวจไวยากรณ์ และ `npm test` ตรวจการกรอง Validation การคำนวณเวลา การรักษาข้อมูล และ XLSX

## สี Acid Jungle

ใช้สีจากภาพอ้างอิง: Cream `#FFF6DD`, Lime `#BEE687`, Mint `#61D195`, Blue `#2B91C5`, Pink `#FF88A4` พื้นหลังครีม ปุ่มหลักมิ้นต์ เมนูที่เลือกเขียวอ่อน กราฟฟ้า และสถานะติดปัญหาชมพู ใช้ตัวหนังสือเข้มและสีที่ปรับความเข้มสำหรับข้อความเพื่อรักษาความอ่านง่าย
