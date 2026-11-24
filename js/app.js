// ควบคุมการทำงานของหน้าเว็บ (UI Events, Filter, Modal, Export/Import)
import {
  fetchAllAssets,
  createAsset,
  updateAsset,
  removeAsset,
  bulkImportToFirestore
} from "./db-service.js";
import { INITIAL_ASSETS } from "./seed-data.js";

let allAssets = [];

// DOM Elements
const connectionBadge = document.getElementById("connectionBadge");
const assetTableBody = document.getElementById("assetTableBody");
const filteredCount = document.getElementById("filteredCount");

const statTotal = document.getElementById("statTotal");
const statNormal = document.getElementById("statNormal");
const statDamaged = document.getElementById("statDamaged");
const statPending = document.getElementById("statPending");

const searchInput = document.getElementById("searchInput");
const filterDepartment = document.getElementById("filterDepartment");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");

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

function updateStats(items) {
  statTotal.textContent = items.length;
  statNormal.textContent = items.filter((i) => i.status === "ปกติ").length;
  statDamaged.textContent = items.filter((i) => i.status === "ชำรุด").length;
  statPending.textContent = items.filter((i) => i.status === "รอตรวจสอบ" || i.status === "ไม่พบทรัพย์สิน").length;
}

function populateFilters(items) {
  const currentDept = filterDepartment.value;
  const currentCat = filterCategory.value;

  const departments = [...new Set(items.map((i) => i.department).filter(Boolean))].sort();
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();

  filterDepartment.innerHTML = `<option value="">ทั้งหมดทุกแผนก</option>` +
    departments.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");

  filterCategory.innerHTML = `<option value="">ทุกประเภท</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  filterDepartment.value = departments.includes(currentDept) ? currentDept : "";
  filterCategory.value = categories.includes(currentCat) ? currentCat : "";
}

function renderTable() {
  const keyword = searchInput.value.trim().toLowerCase();
  const dept = filterDepartment.value;
  const cat = filterCategory.value;
  const status = filterStatus.value;

  const filtered = allAssets.filter((item) => {
    const matchKeyword =
      !keyword ||
      [item.code, item.name, item.serial, item.custodian, item.location, item.note]
        .some((field) => String(field || "").toLowerCase().includes(keyword));

    const matchDept = !dept || item.department === dept;
    const matchCat = !cat || item.category === cat;
    const matchStatus = !status || item.status === status;

    return matchKeyword && matchDept && matchCat && matchStatus;
  });

  filteredCount.textContent = filtered.length;

  if (filtered.length === 0) {
    assetTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">ไม่พบรายการทรัพย์สินตามเงื่อนไขที่ค้นหา</td>
      </tr>
    `;
    return;
  }

  assetTableBody.innerHTML = filtered.map((item) => `
    <tr>
      <td>
        <span class="code-pill">${escapeHtml(item.code)}</span>
        ${item.serial ? `<span class="sub-text">S/N: ${escapeHtml(item.serial)}</span>` : ""}
      </td>
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        ${item.note ? `<span class="sub-text">${escapeHtml(item.note)}</span>` : ""}
      </td>
      <td>${escapeHtml(item.category || "-")}</td>
      <td>
        ${escapeHtml(item.department || "-")}
        ${item.location ? `<span class="sub-text">${escapeHtml(item.location)}</span>` : ""}
      </td>
      <td>${escapeHtml(item.custodian || "-")}</td>
      <td>
        <span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
      </td>
      <td>
        <span>${escapeHtml(item.updatedAt || "-")}</span>
        ${item.surveyor ? `<span class="sub-text">โดย ${escapeHtml(item.surveyor)}</span>` : ""}
      </td>
      <td class="text-right">
        <div class="action-group">
          <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(item.id)}">แก้ไข</button>
          <button type="button" class="btn btn-danger-outline btn-sm" data-action="delete" data-id="${escapeHtml(item.id)}">ลบ</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openModal(item = null) {
  assetForm.reset();
  if (item) {
    modalTitle.textContent = "แก้ไขข้อมูลทรัพย์สิน";
    document.getElementById("editDocId").value = item.id;
    document.getElementById("assetCode").value = item.code || "";
    document.getElementById("serialNumber").value = item.serial || "";
    document.getElementById("assetName").value = item.name || "";
    document.getElementById("assetCategory").value = item.category || "";
    document.getElementById("assetDepartment").value = item.department || "";
    document.getElementById("assetLocation").value = item.location || "";
    document.getElementById("assetCustodian").value = item.custodian || "";
    document.getElementById("assetStatus").value = item.status || "ปกติ";
    document.getElementById("surveyorName").value = item.surveyor || "";
    document.getElementById("assetNote").value = item.note || "";
  } else {
    modalTitle.textContent = "เพิ่มรายการทรัพย์สินใหม่";
    document.getElementById("editDocId").value = "";
  }
  assetModal.classList.remove("hidden");
}

function closeModal() {
  assetModal.classList.add("hidden");
}

async function loadData() {
  const result = await fetchAllAssets();
  allAssets = result.data;

  if (result.source === "firebase") {
    connectionBadge.textContent = "เชื่อมต่อ Cloud Firestore แล้ว";
    connectionBadge.className = "badge badge-online";
  } else {
    connectionBadge.textContent = "โหมดสำรองในเครื่อง (Local)";
    connectionBadge.className = "badge badge-offline";
  }

  updateStats(allAssets);
  populateFilters(allAssets);
  renderTable();
}

// Event Listeners
searchInput.addEventListener("input", renderTable);
filterDepartment.addEventListener("change", renderTable);
filterCategory.addEventListener("change", renderTable);
filterStatus.addEventListener("change", renderTable);

document.getElementById("btnAddNew").addEventListener("click", () => openModal());
document.getElementById("btnCloseModal").addEventListener("click", closeModal);
document.getElementById("btnCancelModal").addEventListener("click", closeModal);

assetModal.addEventListener("click", (e) => {
  if (e.target === assetModal) closeModal();
});

assetTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const targetItem = allAssets.find((i) => i.id === id);

  if (action === "edit" && targetItem) {
    openModal(targetItem);
  } else if (action === "delete" && targetItem) {
    if (!confirm(`ยืนยันการลบรายการ "${targetItem.code} - ${targetItem.name}" ?`)) return;
    try {
      await removeAsset(id);
      allAssets = allAssets.filter((i) => i.id !== id);
      updateStats(allAssets);
      populateFilters(allAssets);
      renderTable();
      showToast("ลบรายการเรียบร้อยแล้ว");
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
  }
});

assetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("editDocId").value;
  const payload = {
    code: document.getElementById("assetCode").value.trim(),
    serial: document.getElementById("serialNumber").value.trim(),
    name: document.getElementById("assetName").value.trim(),
    category: document.getElementById("assetCategory").value.trim(),
    department: document.getElementById("assetDepartment").value.trim(),
    location: document.getElementById("assetLocation").value.trim(),
    custodian: document.getElementById("assetCustodian").value.trim(),
    status: document.getElementById("assetStatus").value,
    surveyor: document.getElementById("surveyorName").value.trim(),
    note: document.getElementById("assetNote").value.trim()
  };

  try {
    if (editId) {
      const updated = await updateAsset(editId, payload);
      allAssets = allAssets.map((item) => (item.id === editId ? { ...item, ...updated } : item));
      showToast("อัปเดตข้อมูลสำเร็จ");
    } else {
      const created = await createAsset(payload);
      allAssets.unshift(created);
      showToast("เพิ่มรายการใหม่สำเร็จ");
    }
    updateStats(allAssets);
    populateFilters(allAssets);
    renderTable();
    closeModal();
  } catch (err) {
    alert("บันทึกไม่สำเร็จ: " + err.message);
  }
});

// ปุ่มนำเข้าข้อมูลตั้งต้นขึ้น Firestore
document.getElementById("btnSeedUpload").addEventListener("click", async () => {
  const sourceList = allAssets.length > 0 ? allAssets : INITIAL_ASSETS;
  if (!confirm(`ต้องการนำเข้าข้อมูลจำนวน ${sourceList.length} รายการ ขึ้น Cloud Firestore ใช่หรือไม่?`)) return;

  try {
    showToast("กำลังนำเข้าข้อมูลขึ้น Firestore...");
    const count = await bulkImportToFirestore(sourceList);
    await loadData();
    showToast(`นำเข้าข้อมูลสำเร็จ ${count} รายการ`);
  } catch (err) {
    alert("นำเข้าไม่สำเร็จ: " + err.message);
  }
});

// Export JSON
document.getElementById("btnExportJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(allAssets, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asset-survey-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Export CSV
document.getElementById("btnExportCsv").addEventListener("click", () => {
  const headers = ["รหัสครุภัณฑ์", "Serial", "ชื่อรายการ", "ประเภท", "แผนก", "สถานที่ตั้ง", "ผู้ดูแล", "สถานะ", "ผู้สำรวจ", "หมายเหตุ", "อัปเดตล่าสุด"];
  const rows = allAssets.map((i) => [
    i.code, i.serial, i.name, i.category, i.department, i.location, i.custodian, i.status, i.surveyor, i.note, i.updatedAt
  ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","));

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asset-survey-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Import JSON
document.getElementById("importJsonInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) throw new Error("รูปแบบไฟล์ JSON ต้องเป็น Array ของรายการทรัพย์สิน");

      if (confirm(`พบข้อมูล ${parsed.length} รายการ ต้องการอัปโหลดขึ้น Cloud Firestore ทันทีหรือไม่? (กด Cancel เพื่อดูในหน้าเว็บก่อน)`)) {
        const count = await bulkImportToFirestore(parsed);
        await loadData();
        showToast(`อัปโหลดขึ้น Firestore สำเร็จ ${count} รายการ`);
      } else {
        allAssets = parsed.map((item, idx) => ({ id: item.id || `local_${idx + 1}`, ...item }));
        updateStats(allAssets);
        populateFilters(allAssets);
        renderTable();
        showToast(`โหลดข้อมูลจากไฟล์ ${parsed.length} รายการเรียบร้อย`);
      }
    } catch (err) {
      alert("อ่านไฟล์ไม่สำเร็จ: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
});

// เริ่มทำงาน
loadData();
