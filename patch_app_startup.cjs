const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = `import { SellerService } from './utils/sellerService';\n` + code;

code = code.replace(
  /await Config\.sync\(\); \/\/ Also sync DATA_MASTER/,
  `await Config.sync(); // Also sync DATA_MASTER\n          await SellerService.sync(); // Load Seller Master`
);

code = code.replace(
  /const handleOnline = \(\) => \{[\s\S]*?Config\.sync\(\);/,
  `const handleOnline = () => {\n      setIsOffline(false);\n      Config.sync();\n      SellerService.sync();`
);

code = code.replace(
  /if \(window\.navigator\.onLine\) Config\.sync\(\);/,
  `if (window.navigator.onLine) {\n      Config.sync();\n      SellerService.sync();\n    }`
);

fs.writeFileSync('src/App.tsx', code);
