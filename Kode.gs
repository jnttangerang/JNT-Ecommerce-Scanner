/**
 * Google Apps Script API endpoint untuk J&T Sprinter Ecommerce
 * Pasang script ini di Google Apps Script (Extensions > Apps Script)
 * yang terhubung ke Google Spreadsheet J&T Anda.
 *
 * Pastikan untuk merubah MASUKKAN_SPREADSHEET_ID_ANDA dan
 * FOTO_FOLDER_ID_GOOGLE_DRIVE_ANDA terlebih dahulu sebelum deploy.
 */

const SPREADSHEET_ID = "12ly2pM3Vof9IKTwjselkLUX6sMdcdI6rcb_KvbjcQ_Y";
const FOTO_FOLDER_ID = "19peJr4JWqKA6Ei4AwuXgohhF2C59ugyp";

// BUSINESS_STATE v2 Header Definition (Columns A:S)
// Menggunakan pemisahan state bisnis independen sesuai arsitektur baru.
const RESI_HEADERS = [
  "ID",                   // A: ID
  "Tanggal",              // B: Tanggal Scan
  "Jam",                  // C: Jam Scan
  "Resi",                 // D: No Resi
  "Outlet",               // E: Outlet Penjemputan
  "Seller",               // F: Nama Seller
  "Operator",             // G: Operator Scanner
  "Status",               // H: Status (Legacy Compatibility)
  "PhotoURL",             // I: Link Foto Resi Utama
  "PackageStatus",        // J: Status Paket (NONE, Untuk Diserahkan, Diserahkan)
  "WaybillStatus",        // K: Status Waybill (NONE, Belum Diambil, Sudah Pickup)
  "ReviewStatus",         // L: Status Review Foto (PENDING, COMPLETED)
  "RetakeStatus",         // M: Status Retake Foto (NONE, PENDING, COMPLETED)
  "AlertStatus",          // N: Status Alur Pembatalan (NONE, PENDING, IN_PROGRESS, RESOLVED)
  "CancelStatus",         // O: Status Pembatalan (NONE, CANCELLED)
  "CancelEvidencePhoto",  // P: Link Foto Bukti Pemisahan Paket Batal
  "CancelHandledBy",      // Q: Operator yang memisahkan paket batal
  "CancelHandledAt",      // R: Waktu pemisahan paket batal
  "CancelRemark"          // S: Catatan pembatalan paket
];

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "get_data_master") {
      return handleGetDataMaster();
    } else if (action === "get_masters") {
      return handleGetMasters();
    } else if (action === "get_records") {
      return handleGetRecords();
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action '" + action + "' not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "save_data_master") {
      return handleSaveDataMaster(payload.keysValues);
    } else if (action === "sync_batch") {
      return handleSyncBatch(payload.records);
    } else if (action === "add_seller") {
      return handleAddSeller(payload.sellerName);
    } else if (action === "add_operator") {
      return handleAddOperator(payload.operatorName);
    } else if (action === "add_outlet") {
      return handleAddOutlet(payload.outletName);
    } else if (action === "get_masters") {
      return handleGetMasters();
    } else if (action === "get_records") {
      return handleGetRecords();
    } else if (action === "sync_masters") {
      return handleSyncMasters(payload.sellers, payload.operators, payload.outlets);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action '" + action + "' not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleSyncBatch(records) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const driveFolder = DriveApp.getFolderById(FOTO_FOLDER_ID);
  let newlyScanned = 0;
  
  // Cache existing resi lists per sheet to prevent redundant and slow sheet queries inside the loop
  const existingResisCache = {};
  // IDs that failed to process are reported back to the client so ONLY those specific
  // records stay PENDING and get retried - one bad record no longer blocks/hides the
  // sync status of every other record in the batch.
  const failedIds = [];
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    try {
      // ROUTING TEPAT BERDASARKAN OUTLET PENJEMPUTAN
      let sheetName = "Data Resi J&T Pasir Jaha Balaraja"; 
      if (r.Outlet && r.Outlet.indexOf("Jayanti") !== -1) {
        sheetName = "Data Resi J&T Jayanti";
      } else if (r.Outlet && r.Outlet.indexOf("Cikupa Mas") !== -1) {
        sheetName = "Data Resi J&T Cikupa Mas";
      }
      
      const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      // Set headers jika kosong
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(RESI_HEADERS);
        sheet.getRange(1, 1, 1, RESI_HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
      }
      
      // Load existing resis for this sheet from cache, or query and cache if not loaded yet
      if (!existingResisCache[sheetName]) {
        existingResisCache[sheetName] = getExistingResiList(sheet);
      }
      const existingResis = existingResisCache[sheetName];
      
      // Update status jika resi sudah ada (proteksi duplikat & memproses pembatalan)
      if (existingResis.indexOf(r.Resi) !== -1) {
        updateRowStatus(sheet, r.Resi, r.Status, r);
        continue;
      }
      
      // Konversi base64 image dan upload ke Google Drive (FOTO RESI)
      let finalPhotoUrl = r.PhotoURL;
      if (r.PhotoURL && r.PhotoURL.indexOf("data:image") === 0) {
        try {
          const rawBase64 = r.PhotoURL.split(",")[1];
          const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), "image/jpeg", r.Resi + ".jpg");
          const file = driveFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          finalPhotoUrl = file.getUrl();
        } catch (uploadErr) {
          finalPhotoUrl = "Upload error: " + uploadErr.toString();
        }
      }

      // Konversi base64 image dan upload ke Google Drive (FOTO PEMISAHAN PAKET BATAL)
      let finalCancelEvidencePhoto = r.CancelEvidencePhoto;
      if (r.CancelEvidencePhoto && r.CancelEvidencePhoto.indexOf("data:image") === 0) {
        try {
          const rawBase64 = r.CancelEvidencePhoto.split(",")[1];
          const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), "image/jpeg", r.Resi + "_cancel.jpg");
          const file = driveFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          finalCancelEvidencePhoto = file.getUrl();
        } catch (uploadErr) {
          finalCancelEvidencePhoto = "Upload error: " + uploadErr.toString();
        }
      }
      
      sheet.appendRow([
        r.ID || "",
        r.Tanggal || "",
        r.Jam || "",
        r.Resi || "",
        r.Outlet || "",
        r.Seller || "",
        r.Operator || "",
        r.Status || "SCANNED",
        finalPhotoUrl || "",
        r.PackageStatus || "",
        r.WaybillStatus || "",
        r.ReviewStatus || "",
        r.RetakeStatus || "",
        r.AlertStatus || "",
        r.CancelStatus || "",
        finalCancelEvidencePhoto || "",
        r.CancelHandledBy || "",
        r.CancelHandledAt || "",
        r.CancelRemark || ""
      ]);
      
      // Track newly added Resi in our local cache list so duplicates within the same batch are resolved without slow sheet re-reads
      existingResis.push(r.Resi);
      newlyScanned++;
    } catch (recordErr) {
      // Isolate the failure to THIS record only - log it and keep processing the rest
      // of the batch instead of letting one bad record throw away the whole request.
      Logger.log("Gagal memproses resi " + r.ID + " (" + r.Resi + "): " + recordErr.toString());
      failedIds.push(r.ID);
    }
  }
  
  // Update real-time summary dashboard sheet
  try {
    updateDashboardSheet(ss);
  } catch (dashErr) {
    Logger.log("Gagal memperbarui sheet dashboard: " + dashErr.toString());
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, added: newlyScanned, failedIds: failedIds }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAddSeller(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seller List") || ss.getSheetByName("Daftar Seller") || ss.insertSheet("Seller List");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nama Seller"]);
    sheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  }
  
  const data = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  const exists = data.some(row => row[0].toString().toLowerCase() === name.trim().toLowerCase());
  
  if (!exists) {
    sheet.appendRow([name.trim()]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Seller ditambahkan" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Seller sudah ada" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAddOperator(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Operator List") || ss.getSheetByName("Daftar Operator") || ss.getSheetByName("Data Operator") || ss.insertSheet("Data Operator");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nama Operator"]);
    sheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  }
  
  const data = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  const exists = data.some(row => row[0].toString().toLowerCase() === name.trim().toLowerCase());
  
  if (!exists) {
    sheet.appendRow([name.trim()]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Operator ditambahkan" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Operator sudah ada" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAddOutlet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Daftar Outlet") || ss.getSheetByName("Outlet List") || ss.insertSheet("Daftar Outlet");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nama Outlet"]);
    sheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  }
  
  const data = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  const exists = data.some(row => row[0].toString().toLowerCase() === name.trim().toLowerCase());
  
  if (!exists) {
    sheet.appendRow([name.trim()]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Outlet ditambahkan" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Outlet sudah ada" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetMasters() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Get Sellers
  const sellerSheet = ss.getSheetByName("Seller List") || ss.getSheetByName("Daftar Seller");
  let sellers = [];
  if (sellerSheet && sellerSheet.getLastRow() > 1) {
    sellers = sellerSheet.getRange(2, 1, sellerSheet.getLastRow() - 1, 1).getValues().map(r => r[0].toString());
  }
  
  // Get Operators
  const opSheet = ss.getSheetByName("Operator List") || ss.getSheetByName("Daftar Operator") || ss.getSheetByName("Data Operator");
  let operators = [];
  if (opSheet && opSheet.getLastRow() > 1) {
    operators = opSheet.getRange(2, 1, opSheet.getLastRow() - 1, 1).getValues().map(r => r[0].toString());
  }

  // Get Outlets
  const outletSheet = ss.getSheetByName("Daftar Outlet") || ss.getSheetByName("Outlet List");
  let outlets = [];
  if (outletSheet && outletSheet.getLastRow() > 1) {
    outlets = outletSheet.getRange(2, 1, outletSheet.getLastRow() - 1, 1).getValues().map(r => r[0].toString());
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, sellers: sellers, operators: operators, outlets: outlets }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetRecords() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const records = [];
  
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName();
    if (sName.indexOf("Data Resi J&T") === 0 || sName.indexOf("Data Resi") === 0) {
      const lastRow = sheets[i].getLastRow();
      const lastCol = sheets[i].getLastColumn();
      if (lastRow > 1) {
        // Read up to 19 columns, but clip to actual lastCol if it is smaller to prevent errors
        const colsToRead = Math.min(19, lastCol);
        const data = sheets[i].getRange(2, 1, lastRow - 1, colsToRead).getValues();
        for (let j = 0; j < data.length; j++) {
          const rawRow = data[j];
          // Pad row with empty strings up to 19 elements
          const row = [];
          for (let colIdx = 0; colIdx < 19; colIdx++) {
            row.push(colIdx < rawRow.length ? rawRow[colIdx] : "");
          }
          
          let tglStr = "";
          if (row[1] instanceof Date) {
            const d = row[1];
            const YYYY = d.getFullYear();
            const MM = String(d.getMonth() + 1).padStart(2, "0");
            const DD = String(d.getDate()).padStart(2, "0");
            tglStr = YYYY + "-" + MM + "-" + DD;
          } else {
            tglStr = row[1] ? row[1].toString() : "";
          }

          let jamStr = "";
          if (row[2] instanceof Date) {
            const d = row[2];
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            const ssSec = String(d.getSeconds()).padStart(2, "0");
            jamStr = hh + ":" + mm + ":" + ssSec;
          } else {
            jamStr = row[2] ? row[2].toString() : "";
          }

          let cancelHandledAtStr = "";
          if (row[17] instanceof Date) {
            cancelHandledAtStr = row[17].toISOString();
          } else {
            cancelHandledAtStr = row[17] ? row[17].toString() : "";
          }

          records.push({
            ID: row[0] ? row[0].toString() : "",
            Tanggal: tglStr,
            Jam: jamStr,
            Resi: row[3] ? row[3].toString() : "",
            Outlet: row[4] ? row[4].toString() : "",
            Seller: row[5] ? row[5].toString() : "",
            Operator: row[6] ? row[6].toString() : "",
            Status: row[7] ? row[7].toString() : "SCANNED",
            PhotoURL: row[8] ? row[8].toString() : "",
            PackageStatus: row[9] ? row[9].toString() : "",
            WaybillStatus: row[10] ? row[10].toString() : "",
            ReviewStatus: row[11] ? row[11].toString() : "",
            RetakeStatus: row[12] ? row[12].toString() : "",
            AlertStatus: row[13] ? row[13].toString() : "",
            CancelStatus: row[14] ? row[14].toString() : "",
            CancelEvidencePhoto: row[15] ? row[15].toString() : "",
            CancelHandledBy: row[16] ? row[16].toString() : "",
            CancelHandledAt: cancelHandledAtStr,
            CancelRemark: row[18] ? row[18].toString() : "",
            SyncStatus: "SYNCED"
          });
        }
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true, records: records }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSyncMasters(sellers, operators, outlets) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  sellers = sellers || [];
  operators = operators || [];
  outlets = outlets || [];
  
  // Clean list and write new ones
  const sellerSheet = ss.getSheetByName("Seller List") || ss.getSheetByName("Daftar Seller") || ss.insertSheet("Seller List");
  sellerSheet.clear();
  sellerSheet.appendRow(["Nama Seller"]);
  sellerSheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  for (let i = 0; i < sellers.length; i++) {
    const val = sellers[i].toString().trim();
    if (val) {
      sellerSheet.appendRow([val]);
    }
  }
  
  const opSheet = ss.getSheetByName("Operator List") || ss.getSheetByName("Daftar Operator") || ss.getSheetByName("Data Operator") || ss.insertSheet("Data Operator");
  opSheet.clear();
  opSheet.appendRow(["Nama Operator"]);
  opSheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  for (let i = 0; i < operators.length; i++) {
    const val = operators[i].toString().trim();
    if (val) {
      opSheet.appendRow([val]);
    }
  }

  const outletSheet = ss.getSheetByName("Daftar Outlet") || ss.getSheetByName("Outlet List") || ss.insertSheet("Daftar Outlet");
  outletSheet.clear();
  outletSheet.appendRow(["Nama Outlet"]);
  outletSheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
  if (outlets && outlets.length > 0) {
    for (let i = 0; i < outlets.length; i++) {
      const val = outlets[i].toString().trim();
      if (val) {
        outletSheet.appendRow([val]);
      }
    }
  } else {
    // default fallbacks if empty
    outletSheet.appendRow(["J&T Pasir Jaha Balaraja"]);
    outletSheet.appendRow(["J&T Jayanti"]);
    outletSheet.appendRow(["J&T Cikupa Mas"]);
  }
  
  // Re-generate dashboard
  try {
    updateDashboardSheet(ss);
  } catch(e) {}

  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Berhasil disinkronkan ke Spreadsheet!" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getExistingResiList(sheet) {
  if (sheet.getLastRow() <= 1) return [];
  const range = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1);
  return range.getValues().map(row => row[0].toString());
}

function updateRowStatus(sheet, resi, status, record) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString() === resi) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 8).setValue(status); // Kolom 8 adalah 'Status'
      
      // Jika ada objek record lengkap, update kolom-kolom baru tanpa merusak kolom lain
      if (record && typeof record === "object") {
        if (record.PackageStatus !== undefined) sheet.getRange(rowNum, 10).setValue(record.PackageStatus);
        if (record.WaybillStatus !== undefined) sheet.getRange(rowNum, 11).setValue(record.WaybillStatus);
        if (record.ReviewStatus !== undefined) sheet.getRange(rowNum, 12).setValue(record.ReviewStatus);
        if (record.RetakeStatus !== undefined) sheet.getRange(rowNum, 13).setValue(record.RetakeStatus);
        if (record.AlertStatus !== undefined) sheet.getRange(rowNum, 14).setValue(record.AlertStatus);
        if (record.CancelStatus !== undefined) sheet.getRange(rowNum, 15).setValue(record.CancelStatus);
        
        let evidencePhotoUrl = record.CancelEvidencePhoto;
        if (evidencePhotoUrl && evidencePhotoUrl.indexOf("data:image") === 0) {
          try {
            const driveFolder = DriveApp.getFolderById(FOTO_FOLDER_ID);
            const rawBase64 = evidencePhotoUrl.split(",")[1];
            const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), "image/jpeg", resi + "_cancel.jpg");
            const file = driveFolder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            evidencePhotoUrl = file.getUrl();
          } catch (uploadErr) {
            evidencePhotoUrl = "Upload error: " + uploadErr.toString();
          }
        }
        
        if (evidencePhotoUrl !== undefined) sheet.getRange(rowNum, 16).setValue(evidencePhotoUrl);
        if (record.CancelHandledBy !== undefined) sheet.getRange(rowNum, 17).setValue(record.CancelHandledBy);
        if (record.CancelHandledAt !== undefined) sheet.getRange(rowNum, 18).setValue(record.CancelHandledAt);
        if (record.CancelRemark !== undefined) sheet.getRange(rowNum, 19).setValue(record.CancelRemark);
      }
      break;
    }
  }
}

// ==========================================
// AUTO GENERATE REAL-TIME DASHBOARD DATA OUTLET & SELLER
// ==========================================
function updateDashboardSheet(ss) {
  const dashboard = ss.getSheetByName("Dashboard") || ss.insertSheet("Dashboard");
  dashboard.clear();
  
  // Style Dashboard
  dashboard.appendRow(["RINGKASAN REKAP DATA PICKUP - J&T EXPRESS"]);
  dashboard.getRange("A1").setFontSize(14).setFontWeight("bold").setFontColor("#b91c1c");
  dashboard.getRange("A2").setValue("Diperbarui secara real-time: " + Utilities.formatDate(new Date(), "GMT+7", "dd-MM-yyyy HH:mm:ss"));
  dashboard.getRange("A2").setFontSize(9).setFontItalic(true).setFontColor("#4b5563");
  dashboard.appendRow([]); // Spacing

  const sheets = ss.getSheets();
  const outletCounts = {};
  const sellerCounts = {};
  let totalScanned = 0;
  let totalCancelled = 0;
  
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName();
    if (sName.indexOf("Data Resi J&T") === 0 || sName.indexOf("Data Resi") === 0) {
      const lastRow = sheets[i].getLastRow();
      const lastCol = sheets[i].getLastColumn();
      if (lastRow > 1) {
        const colsToRead = Math.min(9, lastCol);
        const data = sheets[i].getRange(2, 1, lastRow - 1, colsToRead).getValues();
        for (let j = 0; j < data.length; j++) {
          const rawRow = data[j];
          const row = [];
          for (let colIdx = 0; colIdx < 9; colIdx++) {
            row.push(colIdx < rawRow.length ? rawRow[colIdx] : "");
          }
          const outlet = row[4] ? row[4].toString().trim() : "";
          const seller = row[5] ? row[5].toString().trim() : "";
          const status = row[7] ? row[7].toString().trim() : "";
          
          if (outlet) outletCounts[outlet] = (outletCounts[outlet] || 0) + 1;
          if (seller) sellerCounts[seller] = (sellerCounts[seller] || 0) + 1;
          
          if (status === "CANCELLED") {
            totalCancelled++;
          } else {
            totalScanned++;
          }
        }
      }
    }
  }

  // Section 1: Dashboard Cards
  dashboard.getRange("D4:E4").merge().setValue("METRIK UTAMA").setFontWeight("bold").setBackground("#fee2e2").setFontColor("#b91c1c").setHorizontalAlignment("center");
  dashboard.getRange("D5").setValue("Total Paket Berhasil (EXITO)");
  dashboard.getRange("E5").setValue(totalScanned).setFontWeight("bold").setFontColor("#16a34a");
  dashboard.getRange("D6").setValue("Total Paket Dibatalkan");
  dashboard.getRange("E6").setValue(totalCancelled).setFontWeight("bold").setFontColor("#dc2626");
  dashboard.getRange("D7").setValue("Total Pickup Diproses");
  dashboard.getRange("E7").setValue(totalScanned + totalCancelled).setFontWeight("bold").setFontColor("#111827");
  dashboard.getRange("D4:E7").setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);

  // Section 2: Outlet summary table
  dashboard.getRange("A4:B4").merge().setValue("VOLUME PER OUTLET").setFontWeight("bold").setBackground("#f3f4f6").setHorizontalAlignment("center");
  dashboard.getRange("A5").setValue("Nama Outlet").setFontWeight("bold");
  dashboard.getRange("B5").setValue("Jumlah Paket").setFontWeight("bold");
  
  let currentLine = 6;
  const outletsList = Object.keys(outletCounts).sort();
  for (let k = 0; k < outletsList.length; k++) {
    dashboard.getRange(currentLine, 1).setValue(outletsList[k]);
    dashboard.getRange(currentLine, 2).setValue(outletCounts[outletsList[k]]);
    currentLine++;
  }
  if (outletsList.length === 0) {
    dashboard.getRange(currentLine, 1).setValue("(Belum ada data)");
    dashboard.getRange(currentLine, 2).setValue(0);
    currentLine++;
  }
  dashboard.getRange(4, 1, currentLine - 4, 2).setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);

  // Section 3: Seller summary table
  const sellerStartRow = currentLine + 2;
  dashboard.getRange(sellerStartRow, 1, 1, 2).merge().setValue("VOLUME PER SELLER").setFontWeight("bold").setBackground("#f3f4f6").setHorizontalAlignment("center");
  dashboard.getRange(sellerStartRow + 1, 1).setValue("Nama Seller").setFontWeight("bold");
  dashboard.getRange(sellerStartRow + 1, 2).setValue("Jumlah Paket").setFontWeight("bold");
  
  let sellerRow = sellerStartRow + 2;
  const sellersList = Object.keys(sellerCounts).sort((a,b) => sellerCounts[b] - sellerCounts[a]);
  for (let k = 0; k < sellersList.length; k++) {
    dashboard.getRange(sellerRow, 1).setValue(sellersList[k]);
    dashboard.getRange(sellerRow, 2).setValue(sellerCounts[sellersList[k]]);
    sellerRow++;
  }
  if (sellersList.length === 0) {
    dashboard.getRange(sellerRow, 1).setValue("(Belum ada data)");
    dashboard.getRange(sellerRow, 2).setValue(0);
    sellerRow++;
  }
  dashboard.getRange(sellerStartRow, 1, sellerRow - sellerStartRow, 2).setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);
  
  // Format formatting
  dashboard.getRange("A1:E100").setFontFamily("Arial");
  dashboard.autoResizeColumn(1);
  dashboard.autoResizeColumn(2);
  dashboard.autoResizeColumn(4);
  dashboard.autoResizeColumn(5);
}

// ==========================================
// AKSES MENU INISIALISASI DI SPREADSHEET
// ==========================================

// Membuat menu otomatis di Google Sheets saat dokumen dibuka
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("J&T Scanner Setup")
      .addItem("Inisialisasi Sheet & Header Otomatis", "setupSheetHeaders")
      .addToUi();
  } catch (e) {
    // Mengabaikan error di luar konteks UI
  }
}

// Fungsi utama untuk inisialisasi sheet & header otomatis di awal setup
function setupSheetHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const setupTargets = [
    { 
      name: "Data Resi J&T Pasir Jaha Balaraja", 
      headers: RESI_HEADERS 
    },
    { 
      name: "Data Resi J&T Jayanti", 
      headers: RESI_HEADERS 
    },
    { 
      name: "Data Resi J&T Cikupa Mas", 
      headers: RESI_HEADERS 
    },
    { 
      name: "Seller List", 
      headers: ["Nama Seller"] 
    },
    { 
      name: "Data Operator", 
      headers: ["Nama Operator"] 
    },
    { 
      name: "Daftar Outlet", 
      headers: ["Nama Outlet"] 
    }
  ];
  
  let resultMsg = "Hasil Inisialisasi Sheet:\\n";
  
  for (let i = 0; i < setupTargets.length; i++) {
    const target = setupTargets[i];
    let sheet = ss.getSheetByName(target.name);
    
    if (!sheet) {
      sheet = ss.insertSheet(target.name);
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(target.headers);
      sheet.getRange(1, 1, 1, target.headers.length).setFontWeight("bold").setBackground("#f1f5f9");
      
      // Auto populate template values for metadata to help user start
      if (target.name === "Daftar Outlet") {
        sheet.appendRow(["J&T Pasir Jaha Balaraja"]);
        sheet.appendRow(["J&T Jayanti"]);
        sheet.appendRow(["J&T Cikupa Mas"]);
      } else if (target.name === "Seller List") {
        sheet.appendRow(["Skincare A"]);
        sheet.appendRow(["Fashion B"]);
        sheet.appendRow(["Elektronik C"]);
        sheet.appendRow(["Hijab Trend"]);
      } else if (target.name === "Data Operator") {
        sheet.appendRow(["FITRI FAJRIA"]);
        sheet.appendRow(["M. HARI YANTO"]);
        sheet.appendRow(["M. DANANG"]);
      }
      
      resultMsg += "✓ " + target.name + " (Berhasil di-setup dengan Header & Template)\\n";
    } else {
      // Sheet sudah ada dan berisi data -> Lakukan Migrasi Kolom/Header Baru
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());
      const missingHeaders = [];
      
      for (let hIdx = 0; hIdx < target.headers.length; hIdx++) {
        const hName = target.headers[hIdx];
        // Jika header di index ini tidak cocok dengan existingHeaders, atau existingHeaders lebih pendek
        if (hIdx >= existingHeaders.length || existingHeaders[hIdx] !== hName) {
          missingHeaders.push(hName);
        }
      }
      
      if (missingHeaders.length > 0) {
        const startCol = existingHeaders.length + 1;
        sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders])
          .setFontWeight("bold")
          .setBackground("#f1f5f9");
        resultMsg += "✓ " + target.name + " (Berhasil di-migrasi: Ditambahkan " + missingHeaders.length + " kolom baru)\\n";
      } else {
        resultMsg += "• " + target.name + " (Sudah up-to-date - Dilewati)\\n";
      }
    }
  }
  
  // Setup Dashboard
  try {
    updateDashboardSheet(ss);
    resultMsg += "✓ Dashboard (Berhasil di-generate)\\n";
  } catch (dashE) {}

  try {
    SpreadsheetApp.getUi().alert("Inisialisasi Selesai!\\n\\n" + resultMsg + "\\nLangkah ini aman dijalankan dan hanya menulis header bila sheet masih kosong atau menambahkan kolom baru yang kurang.");
  } catch (e) {
    Logger.log("Setup Selesai: " + resultMsg);
  }
  
  return { success: true, message: resultMsg };
}
function handleGetDataMaster() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("DATA_MASTER");
  if (!sheet) {
    sheet = ss.insertSheet("DATA_MASTER");
    sheet.appendRow(["KEY", "VALUE", "DESCRIPTION"]);
  }
  const lastRow = sheet.getLastRow();
  let values = [];
  if (lastRow > 1) {
    values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true, values: values }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSaveDataMaster(keysValues) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("DATA_MASTER");
  if (!sheet) {
    sheet = ss.insertSheet("DATA_MASTER");
    sheet.appendRow(["KEY", "VALUE", "DESCRIPTION"]);
  }
  // This uses a simple overwrite logic for the provided keys 
  const lastRow = sheet.getLastRow();
  const existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];
  
  const currentMap = {};
  for (let i = 0; i < existingData.length; i++) {
    if (existingData[i][0]) {
      currentMap[existingData[i][0]] = { value: existingData[i][1], desc: existingData[i][2], rowIndex: i + 2 };
    }
  }

  for (let j = 0; j < keysValues.length; j++) {
    const key = keysValues[j].key;
    const val = keysValues[j].value;
    if (currentMap[key]) {
      sheet.getRange(currentMap[key].rowIndex, 2).setValue(val);
    } else {
      sheet.appendRow([key, val, ""]);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
