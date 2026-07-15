const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

// We can just stub getSellers() and addSeller() etc if they are still there
// But they shouldn't be used now.
// I will just let them be, except remove them from pullMasters.

code = code.replace(
  /results\.sellers = await getSheetData\(lists\[0\]\.name, lists\[0\]\.alt\);/,
  `results.sellers = []; // Handled by SellerService`
);

code = code.replace(
  /const fetchedSellers = data\.sellers\.map\(\(s: any\) => \(\{ NamaSeller: s \}\)\);/,
  `const fetchedSellers: any[] = [];`
);

fs.writeFileSync('src/utils/db.ts', code);
