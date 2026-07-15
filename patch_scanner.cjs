const fs = require('fs');
let code = fs.readFileSync('src/components/ScannerScreen.tsx', 'utf8');

code = `import { Config, CONFIG_KEYS } from '../utils/config';\n` + code;

code = code.replace(/localStorage\.getItem\("jt_resi_prefixes"\)/g, 'Config.get(CONFIG_KEYS.RESI_PREFIXES)');
code = code.replace(/localStorage\.getItem\('jt_resi_prefixes'\)/g, 'Config.get(CONFIG_KEYS.RESI_PREFIXES)');

code = code.replace(/localStorage\.removeItem\("jt_saved_operator"\)/g, 'Config.set(CONFIG_KEYS.SAVED_OPERATOR, "")');
code = code.replace(/localStorage\.setItem\("jt_current_view", "WELCOME"\)/g, 'Config.set(CONFIG_KEYS.CURRENT_VIEW, "WELCOME")');

fs.writeFileSync('src/components/ScannerScreen.tsx', code);
