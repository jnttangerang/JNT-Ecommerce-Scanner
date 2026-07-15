const fs = require('fs');
let code = fs.readFileSync('Kode.gs', 'utf8');

const masterSellerFunctions = `
function handleGetMasterSeller() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("MASTER_SELLER");
  if (!sheet) {
    sheet = ss.insertSheet("MASTER_SELLER");
    sheet.appendRow(["ID", "Kode Seller", "Nama", "Kategori Produk", "No. HP Admin Seller", "Alamat", "Titik GPS", "Status Aktif", "Jumlah Paket Harian", "Catatan", "updatedAt"]);
  }
  const lastRow = sheet.getLastRow();
  let values = [];
  if (lastRow > 1) {
    values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true, values: values }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSaveMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("MASTER_SELLER");
  if (!sheet) {
    sheet = ss.insertSheet("MASTER_SELLER");
    sheet.appendRow(["ID", "Kode Seller", "Nama", "Kategori Produk", "No. HP Admin Seller", "Alamat", "Titik GPS", "Status Aktif", "Jumlah Paket Harian", "Catatan", "updatedAt"]);
  }
  
  const seller = payload.seller;
  const now = new Date().toISOString();
  
  // Check if kode seller already exists
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // [ID, Kode Seller]
    for (let i = 0; i < data.length; i++) {
      if (data[i][1] === seller.kodeSeller) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Kode Seller already exists" })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  sheet.appendRow([
    seller.id,
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
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateMasterSeller(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("MASTER_SELLER");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);

  const seller = payload.seller;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === seller.id) {
        const row = i + 2;
        // Check for duplicate kodeSeller
        if (seller.kodeSeller) {
           const allKodes = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
           for (let j = 0; j < allKodes.length; j++) {
               if (j !== i && allKodes[j][0] === seller.kodeSeller) {
                   return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Kode Seller already exists" })).setMimeType(ContentService.MimeType.JSON);
               }
           }
        }
        
        const now = new Date().toISOString();
        sheet.getRange(row, 2, 1, 10).setValues([[
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
        ]]);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Seller not found" })).setMimeType(ContentService.MimeType.JSON);
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
`;

code = code.replace(
  /if \(action === "get_data_master"\) \{/,
  `if (action === "get_master_seller") {
      return handleGetMasterSeller();
    } else if (action === "get_data_master") {`
);

code = code.replace(
  /if \(action === "save_data_master"\) \{/,
  `if (action === "save_master_seller") {
      return handleSaveMasterSeller(payload);
    } else if (action === "update_master_seller") {
      return handleUpdateMasterSeller(payload);
    } else if (action === "delete_master_seller") {
      return handleDeleteMasterSeller(payload);
    } else if (action === "save_data_master") {`
);

code += '\n' + masterSellerFunctions;
fs.writeFileSync('Kode.gs', code);
