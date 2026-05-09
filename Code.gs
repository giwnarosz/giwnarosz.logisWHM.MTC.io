/**
 * Warehouse Management System - Backend (Google Apps Script)
 * Sheet Structure: [Barcode, Name, Quantity, Unit, MinLevel]
 */

const SHEET_NAME = "Stock";

/**
 * Serves the HTML content or API data
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getStock") {
    return ContentService.createTextOutput(JSON.stringify(getStockData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle("WMS Pro")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handles incoming POST requests for Inbound/Outbound transactions
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 10 seconds (optimized for responsiveness)
    lock.waitLock(10000);
    
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return responseJSON({ success: false, message: "ข้อมูลที่ส่งมาไม่ถูกต้อง (JSON Parse Error)" });
    }
    
    const action = (data.action || "").trim();
    const barcode = data.barcode;
    const qty = parseInt(data.qty) || 0;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Barcode", "Name", "Quantity", "Unit", "MinLevel"]);
    }
    
    const rows = sheet.getDataRange().getValues();
    let foundIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0].toString() === barcode.toString()) {
        foundIndex = i + 1;
        break;
      }
    }
    
    if (action === "inbound") {
      if (foundIndex !== -1) {
        const currentQty = parseInt(rows[foundIndex-1][2]) || 0;
        sheet.getRange(foundIndex, 3).setValue(currentQty + qty);
        return responseJSON({ success: true, message: "อัปเดตจำนวนสินค้าเรียบร้อยแล้ว" });
      } else {
        sheet.appendRow([barcode, data.name || "สินค้าใหม่", qty, data.unit || "ชิ้น", data.min || 5]);
        return responseJSON({ success: true, message: "เพิ่มสินค้าใหม่เรียบร้อยแล้ว" });
      }
    } 
    
    else if (action === "outbound") {
      if (foundIndex === -1) {
        return responseJSON({ success: false, message: "ไม่พบสินค้าในระบบ" });
      }
      
      const currentQty = parseInt(rows[foundIndex-1][2]) || 0;
      if (currentQty < qty) {
        return responseJSON({ success: false, message: "สินค้าในสต็อกไม่พอ" });
      }
      
      sheet.getRange(foundIndex, 3).setValue(currentQty - qty);
      return responseJSON({ success: true, message: "เบิกสินค้าเรียบร้อยแล้ว" });
    }
    
    else if (action === "addProduct") {
      if (foundIndex !== -1) {
        return responseJSON({ success: false, message: "มีรหัสบาร์โค้ดนี้อยู่ในระบบแล้ว" });
      }
      sheet.appendRow([barcode, data.name, qty, data.unit, data.min]);
      return responseJSON({ success: true, message: "เพิ่มสินค้าใหม่เรียบร้อยแล้ว" });
    }
    
    else if (action === "updateProduct") {
      const oldBarcode = data.oldBarcode;
      let targetRow = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === oldBarcode.toString()) {
          targetRow = i + 1;
          break;
        }
      }
      
      if (targetRow === -1) {
        return responseJSON({ success: false, message: "ไม่พบสินค้าที่จะแก้ไข" });
      }
      
      sheet.getRange(targetRow, 1, 1, 5).setValues([[barcode, data.name, qty, data.unit, data.min]]);
      return responseJSON({ success: true, message: "แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว" });
    }
    
    else if (action === "deleteProduct") {
      if (foundIndex === -1) {
        return responseJSON({ success: false, message: "ไม่พบสินค้าที่จะลบ" });
      }
      sheet.deleteRow(foundIndex);
      return responseJSON({ success: true, message: "ลบสินค้าเรียบร้อยแล้ว" });
    }
    
    return responseJSON({ success: false, message: "ไม่สามารถดำเนินการได้: " + action + " (ตรวจสอบการ Deploy สคริปต์)" });
    
  } catch (err) {
    return responseJSON({ success: false, message: "Server Error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to get all stock data
 */
function getStockData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Only header or empty
  
  const values = sheet.getDataRange().getValues();
  values.shift(); // Remove headers
  
  return values.map(row => {
    return {
      barcode: row[0],
      name: row[1],
      qty: row[2],
      unit: row[3],
      min: row[4]
    };
  });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชันสำหรับสร้างข้อมูลจำลอง 10 รายการเพื่อทดสอบ
 * วิธีใช้: เลือกฟังก์ชัน 'generateMockData' ในหน้า Apps Script แล้วกดปุ่ม Run
 */
function generateMockData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  sheet.clear();
  sheet.appendRow(["Barcode", "Name", "Quantity", "Unit", "MinLevel"]);
  
  const mockData = [
    ["8850001001", "น้ำดื่ม 600ml", 100, "ขวด", 20],
    ["8850001002", "ข้าวสาร 5kg", 50, "ถุง", 10],
    ["8850001003", "บะหมี่กึ่งสำเร็จรูป", 200, "ซอง", 50],
    ["8850001004", "ปลากระป๋อง", 80, "กระป๋อง", 15],
    ["8850001005", "น้ำมันพืช 1L", 60, "ขวด", 10],
    ["8850001006", "ไข่ไก่ (แพ็ค 10)", 30, "แพ็ค", 5],
    ["8850001007", "นมกล่อง 250ml", 120, "กล่อง", 30],
    ["8850001008", "ผงซักฟอก 800g", 40, "ถุง", 8],
    ["8850001009", "สบู่ก้อน", 150, "ก้อน", 20],
    ["8850001010", "ยาสีฟัน", 90, "หลอด", 15],
    ["8850001011", "น้ำยาปรับผ้านุ่ม", 45, "ถุง", 10],
    ["8850001012", "แชมพู 450ml", 70, "ขวด", 12],
    ["8850001013", "ครีมนวดผม 450ml", 65, "ขวด", 10],
    ["8850001014", "กระดาษชำระ (แพ็ค 6)", 25, "แพ็ค", 8],
    ["8850001015", "แปรงสีฟัน", 110, "อัน", 20],
    ["8850001016", "น้ำยาล้างจาน 500ml", 95, "ถุง", 15],
    ["8850001017", "ถุงขยะ ขนาด 18x20", 40, "แพ็ค", 10],
    ["8850001018", "หลอดไฟ LED 9W", 15, "กล่อง", 5],
    ["8850001019", "ถ่านไฟฉาย AA (4 ก้อน)", 55, "แพ็ค", 10],
    ["8850001020", "น้ำยาถูพื้น 800ml", 35, "ถุง", 7]
  ];
  
  sheet.getRange(2, 1, mockData.length, 5).setValues(mockData);
  SpreadsheetApp.getUi().alert("สร้างสินค้าใหม่ 20 รายการเรียบร้อยแล้ว!");
}
