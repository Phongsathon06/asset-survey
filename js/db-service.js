// จัดการการอ่าน/เขียนข้อมูล (รองรับทั้ง Cloud Firestore และ LocalStorage สำรอง)
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { db, USE_FIREBASE } from "./firebase-config.js";
import { INITIAL_ASSETS } from "./seed-data.js";

const COLLECTION_NAME = "asset_surveys";
const LOCAL_STORAGE_KEY = "yhh_asset_survey_data_v1";

function nowFormatted() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function fetchAllAssets() {
  if (USE_FIREBASE && db) {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy("code", "asc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // อัปเดตแคชในเครื่องไว้สำรอง
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
      return { source: "firebase", data: items };
    } catch (error) {
      console.warn("ไม่สามารถดึงข้อมูลจาก Firestore ได้ กำลังใช้ข้อมูลในเครื่องแทน:", error);
    }
  }

  // Fallback: ใช้ LocalStorage หรือข้อมูลตั้งต้นจาก seed-data.js
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    return { source: "local", data: JSON.parse(cached) };
  }

  const seeded = INITIAL_ASSETS.map((item, idx) => ({
    id: `local_${idx + 1}`,
    ...item
  }));
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seeded));
  return { source: "local", data: seeded };
}

export async function createAsset(payload) {
  const record = {
    ...payload,
    updatedAt: nowFormatted()
  };

  if (USE_FIREBASE && db) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), record);
    return { id: docRef.id, ...record };
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  const newItem = { id: `local_${Date.now()}`, ...record };
  current.unshift(newItem);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  return newItem;
}

export async function updateAsset(id, payload) {
  const record = {
    ...payload,
    updatedAt: nowFormatted()
  };

  if (USE_FIREBASE && db && !String(id).startsWith("local_")) {
    await updateDoc(doc(db, COLLECTION_NAME, id), record);
    return { id, ...record };
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  const updated = current.map((item) => (item.id === id ? { ...item, ...record } : item));
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  return { id, ...record };
}

export async function removeAsset(id) {
  if (USE_FIREBASE && db && !String(id).startsWith("local_")) {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return;
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  const filtered = current.filter((item) => item.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
}

// นำเข้าข้อมูลชุดใหญ่ขึ้น Firestore (รองรับเกิน 500 รายการด้วยการแบ่ง batch อัตโนมัติ)
export async function bulkImportToFirestore(records) {
  if (!USE_FIREBASE || !db) {
    throw new Error("ยังไม่ได้เปิดใช้งาน USE_FIREBASE ในไฟล์ js/firebase-config.js");
  }

  const CHUNK_SIZE = 450; // Firestore จำกัดสูงสุด 500 operations ต่อ 1 batch
  let importedCount = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const ref = doc(collection(db, COLLECTION_NAME));
      batch.set(ref, {
        code: item.code || "",
        serial: item.serial || "",
        name: item.name || "",
        category: item.category || "",
        department: item.department || "",
        location: item.location || "",
        custodian: item.custodian || "",
        status: item.status || "รอตรวจสอบ",
        surveyor: item.surveyor || "",
        note: item.note || "",
        updatedAt: item.updatedAt || nowFormatted()
      });
    });

    await batch.commit();
    importedCount += chunk.length;
  }

  return importedCount;
}
