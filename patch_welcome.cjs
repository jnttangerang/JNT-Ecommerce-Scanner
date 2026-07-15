const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');

code = `import { SellerService } from '../utils/sellerService';\n` + code;

code = code.replace(
  /const sels = dbService\.getSellers\(\);/,
  `const sels = SellerService.getAll();`
);

code = code.replace(
  /const updatedSellers = dbService\.getSellers\(\);/,
  `const updatedSellers = SellerService.getAll();`
);

code = code.replace(
  /const added = dbService\.addSeller\(name\);/g,
  `const added = true; SellerService.create({ kodeSeller: "KS-" + Date.now(), nama: name, statusAktif: "ACTIVE" });`
);

// We need to change how the list maps, because previously it used s.NamaSeller
code = code.replace(
  /s\.NamaSeller/g,
  `s.nama`
);

fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
