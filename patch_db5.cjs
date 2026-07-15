const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

code = code.replace(
  /public deleteSeller\(name: string\): boolean {[\s\S]*?return true;\s*}/,
  ``
);

code = code.replace(
  /const DEFAULT_SELLERS[\s\S]*?];/,
  ``
);

fs.writeFileSync('src/utils/db.ts', code);
