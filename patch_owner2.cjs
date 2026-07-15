const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');

code = `import { SellerService } from '../utils/sellerService';\n` + code;

code = code.replace(
  /setSellers\(dbService\.getSellers\(\)\);/g,
  `setSellers(SellerService.getAll());`
);

code = code.replace(
  /const success = dbService\.addSeller\(name\);/g,
  `let success = true; try { SellerService.create({ kodeSeller: "KS-" + Date.now(), nama: name, statusAktif: "ACTIVE" }); } catch(e) { success = false; }`
);

code = code.replace(
  /dbService\.deleteSeller\(name\);/g,
  `const target = sellers.find(s => s.nama === name); if(target) SellerService.delete(target.id);`
);

code = code.replace(
  /s\.NamaSeller/g,
  `s.nama`
);

// Remove the old sync fetching in pullDatabaseFromCloud
// actually pullDatabaseFromCloud calls dbService.pullMasters, which is where it fetches masters... we should remove sellers from dbService.pullMasters

fs.writeFileSync('src/components/OwnerScreen.tsx', code);
