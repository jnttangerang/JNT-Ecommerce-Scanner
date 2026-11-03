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
    if (action === "get_master_seller") {
      return handleGetMasterSeller();
    } else if (action === "get_data_master") {
      return handleGetDataMaster();
    } else if (action === "get_masters") {
      return handleGetMasters();
    } else if (action === "get_records") {
      return handleGetRecords();
    } else if (action === "get_retur") {
      return handleGetRetur();
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

    if (action === "sync_master_seller") {
      return handleSyncMasterSeller(payload);
    } else if (action === "save_master_seller") {
      return handleSaveMasterSeller(payload);
    } else if (action === "update_master_seller") {
      return handleUpdateMasterSeller(payload);
    } else if (action === "delete_master_seller") {
      return handleDeleteMasterSeller(payload);
    } else if (action === "save_data_master") {
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
    } else if (action === "save_retur_batch") {
      return handleSaveReturBatch(payload.records);
    } else if (action === "save_handover") {
      return handleSaveHandover(payload.handover);
    } else if (action === "get_retur") {
      return handleGetRetur();
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action '" + action + "' not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function syncBatchLocked_(records) {
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
  
  // Get Sellers: Check MASTER_SELLER sheet first, then fallback to Seller List / Daftar Seller
  let sellers = [];
  const masterSellerSheet = ss.getSheetByName("MASTER_SELLER") || 
                            ss.getSheetByName("MASTER SELLERS") || 
                            ss.getSheetByName("MASTER_SELLERS") ||
                            ss.getSheetByName("Master_Seller");
                            
  if (masterSellerSheet && masterSellerSheet.getLastRow() > 1) {
    const lastRow = masterSellerSheet.getLastRow();
    const lastCol = Math.max(1, masterSellerSheet.getLastColumn());
    const headerRow = masterSellerSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h || "").toString().toLowerCase().trim());
    
    // Find name column index (1-based)
    let nameCol = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if ((h.indexOf("nama") !== -1 || h.indexOf("seller") !== -1 || h.indexOf("toko") !== -1) && 
          h.indexOf("kode") === -1 && h.indexOf("admin") === -1 && h.indexOf("no") === -1) {
        nameCol = i + 1;
        break;
      }
    }
    // Fallback: column 3 (standard template: ID, Kode, Nama), then 2, then 1
    if (nameCol === -1) {
      nameCol = lastCol >= 3 ? 3 : (lastCol >= 2 ? 2 : 1);
    }
    
    const rows = masterSellerSheet.getRange(2, nameCol, lastRow - 1, 1).getValues();
    for (let r = 0; r < rows.length; r++) {
      const val = (rows[r][0] || "").toString().trim();
      if (val && !sellers.some(s => s.toLowerCase() === val.toLowerCase())) {
        sellers.push(val);
      }
    }
  }
  
  // Fallback / merge from Seller List or Daftar Seller if any
  const sellerSheet = ss.getSheetByName("Seller List") || ss.getSheetByName("Daftar Seller");
  if (sellerSheet && sellerSheet.getLastRow() > 1) {
    const rows = sellerSheet.getRange(2, 1, sellerSheet.getLastRow() - 1, 1).getValues();
    for (let r = 0; r < rows.length; r++) {
      const val = (rows[r][0] || "").toString().trim();
      if (val && !sellers.some(s => s.toLowerCase() === val.toLowerCase())) {
        sellers.push(val);
      }
    }
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
    },
    {
      name: "DATA_RETUR",
      headers: RETUR_HEADERS
    },
    {
      name: "DATA_RETUR_SERAH",
      headers: HANDOVER_HEADERS
    },
    {
      name: "AUDIT_RETUR",
      headers: AUDIT_RETUR_HEADERS
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


function handleGetMasterSeller() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("MASTER_SELLER") || 
              ss.getSheetByName("MASTER SELLERS") || 
              ss.getSheetByName("MASTER_SELLERS") ||
              ss.getSheetByName("Master_Seller");
  if (!sheet) {
    sheet = ss.insertSheet("MASTER_SELLER");
    sheet.appendRow(["ID", "Kode Seller", "Nama", "Kategori Produk", "No. HP Admin Seller", "Alamat", "Titik GPS", "Status Aktif", "Jumlah Paket Harian", "Catatan", "updatedAt"]);
  }
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(1, sheet.getLastColumn());
  let values = [];
  let headers = [];
  if (lastRow >= 1 && lastCol >= 1) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h || "").toString().trim());
  }
  if (lastRow > 1 && lastCol >= 1) {
    values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true, values: values, headers: headers }))
    .setMimeType(ContentService.MimeType.JSON);
}


function handleDeleteMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("MASTER_SELLER");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
  
  const id = payload.id;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === id) {
        sheet.deleteRow(i + 2);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Seller not found" })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * PATCH URGENT Kode.gs  (TASK_10)
 * Cara pasang di Apps Script:
 *  1. HAPUS fungsi lama: handleSaveMasterSeller, handleUpdateMasterSeller,
 *     handleSyncMasterSeller, handleSyncMasters.
 *  2. Pada fungsi lama "handleSyncBatch(records)", UBAH NAMA saja menjadi
 *     "syncBatchLocked_(records)" (isi tidak diubah).
 *  3. Paste SEMUA isi file ini di bawah kode yang ada.
 *  4. Jalankan selfCheckSellerRow_() sekali dari editor -> harus "OK".
 *  5. Deploy > Manage deployments > Edit > New version > Deploy.
 *
 * Tidak diubah: handleGetMasterSeller, handleDeleteMasterSeller, auth, routing outlet.
 */

// Header MASTER_SELLER asli (13 kolom, A:M)
const SELLER_HEADERS = [
  "ID", "Kode Seller", "Nama Seller", "Kategori", "Admin Seller", "No HP",
  "Alamat", "GPS", "Radius", "Pickup Time", "Target Harian", "Status", "Catatan"
];

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- FIX 1: MASTER_SELLER 13 kolom ----------

function sellerSheet_(ss) {
  let sh = ss.getSheetByName("MASTER_SELLER");
  if (!sh) {
    sh = ss.insertSheet("MASTER_SELLER");
    sh.appendRow(SELLER_HEADERS);
  }
  const maxCols = sh.getMaxColumns();
  if (maxCols < SELLER_HEADERS.length) sh.insertColumnsAfter(maxCols, SELLER_HEADERS.length - maxCols);
  return sh;
}

// Bangun 1 baris 13 kolom. Field yang tidak dikirim klien mempertahankan nilai lama (old).
function sellerRow_(s, old) {
  old = old || [];
  const pick = (v, i) => (v !== undefined && v !== null ? v : (old[i] !== undefined ? old[i] : ""));
  return [
    pick(s.id, 0),
    pick(s.kodeSeller, 1),
    pick(s.nama, 2),
    pick(s.kategoriProduk, 3),
    pick(s.adminSeller, 4),
    pick(s.noHp, 5),
    pick(s.alamat, 6),
    pick(s.gps, 7),
    pick(s.radius, 8),
    pick(s.pickupTime, 9),
    pick(s.targetHarian, 10),
    pick(s.statusAktif, 11) || "ACTIVE",
    pick(s.catatan, 12)
  ];
}

function handleSaveMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = sellerSheet_(ss);
  const seller = payload.seller;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // [ID, Kode]
    for (let i = 0; i < data.length; i++) {
      if (data[i][1] === seller.kodeSeller) return jsonOut_({ success: false, error: "Kode Seller already exists" });
    }
  }
  sheet.appendRow(sellerRow_(seller, null));
  return jsonOut_({ success: true });
}

function handleUpdateMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName("MASTER_SELLER")) return jsonOut_({ success: false, error: "Sheet not found" });
  const sheet = sellerSheet_(ss);
  const seller = payload.seller;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const all = sheet.getRange(2, 1, lastRow - 1, SELLER_HEADERS.length).getValues();
    for (let i = 0; i < all.length; i++) {
      if (all[i][0] !== seller.id) continue;
      if (seller.kodeSeller) {
        for (let j = 0; j < all.length; j++) {
          if (j !== i && all[j][1] === seller.kodeSeller) return jsonOut_({ success: false, error: "Kode Seller already exists" });
        }
      }
      sheet.getRange(i + 2, 1, 1, SELLER_HEADERS.length).setValues([sellerRow_(seller, all[i])]);
      return jsonOut_({ success: true });
    }
  }
  return jsonOut_({ success: false, error: "Seller not found" });
}

function handleSyncMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = sellerSheet_(ss);
  const sellers = payload.sellers || [];
  if (sellers.length === 0) return jsonOut_({ success: true });

  const lastRow = sheet.getLastRow();
  const all = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, SELLER_HEADERS.length).getValues() : [];
  const idToIdx = {};
  const kodeToId = {};
  for (let i = 0; i < all.length; i++) {
    if (all[i][0]) idToIdx[all[i][0]] = i;
    if (all[i][1]) kodeToId[all[i][1]] = all[i][0];
  }

  const appends = [];
  const errors = [];
  for (let i = 0; i < sellers.length; i++) {
    const s = sellers[i];
    if (kodeToId[s.kodeSeller] && kodeToId[s.kodeSeller] !== s.id) {
      errors.push("Kode Seller " + s.kodeSeller + " already exists.");
      continue;
    }
    const idx = idToIdx[s.id];
    if (idx !== undefined) {
      sheet.getRange(idx + 2, 1, 1, SELLER_HEADERS.length).setValues([sellerRow_(s, all[idx])]);
    } else {
      appends.push(sellerRow_(s, null));
    }
  }
  if (appends.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, SELLER_HEADERS.length).setValues(appends);
  }
  return jsonOut_({ success: errors.length === 0, errors: errors });
}

// Cek cepat: jalankan dari editor Apps Script. Gagal = throw.
function selfCheckSeller() {
  const old = ["S1", "KS1", "Toko A", "Fashion", "Admin A", "0811", "Alamat", "gps", "50", "08:00", "20", "Aktif", "cat"];
  const r = sellerRow_({ id: "S1", nama: "Toko B", noHp: "0822" }, old);
  if (r.length !== 13) throw new Error("harus 13 kolom");
  if (r[2] !== "Toko B" || r[5] !== "0822") throw new Error("kolom yang diubah salah posisi");
  if (r[4] !== "Admin A" || r[8] !== "50" || r[9] !== "08:00" || r[10] !== "20" || r[11] !== "Aktif") {
    throw new Error("kolom lain tertimpa");
  }
  if (sellerRow_({ id: "X" }, null)[11] !== "ACTIVE") throw new Error("default status salah");
  return "OK";
}

// ---------- FIX 2: kunci agar 2 perangkat tidak menulis resi ganda ----------

// ponytail: satu kunci global untuk seluruh script; pecah per-outlet jika antrean sync terasa lambat.
function handleSyncBatch(records) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonOut_({
      success: false,
      error: "Server sibuk, akan dicoba ulang otomatis",
      failedIds: (records || []).map(function (r) { return r.ID; })
    });
  }
  try {
    return syncBatchLocked_(records);
  } finally {
    lock.releaseLock();
  }
}

// ---------- FIX 3: sync_masters tidak menghapus daftar jika kiriman kosong ----------

function rewriteList_(ss, sheetNames, defaultName, header, values) {
  let sheet = null;
  for (let i = 0; i < sheetNames.length && !sheet; i++) sheet = ss.getSheetByName(sheetNames[i]);
  if (!sheet) sheet = ss.insertSheet(defaultName);
  sheet.clear();
  const rows = [[header]].concat(values.map(function (v) { return [v]; }));
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  sheet.getRange(1, 1).setFontWeight("bold").setBackground("#f1f5f9");
}

function handleSyncMasters(sellers, operators, outlets) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const clean = function (a) {
    return (a || []).map(function (v) { return v.toString().trim(); }).filter(Boolean);
  };
  sellers = clean(sellers);
  operators = clean(operators);
  outlets = clean(outlets);

  const skipped = [];
  if (sellers.length) rewriteList_(ss, ["Seller List", "Daftar Seller"], "Seller List", "Nama Seller", sellers); else skipped.push("sellers");
  if (operators.length) rewriteList_(ss, ["Operator List", "Daftar Operator", "Data Operator"], "Data Operator", "Nama Operator", operators); else skipped.push("operators");
  if (outlets.length) rewriteList_(ss, ["Daftar Outlet", "Outlet List"], "Daftar Outlet", "Nama Outlet", outlets); else skipped.push("outlets");

  try { updateDashboardSheet(ss); } catch (e) {}
  return jsonOut_({ success: true, message: "Berhasil disinkronkan ke Spreadsheet!", skippedEmpty: skipped });
}

// ==========================================
// FITUR PAKET RETUR (TASK_11)
// ==========================================

const RETUR_HEADERS = [
  "ReturID", "Resi", "SellerID", "Seller", "Outlet", "Sumber",
  "TglTerima", "JamTerima", "AdminTerima", "Kondisi", "FotoTerimaURL",
  "Status", "HandoverID", "Catatan", "CreatedAt", "UpdatedAt", "DeletedAt",
  "TglDatang", "IsiPaket"
];

const HANDOVER_HEADERS = [
  "HandoverID", "SellerID", "Seller", "Outlet", "TglSerah", "JamSerah",
  "AdminSerah", "Metode", "JumlahPaket", "DaftarResi", "NamaPenerima",
  "FotoBuktiURL", "Catatan", "CreatedAt", "DeletedAt"
];

const AUDIT_RETUR_HEADERS = [
  "Waktu", "User", "Role", "Aksi", "RecordID", "Detail"
];

function ensureReturColumns_(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol < RETUR_HEADERS.length) {
    const missingCount = RETUR_HEADERS.length - lastCol;
    sheet.insertColumnsAfter(lastCol, missingCount);
    const missingHeaders = RETUR_HEADERS.slice(lastCol);
    sheet.getRange(1, lastCol + 1, 1, missingCount).setValues([missingHeaders]).setFontWeight("bold").setBackground("#f1f5f9");
  }
}

function getReturFolder_(driveFolder) {
  const subFolders = driveFolder.getFoldersByName("Retur");
  if (subFolders.hasNext()) {
    return subFolders.next();
  }
  return driveFolder.createFolder("Retur");
}

function writeAuditRetur_(ss, user, role, aksi, recordId, detail) {
  try {
    let sheet = ss.getSheetByName("AUDIT_RETUR");
    if (!sheet) {
      sheet = ss.insertSheet("AUDIT_RETUR");
      sheet.appendRow(AUDIT_RETUR_HEADERS);
      sheet.getRange(1, 1, 1, AUDIT_RETUR_HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
    }
    const nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([nowStr, user || "", role || "Operator", aksi, recordId || "", detail || ""]);
  } catch (e) {
    Logger.log("Audit retur error: " + e.toString());
  }
}

function handleSaveReturBatch(records) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonOut_({
      success: false,
      error: "Server sibuk (lock timeout), coba lagi dalam beberapa detik.",
      failedIds: (records || []).map(function(r) { return r.ReturID; })
    });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("DATA_RETUR");
    if (!sheet) {
      sheet = ss.insertSheet("DATA_RETUR");
      sheet.appendRow(RETUR_HEADERS);
      sheet.getRange(1, 1, 1, RETUR_HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
    } else {
      ensureReturColumns_(sheet);
    }

    const driveFolder = DriveApp.getFolderById(FOTO_FOLDER_ID);
    const returFolder = getReturFolder_(driveFolder);

    const lastRow = sheet.getLastRow();
    const existingByResi = {};
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, RETUR_HEADERS.length).getValues();
      for (let i = 0; i < data.length; i++) {
        const resi = (data[i][1] || "").toString().trim().toUpperCase();
        const deletedAt = data[i][16];
        if (resi && !deletedAt) {
          existingByResi[resi] = {
            returId: (data[i][0] || "").toString().trim(),
            photoUrl: (data[i][10] || "").toString().trim()
          };
        }
      }
    }

    let addedCount = 0;
    const alreadySynced = [];
    const duplicates = [];
    const failedIds = [];
    const appends = [];
    const results = [];
    const auditItems = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < (records || []).length; i++) {
      const r = records[i];
      try {
        const cleanResi = (r.Resi || "").toString().trim().toUpperCase();
        if (!cleanResi) {
          failedIds.push(r.ReturID);
          continue;
        }
        const cleanReturId = (r.ReturID || "").toString().trim();

        // Cek apakah resi sudah ada di spreadsheet
        if (existingByResi[cleanResi]) {
          const existingRecord = existingByResi[cleanResi];
          if (existingRecord.returId === cleanReturId) {
            // Idempotent: ReturID sama, kembalikan di alreadySynced beserta photoUrl yang sudah tersimpan
            alreadySynced.push({
              id: cleanReturId,
              resi: cleanResi,
              photoUrl: existingRecord.photoUrl || ""
            });
          } else {
            // ReturID BERBEDA, kembalikan di duplicates
            duplicates.push(cleanResi);
          }
          continue;
        }

        let finalPhotoUrl = r.FotoTerimaURL || "";
        if (finalPhotoUrl && finalPhotoUrl.indexOf("data:image") === 0) {
          try {
            const rawBase64 = finalPhotoUrl.split(",")[1];
            const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), "image/jpeg", "Retur_" + cleanResi + "_" + Date.now() + ".jpg");
            const file = returFolder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            finalPhotoUrl = file.getUrl();
          } catch (uploadErr) {
            // Foto tidak boleh hilang saat upload gagal: JANGAN append baris, masukkan ReturID ke failedIds (tetap PENDING di klien)
            Logger.log("Upload foto retur gagal untuk " + cleanReturId + ": " + uploadErr.toString());
            failedIds.push(cleanReturId);
            continue;
          }
        }

        const row = [
          cleanReturId,
          cleanResi,
          r.SellerID || "",
          r.Seller || "",
          r.Outlet || "",
          r.Sumber || "",
          r.TglTerima || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
          r.JamTerima || Utilities.formatDate(new Date(), "GMT+7", "HH:mm:ss"),
          r.AdminTerima || "",
          r.Kondisi || "Baik",
          finalPhotoUrl,
          "DITERIMA", // Server save_retur_batch harus SELALU menyimpan sebagai DITERIMA (status DISERAHKAN hanya boleh diubah oleh save_handover)
          "", // HandoverID selalu "" saat save_retur_batch (jangan salin dari klien)
          r.Catatan || "",
          r.CreatedAt || nowIso,
          r.UpdatedAt || nowIso,
          "", // DeletedAt
          r.TglDatang || r.TglTerima || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
          r.IsiPaket || ""
        ];

        appends.push(row);
        results.push({ id: cleanReturId, photoUrl: finalPhotoUrl });
        existingByResi[cleanResi] = { returId: cleanReturId, photoUrl: finalPhotoUrl };
        addedCount++;

        auditItems.push({
          admin: r.AdminTerima,
          returId: cleanReturId,
          resi: cleanResi,
          kondisi: r.Kondisi || "Baik",
          sumber: r.Sumber || "-"
        });
      } catch (err) {
        Logger.log("Error processing retur record " + r.ReturID + ": " + err.toString());
        failedIds.push(r.ReturID);
      }
    }

    if (appends.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      const count = appends.length;
      const endRow = startRow + count - 1;
      if (endRow > sheet.getMaxRows()) {
        sheet.insertRowsAfter(sheet.getMaxRows(), endRow - sheet.getMaxRows());
      }
      sheet.getRange(startRow, 2, count, 1).setNumberFormat("@");
      sheet.getRange(startRow, 7, count, 2).setNumberFormat("@");
      sheet.getRange(startRow, 15, count, 3).setNumberFormat("@");
      sheet.getRange(startRow, 18, count, 1).setNumberFormat("@");

      sheet.getRange(startRow, 1, count, RETUR_HEADERS.length).setValues(appends);
      // Pindahkan writeAuditRetur_ ke SETELAH setValues berhasil
      for (let a = 0; a < auditItems.length; a++) {
        const item = auditItems[a];
        writeAuditRetur_(ss, item.admin, "Admin/Operator", "TERIMA_RETUR", item.returId, "Terima resi " + item.resi + " (" + item.kondisi + ") dari " + item.sumber);
      }
    }

    return jsonOut_({
      success: true,
      added: addedCount,
      alreadySynced: alreadySynced,
      duplicates: duplicates,
      failedIds: failedIds,
      results: results
    });
  } catch (outerErr) {
    return jsonOut_({ success: false, error: outerErr.toString() });
  } finally {
    lock.releaseLock();
  }
}

function handleSaveHandover(handover) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonOut_({
      success: false,
      error: "Server sibuk (lock timeout), coba lagi dalam beberapa detik."
    });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let returSheet = ss.getSheetByName("DATA_RETUR");
    if (!returSheet) return jsonOut_({ success: false, error: "Sheet DATA_RETUR belum ada" });

    let hoSheet = ss.getSheetByName("DATA_RETUR_SERAH");
    if (!hoSheet) {
      hoSheet = ss.insertSheet("DATA_RETUR_SERAH");
      hoSheet.appendRow(HANDOVER_HEADERS);
      hoSheet.getRange(1, 1, 1, HANDOVER_HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
    }

    const cleanHandoverId = (handover.HandoverID || "").toString().trim();
    if (!cleanHandoverId) {
      return jsonOut_({ success: false, error: "HandoverID kosong" });
    }

    // Idempotency check: jika HandoverID sudah ada di DATA_RETUR_SERAH, kembalikan success tanpa menulis ulang dan tanpa upload foto lagi
    const hoLastRow = hoSheet.getLastRow();
    if (hoLastRow > 1) {
      const hoData = hoSheet.getRange(2, 1, hoLastRow - 1, 15).getValues();
      for (let h = 0; h < hoData.length; h++) {
        const existHoId = (hoData[h][0] || "").toString().trim();
        const deletedAt = hoData[h][14];
        if (existHoId === cleanHandoverId && !deletedAt) {
          return jsonOut_({
            success: true,
            alreadySynced: true,
            handoverId: cleanHandoverId,
            photoUrl: (hoData[h][11] || "").toString().trim()
          });
        }
      }
    }

    // 1. DaftarResi dari klien adalah ARRAY. Terima array maupun string, lalu hapus resi dobel (Set) SEBELUM menghitung actualJumlah
    const parsedResis = (Array.isArray(handover.DaftarResi) ? handover.DaftarResi : String(handover.DaftarResi || "").split(","))
      .map(function(s) { return s.toString().trim().toUpperCase(); })
      .filter(Boolean);
    const rawResis = Array.from(new Set(parsedResis));
    if (rawResis.length === 0) {
      return jsonOut_({ success: false, error: "Daftar resi kosong" });
    }

    // Hitung ulang JumlahPaket di server secara ketat dari DaftarResi unik
    const actualJumlah = rawResis.length;

    // Baca DATA_RETUR untuk validasi semua resi
    const lastRow = returSheet.getLastRow();
    if (lastRow <= 1) {
      return jsonOut_({ success: false, error: "Data retur masih kosong di spreadsheet" });
    }

    const returData = returSheet.getRange(2, 1, lastRow - 1, 17).getValues();
    const resiToRowIdx = {};

    for (let i = 0; i < returData.length; i++) {
      const resi = (returData[i][1] || "").toString().trim().toUpperCase();
      const deletedAt = returData[i][16];
      if (resi && !deletedAt) {
        resiToRowIdx[resi] = i;
      }
    }

    // 3. handleSaveHandover harus aman diulang (resume):
    // Saat validasi, resi berstatus DISERAHKAN dengan HandoverID SAMA dengan handover ini dianggap valid (lewati update, jangan error).
    // Hanya resi berstatus DISERAHKAN dengan HandoverID BERBEDA yang ditolak.
    const resisToUpdate = [];
    for (let j = 0; j < rawResis.length; j++) {
      const targetResi = rawResis[j];
      const rIdx = resiToRowIdx[targetResi];
      if (rIdx === undefined) {
        return jsonOut_({ success: false, error: "Resi " + targetResi + " tidak ditemukan di DATA_RETUR" });
      }
      const currentStatus = (returData[rIdx][11] || "").toString().trim();
      const currentHoId = (returData[rIdx][12] || "").toString().trim();
      const currentSellerId = (returData[rIdx][2] || "").toString().trim();

      if (currentStatus === "DISERAHKAN") {
        if (currentHoId === cleanHandoverId) {
          // HandoverID sama: lewati update status baris ini, aman diulang
          continue;
        } else {
          return jsonOut_({
            success: false,
            error: "Resi " + targetResi + " sudah berstatus DISERAHKAN sebelumnya (Handover: " + (currentHoId || "-") + ")"
          });
        }
      }

      if (handover.SellerID && currentSellerId && currentSellerId !== handover.SellerID) {
        return jsonOut_({ success: false, error: "Resi " + targetResi + " bukan milik seller " + handover.Seller });
      }

      resisToUpdate.push({ resi: targetResi, rowIdx: rIdx });
    }

    // 2. Foto tidak boleh hilang: Upload Foto Bukti serah terima ke subfolder Retur SEBELUM mengubah status resi apa pun
    const driveFolder = DriveApp.getFolderById(FOTO_FOLDER_ID);
    const returFolder = getReturFolder_(driveFolder);
    let finalPhotoUrl = handover.FotoBuktiURL || "";
    if (finalPhotoUrl && finalPhotoUrl.indexOf("data:image") === 0) {
      try {
        const rawBase64 = finalPhotoUrl.split(",")[1];
        const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), "image/jpeg", "Handover_" + cleanHandoverId + "_" + Date.now() + ".jpg");
        const file = returFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        finalPhotoUrl = file.getUrl();
      } catch (uploadErr) {
        return jsonOut_({
          success: false,
          error: "Upload foto bukti gagal, akan dicoba ulang"
        });
      }
    }

    const nowIso = new Date().toISOString();

    // Update Status, HandoverID, UpdatedAt pada masing-masing baris di DATA_RETUR (kolom 12-13 setValues sekaligus, kolom 16 UpdatedAt)
    for (let k = 0; k < resisToUpdate.length; k++) {
      const item = resisToUpdate[k];
      const sheetRowNum = item.rowIdx + 2;

      returSheet.getRange(sheetRowNum, 12, 1, 2).setValues([["DISERAHKAN", cleanHandoverId]]);
      returSheet.getRange(sheetRowNum, 16).setValue(nowIso);
    }

    // 3. Tulis baris DATA_RETUR_SERAH dan audit SETELAH semua update status selesai
    const targetRow = hoSheet.getLastRow() + 1;
    if (targetRow > hoSheet.getMaxRows()) {
      hoSheet.insertRowsAfter(hoSheet.getMaxRows(), targetRow - hoSheet.getMaxRows());
    }
    hoSheet.getRange(targetRow, 5, 1, 2).setNumberFormat("@");
    hoSheet.getRange(targetRow, 10, 1, 1).setNumberFormat("@");
    hoSheet.getRange(targetRow, 14, 1, 2).setNumberFormat("@");

    hoSheet.getRange(targetRow, 1, 1, HANDOVER_HEADERS.length).setValues([[
      cleanHandoverId,
      handover.SellerID || "",
      handover.Seller || "",
      handover.Outlet || "",
      handover.TglSerah || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
      handover.JamSerah || Utilities.formatDate(new Date(), "GMT+7", "HH:mm:ss"),
      handover.AdminSerah || "",
      handover.Metode || "AMBIL_DI_OUTLET",
      actualJumlah,
      rawResis.join(", "),
      handover.NamaPenerima || "",
      finalPhotoUrl,
      handover.Catatan || "",
      nowIso,
      ""
    ]]);

    writeAuditRetur_(ss, handover.AdminSerah, "Admin/Operator", "SERAH_TERIMA", cleanHandoverId, "Serahkan " + actualJumlah + " paket retur ke " + handover.NamaPenerima + " (" + (handover.Metode || "AMBIL_DI_OUTLET") + ")");

    return jsonOut_({
      success: true,
      handoverId: cleanHandoverId,
      photoUrl: finalPhotoUrl
    });
  } catch (outerErr) {
    return jsonOut_({ success: false, error: outerErr.toString() });
  } finally {
    lock.releaseLock();
  }
}

function handleGetRetur() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const returSheet = ss.getSheetByName("DATA_RETUR");
  const hoSheet = ss.getSheetByName("DATA_RETUR_SERAH");

  const returs = [];
  const handovers = [];

  if (returSheet && returSheet.getLastRow() > 1) {
    ensureReturColumns_(returSheet);
    const data = returSheet.getRange(2, 1, returSheet.getLastRow() - 1, RETUR_HEADERS.length).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const deletedAt = row[16] ? row[16].toString() : "";
      if (deletedAt) continue;

      let tglStr = row[6] instanceof Date ? Utilities.formatDate(row[6], "GMT+7", "yyyy-MM-dd") : (row[6] ? row[6].toString() : "");
      let jamStr = row[7] instanceof Date ? Utilities.formatDate(row[7], "GMT+7", "HH:mm:ss") : (row[7] ? row[7].toString() : "");
      let tglDatangStr = row[17] instanceof Date ? Utilities.formatDate(row[17], "GMT+7", "yyyy-MM-dd") : (row[17] ? row[17].toString() : tglStr);
      let isiPaketStr = row[18] ? row[18].toString() : "";

      returs.push({
        ReturID: row[0] ? row[0].toString() : "",
        Resi: row[1] ? row[1].toString() : "",
        SellerID: row[2] ? row[2].toString() : "",
        Seller: row[3] ? row[3].toString() : "",
        Outlet: row[4] ? row[4].toString() : "",
        Sumber: row[5] ? row[5].toString() : "",
        TglDatang: tglDatangStr,
        TglTerima: tglStr,
        JamTerima: jamStr,
        AdminTerima: row[8] ? row[8].toString() : "",
        Kondisi: row[9] ? row[9].toString() : "Baik",
        IsiPaket: isiPaketStr,
        FotoTerimaURL: row[10] ? row[10].toString() : "",
        Status: row[11] ? row[11].toString() : "DITERIMA",
        HandoverID: row[12] ? row[12].toString() : "",
        Catatan: row[13] ? row[13].toString() : "",
        CreatedAt: row[14] ? row[14].toString() : "",
        UpdatedAt: row[15] ? row[15].toString() : "",
        DeletedAt: deletedAt,
        SyncStatus: "SYNCED"
      });
    }
  }

  if (hoSheet && hoSheet.getLastRow() > 1) {
    const data = hoSheet.getRange(2, 1, hoSheet.getLastRow() - 1, 15).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const deletedAt = row[14] ? row[14].toString() : "";
      if (deletedAt) continue;

      let tglStr = row[4] instanceof Date ? Utilities.formatDate(row[4], "GMT+7", "yyyy-MM-dd") : (row[4] ? row[4].toString() : "");
      let jamStr = row[5] instanceof Date ? Utilities.formatDate(row[5], "GMT+7", "HH:mm:ss") : (row[5] ? row[5].toString() : "");

      handovers.push({
        HandoverID: row[0] ? row[0].toString() : "",
        SellerID: row[1] ? row[1].toString() : "",
        Seller: row[2] ? row[2].toString() : "",
        Outlet: row[3] ? row[3].toString() : "",
        TglSerah: tglStr,
        JamSerah: jamStr,
        AdminSerah: row[6] ? row[6].toString() : "",
        Metode: row[7] ? row[7].toString() : "AMBIL_DI_OUTLET",
        JumlahPaket: Number(row[8]) || 0,
        DaftarResi: row[9] ? row[9].toString() : "",
        NamaPenerima: row[10] ? row[10].toString() : "",
        FotoBuktiURL: row[11] ? row[11].toString() : "",
        Catatan: row[12] ? row[12].toString() : "",
        CreatedAt: row[13] ? row[13].toString() : "",
        DeletedAt: deletedAt,
        SyncStatus: "SYNCED"
      });
    }
  }

  return jsonOut_({
    success: true,
    returs: returs,
    handovers: handovers
  });
}