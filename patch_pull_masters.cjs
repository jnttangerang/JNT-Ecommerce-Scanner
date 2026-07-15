const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

code = code.replace(
  /const fetchedSellers = \(data\.sellers \|\| \[\]\)\.map\(\(name: string\) => \(\{\ NamaSeller: name\.trim\(\) \}\)\)\.filter\(\(x: any\) => x\.NamaSeller\);/,
  ``
);

code = code.replace(
  /Config\.set\(CONFIG_KEYS\.SELLERS, JSON\.stringify\(fetchedSellers\)\);/,
  ``
);

fs.writeFileSync('src/utils/db.ts', code);
