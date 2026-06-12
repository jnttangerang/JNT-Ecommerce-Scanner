/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScanRecord, Seller, Outlet, Operator } from "../types";

// Predefined constants and localstorage keys
const SELLER_KEY = "jt_pickup_sellers";
const OUTLET_KEY = "jt_pickup_outlets";
const OPERATOR_KEY = "jt_pickup_operators";
const RECORDS_KEY = "jt_pickup_records";
const OFFLINE_MODE_KEY = "jt_pickup_offline_mode";
const CLOUD_CONFIG_KEY = "jt_pickup_cloud_config";

export interface CloudConfig {
  coreFolderUrl: string;
  fotoFolderId: string;
  spreadsheetId: string;
  appsScriptUrl: string;
}

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  coreFolderUrl: "https://drive.google.com/drive/folders/1_Zt8E_Pickup_Ecommerce_Scanner_JT_Example",
  fotoFolderId: "1_Ph0t0_Res1_Folder_ID_Example",
  spreadsheetId: "1_JT_Pickup_Ecommerce_Spreadsheet_ID_Example",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbz_Example_Apps_Script_Web_App_URL_Here/exec"
};

// Default Master Data
const DEFAULT_OUTLETS: Outlet[] = [
  { NamaOutlet: "J&T Pasir Jaha Balaraja" },
  { NamaOutlet: "J&T Jayanti" },
  { NamaOutlet: "J&T Cikupa Mas" }
];

const DEFAULT_OPERATORS: Operator[] = [
  { NamaOperator: "FITRI FAJRIA" },
  { NamaOperator: "M. HARI YANTO" },
  { NamaOperator: "M. DANANG" },
  { NamaOperator: "ANITA SARI" }
];

const DEFAULT_SELLERS: Seller[] = [
  { NamaSeller: "Skincare A" },
  { NamaSeller: "Fashion B" },
  { NamaSeller: "Elektronik C" },
  { NamaSeller: "Hijab Trend" },
  { NamaSeller: "Glow Cosmetics" }
];

// Generate fake scanned records for the past 2 days to populate analytics out of the box
function generateHistoricalData(): ScanRecord[] {
  const records: ScanRecord[] = [];
  const outlets = ["J&T Pasir Jaha Balaraja", "J&T Jayanti"];
  const operators = ["FITRI FAJRIA", "M. HARI YANTO", "M. DANANG"];
  const sellers = ["Skincare A", "Fashion B", "Elektronik C", "Hijab Trend"];
  
  const today = new Date().toISOString().split("T")[0];
  
  // Yesterday
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterday = yesterdayObj.toISOString().split("T")[0];

  // Let's generate about 40 entries for yesterday, and 30 for today
  let idCounter = 1000;

  // Yesterday Data
  for (let i = 0; i < 45; i++) {
    const outlet = outlets[i % 2];
    const operator = operators[i % 3];
    const seller = sellers[i % 4];
    const resiNum = 9530937000 + i;
    const resi = `JX${resiNum}`;
    
    // Random hour between 09 and 17
    const hour = String(9 + (i % 9)).padStart(2, "0");
    const min = String((i * 13) % 60).padStart(2, "0");
    const sec = String((i * 27) % 60).padStart(2, "0");
    
    records.push({
      ID: String(idCounter++),
      Tanggal: yesterday,
      Jam: `${hour}:${min}:${sec}`,
      Resi: resi,
      Outlet: outlet,
      Seller: seller,
      Operator: operator,
      Status: i % 15 === 0 ? "CANCELLED" : "SCANNED", // occasional cancel for testing
      PhotoURL: createMockResiPhoto(resi, seller),
      SyncStatus: "SYNCED",
      ScanTimestamp: new Date(`${yesterday}T${hour}:${min}:${sec}`).getTime()
    });
  }

  // Today Data
  for (let i = 0; i < 35; i++) {
    const outlet = outlets[(i + 1) % 2];
    const operator = operators[(i + 2) % 3];
    const seller = sellers[(i + 3) % 4];
    const resiNum = 9530938000 + i;
    const resi = `JX${resiNum}`;
    
    const hour = String(9 + (i % 8)).padStart(2, "0");
    const min = String((i * 17) % 60).padStart(2, "0");
    const sec = String((i * 19) % 60).padStart(2, "0");
    
    records.push({
      ID: String(idCounter++),
      Tanggal: today,
      Jam: `${hour}:${min}:${sec}`,
      Resi: resi,
      Outlet: outlet,
      Seller: seller,
      Operator: operator,
      Status: i === 12 ? "CANCELLED" : "SCANNED",
      PhotoURL: createMockResiPhoto(resi, seller),
      SyncStatus: i < 30 ? "SYNCED" : "PENDING", // some pending items for sync simulation!
      ScanTimestamp: new Date(`${today}T${hour}:${min}:${sec}`).getTime()
    });
  }

  return records.sort((a, b) => b.ScanTimestamp - a.ScanTimestamp);
}

// Generate simple svg-based data URI as mock tracking photo
export function createMockResiPhoto(resi: string, seller: string): string {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return "";
  canvas.width = 400;
  canvas.height = 250;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Background receipt slate
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, 400, 250);
    
    // Invoice border & line
    ctx.strokeStyle = "#e1e4e8";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 384, 234);
    
    // Header J&T Express logo lookalike
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(20, 20, 100, 32);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("J&T EXPRESS", 26, 42);

    // Shipping info
    ctx.fillStyle = "#333333";
    ctx.font = "normal 11px monospace";
    ctx.fillText("LAYANAN: EZ (REGULER)", 135, 32);
    ctx.fillText("E-COMMERCE PICKUP", 135, 47);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 60);
    ctx.lineTo(380, 60);
    ctx.stroke();

    // Seller Info
    ctx.fillStyle = "#222";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`PENGIRIM: ${seller}`, 20, 80);
    ctx.font = "normal 11px sans-serif";
    ctx.fillText("PENERIMA: Bpk. Joko Widodo (JAKARTA)", 20, 98);
    
    // Mock Barcode bars
    ctx.fillStyle = "#000000";
    let startX = 40;
    const barHeights = 55;
    const barcodeParts = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 3, 1, 2, 3, 1, 4, 2, 1, 2, 3, 1, 4, 1];
    barcodeParts.forEach((width, index) => {
      if (index % 2 === 0) {
        ctx.fillRect(startX, 120, width * 2.8, barHeights);
      }
      startX += width * 3.2;
    });

    // Tracking number code
    ctx.fillStyle = "#000000";
    ctx.font = "bold 15px monospace";
    ctx.fillText(resi, 120, 195);

    // Status watermark banner
    ctx.fillStyle = "rgba(0, 128, 0, 0.08)";
    ctx.fillRect(200, 75, 170, 30);
    ctx.fillStyle = "#2e7d32";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("✓ VERIFIED RESI OK", 235, 94);
  }
  return canvas.toDataURL("image/jpeg", 0.75);
}

export class DatabaseService {
  // Initialize lists
  public getOutlets(): Outlet[] {
    const raw = localStorage.getItem(OUTLET_KEY);
    if (!raw) {
      localStorage.setItem(OUTLET_KEY, JSON.stringify(DEFAULT_OUTLETS));
      return DEFAULT_OUTLETS;
    }
    return JSON.parse(raw);
  }

  public getOperators(): Operator[] {
    const raw = localStorage.getItem(OPERATOR_KEY);
    if (!raw) {
      localStorage.setItem(OPERATOR_KEY, JSON.stringify(DEFAULT_OPERATORS));
      return DEFAULT_OPERATORS;
    }
    return JSON.parse(raw);
  }

  public getSellers(): Seller[] {
    const raw = localStorage.getItem(SELLER_KEY);
    if (!raw) {
      localStorage.setItem(SELLER_KEY, JSON.stringify(DEFAULT_SELLERS));
      return DEFAULT_SELLERS;
    }
    return JSON.parse(raw);
  }

  public addSeller(name: string): boolean {
    const sellers = this.getSellers();
    const cleanName = name.trim();
    if (!cleanName) return false;
    
    // Duplicate check
    if (sellers.some(s => s.NamaSeller.toLowerCase() === cleanName.toLowerCase())) {
      return false; // already exists
    }

    sellers.push({ NamaSeller: cleanName });
    localStorage.setItem(SELLER_KEY, JSON.stringify(sellers));
    return true;
  }

  public deleteSeller(name: string): boolean {
    const sellers = this.getSellers();
    const filtered = sellers.filter(s => s.NamaSeller.toLowerCase() !== name.trim().toLowerCase());
    if (sellers.length === filtered.length) return false;
    localStorage.setItem(SELLER_KEY, JSON.stringify(filtered));
    return true;
  }

  public addOperator(name: string): boolean {
    const operators = this.getOperators();
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (operators.some(o => o.NamaOperator.toLowerCase() === cleanName.toLowerCase())) {
      return false;
    }
    operators.push({ NamaOperator: cleanName });
    localStorage.setItem(OPERATOR_KEY, JSON.stringify(operators));
    return true;
  }

  public deleteOperator(name: string): boolean {
    const operators = this.getOperators();
    const filtered = operators.filter(o => o.NamaOperator.toLowerCase() !== name.trim().toLowerCase());
    if (operators.length === filtered.length) return false;
    localStorage.setItem(OPERATOR_KEY, JSON.stringify(filtered));
    return true;
  }

  public getCloudConfig(): CloudConfig {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(DEFAULT_CLOUD_CONFIG));
      return DEFAULT_CLOUD_CONFIG;
    }
    return JSON.parse(raw);
  }

  public saveCloudConfig(config: Partial<CloudConfig>) {
    const current = this.getCloudConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(updated));
  }

  // Get active scanned records
  public getRecords(): ScanRecord[] {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) {
      const hist = generateHistoricalData();
      localStorage.setItem(RECORDS_KEY, JSON.stringify(hist));
      return hist;
    }
    return JSON.parse(raw);
  }

  // Check if ticket barcode already exists
  public isDuplicate(resi: string): boolean {
    const records = this.getRecords();
    return records.some(r => r.Resi.toLowerCase() === resi.trim().toLowerCase());
  }

  // Set offline mode preference
  public getOfflinePreference(): boolean {
    return localStorage.getItem(OFFLINE_MODE_KEY) === "true";
  }

  public setOfflinePreference(val: boolean) {
    localStorage.setItem(OFFLINE_MODE_KEY, String(val));
  }

  /**
   * Save a newly scanned barcode record
   */
  public addRecord(data: {
    resi: string;
    outlet: string;
    seller: string;
    operator: string;
    photoURL?: string;
  }): { success: boolean; record?: ScanRecord; error?: string } {
    const resi = data.resi.trim().toUpperCase();
    if (!resi) return { success: false, error: "Tracking number empty" };

    // Anti-duplicate protection
    if (this.isDuplicate(resi)) {
      return { success: false, error: "RESI DUPLIKAT" };
    }

    const records = this.getRecords();
    
    // Auto generate date & time based on local timezone
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const tanggal = `${YYYY}-${MM}-${DD}`;
    const jam = `${hh}:${mm}:${ss}`;

    // Compute photo URL or fallback dummy generator
    const photo = data.photoURL || createMockResiPhoto(resi, data.seller);
    
    // Determine sync state depending on active network/offline setting
    const isOffline = this.getOfflinePreference();
    const syncStatus = isOffline ? "PENDING" : "SYNCED";

    const newRecord: ScanRecord = {
      ID: String(records.length + 5001),
      Tanggal: tanggal,
      Jam: jam,
      Resi: resi,
      Outlet: data.outlet,
      Seller: data.seller,
      Operator: data.operator,
      Status: "SCANNED",
      PhotoURL: photo,
      SyncStatus: syncStatus,
      ScanTimestamp: now.getTime()
    };

    records.unshift(newRecord);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));

    return { success: true, record: newRecord };
  }

  /**
   * Updates package status (e.g. from SCANNED to CANCELLED)
   */
  public updateRecordStatus(resi: string, status: "SCANNED" | "CANCELLED"): boolean {
    const records = this.getRecords();
    const index = records.findIndex(r => r.Resi === resi);
    if (index === -1) return false;

    records[index].Status = status;
    // When changed, trigger marked as pending check if offline
    if (this.getOfflinePreference()) {
      records[index].SyncStatus = "PENDING";
    }
    
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  }

  /**
   * Batch Upload / Sync simulation
   */
  public syncPendingRecords(): Promise<{ successCount: number; failedCount: number }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const records = this.getRecords();
        let successCount = 0;
        
        const updated = records.map(r => {
          if (r.SyncStatus === "PENDING") {
            successCount++;
            return { ...r, SyncStatus: "SYNCED" as const };
          }
          return r;
        });

        localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
        resolve({ successCount, failedCount: 0 });
      }, 1500); // realistic network sync delay
    });
  }

  /**
   * Clear active log database (for setup & testing)
   */
  public resetDatabase() {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(SELLER_KEY);
  }

  /**
   * Return Google Apps Script Code
   */
  public getAppsScriptCode(): string {
    const config = this.getCloudConfig();
    const spreadsheetId = config.spreadsheetId || "MASUKKAN_SPREADSHEET_ID_ANDA";
    const fotoFolderId = config.fotoFolderId || "FOTO_FOLDER_ID_GOOGLE_DRIVE_ANDA";

    return `/**
 * Google Apps Script API endpoint untuk J&T Pickup Ecommerce Scanner
 * Pasang script ini di Google Apps Script yang terhubung ke:
 * 1. Spreadsheet "Pickup Ecommerce Scanner J&T"
 * 2. Folder Google Drive bernama "FOTO RESI"
 *
 * Di-generate otomatis oleh dashboard J&T Tangerang Barat.
 */

const SPREADSHEET_ID = "${spreadsheetId}";
const FOTO_FOLDER_ID = "${fotoFolderId}";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "sync_batch") {
      return handleSyncBatch(payload.records);
    } else if (action === "add_seller") {
      return handleAddSeller(payload.sellerName);
    } else if (action === "add_operator") {
      return handleAddOperator(payload.operatorName);
    } else if (action === "get_masters") {
      return handleGetMasters();
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
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    
    // ROUTING TEPAT BERDASARKAN OUTLET PENJEMPUTAN
    let sheetName = "Data Resi J&T Pasir Jaha Balaraja"; 
    if (r.Outlet && r.Outlet.indexOf("Jayanti") !== -1) {
      sheetName = "Data Resi J&T Jayanti";
    }
    
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    // Set headers jika kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#f1f5f9");
    }
    
    const existingResis = getExistingResiList(sheet);
    
    // Update status jika resi sudah ada (proteksi duplikat & memproses pembatalan)
    if (existingResis.indexOf(r.Resi) !== -1) {
      updateRowStatus(sheet, r.Resi, r.Status);
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
    
    sheet.appendRow([
      r.ID,
      r.Tanggal,
      r.Jam,
      r.Resi,
      r.Outlet,
      r.Seller,
      r.Operator,
      r.Status,
      finalPhotoUrl
    ]);
    newlyScanned++;
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, added: newlyScanned }))
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
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Seller ditambahkan ke sheet" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Seller sudah ada di sheet" }))
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
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Operator ditambahkan ke sheet" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Operator sudah ada di sheet" }))
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
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, sellers: sellers, operators: operators }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getExistingResiList(sheet) {
  if (sheet.getLastRow() <= 1) return [];
  const range = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1);
  return range.getValues().map(row => row[0].toString());
}

function updateRowStatus(sheet, resi, status) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString() === resi) {
      sheet.getRange(i + 2, 8).setValue(status); // Kolom 8 adalah 'Status'
      break;
    }
  }
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
    // Mengabaikan error jika dijalankan di luar konteks UI Spreadsheet
  }
}

// Fungsi utama untuk inisialisasi sheet & header otomatis di awal setup
function setupSheetHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const setupTargets = [
    { 
      name: "Data Resi J&T Pasir Jaha Balaraja", 
      headers: ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"] 
    },
    { 
      name: "Data Resi J&T Jayanti", 
      headers: ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"] 
    },
    { 
      name: "Seller List", 
      headers: ["Nama Seller"] 
    },
    { 
      name: "Data Operator", 
      headers: ["Nama Operator"] 
    }
  ];
  
  let resultMsg = "Hasil Inisialisasi Sheet:\\n";
  
  for (let i = 0; i < setupTargets.length; i++) {
    const target = setupTargets[i];
    let sheet = ss.getSheetByName(target.name);
    
    if (!sheet) {
      sheet = ss.insertSheet(target.name);
    }
    
    // PEMBUATAN HEADER OTOMATIS HANYA BERLAKU DI AWAL SETUP (jika baris masih kosong/getLastRow === 0)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(target.headers);
      sheet.getRange(1, 1, 1, target.headers.length).setFontWeight("bold").setBackground("#f1f5f9");
      resultMsg += "✓ " + target.name + " (Berhasil di-setup dengan Header)\\n";
    } else {
      resultMsg += "• " + target.name + " (Sudah berisi data - Dilewati)\\n";
    }
  }
  
  try {
    SpreadsheetApp.getUi().alert("Inisialisasi Selesai!\\n\\n" + resultMsg + "\\nLangkah ini aman dijalankan dan hanya menulis header bila sheet masih kosong.");
  } catch (e) {
    Logger.log("Setup Selesai: " + resultMsg);
  }
  
  return { success: true, message: resultMsg };
}
\`;
  }`;
  }
}

export const dbService = new DatabaseService();
