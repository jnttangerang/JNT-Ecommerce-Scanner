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
function selfCheckSellerRow_() {
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