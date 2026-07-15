const fs = require('fs');
let code = fs.readFileSync('Kode.gs', 'utf8');

const batchSyncCode = `
function handleSyncMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("MASTER_SELLER");
  if (!sheet) {
    sheet = ss.insertSheet("MASTER_SELLER");
    sheet.appendRow(["ID", "Kode Seller", "Nama", "Kategori Produk", "No. HP Admin Seller", "Alamat", "Titik GPS", "Status Aktif", "Jumlah Paket Harian", "Catatan", "updatedAt"]);
  }
  
  const sellers = payload.sellers || [];
  if (sellers.length === 0) return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  
  const lastRow = sheet.getLastRow();
  let existingData = [];
  if (lastRow > 1) {
    existingData = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // [ID, Kode Seller]
  }
  
  const idToRow = {};
  const kodeSet = {};
  for (let i = 0; i < existingData.length; i++) {
    if (existingData[i][0]) idToRow[existingData[i][0]] = i + 2;
    if (existingData[i][1]) kodeSet[existingData[i][1]] = existingData[i][0];
  }
  
  const updates = []; // { range, values }
  const appends = [];
  const now = new Date().toISOString();
  const errors = [];
  
  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i];
    const rowIdx = idToRow[seller.id];
    
    // Check kode conflict
    if (kodeSet[seller.kodeSeller] && kodeSet[seller.kodeSeller] !== seller.id) {
       errors.push("Kode Seller " + seller.kodeSeller + " already exists.");
       continue;
    }
    
    const rowData = [
       seller.kodeSeller,
       seller.nama,
       seller.kategoriProduk || "",
       seller.noHp || "",
       seller.alamat || "",
       seller.gps || "",
       seller.statusAktif || "ACTIVE",
       seller.targetHarian || 0,
       seller.catatan || "",
       now
    ];
    
    if (rowIdx) {
       // Update
       sheet.getRange(rowIdx, 2, 1, 10).setValues([rowData]);
    } else {
       // Append
       appends.push([seller.id, ...rowData]);
    }
  }
  
  if (appends.length > 0) {
     sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, 11).setValues(appends);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: errors.length === 0, errors: errors }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

code = code.replace(
  /if \(action === "save_master_seller"\) \{/,
  `if (action === "sync_master_seller") {
      return handleSyncMasterSeller(payload);
    } else if (action === "save_master_seller") {`
);

code += '\n' + batchSyncCode;
fs.writeFileSync('Kode.gs', code);
