const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');

code = code.replace(
  /const fetchedSellers = \(data\.sellers \|\| \[\]\)\.map\(\(name: string\) => \(\{ NamaSeller: name\.trim\(\) \}\)\)\.filter\(\(x: any\) => x\.NamaSeller\);/g,
  `const fetchedSellers: any[] = [];`
);

code = code.replace(
  /Config\.set\(CONFIG_KEYS\.SELLERS, JSON\.stringify\(fetchedSellers\)\);/g,
  ``
);

code = code.replace(
  /setSellers\(fetchedSellers\);/g,
  `setSellers(SellerService.getAll());`
);

code = code.replace(
  /\$\{fetchedSellers\.length\} Seller,/g,
  `Seller Master tersinkron secara terpisah,`
);

fs.writeFileSync('src/components/OwnerScreen.tsx', code);
