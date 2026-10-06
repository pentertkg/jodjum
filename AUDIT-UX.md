# JoDJuM — UX/UI audit รอบหลังปรับ Workspace

ตรวจวันที่ 6 ตุลาคม 2026 · commit `0d1cfa890ed5133738e51aaee942f48f70cf2aaf`

ตรวจซอร์สและเบราว์เซอร์ localhost โดยใช้ข้อมูลตัวอย่างในโปรไฟล์ QA ทดสอบ keyboard และ viewport 390×844 ไม่ได้แก้ซอร์สแอปหรือเผยแพร่เว็บในรอบนี้

## Findings ตามลำดับที่ควรแก้

### 1. [P1] ทำสำเนางานเขียนทับแบบร่างงานใหม่เดิม

ตำแหน่ง: `dist/app.js:145–156` (`openLog`), `dist/app.js:144` (`saveDraft`)

หากมีแบบร่างงานใหม่ที่ยังไม่เสร็จ แล้วเปิดทำสำเนางานเก่า ระบบข้าม `loadDraft` เมื่อ `duplicate=true` แต่ยังใช้ `draftKey(null)` เดียวกับงานใหม่ เมื่อกรอกสำเนา ช่อง oninput/onchange จะเขียนแบบร่างสำเนาทับแบบร่างเดิมทันที ไม่มีคำถามหรือ Undo สำหรับ draft

ทำซ้ำใน VM แยกด้วย storage จำลอง: ตั้ง draft.new เป็น “Unfinished original draft” → openLog(id,true) → กรอกสำเนาและ saveDraft → draft.new กลายเป็น “Duplicate draft” สคริปต์อยู่ `test-output/ux-audit-repro.cjs` ไม่ได้แตะ localStorage ของผู้ใช้

ควรแยก draft ของสำเนาจากงานใหม่ หรือให้จัดการแบบร่างเดิมก่อนเริ่มสำเนา พร้อม regression test ตรวจว่าแบบร่างเดิมยังอยู่

### 2. [P2] ฟอร์มจากหน้าตั้งค่าไม่คำนวณระยะเวลา และ label ผูกกับ Preview

ตำแหน่ง: `dist/app.js:113` (`fieldControl`), `dist/app.js:121` (`settingsPage`), `dist/app.js:155` (`calculateTime`)

Preview และฟอร์มจริงใช้ ID `input-*` ซ้ำกัน เปิดตั้งค่า → เพิ่มบันทึกใหม่ → รายละเอียดเพิ่มเติม → กรอก 09:00–10:30 พบว่า input-duration ในฟอร์มจริงยังว่าง ควรเป็น 90 นาที เพราะ calculateTime ใช้ querySelector จาก document จึงอ่าน Preview ที่อยู่ก่อนฟอร์มจริง รายงาน/Export อาจนับเวลาเป็นศูนย์หากผู้ใช้ไม่กรอกระยะเวลาเอง label for ของฟอร์มจริงก็ผูกกับ Preview ตัวแรก ทำให้ AX ไม่มีชื่อช่องที่ถูกต้อง

ควรใช้ ID แยกสำหรับ Preview และ query เฉพาะ #log-form สำหรับการคำนวณเวลา/อัปเดตโปรเจกต์ ตรวจการคำนวณและการคลิก label จากทุกหน้าที่เปิดฟอร์มได้

### 3. [P2] Export มีตัวกรองที่ผู้ใช้มองไม่เห็น และ “ดูงานทั้งหมด” ไม่ล้างตัวกรอง

ตำแหน่ง: `dist/app.js:112` (`exportPage`), `dist/app.js:125` (`bindView`), `dist/app.js:177` (`exportExcel`)

ค้นหา API ในบันทึกงาน → เปิดส่งออกข้อมูล จะพบ 1 รายการจากข้อมูลตัวอย่าง 10 งาน ทั้งที่ช่วงวันที่ว่าง ทุกโปรเจกต์ และทุกสถานะ หน้า Export มีคำบอกว่าใช้ตัวกรองจากบันทึกงานด้วย แต่ไม่แสดงคำค้นหา period หรือ priority ที่ยังมีผลอยู่ ผู้ใช้จึงตรวจขอบเขตไฟล์จาก controls ที่เห็นไม่ได้ การปรับวันที่ไม่ยกเลิก period เก่าด้วย

จากสถานะค้นหาเดียวกัน กลับ Dashboard → “ดูงานทั้งหมด” จะกลับไปตารางที่ยังค้นหา API อยู่ ไม่ใช่งานทั้งหมด

ควรมี export filters ของตัวเอง หรือแสดง chips ของตัวกรองทั้งหมดพร้อมปุ่มล้างเฉพาะตัว “ดูงานทั้งหมด” ควรเรียก openLogView('all') ซึ่งมีการ reset อยู่แล้ว ภาพหลักฐาน: `test-output/audit-export.jpg`

### 4. [P2] เมนูที่ซ่อนยังรับ focus จากคีย์บอร์ด

ตำแหน่ง: `dist/workspace.css:74`, `dist/workspace.css:267–269`, `dist/app.js:79–84`

ที่ 390×844 เมื่อ drawer ปิด กด Shift+Tab จากปุ่มเปิดเมนู พบ focus ไปปุ่ม “เสร็จแล้ว” ใน sidebar ที่ x=-235 นอกจอ เพราะใช้ transform อย่างเดียว เมนูไม่ inert/hidden ผู้ใช้คีย์บอร์ดต้องผ่าน controls ที่มองไม่เห็น และ screen reader ยังพบเมนูที่ปิด Drawer ที่เปิดก็ไม่มีการกัก/คืน focus หรือปิดด้วย Escape

ควรใช้ inert/visibility พร้อมจัดการ focus และ aria-expanded ให้สอดคล้องกับ breakpoint ตรวจ Tab/Shift+Tab ทั้ง desktop collapsed และ mobile drawer

### 5. [P3] เปิดค้นหาแล้ว focus อยู่ปุ่มปิด

ตำแหน่ง: `dist/app.js:95–102` (`openSearch`), `dist/app.js:130` (`showModal`)

เปิดค้นหาแล้ว document.activeElement.id เป็น modal-close ไม่ใช่ command-query เพราะ selector ใน showModal เลือก button ตัวแรกก่อน input แม้ input จะปรากฏก่อนใน selector ก็ตาม Ctrl/⌘ K จึงยังพิมพ์ค้นหาทันทีไม่ได้

ควรให้ modal ระบุ initial focus และตั้งเป็น #command-query สำหรับค้นหา คืน focus ไป trigger เมื่อปิด

## สิ่งที่ผ่านและข้อจำกัด

- `npm test` ผ่าน 69 checks ของ data writes/import/rollback/drafts/HTTP/XLSX
- Browser flows ที่ทำซ้ำ: export/filter navigation, search focus, modal จาก settings, calculation และ mobile hidden focus ไม่พบ console error/warning ใน flows นี้
- แบบร่างจากการทดสอบเวลาในโปรไฟล์ QA ถูกทิ้งผ่าน UI และล้างตัวกรองหลังเก็บหลักฐาน ไม่ได้บันทึกงานทดสอบหรือเปลี่ยน form schema
- ชุดทดสอบเดิมแทนที่ render และ readLogForm จึงยังไม่ครอบคลุม DOM ซ้ำ/focus/การคำนวณบนหน้าจอจริง ควรเพิ่ม browser regression ตาม findings ก่อนเพิ่ม backend หรือฟีเจอร์ทีม
- รอบนี้ไม่ใช่ security penetration test หรือการทดสอบ screen reader จริง และไม่ได้ตรวจ Microsoft Excel โดยตรง

แนะนำแก้ 1 → 2 → 3 → 4 → 5 แล้วตรวจ flow เพิ่ม → แก้ไข → ทำสำเนา → แบบร่าง → Export ซ้ำจากทั้ง Dashboard และ Settings

## สถานะหลังแก้ไขตามคำขอ

แก้ครบทั้ง 5 รายการแล้ว:

1. แบบร่างสำเนาเก็บแยกต่อ source record ใน `jodjum.v1.draft.copy.<id>` เปิดทำสำเนางานเดิมเพื่อกรอกต่อได้ บันทึกหรือทิ้งสำเนาล้างเฉพาะแบบร่างนั้น และแบบร่างงานใหม่ยังอยู่
2. Preview ใช้ ID `preview-*` ฟอร์มจริงใช้ `input-*` การคำนวณเวลาและเพิ่มโปรเจกต์ query ใน #log-form
3. หน้า Export แสดงคำค้นหา ความสำคัญ และช่วง/มุมมองเพิ่มเติม พร้อมปุ่มล้างแต่ละตัว “ดูงานทั้งหมด” และ “เลือกวัน” จาก Dashboard เริ่มจากตัวกรองทั้งหมด
4. เมนูที่ปิดใช้ hidden/inert Drawer มีปุ่มปิด กัก Tab/Shift+Tab คืน focus เมื่อปิดด้วย Escape และอัปเดตเมื่อเปลี่ยน breakpoint พื้นหลัง modal/drawer ใช้ inert
5. Search modal focus #command-query และคืน focus ไป trigger เมื่อปิด

ผลทดสอบ: `npm test` ผ่าน 84 checks เพิ่มการรักษา draft งานใหม่เมื่อทำสำเนา การ resume/บันทึกสำเนาโดยล้างเฉพาะ draft สำเนา ID preview การคำนวณเวลาโดยไม่อ่าน preview และตัวกรอง Export

ตรวจเบราว์เซอร์จริงบน localhost: สร้าง draft งานใหม่ → สร้าง draft สำเนา → เปิดกลับได้ทั้งคู่ → ทิ้ง draft QA, บันทึกจาก Settings ด้วยเวลา 09:00–10:30 = 90 นาทีแล้ว Undo งาน QA, ค้นหา focus ถูกต้อง, ล้าง export chips ทีละชนิดกลับครบ 10 งาน, ดูงานทั้งหมดล้างคำค้นหา, desktop collapsed และ mobile 390×844 ไม่ focus ไปเมนูที่ปิด, Tab/Shift+Tab ใน drawer และ Escape/คืน focus ไม่มี console error/warning ใน flow ที่ตรวจ

ภาพเวอร์ชันแก้ไข: `test-output/ux-fixes-export.jpg` การทดสอบทำในโปรไฟล์ QA และคืนข้อมูลตัวอย่างหลังเสร็จ
