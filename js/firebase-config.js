// ตั้งค่าการเชื่อมต่อ Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC15fEpJNQuaZ8bOr7R8rwfT2Xmfui40N8",
  authDomain: "asset-survey-46025.firebaseapp.com",
  projectId: "asset-survey-46025",
  storageBucket: "asset-survey-46025.firebasestorage.app",
  messagingSenderId: "469488357942",
  appId: "1:469488357942:web:cae137abb1250acc37be97",
  measurementId: "G-BVJTVZVCVB"
};

// เปลี่ยนเป็น true เมื่อพร้อมเชื่อมต่อกับ Cloud Firestore จริง
export const USE_FIREBASE = true;

let db = null;
if (USE_FIREBASE) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db };
