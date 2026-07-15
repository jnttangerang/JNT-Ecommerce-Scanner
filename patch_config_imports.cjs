const fs = require('fs');
let code = fs.readFileSync('src/utils/config.ts', 'utf8');

code = code.replace(/import { db } from '\.\/db';/g, '');

fs.writeFileSync('src/utils/config.ts', code);
