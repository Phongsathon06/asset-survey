# ระบบสำรวจทรัพย์สินและครุภัณฑ์ (Asset Survey Web App)

โครงสร้างโปรเจกต์แยกไฟล์พร้อมอัปขึ้น GitHub / GitHub Pages และเชื่อมต่อ Firebase Firestore เรียบร้อยแล้ว

## โครงสร้างไฟล์
```text
asset_survey_web/
├── index.html               # โครงสร้างหน้าเว็บหลักและ Modal ฟอร์มบันทึกข้อมูล
├── css/
│   └── style.css            # สไตล์หน้าเว็บแบบมินิมอล รองรับทั้งคอมและมือถือ
├── js/
│   ├── firebase-config.js   # เก็บค่า Config ของ Firebase Firestore
│   ├── seed-data.js         # ข้อมูลตั้งต้น (สามารถนำข้อมูลทั้งหมดมาใส่ที่นี่ได้)
│   ├── db-service.js        # จัดการ CRUD และ Batch Upload ขึ้น Firestore
│   └── app.js               # ควบคุมหน้าจอ การค้นหา กรอง Export/Import
└── README.md
```

## วิธีใช้งาน
1. **รันทดสอบในเครื่อง:** เปิดผ่าน Live Server (ใน VS Code) หรือ XAMPP (ห้ามดับเบิลคลิกเปิดไฟล์ `.html` ตรงๆ เพราะใช้ `<script type="module">`)
2. **นำเข้าข้อมูลตั้งต้น:** นำข้อมูลทั้งหมดใส่ใน `js/seed-data.js` หรือใช้ปุ่ม **Import JSON** บนหน้าเว็บ แล้วกด **นำเข้าข้อมูลตั้งต้นขึ้น Cloud** ระบบจะแบ่ง Batch อัปโหลดขึ้น Firestore ให้อัตโนมัติ
3. **อัปขึ้น GitHub Pages:** Push โฟลเดอร์นี้ขึ้น GitHub Repository แล้วเปิดใช้งาน **Settings > Pages** ได้เลย
