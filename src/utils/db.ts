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
  faviconUrl?: string;
}

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  coreFolderUrl: "https://drive.google.com/drive/folders/1Q1Ch2LDxr30cHbyd-xFueIqAnLHANPPY",
  fotoFolderId: "https://drive.google.com/drive/folders/19peJr4JWqKA6Ei4AwuXgohhF2C59ugyp",
  spreadsheetId: "12ly2pM3Vof9IKTwjselkLUX6sMdcdI6rcb_KvbjcQ_Y",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxO2II_Tg_8wBnGJBZTjWGz1sDfqNXdU06o1xNkPmRE6wdvSlDfGmLfb81cTb3_NWWm/exec",
  faviconUrl: "https://jet.co.id/static/favicon.ico"
};

// Default Master Data
const DEFAULT_OUTLETS: Outlet[] = [
  { NamaOutlet: "J&T Pasir Jaha Balaraja" },
  { NamaOutlet: "J&T Jayanti" }
];

const DEFAULT_OPERATORS: Operator[] = [
  { NamaOperator: "FITRI FAJRIA" },
  { NamaOperator: "M. HARI YANTO" },
  { NamaOperator: "M. DANANG" }
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
    ctx.fillText("LAYANAN: EZ", 135, 32);
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
    ctx.fillText("PENERIMA: BUDI (JAKARTA))", 20, 98);
    
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

/**
 * Converts a Google Drive share link into a direct web-embeddable viewable image URL.
 * Supports standard share links /file/d/FILE_ID/view and query param format id=FILE_ID
 */
export function getDirectDriveImageUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("data:image")) {
    return url;
  }
  
  // Extract file ID from google drive sharing url
  // Match standard '/file/d/FILE_ID/view...' or query param '?id=FILE_ID'
  const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const idRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
  
  let fileId = "";
  let match = url.match(driveRegex);
  if (match && match[1]) {
    fileId = match[1];
  } else {
    match = url.match(idRegex);
    if (match && match[1]) {
      fileId = match[1];
    }
  }
  
  if (fileId) {
    // lh3.googleusercontent.com/d/FILE_ID is ultra-fast, has CDN caching and bypassing standard drive redirect page
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
}

export class DatabaseService {
  private isSyncingInProgress = false;

  // Initialize lists
  public getOutlets(): Outlet[] {
    const raw = localStorage.getItem(OUTLET_KEY);
    if (!raw) {
      const config = this.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example");
      if (hasAppsScript) {
        return [];
      }
      localStorage.setItem(OUTLET_KEY, JSON.stringify(DEFAULT_OUTLETS));
      return DEFAULT_OUTLETS;
    }
    return JSON.parse(raw);
  }

  public addOutlet(name: string): boolean {
    const outlets = this.getOutlets();
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (outlets.some(o => o.NamaOutlet.toLowerCase() === cleanName.toLowerCase())) {
      return false;
    }
    outlets.push({ NamaOutlet: cleanName });
    localStorage.setItem(OUTLET_KEY, JSON.stringify(outlets));

    // Try background sync to Spreadsheet if available
    const config = this.getCloudConfig();
    if (config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example")) {
      fetch(config.appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "add_outlet", outletName: cleanName })
      }).catch(err => console.warn("Background cloud add_outlet error", err));
    }

    return true;
  }

  public deleteOutlet(name: string): boolean {
    const outlets = this.getOutlets();
    const filtered = outlets.filter(o => o.NamaOutlet.trim().toLowerCase() !== name.trim().toLowerCase());
    if (outlets.length === filtered.length) return false;
    localStorage.setItem(OUTLET_KEY, JSON.stringify(filtered));
    return true;
  }

  public getOperators(): Operator[] {
    const raw = localStorage.getItem(OPERATOR_KEY);
    if (!raw) {
      const config = this.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example");
      if (hasAppsScript) {
        return [];
      }
      localStorage.setItem(OPERATOR_KEY, JSON.stringify(DEFAULT_OPERATORS));
      return DEFAULT_OPERATORS;
    }
    return JSON.parse(raw);
  }

  public getSellers(): Seller[] {
    const raw = localStorage.getItem(SELLER_KEY);
    if (!raw) {
      const config = this.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example");
      if (hasAppsScript) {
        return [];
      }
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

    // Try background sync to Spreadsheet if available
    const config = this.getCloudConfig();
    if (config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example")) {
      fetch(config.appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "add_seller", sellerName: cleanName })
      }).catch(err => console.warn("Background cloud add_seller error", err));
    }

    return true;
  }

  public deleteSeller(name: string): boolean {
    const sellers = this.getSellers();
    const filtered = sellers.filter(s => s.NamaSeller.trim().toLowerCase() !== name.trim().toLowerCase());
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

    // Try background sync to Spreadsheet if available
    const config = this.getCloudConfig();
    if (config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example")) {
      fetch(config.appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "add_operator", operatorName: cleanName })
      }).catch(err => console.warn("Background cloud add_operator error", err));
    }

    return true;
  }

  public deleteOperator(name: string): boolean {
    const operators = this.getOperators();
    const filtered = operators.filter(o => o.NamaOperator.trim().toLowerCase() !== name.trim().toLowerCase());
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
      const config = this.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && !config.appsScriptUrl.includes("AKfycbz_Example");
      if (hasAppsScript) {
        localStorage.setItem(RECORDS_KEY, JSON.stringify([]));
        return [];
      }
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
    
    // Determine sync state - always start as PENDING so that the queue picks it up to upload to the server
    const syncStatus = "PENDING";

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
  }  /**
   * Batch Upload / Sync to Spreadsheet
   */
  public async syncPendingRecords(): Promise<{ successCount: number; failedCount: number; error?: string }> {
    if (this.isSyncingInProgress) {
      console.log("Sinkronisasi sedang berlangsung. Permintaan diabaikan untuk mencegah duplikat.");
      return { successCount: 0, failedCount: 0 };
    }

    this.isSyncingInProgress = true;

    try {
      const config = this.getCloudConfig();
      const records = this.getRecords();
      const pending = records.filter(r => r.SyncStatus === "PENDING");
      
      if (pending.length === 0) {
        return { successCount: 0, failedCount: 0 };
      }

      if (!config.appsScriptUrl || config.appsScriptUrl.includes("Example_Apps_Script_Web_App") || config.appsScriptUrl.includes("AKfycbz_Example")) {
        // Simulate/fallback sync locally if actual cloud API is not configured
        const updated = records.map(r => {
          if (r.SyncStatus === "PENDING") {
            return { ...r, SyncStatus: "SYNCED" as const };
          }
          return r;
        });
        localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
        return { successCount: pending.length, failedCount: 0 };
      }

      try {
        const response = await fetch(config.appsScriptUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            action: "sync_batch",
            records: pending
          })
        });
        
        const data = await response.json();
        if (data && data.success) {
          const pendingIds = new Set(pending.map(p => p.ID));
          const updated = records.map(r => {
            if (pendingIds.has(r.ID)) {
              return { ...r, SyncStatus: "SYNCED" as const };
            }
            return r;
          });
          localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
          return { successCount: pending.length, failedCount: 0 };
        } else {
          return { successCount: 0, failedCount: pending.length, error: data.error || "Tanggapan web app bernilai sukses false." };
        }
      } catch (err: any) {
        console.error("Gagal melakukan sinkronisasi cloud", err);
        return { successCount: 0, failedCount: pending.length, error: err.toString() };
      }
    } finally {
      this.isSyncingInProgress = false;
    }
  }

  /**
   * Pull Master Data (Outlets, Operators, Sellers) from Spreadsheet
   */
  public async pullMasters(): Promise<{ success: boolean; error?: string }> {
    const config = this.getCloudConfig();
    if (!config.appsScriptUrl || config.appsScriptUrl.includes("Example_Apps_Script_Web_App") || config.appsScriptUrl.includes("AKfycbz_Example")) {
      return { success: false, error: "Apps Script URL is not configured." };
    }

    try {
      let data: any = null;
      
      // Try GET first as it avoids CORS preflight issues on production deployments (like Vercel)
      try {
        const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_masters`;
        const response = await fetch(getUrl, {
          method: "GET",
          mode: "cors"
        });
        const resJson = await response.json();
        if (resJson && resJson.success) {
          data = resJson;
        }
      } catch (getErr) {
        console.warn("GET pullMasters failed, trying POST fallback", getErr);
      }

      if (!data) {
        // Fallback to original POST method if GET is not supported by the deployed Apps Script
        const response = await fetch(config.appsScriptUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({ action: "get_masters" })
        });
        data = await response.json();
      }

      if (data && data.success) {
        const fetchedSellers = (data.sellers || []).map((name: string) => ({ NamaSeller: name.trim() })).filter((x: any) => x.NamaSeller);
        const fetchedOperators = (data.operators || []).map((name: string) => ({ NamaOperator: name.trim() })).filter((x: any) => x.NamaOperator);
        const fetchedOutlets = (data.outlets || []).map((name: string) => ({ NamaOutlet: name.trim() })).filter((x: any) => x.NamaOutlet);

        localStorage.setItem(SELLER_KEY, JSON.stringify(fetchedSellers));
        localStorage.setItem(OPERATOR_KEY, JSON.stringify(fetchedOperators));
        localStorage.setItem(OUTLET_KEY, JSON.stringify(fetchedOutlets));
        return { success: true };
      }
      return { success: false, error: "Data masters kosong atau respons gagal." };
    } catch (err: any) {
      console.error("Gagal menarik data master", err);
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Pull Scanned Records from Spreadsheet
   */
  public async pullRecords(): Promise<{ success: boolean; error?: string }> {
    const config = this.getCloudConfig();
    if (!config.appsScriptUrl || config.appsScriptUrl.includes("Example_Apps_Script_Web_App") || config.appsScriptUrl.includes("AKfycbz_Example")) {
      return { success: false, error: "Apps Script URL is not configured." };
    }

    try {
      let data: any = null;

      // Try GET first as it avoids CORS preflight issues on production deployments (like Vercel)
      try {
        const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_records`;
        const response = await fetch(getUrl, {
          method: "GET",
          mode: "cors"
        });
        const resJson = await response.json();
        if (resJson && resJson.success) {
          data = resJson;
        }
      } catch (getErr) {
        console.warn("GET pullRecords failed, trying POST fallback", getErr);
      }

      if (!data) {
        // Fallback to original POST method if GET is not supported by the deployed Apps Script
        const response = await fetch(config.appsScriptUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({ action: "get_records" })
        });
        data = await response.json();
      }

      if (data && data.success) {
        localStorage.setItem(RECORDS_KEY, JSON.stringify(data.records || []));
        return { success: true };
      }
      return { success: false, error: "Gagal menarik data resi." };
    } catch (err: any) {
      console.error("Gagal menarik data resi", err);
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Clear active log database (for setup & testing)
   */
  public resetDatabase() {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([]));
  }

  /**
   * Clear all records to empty slate (without triggering mock data recreation)
   */
  public clearAllRecords() {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([]));
  }

  /**
   * Return Google Apps Script Code
   */
  public getAppsScriptCode(): string {
    const config = this.getCloudConfig();
    const spreadsheetId = config.spreadsheetId || "MASUKKAN_SPREADSHEET_ID_ANDA";
    const fotoFolderId = config.fotoFolderId || "FOTO_FOLDER_ID_GOOGLE_DRIVE_ANDA";

    return `/**
 * Google Apps Script API endpoint untuk J&T Pickup Ecommerce Scanner Pro
 * Pasang script ini di Google Apps Script yang terhubung ke:
 * 1. Spreadsheet "Pickup Ecommerce Scanner J&T"
 * 2. Folder Google Drive bernama "FOTO RESI"
 *
 * Di-generate otomatis oleh dashboard J&T Tangerang Barat.
 */

const SPREADSHEET_ID = "${spreadsheetId}";
const FOTO_FOLDER_ID = "${fotoFolderId}";

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "get_masters") {
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

    if (action === "sync_batch") {
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
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    
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
  
  // Update real-time summary dashboard sheet
  try {
    updateDashboardSheet(ss);
  } catch (dashErr) {
    Logger.log("Gagal memperbarui sheet dashboard: " + dashErr.toString());
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
      if (lastRow > 1) {
        const data = sheets[i].getRange(2, 1, lastRow - 1, 9).getValues();
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
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
      if (lastRow > 1) {
        const data = sheets[i].getRange(2, 1, lastRow - 1, 9).getValues();
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const outlet = row[4] ? row[4].toString().trim() : \"\";
          const seller = row[5] ? row[5].toString().trim() : \"\";
          const status = row[7] ? row[7].toString().trim() : \"\";
          
          if (outlet) outletCounts[outlet] = (outletCounts[outlet] || 0) + 1;
          if (seller) sellerCounts[seller] = (sellerCounts[seller] || 0) + 1;
          
          if (status === \"CANCELLED\") {
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
      headers: ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"] 
    },
    { 
      name: "Data Resi J&T Jayanti", 
      headers: ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"] 
    },
    { 
      name: "Data Resi J&T Cikupa Mas", 
      headers: ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"] 
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
      resultMsg += "• " + target.name + " (Sudah berisi data - Dilewati)\\n";
    }
  }
  
  // Setup Dashboard
  try {
    updateDashboardSheet(ss);
    resultMsg += "✓ Dashboard (Berhasil di-generate)\\n";
  } catch (dashE) {}

  try {
    SpreadsheetApp.getUi().alert("Inisialisasi Selesai!\\n\\n" + resultMsg + "\\nLangkah ini aman dijalankan dan hanya menulis header bila sheet masih kosong.");
  } catch (e) {
    Logger.log("Setup Selesai: " + resultMsg);
  }
  
  return { success: true, message: resultMsg };
}
`;
  }
}

export const dbService = new DatabaseService();
