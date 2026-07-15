const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');

code = code.replace(
  /sellers: sellers\.map\(s => s\.nama\),/,
  `sellers: [], // Handled by SellerService`
);

fs.writeFileSync('src/components/OwnerScreen.tsx', code);
