const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

code = code.replace(
  /public getSellers\(\): Seller\[\] {[\s\S]*?return JSON\.parse\(raw\);\s*}/,
  ``
);

code = code.replace(
  /public addSeller\(name: string\): boolean {[\s\S]*?return true;\s*}/,
  ``
);

code = code.replace(
  /public deleteSeller\(name: string\): void {[\s\S]*?Config\.set\(CONFIG_KEYS\.SELLERS, JSON\.stringify\(filtered\)\);\s*}/,
  ``
);

fs.writeFileSync('src/utils/db.ts', code);
