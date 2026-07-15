const fs = require('fs');
let code = fs.readFileSync('src/utils/config.ts', 'utf8');

code = code.replace(
  /\[CONFIG_KEYS\.OUTLETS\]: '\["J&T Pasir Jaha Balaraja", "J&T Jayanti", "J&T Cikupa Mas"\]',/,
  `[CONFIG_KEYS.OUTLETS]: '[{"NamaOutlet":"J&T Pasir Jaha Balaraja"},{"NamaOutlet":"J&T Jayanti"},{"NamaOutlet":"J&T Cikupa Mas"}]',`
);

code = code.replace(
  /\[CONFIG_KEYS\.OPERATORS\]: '\["FITRI FAJRIA", "M\. HARI YANTO", "M\. DANANG"\]',/,
  `[CONFIG_KEYS.OPERATORS]: '[{"NamaOperator":"FITRI FAJRIA"},{"NamaOperator":"M. HARI YANTO"},{"NamaOperator":"M. DANANG"}]',`
);

fs.writeFileSync('src/utils/config.ts', code);
