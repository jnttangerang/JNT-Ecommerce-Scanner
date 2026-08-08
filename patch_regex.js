const fs = require('fs');
const file = 'src/components/ScannerScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const prefixRegexPart = validPrefixes\.length > 0 \? `\(\$\{validPrefixes\.join\("|"\)\}\)` : "";/,
  'const prefixRegexPart = validPrefixes.length > 0 ? `(?:${validPrefixes.join("|")})?` : "";'
);

content = content.replace(
  /const regex = new RegExp\(`\^\\$\\{prefixRegexPart\\}\\\\d\\{10,15\\}\\$`\);/,
  'const regex = new RegExp(`^${prefixRegexPart}\\\\d{10,12}$`);'
);

fs.writeFileSync(file, content);
console.log("Patched regex.");
