// จัดการการอ่าน/เขียน/ลบข้อมูล (รองรับทั้ง Cloud Firestore และ LocalStorage สำรอง)
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { db, USE_FIREBASE } from "./firebase-config.js";
import { INITIAL_ASSETS } from "./seed-data.js";

const COLLECTION_NAME = "asset_surveys";
const LOCAL_STORAGE_KEY = "yhh_asset_survey_excel_v3";

function sortBySeqAndCode(list) {
  return [...list].sort((a, b) => {
    const seqA = Number(a.seq) || 999999;
    const seqB = Number(b.seq) || 999999;
    if (seqA !== seqB) return seqA - seqB;
    return String(a.code || "").localeCompare(String(b.code || ""), "th");
  });
}

export async function fetchAllAssets() {
  if (USE_FIREBASE && db) {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      const sorted = sortBySeqAndCode(items);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
      return { source: "firebase", data: sorted };
    } catch (error) {
      console.warn("ไม่สามารถดึงข้อมูลจาก Firestore ได้ กำลังใช้ข้อมูลในเครื่องแทน:", error);
    }
  }

  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    return { source: "local", data: sortBySeqAndCode(JSON.parse(cached)) };
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
    seq: Number(payload.seq) || 0,
    code: String(payload.code || "").trim(),
    name: String(payload.name || "").trim(),
    found: String(payload.found || "").trim(),
    notFound: String(payload.notFound || "").trim(),
    location: String(payload.location || "").trim(),
    note: String(payload.note || "").trim()
  };

  if (USE_FIREBASE && db) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), record);
    return { id: docRef.id, ...record };
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  const newItem = { id: `local_${Date.now()}`, ...record };
  current.push(newItem);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  return newItem;
}

export async function updateAsset(id, payload) {
  const record = {
    seq: Number(payload.seq) || 0,
    code: String(payload.code || "").trim(),
    name: String(payload.name || "").trim(),
    found: String(payload.found || "").trim(),
    notFound: String(payload.notFound || "").trim(),
    location: String(payload.location || "").trim(),
    note: String(payload.note || "").trim()
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

// ลบหลายรายการพร้อมกัน (รองรับทั้งเลือกบางส่วนและลบทั้งหมด)
export async function bulkRemoveAssets(ids) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return 0;

  if (USE_FIREBASE && db) {
    const cloudIds = uniqueIds.filter((id) => !String(id).startsWith("local_"));
    const CHUNK_SIZE = 450; // Firestore จำกัดสูงสุด 500 operations ต่อ 1 batch
    for (let i = 0; i < cloudIds.length; i += CHUNK_SIZE) {
      const chunk = cloudIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, COLLECTION_NAME, id));
      });
      await batch.commit();
    }
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  const idSet = new Set(uniqueIds);
  const remaining = current.filter((item) => !idSet.has(item.id));
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));

  return uniqueIds.length;
}

// นำเข้าข้อมูลชุดใหญ่ขึ้น Firestore (แบ่ง batch ละ 450 รายการอัตโนมัติ)
export async function bulkImportToFirestore(records) {
  if (!USE_FIREBASE || !db) {
    throw new Error("ยังไม่ได้เปิดใช้งาน USE_FIREBASE ในไฟล์ js/firebase-config.js");
  }

  const CHUNK_SIZE = 450;
  let importedCount = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item, offset) => {
      const ref = doc(collection(db, COLLECTION_NAME));
      batch.set(ref, {
        seq: Number(item.seq) || (i + offset + 1),
        code: String(item.code || "").trim(),
        name: String(item.name || "").trim(),
        found: String(item.found || "").trim(),
        notFound: String(item.notFound || "").trim(),
        location: String(item.location || "").trim(),
        note: String(item.note || "").trim()
      });
    });

    await batch.commit();
    importedCount += chunk.length;
  }

  return importedCount;
}

// ล้างข้อมูลทั้งหมดใน Firestore แล้วเขียนชุดใหม่ (ใช้เมื่อต้องการซิงก์ข้อมูลจาก Excel ให้ตรงกับตารางเป๊ะๆ)
export async function replaceAllInFirestore(records) {
  if (!USE_FIREBASE || !db) {
    throw new Error("ยังไม่ได้เปิดใช้งาน USE_FIREBASE ในไฟล์ js/firebase-config.js");
  }

  const CHUNK_SIZE = 450;
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const existingIds = snapshot.docs.map((d) => d.id);

  for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
    const chunk = existingIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.delete(doc(db, COLLECTION_NAME, id));
    });
    await batch.commit();
  }

  return await bulkImportToFirestore(records);
}
