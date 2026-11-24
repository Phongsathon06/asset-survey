// ไฟล์เก็บข้อมูลทรัพย์สินตั้งต้น (สามารถนำข้อมูลทั้ง 658 รายการมาวางใน array นี้ได้)
export const INITIAL_ASSETS = [
  {
    code: "IT-COM-001",
    serial: "SN-DELL-88412",
    name: "คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex 7090",
    category: "คอมพิวเตอร์",
    department: "แผนกซ่อมบำรุงคอมพิวเตอร์และเครือข่าย",
    location: "อาคาร 1 ชั้น 2 ห้อง IT",
    custodian: "เจ้าหน้าที่ IT",
    status: "ปกติ",
    surveyor: "พงศธร",
    note: "ใช้งานปกติ อัปเกรด RAM 16GB แล้ว",
    updatedAt: "2026-11-24 08:00"
  },
  {
    code: "IT-PRN-014",
    serial: "CN-LBP2900-441",
    name: "เครื่องพิมพ์เลเซอร์ Canon LBP2900",
    category: "เครื่องพิมพ์ / สแกนเนอร์",
    department: "ห้องตรวจผู้ป่วยนอก (OPD)",
    location: "อาคาร 2 ชั้น 1 จุดคัดกรอง",
    custodian: "หัวหน้าพยาบาล OPD",
    status: "ชำรุด",
    surveyor: "พงศธร",
    note: "ลูกยางดึงกระดาษเสื่อม รอเบิกอะไหล่",
    updatedAt: "2026-11-24 08:05"
  },
  {
    code: "IT-NET-008",
    serial: "FGT-60F-99201",
    name: "Firewall FortiGate 60F",
    category: "อุปกรณ์เครือข่าย",
    department: "ห้อง Server กลาง",
    location: "อาคาร 1 ชั้น 3 ห้อง Data Center",
    custodian: "ทีม Network",
    status: "ปกติ",
    surveyor: "พงศธร",
    note: "เชื่อมต่อ UPS สำรองไฟเรียบร้อย",
    updatedAt: "2026-11-24 08:10"
  }
];
