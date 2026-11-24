// ควบคุมการทำงานของหน้าเว็บ (อิงตารางจาก Excel: ลำดับ, รหัสทรัพย์สิน, รายการ, พบ, ไม่พบ, สถานที่ตั้ง, หมายเหตุ)
import {
  fetchAllAssets,
  createAsset,
  updateAsset,
  removeAsset,
  bulkRemoveAssets,
  bulkImportToFirestore
} from "./db-service.js";
import { INITIAL_ASSETS } from "./seed-data.js";

let allAssets = [];
let selectedIds = new Set();

// DOM Elements
const assetTableBody = document.getElementById("assetTableBody");
const filteredCount = document.getElementById("filteredCount");

const statTotal = document.getElementById("statTotal");
const statFound = document.getElementById("statFound");
const statNotFound = document.getElementById("statNotFound");
const statPending = document.getElementById("statPending");

const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");

const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const selectedCounter = document.getElementById("selectedCounter");
const btnDeleteSelected = document.getElementById("btnDeleteSelected");
const selectedCountBtn = document.getElementById("selectedCountBtn");
const btnDeleteAll = document.getElementById("btnDeleteAll");

const assetModal = document.getElementById("assetModal");
const modalTitle = document.getElementById("modalTitle");
const assetForm = document.getElementById("assetForm");
const toastEl = document.getElementById("toast");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3200);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getItemStatus(item) {
  if (String(item.found || "").trim() !== "") return "พบ";
  if (String(item.notFound || "").trim() !== "") return "ไม่พบ";
  return "รอตรวจสอบ";
}

function pickColumn(row, candidates) {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const target = candidate.toLowerCase().trim();
    const exactKey = keys.find((k) => k.toLowerCase().trim() === target);
    if (exactKey && row[exactKey] !== undefined && String(row[exactKey]).trim() !== "") {
      return String(row[exactKey]).trim();
    }
  }
  return "";
}

function mapExcelRow(row, fallbackSeq) {
  const rawSeq = pickColumn(row, ["ลำดับ", "ที่", "no", "seq"]);
  const code = pickColumn(row, ["รหัสทรัพย์สิน", "รหัสครุภัณฑ์", "เลขครุภัณฑ์", "รหัส"]);
  const name = pickColumn(row, ["รายการ", "ชื่อรายการ", "ชื่อทรัพย์สิน", "ชื่อครุภัณฑ์"]);
  const foundRaw = pickColumn(row, ["พบ"]);
  const notFoundRaw = pickColumn(row, ["ไม่พบ"]);
  const location = pickColumn(row, ["สถานที่ตั้ง", "สถานที่", "จุดติดตั้ง"]);
  const note = pickColumn(row, ["หมายเหตุ", "บันทึก"]);

  // กรองแถวท้ายตารางของแบบฟอร์มราชการ/โรงพยาบาล เช่น "ผู้ตรวจนับ ....", "ลงวันที่ ...." ที่ไม่มีรหัสและไม่มีชื่อรายการ
  if (!code && !name) {
    return null;
  }

  return {
    seq: Number(rawSeq) || fallbackSeq,
    code,
    name,
    found: foundRaw ? "✓" : "",
    notFound: !foundRaw && notFoundRaw ? "✓" : "",
    location,
    note
  };
}

function getFilteredAssets() {
  const keyword = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;

  return allAssets.filter((item) => {
    const matchKeyword =
      !keyword ||
      [item.seq, item.code, item.name, item.location, item.note]
        .some((field) => String(field || "").toLowerCase().includes(keyword));

    const itemStatus = getItemStatus(item);
    const matchStatus = !status || itemStatus === status;

    return matchKeyword && matchStatus;
  });
}

function updateStats(items) {
  statTotal.textContent = items.length;
  statFound.textContent = items.filter((i) => getItemStatus(i) === "พบ").length;
  statNotFound.textContent = items.filter((i) => getItemStatus(i) === "ไม่พบ").length;
  statPending.textContent = items.filter((i) => getItemStatus(i) === "รอตรวจสอบ").length;
}

function updateSelectionUI(filteredItems) {
  // ตัด id ที่ไม่อยู่ในรายการแล้วออก
  const validIdSet = new Set(allAssets.map((i) => i.id));
  selectedIds = new Set([...selectedIds].filter((id) => validIdSet.has(id)));

  const count = selectedIds.size;
  if (count > 0) {
    selectedCounter.textContent = `เลือกแล้ว ${count} รายการ`;
    selectedCounter.classList.remove("hidden");
    selectedCountBtn.textContent = count;
    btnDeleteSelected.classList.remove("hidden");
  } else {
    selectedCounter.classList.add("hidden");
    btnDeleteSelected.classList.add("hidden");
  }

  if (filteredItems.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  const selectedInView = filteredItems.filter((i) => selectedIds.has(i.id)).length;
  selectAllCheckbox.checked = selectedInView === filteredItems.length;
  selectAllCheckbox.indeterminate = selectedInView > 0 && selectedInView < filteredItems.length;
}

function renderTable() {
  const filtered = getFilteredAssets();
  filteredCount.textContent = filtered.length;
  updateSelectionUI(filtered);

  if (filtered.length === 0) {
    assetTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">ไม่พบรายการทรัพย์สินตามเงื่อนไขที่ค้นหา</td>
      </tr>
    `;
    return;
  }

  assetTableBody.innerHTML = filtered.map((item, idx) => {
    const isChecked = selectedIds.has(item.id);
    const isFound = String(item.found || "").trim() !== "";
    const isNotFound = String(item.notFound || "").trim() !== "";

    return `
      <tr class="${isChecked ? "row-selected" : ""}">
        <td class="col-check">
          <input type="checkbox" class="row-checkbox" data-id="${escapeHtml(item.id)}" ${isChecked ? "checked" : ""} />
        </td>
        <td class="col-seq">${escapeHtml(item.seq || idx + 1)}</td>
        <td><span class="code-pill">${escapeHtml(item.code || "-")}</span></td>
        <td><strong>${escapeHtml(item.name || "-")}</strong></td>
        <td class="col-center">
          <button
            type="button"
            class="check-badge ${isFound ? "active-found" : ""}"
            data-action="toggle-found"
            data-id="${escapeHtml(item.id)}"
            title="คลิกเพื่อติ๊ก/ยกเลิก พบ"
          >${isFound ? "✓" : ""}</button>
        </td>
        <td class="col-center">
          <button
            type="button"
            class="check-badge ${isNotFound ? "active-notfound" : ""}"
            data-action="toggle-notfound"
            data-id="${escapeHtml(item.id)}"
            title="คลิกเพื่อติ๊ก/ยกเลิก ไม่พบ"
          >${isNotFound ? "✓" : ""}</button>
        </td>
        <td>${escapeHtml(item.location || "-")}</td>
        <td>${escapeHtml(item.note || "-")}</td>
        <td class="text-right">
          <div class="action-group">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(item.id)}">แก้ไข</button>
            <button type="button" class="btn btn-danger-outline btn-sm" data-action="delete" data-id="${escapeHtml(item.id)}">ลบ</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openModal(item = null) {
  assetForm.reset();
  if (item) {
    modalTitle.textContent = "แก้ไขข้อมูลทรัพย์สิน";
    document.getElementById("editDocId").value = item.id;
    document.getElementById("assetSeq").value = item.seq || "";
    document.getElementById("assetCode").value = item.code || "";
    document.getElementById("assetName").value = item.name || "";
    document.getElementById("assetStatus").value = getItemStatus(item);
    document.getElementById("assetLocation").value = item.location || "";
    document.getElementById("assetNote").value = item.note || "";
  } else {
    modalTitle.textContent = "เพิ่มรายการทรัพย์สินใหม่";
    document.getElementById("editDocId").value = "";
    const maxSeq = allAssets.reduce((max, i) => Math.max(max, Number(i.seq) || 0), 0);
    document.getElementById("assetSeq").value = maxSeq + 1;
  }
  assetModal.classList.remove("hidden");
}

function closeModal() {
  assetModal.classList.add("hidden");
}

async function loadData() {
  const result = await fetchAllAssets();
  allAssets = result.data;

  updateStats(allAssets);
  renderTable();
}

// Filter Events
searchInput.addEventListener("input", renderTable);
filterStatus.addEventListener("change", renderTable);

// Select All Checkbox (เลือกทั้งหมดตามรายการที่แสดงอยู่)
selectAllCheckbox.addEventListener("change", (e) => {
  const filtered = getFilteredAssets();
  if (e.target.checked) {
    filtered.forEach((item) => selectedIds.add(item.id));
  } else {
    filtered.forEach((item) => selectedIds.delete(item.id));
  }
  renderTable();
});

// ลบรายการที่เลือก (Multi-delete)
btnDeleteSelected.addEventListener("click", async () => {
  const count = selectedIds.size;
  if (count === 0) return;

  if (!confirm(`ยืนยันการลบข้อมูลที่เลือกจำนวน ${count} รายการ ใช่หรือไม่?
(การลบนี้ไม่สามารถกู้คืนได้)`)) return;

  try {
    showToast(`กำลังลบข้อมูล ${count} รายการ...`);
    await bulkRemoveAssets([...selectedIds]);
    const deletedSet = new Set(selectedIds);
    allAssets = allAssets.filter((i) => !deletedSet.has(i.id));
    selectedIds.clear();
    updateStats(allAssets);
      renderTable();
    showToast(`ลบข้อมูลสำเร็จ ${count} รายการ`);
  } catch (err) {
    alert("ลบข้อมูลไม่สำเร็จ: " + err.message);
  }
});

// ลบข้อมูลทั้งหมด
btnDeleteAll.addEventListener("click", async () => {
  if (allAssets.length === 0) {
    showToast("ไม่มีรายการให้ลบ");
    return;
  }

  const total = allAssets.length;
  if (!confirm(`⚠️ คำเตือน: ต้องการลบข้อมูลทั้งหมดจำนวน ${total} รายการ ออกจากระบบใช่หรือไม่?`)) return;

  try {
    showToast(`กำลังลบข้อมูลทั้งหมด ${total} รายการ...`);
    await bulkRemoveAssets(allAssets.map((i) => i.id));
    allAssets = [];
    selectedIds.clear();
    updateStats(allAssets);
      renderTable();
    showToast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
  } catch (err) {
    alert("ลบข้อมูลทั้งหมดไม่สำเร็จ: " + err.message);
  }
});

// Modal Events
document.getElementById("btnAddNew").addEventListener("click", () => openModal());
document.getElementById("btnCloseModal").addEventListener("click", closeModal);
document.getElementById("btnCancelModal").addEventListener("click", closeModal);

assetModal.addEventListener("click", (e) => {
  if (e.target === assetModal) closeModal();
});

// Table Events (Checkbox, Quick Toggle พบ/ไม่พบ, แก้ไข, ลบรายแถว)
assetTableBody.addEventListener("change", (e) => {
  const cb = e.target.closest(".row-checkbox");
  if (!cb) return;

  const id = cb.dataset.id;
  if (cb.checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  renderTable();
});

assetTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const targetItem = allAssets.find((i) => i.id === id);
  if (!targetItem) return;

  if (action === "toggle-found") {
    const nextFound = targetItem.found ? "" : "✓";
    const updatedPayload = {
      ...targetItem,
      found: nextFound,
      notFound: nextFound ? "" : targetItem.notFound
    };
    try {
      const saved = await updateAsset(id, updatedPayload);
      allAssets = allAssets.map((i) => (i.id === id ? { ...i, ...saved } : i));
      updateStats(allAssets);
      renderTable();
    } catch (err) {
      alert("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    }
  } else if (action === "toggle-notfound") {
    const nextNotFound = targetItem.notFound ? "" : "✓";
    const updatedPayload = {
      ...targetItem,
      found: nextNotFound ? "" : targetItem.found,
      notFound: nextNotFound
    };
    try {
      const saved = await updateAsset(id, updatedPayload);
      allAssets = allAssets.map((i) => (i.id === id ? { ...i, ...saved } : i));
      updateStats(allAssets);
      renderTable();
    } catch (err) {
      alert("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    }
  } else if (action === "edit") {
    openModal(targetItem);
  } else if (action === "delete") {
    if (!confirm(`ยืนยันการลบรายการ "${targetItem.code} - ${targetItem.name}" ?`)) return;
    try {
      await removeAsset(id);
      allAssets = allAssets.filter((i) => i.id !== id);
      selectedIds.delete(id);
      updateStats(allAssets);
          renderTable();
      showToast("ลบรายการเรียบร้อยแล้ว");
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
  }
});

// Save Modal Form
assetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("editDocId").value;
  const statusVal = document.getElementById("assetStatus").value;

  const payload = {
    seq: Number(document.getElementById("assetSeq").value) || 0,
    code: document.getElementById("assetCode").value.trim(),
    name: document.getElementById("assetName").value.trim(),
    found: statusVal === "พบ" ? "✓" : "",
    notFound: statusVal === "ไม่พบ" ? "✓" : "",
    location: document.getElementById("assetLocation").value.trim(),
    note: document.getElementById("assetNote").value.trim()
  };

  try {
    if (editId) {
      const updated = await updateAsset(editId, payload);
      allAssets = allAssets.map((item) => (item.id === editId ? { ...item, ...updated } : item));
      showToast("อัปเดตข้อมูลสำเร็จ");
    } else {
      const created = await createAsset(payload);
      allAssets.push(created);
      showToast("เพิ่มรายการใหม่สำเร็จ");
    }
    updateStats(allAssets);
      renderTable();
    closeModal();
  } catch (err) {
    alert("บันทึกไม่สำเร็จ: " + err.message);
  }
});

// Export เฉพาะไฟล์ Excel (.xlsx) ตรงตามคอลัมน์ในสำรวจ.xlsx
document.getElementById("btnExportExcel").addEventListener("click", () => {
  if (typeof XLSX === "undefined") {
    alert("ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
    return;
  }

  const rows = allAssets.map((item, idx) => ({
    "ลำดับ": item.seq || idx + 1,
    "รหัสทรัพย์สิน": item.code || "",
    "รายการ": item.name || "",
    "พบ": item.found || "",
    "ไม่พบ": item.notFound || "",
    "สถานที่ตั้ง": item.location || "",
    "หมายเหตุ": item.note || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `สำรวจทรัพย์สิน-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// Import เฉพาะไฟล์ Excel (.xlsx / .xls)
document.getElementById("importExcelInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
    alert("รองรับเฉพาะไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      if (typeof XLSX === "undefined") {
        throw new Error("ยังโหลดไลบรารีอ่านไฟล์ Excel ไม่เสร็จ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่");
      }

      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      const records = [];
      rawRows.forEach((row) => {
        const mapped = mapExcelRow(row, records.length + 1);
        if (mapped) records.push(mapped);
      });

      if (records.length === 0) {
        throw new Error("ไม่พบข้อมูลรายการในไฟล์ Excel (ตรวจสอบหัวคอลัมน์: ลำดับ, รหัสทรัพย์สิน, รายการ)");
      }

      if (confirm(`อ่านข้อมูลจาก Excel สำเร็จจำนวน ${records.length} รายการ
ต้องการอัปโหลดขึ้น Cloud Firestore ทันทีหรือไม่? (กด Cancel เพื่อแสดงในตารางก่อน)`)) {
        showToast(`กำลังอัปโหลด ${records.length} รายการขึ้น Cloud Firestore...`);
        const count = await bulkImportToFirestore(records);
        await loadData();
        showToast(`อัปโหลดขึ้น Firestore สำเร็จ ${count} รายการ`);
      } else {
        allAssets = records.map((item, idx) => ({ id: `local_${idx + 1}`, ...item }));
        selectedIds.clear();
        updateStats(allAssets);
              renderTable();
        showToast(`โหลดข้อมูลจาก Excel จำนวน ${records.length} รายการเรียบร้อย`);
      }
    } catch (err) {
      alert("นำเข้าไฟล์ Excel ไม่สำเร็จ: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
});


// ==================== กล้องอ่านข้อความบนสติกเกอร์ (Camera OCR) ====================
const btnOpenCamera = document.getElementById("btnOpenCamera");
const cameraModal = document.getElementById("cameraModal");
const btnCloseCamera = document.getElementById("btnCloseCamera");
const cameraVideo = document.getElementById("cameraVideo");
const cameraCanvas = document.getElementById("cameraCanvas");
const btnCaptureOcr = document.getElementById("btnCaptureOcr");
const ocrImageInput = document.getElementById("ocrImageInput");
const btnUseOcrText = document.getElementById("btnUseOcrText");
const ocrStatusBar = document.getElementById("ocrStatusBar");
const ocrResultBox = document.getElementById("ocrResultBox");
const ocrPickedText = document.getElementById("ocrPickedText");
const ocrTokens = document.getElementById("ocrTokens");

let cameraStream = null;
let ocrWorker = null;

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cameraVideo) {
    cameraVideo.srcObject = null;
  }
}

async function startCameraStream() {
  stopCameraStream();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    ocrStatusBar.textContent = "เบราว์เซอร์ไม่รองรับกล้องสด กรุณาใช้ปุ่ม 'เลือกรูปภาพ' แทน";
    ocrStatusBar.classList.remove("hidden");
    return;
  }

  try {
    ocrStatusBar.textContent = "กำลังเปิดกล้อง...";
    ocrStatusBar.classList.remove("hidden");
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    ocrStatusBar.textContent = "พร้อมสแกน — เล็งกรอบไปที่สติกเกอร์แล้วกด 'อ่านข้อความจากกล้อง'";
  } catch (err) {
    ocrStatusBar.textContent = "ไม่สามารถเปิดกล้องได้ (" + err.message + ") สามารถกด 'เลือกรูปภาพ' เพื่ออ่านจากรูปได้";
    ocrStatusBar.classList.remove("hidden");
  }
}

async function getOcrWorker() {
  if (typeof Tesseract === "undefined") {
    throw new Error("ยังโหลดระบบอ่านข้อความ (Tesseract.js) ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า");
  }
  if (!ocrWorker) {
    ocrStatusBar.textContent = "กำลังเตรียมโมเดลอ่านข้อความ (ครั้งแรกอาจใช้เวลาเล็กน้อย)...";
    ocrStatusBar.classList.remove("hidden");
    ocrWorker = await Tesseract.createWorker("tha+eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          ocrStatusBar.textContent = `กำลังอ่านข้อความบนสติกเกอร์... ${Math.round(m.progress * 100)}%`;
        }
      }
    });
  }
  return ocrWorker;
}

function renderOcrTokens(rawText) {
  const cleaned = String(rawText || "").replace(/\s+/g, " ").trim();
  ocrPickedText.value = cleaned;

  const tokens = [...new Set(
    cleaned
      .split(/[\s|,;:\/\(\)\[\]]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  )];

  ocrTokens.innerHTML = tokens
    .map((tok) => `<button type="button" class="ocr-token-btn" data-token="${escapeHtml(tok)}">${escapeHtml(tok)}</button>`)
    .join("");

  if (cleaned) {
    ocrResultBox.classList.remove("hidden");
    btnUseOcrText.classList.remove("hidden");
  } else {
    ocrResultBox.classList.add("hidden");
    btnUseOcrText.classList.add("hidden");
  }
}

async function recognizeImageSource(source) {
  try {
    btnCaptureOcr.disabled = true;
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(source);
    renderOcrTokens(data.text || "");
    if (data.text && data.text.trim()) {
      ocrStatusBar.textContent = "อ่านข้อความสำเร็จ — เลือกคำหรือกด 'ใช้คำนี้ค้นหา'";
    } else {
      ocrStatusBar.textContent = "ไม่พบข้อความชัดเจน ลองขยับกล้องให้ใกล้สติกเกอร์มากขึ้นหรือปรับแสง";
    }
  } catch (err) {
    alert("อ่านข้อความไม่สำเร็จ: " + err.message);
    ocrStatusBar.textContent = "เกิดข้อผิดพลาดในการอ่านข้อความ";
  } finally {
    btnCaptureOcr.disabled = false;
  }
}

function openCameraModal() {
  ocrPickedText.value = "";
  ocrTokens.innerHTML = "";
  ocrResultBox.classList.add("hidden");
  btnUseOcrText.classList.add("hidden");
  cameraModal.classList.remove("hidden");
  startCameraStream();
}

function closeCameraModal() {
  stopCameraStream();
  cameraModal.classList.add("hidden");
}

function applySearchFromOcr(value) {
  const query = String(value || "").trim();
  if (!query) return;
  searchInput.value = query;
  renderTable();
  closeCameraModal();
  showToast(`ค้นหาด้วยข้อความสติกเกอร์: "${query}"`);
}

btnOpenCamera.addEventListener("click", openCameraModal);
btnCloseCamera.addEventListener("click", closeCameraModal);
cameraModal.addEventListener("click", (e) => {
  if (e.target === cameraModal) closeCameraModal();
});

btnCaptureOcr.addEventListener("click", async () => {
  if (!cameraVideo || !cameraVideo.videoWidth) {
    ocrImageInput.click();
    return;
  }

  // ตัดเฉพาะกรอบกลาง (บริเวณสติกเกอร์) เพื่อเพิ่มความแม่นยำและลดจุดรบกวน
  const vw = cameraVideo.videoWidth;
  const vh = cameraVideo.videoHeight;
  const cropW = Math.floor(vw * 0.78);
  const cropH = Math.floor(vh * 0.42);
  const sx = Math.floor((vw - cropW) / 2);
  const sy = Math.floor((vh - cropH) / 2);

  cameraCanvas.width = cropW;
  cameraCanvas.height = cropH;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraVideo, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

  await recognizeImageSource(cameraCanvas);
});

ocrImageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imgUrl = URL.createObjectURL(file);
    await recognizeImageSource(imgUrl);
    URL.revokeObjectURL(imgUrl);
  } finally {
    e.target.value = "";
  }
});

ocrTokens.addEventListener("click", (e) => {
  const btn = e.target.closest(".ocr-token-btn");
  if (!btn) return;
  ocrPickedText.value = btn.dataset.token || "";
  applySearchFromOcr(ocrPickedText.value);
});

btnUseOcrText.addEventListener("click", () => {
  applySearchFromOcr(ocrPickedText.value);
});

// เริ่มทำงาน
loadData();
