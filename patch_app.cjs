const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = `import { Config, CONFIG_KEYS } from './utils/config';\n` + code;

code = code.replace(/localStorage\.getItem\("jt_current_view"\)/g, 'Config.get(CONFIG_KEYS.CURRENT_VIEW)');
code = code.replace(/localStorage\.setItem\("jt_current_view", (.*?)\)/g, 'Config.set(CONFIG_KEYS.CURRENT_VIEW, String($1))');

code = code.replace(/localStorage\.getItem\("jt_saved_outlet"\)/g, 'Config.get(CONFIG_KEYS.SAVED_OUTLET)');
code = code.replace(/localStorage\.setItem\("jt_saved_outlet", (.*?)\)/g, 'Config.set(CONFIG_KEYS.SAVED_OUTLET, $1)');

code = code.replace(/localStorage\.getItem\("jt_saved_seller"\)/g, 'Config.get(CONFIG_KEYS.SAVED_SELLER)');
code = code.replace(/localStorage\.setItem\("jt_saved_seller", (.*?)\)/g, 'Config.set(CONFIG_KEYS.SAVED_SELLER, $1)');

code = code.replace(/localStorage\.getItem\("jt_saved_operator"\)/g, 'Config.get(CONFIG_KEYS.SAVED_OPERATOR)');
code = code.replace(/localStorage\.setItem\("jt_saved_operator", (.*?)\)/g, 'Config.set(CONFIG_KEYS.SAVED_OPERATOR, $1)');

code = code.replace(/localStorage\.getItem\("jt_owner_authenticated"\)/g, 'Config.get(CONFIG_KEYS.OWNER_AUTHENTICATED)');
code = code.replace(/localStorage\.setItem\("jt_owner_authenticated", (.*?)\)/g, 'Config.set(CONFIG_KEYS.OWNER_AUTHENTICATED, String($1))');

code = code.replace(/localStorage\.getItem\("jt_is_cloud_data_fresh"\)/g, 'Config.get(CONFIG_KEYS.IS_CLOUD_DATA_FRESH)');
code = code.replace(/localStorage\.setItem\("jt_is_cloud_data_fresh", (.*?)\)/g, 'Config.set(CONFIG_KEYS.IS_CLOUD_DATA_FRESH, String($1))');

// For "Hapus Cache & Restart" - remove the manual backup lines
code = code.replace(/const prefixes = localStorage\.getItem\("jt_resi_prefixes"\);[\s\S]*?if \(offlineMode\) localStorage\.setItem\("jt_pickup_offline_mode", offlineMode\);/m, 'Config.clearSessionCache(); Config.saveCache();');

fs.writeFileSync('src/App.tsx', code);
