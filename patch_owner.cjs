const fs = require('fs');
let code = fs.readFileSync('src/components/OwnerScreen.tsx', 'utf8');

code = `import { Config, CONFIG_KEYS } from '../utils/config';\n` + code;

code = code.replace(/localStorage\.getItem\("jt_owner_authenticated"\)/g, 'Config.get(CONFIG_KEYS.OWNER_AUTHENTICATED)');
code = code.replace(/localStorage\.setItem\("jt_owner_authenticated", (.*?)\)/g, 'Config.set(CONFIG_KEYS.OWNER_AUTHENTICATED, $1)');
code = code.replace(/localStorage\.removeItem\("jt_owner_authenticated"\)/g, 'Config.set(CONFIG_KEYS.OWNER_AUTHENTICATED, "false")');

code = code.replace(/localStorage\.getItem\("jt_review_completed_date"\)/g, 'Config.get(CONFIG_KEYS.REVIEW_COMPLETED_DATE)');
code = code.replace(/localStorage\.setItem\("jt_review_completed_date", (.*?)\)/g, 'Config.set(CONFIG_KEYS.REVIEW_COMPLETED_DATE, $1)');

code = code.replace(/localStorage\.getItem\("jt_completed_review_records"\)/g, 'Config.get(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS)');
code = code.replace(/localStorage\.setItem\("jt_completed_review_records", (.*?)\)/g, 'Config.set(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS, $1)');
code = code.replace(/localStorage\.removeItem\("jt_completed_review_records"\)/g, 'Config.set(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS, "[]")');

code = code.replace(/localStorage\.getItem\("jt_resi_prefixes"\)/g, 'Config.get(CONFIG_KEYS.RESI_PREFIXES)');
code = code.replace(/localStorage\.setItem\("jt_resi_prefixes", (.*?)\)/g, 'Config.set(CONFIG_KEYS.RESI_PREFIXES, $1)');

code = code.replace(/localStorage\.getItem\("jt_owner_password"\)/g, 'Config.get(CONFIG_KEYS.OWNER_PASSWORD)');
code = code.replace(/localStorage\.setItem\("jt_owner_password", (.*?)\)/g, 'Config.set(CONFIG_KEYS.OWNER_PASSWORD, $1)');

code = code.replace(/localStorage\.setItem\("jt_pickup_operators", JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.OPERATORS, JSON.stringify($1))');
code = code.replace(/localStorage\.setItem\("jt_pickup_sellers", JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.SELLERS, JSON.stringify($1))');
code = code.replace(/localStorage\.setItem\("jt_pickup_outlets", JSON\.stringify\((.*?)\)\)/g, 'Config.set(CONFIG_KEYS.OUTLETS, JSON.stringify($1))');

fs.writeFileSync('src/components/OwnerScreen.tsx', code);
