// Configuration
const GAS_URL = "https://script.google.com/macros/s/AKfycbwDwO9J-_QZpxA80-_C0NiFaDYNS8sF7KyTe2j_dbOkI2nvh0DbfqJRLx96wbVwg0GQ/exec";

// State Management
let stockData = [];
let displayLimit = 10;

// Thai Keyboard to English Numbers Mapping
const thaiNumMap = {
    'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0',
    '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9', '๐': '0',
    '+': '1', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9', '๐': '0'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStockData();
    setupEventListeners();

    // Auto-focus barcode input when switching to inbound
    const inboundTab = document.getElementById('nav-inbound');
    if (inboundTab) {
        inboundTab.addEventListener('click', () => {
            setTimeout(() => {
                const el = document.getElementById('inboundBarcode');
                if (el) el.focus();
            }, 100);
        });
    }
});

function setupEventListeners() {
    // Sidebar Toggle for Mobile
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('content').classList.toggle('active');
        });
    }

    // Search Filtering
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterTable(e.target.value);
        });
    }

    // Barcode Cleaners (Thai Keyboard Fix)
    ['inboundBarcode', 'outboundBarcode', 'prodBarcode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                let val = e.target.value;
                let cleaned = "";
                for (let char of val) {
                    cleaned += thaiNumMap[char] || char;
                }
                // Keep only alphanumeric for barcodes
                e.target.value = cleaned.replace(/[^a-zA-Z0-9]/g, '');
            });
        }
    });

    // Form Submissions
    const inboundForm = document.getElementById('inboundForm');
    if (inboundForm) inboundForm.addEventListener('submit', handleInbound);

    const outboundForm = document.getElementById('outboundForm');
    if (outboundForm) outboundForm.addEventListener('submit', handleOutbound);

    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', handleProductForm);
}

// Navigation Logic
function showSection(sectionId) {
    const sections = ['dashboard', 'inbound', 'outbound', 'management'];
    sections.forEach(s => {
        const element = document.getElementById(`${s}-section`);
        if (element) element.style.display = (s === sectionId || (s === 'dashboard' && sectionId === 'management')) ? 'block' : 'none';

        const navItem = document.getElementById(`nav-${s}`);
        if (navItem) navItem.parentElement.classList.toggle('active', s === sectionId);
    });

    const isManagement = (sectionId === 'management');
    renderTable(stockData, isManagement);

    const titles = {
        'dashboard': 'แดชบอร์ด',
        'inbound': 'นำเข้าสินค้า',
        'outbound': 'เบิกสินค้า',
        'management': 'จัดการสินค้า'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = titles[sectionId];

    // Focus barcode scanner if on inbound/outbound
    if (sectionId === 'inbound') {
        setTimeout(() => {
            const el = document.getElementById('inboundBarcode');
            if (el) el.focus();
        }, 200);
    } else if (sectionId === 'outbound') {
        setTimeout(() => {
            const el = document.getElementById('outboundBarcode');
            if (el) el.focus();
        }, 200);
    }
}

// Data Fetching
async function loadStockData() {
    try {
        const response = await fetch(`${GAS_URL}?action=getStock`);
        if (!response.ok) throw new Error('Network response was not ok');
        stockData = await response.json();

        const activeNav = document.querySelector('ul.components li.active a');
        const activeSection = activeNav ? activeNav.id.replace('nav-', '') : 'dashboard';
        renderTable(stockData, activeSection === 'management');
        updateStats();
    } catch (error) {
        console.error("Error loading data:", error);
        showAlert('danger', 'ไม่สามารถโหลดข้อมูลได้', 'โปรดตรวจสอบการตั้งค่า Google Apps Script หรือการเชื่อมต่ออินเทอร์เน็ต');
    }
}

function renderTable(data, showActions = false) {
    const tbody = document.getElementById('stockTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Show/Hide Header
    const actionHeaders = document.querySelectorAll('.action-col');
    actionHeaders.forEach(h => h.style.display = showActions ? '' : 'none');

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${showActions ? 6 : 5}" class="text-center py-4 text-muted">ไม่พบข้อมูลสินค้า</td></tr>`;
        return;
    }

    // Apply Display Limit
    let displayData = data;
    if (displayLimit > 0) {
        displayData = data.slice(0, displayLimit);
    }

    displayData.forEach((item) => {
        const isLow = parseInt(item.qty) <= parseInt(item.min);
        const actionBtn = showActions ? `
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${item.barcode}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${item.barcode}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>` : '';

        const row = `
            <tr>
                <td class="ps-4 fw-bold text-primary">${item.barcode}</td>
                <td>${item.name}</td>
                <td class="text-center fw-bold">${item.qty}</td>
                <td>${item.unit}</td>
                <td>
                    <span class="badge ${isLow ? 'bg-danger' : 'bg-success'} rounded-pill">
                        ${isLow ? 'สินค้าใกล้หมด' : 'ปกติ'}
                    </span>
                </td>
                ${actionBtn}
            </tr>
        `;
        tbody.innerHTML += row;
    });

    // If there's more data, show a hint
    if (displayLimit > 0 && data.length > displayLimit) {
        tbody.innerHTML += `<tr><td colspan="${showActions ? 6 : 5}" class="text-center py-2 text-muted small">แสดง ${displayLimit} จากทั้งหมด ${data.length} รายการ (ปรับได้ที่ตัวเลือกด้านบน)</td></tr>`;
    }
}

function changeDisplayLimit() {
    const limit = document.getElementById('displayLimit').value;
    displayLimit = parseInt(limit);
    const activeNav = document.querySelector('ul.components li.active a');
    const activeSection = activeNav ? activeNav.id.replace('nav-', '') : 'dashboard';
    renderTable(stockData, activeSection === 'management');
}

function updateStats() {
    const totalEl = document.getElementById('total-items');
    const lowEl = document.getElementById('low-stock-count');

    if (totalEl) totalEl.innerText = stockData.length;
    if (lowEl) {
        const lowStockCount = stockData.filter(i => parseInt(i.qty) <= parseInt(i.min)).length;
        lowEl.innerText = lowStockCount;
    }
}

function filterTable(query) {
    const filtered = stockData.filter(item =>
        item.barcode.toString().toLowerCase().includes(query.toLowerCase()) ||
        item.name.toLowerCase().includes(query.toLowerCase())
    );
    renderTable(filtered, document.querySelector('ul.components li.active a').id.includes('management'));
}

// Generic API caller for POST actions
async function callGAS(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.error("API Error:", error);
        return { success: false, message: error.name === 'AbortError' ? "หมดเวลาเชื่อมต่อ" : "ไม่สามารถบันทึกข้อมูลได้" };
    }
}

// Form Handlers
async function handleInbound(e) {
    e.preventDefault();
    const barcode = document.getElementById('inboundBarcode').value;
    const qty = parseInt(document.getElementById('inboundQty').value);
    setLoading(true);
    try {
        const result = await callGAS({ action: 'inbound', barcode, qty });
        if (result.success) {
            showAlert('success', 'สำเร็จ!', result.message);
            e.target.reset();
            await loadStockData();
            document.getElementById('inboundBarcode').focus();
        } else {
            showAlert('danger', 'ผิดพลาด', result.message);
        }
    } catch (err) {
        showAlert('danger', 'ผิดพลาด', 'เกิดข้อผิดพลาด');
    } finally {
        setLoading(false);
    }
}

async function handleOutbound(e) {
    e.preventDefault();
    const barcode = document.getElementById('outboundBarcode').value;
    const qty = parseInt(document.getElementById('outboundQty').value);
    setLoading(true);
    try {
        const result = await callGAS({ action: 'outbound', barcode, qty });
        if (result.success) {
            showAlert('success', 'สำเร็จ!', result.message);
            e.target.reset();
            await loadStockData();
            document.getElementById('outboundBarcode').focus();
        } else {
            showAlert('danger', 'ผิดพลาด', result.message);
        }
    } catch (err) {
        showAlert('danger', 'ผิดพลาด', 'เกิดข้อผิดพลาด');
    } finally {
        setLoading(false);
    }
}

// Management Functions
let productModalInstance = null;
let deleteModalInstance = null;

function openAddModal() {
    const modalEl = document.getElementById('productModal');
    document.getElementById('productModalTitle').innerText = 'เพิ่มสินค้าใหม่';
    document.getElementById('productForm').reset();
    document.getElementById('oldBarcode').value = '';

    if (!productModalInstance) productModalInstance = new bootstrap.Modal(modalEl);
    productModalInstance.show();
}

function openEditModal(barcode) {
    const item = stockData.find(i => i.barcode.toString() === barcode.toString());
    if (!item) return;

    const modalEl = document.getElementById('productModal');
    document.getElementById('productModalTitle').innerText = 'แก้ไขข้อมูลสินค้า';
    document.getElementById('prodBarcode').value = item.barcode;
    document.getElementById('oldBarcode').value = item.barcode;
    document.getElementById('prodName').value = item.name;
    document.getElementById('prodQty').value = item.qty;
    document.getElementById('prodUnit').value = item.unit;
    document.getElementById('prodMin').value = item.min;

    if (!productModalInstance) productModalInstance = new bootstrap.Modal(modalEl);
    productModalInstance.show();
}

async function handleProductForm(e) {
    e.preventDefault();
    const oldBarcode = document.getElementById('oldBarcode').value;
    const barcode = document.getElementById('prodBarcode').value;
    const name = document.getElementById('prodName').value;
    const qty = parseInt(document.getElementById('prodQty').value) || 0;
    const unit = document.getElementById('prodUnit').value;
    const min = parseInt(document.getElementById('prodMin').value) || 0;

    setLoading(true);
    try {
        const payload = {
            action: oldBarcode ? 'updateProduct' : 'addProduct',
            oldBarcode: oldBarcode,
            barcode: barcode,
            name: name,
            qty: qty,
            unit: unit,
            min: min
        };

        const result = await callGAS(payload);

        if (result.success) {
            if (productModalInstance) productModalInstance.hide();
            showAlert('success', 'สำเร็จ!', result.message);
            await loadStockData();
        } else {
            showAlert('danger', 'ผิดพลาด', result.message);
        }
    } catch (err) {
        console.error("Form Error:", err);
        showAlert('danger', 'ผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
    } finally {
        setLoading(false);
    }
}

function openDeleteModal(barcode) {
    const modalEl = document.getElementById('deleteModal');
    document.getElementById('deleteBarcode').value = barcode;
    if (!deleteModalInstance) deleteModalInstance = new bootstrap.Modal(modalEl);
    deleteModalInstance.show();
}

async function confirmDelete() {
    const barcode = document.getElementById('deleteBarcode').value;
    if (!barcode) return;

    setLoading(true);
    try {
        const result = await callGAS({ action: 'deleteProduct', barcode: barcode });
        if (result.success) {
            if (deleteModalInstance) deleteModalInstance.hide();
            showAlert('success', 'ลบสำเร็จ', result.message);
            await loadStockData();
        } else {
            showAlert('danger', 'ผิดพลาด', result.message);
        }
    } catch (err) {
        showAlert('danger', 'ผิดพลาด', 'ไม่สามารถลบข้อมูลได้');
    } finally {
        setLoading(false);
    }
}

// UI Helpers
function showAlert(type, title, message) {
    const modal = new bootstrap.Modal(document.getElementById('alertModal'));
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    const icon = document.getElementById('modalIcon');
    icon.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill text-success' : 'x-circle-fill text-danger'}" style="font-size: 4rem;"></i>`;
    modal.show();
}

function setLoading(isLoading) {
    const buttons = document.querySelectorAll('button[type="submit"], .btn-danger');
    buttons.forEach(btn => {
        if (isLoading) {
            btn.disabled = true;
            if (!btn.getAttribute('data-original-text')) btn.setAttribute('data-original-text', btn.innerHTML);
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังทำงาน...';
        } else {
            btn.disabled = false;
            const originalText = btn.getAttribute('data-original-text');
            if (originalText) btn.innerHTML = originalText;
        }
    });
}
