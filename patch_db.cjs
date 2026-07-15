const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

code = code.replace(/const SELLER_KEY = "jt_pickup_sellers";/g, '');
code = code.replace(/const OUTLET_KEY = "jt_pickup_outlets";/g, '');
code = code.replace(/const OPERATOR_KEY = "jt_pickup_operators";/g, '');
code = code.replace(/const OFFLINE_MODE_KEY = "jt_pickup_offline_mode";/g, '');
code = code.replace(/const CLOUD_CONFIG_KEY = "jt_pickup_cloud_config";/g, '');
code = code.replace(/const DAILY_TARGET_KEY = "jt_pickup_daily_target";/g, '');

code = `import { Config, CONFIG_KEYS } from './config';\n` + code;

code = code.replace(/localStorage\.getItem\(OUTLET_KEY\)/g, 'Config.get(CONFIG_KEYS.OUTLETS)');
code = code.replace(/localStorage\.setItem\(OUTLET_KEY, JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.OUTLETS, JSON.stringify($1))');

code = code.replace(/localStorage\.getItem\(OPERATOR_KEY\)/g, 'Config.get(CONFIG_KEYS.OPERATORS)');
code = code.replace(/localStorage\.setItem\(OPERATOR_KEY, JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.OPERATORS, JSON.stringify($1))');

code = code.replace(/localStorage\.getItem\(SELLER_KEY\)/g, 'Config.get(CONFIG_KEYS.SELLERS)');
code = code.replace(/localStorage\.setItem\(SELLER_KEY, JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.SELLERS, JSON.stringify($1))');

code = code.replace(/localStorage\.getItem\(CLOUD_CONFIG_KEY\)/g, "JSON.stringify({spreadsheetId: Config.get(CONFIG_KEYS.GOOGLE_SHEET_ID), fotoFolderId: Config.get(CONFIG_KEYS.GOOGLE_DRIVE_FOLDER), appsScriptUrl: ''})");
code = code.replace(/localStorage\.setItem\(CLOUD_CONFIG_KEY, JSON\.stringify\((.*?)\)\)/g, "Config.set(CONFIG_KEYS.GOOGLE_SHEET_ID, $1.spreadsheetId); Config.set(CONFIG_KEYS.GOOGLE_DRIVE_FOLDER, $1.fotoFolderId)");

code = code.replace(/localStorage\.getItem\(OFFLINE_MODE_KEY\)/g, 'Config.get(CONFIG_KEYS.OFFLINE_MODE)');
code = code.replace(/localStorage\.setItem\(OFFLINE_MODE_KEY, String\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.OFFLINE_MODE, String($1))');

code = code.replace(/localStorage\.getItem\(DAILY_TARGET_KEY\)/g, 'Config.get(CONFIG_KEYS.DAILY_TARGET)');
code = code.replace(/localStorage\.setItem\(DAILY_TARGET_KEY, String\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.DAILY_TARGET, String($1))');

fs.writeFileSync('src/utils/db.ts', code);
