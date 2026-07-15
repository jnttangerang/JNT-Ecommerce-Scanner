const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

// Replace the old Seller
code = code.replace(
  /export interface Seller {\s+NamaSeller: string;\s+}/,
  ``
);

fs.writeFileSync('src/types.ts', code);
