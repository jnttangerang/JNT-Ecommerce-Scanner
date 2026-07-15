const fs = require('fs');
let code = fs.readFileSync('src/components/ScannerScreen.tsx', 'utf8');

// Replace:
// const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES) || "JX, JZ";
// const validPrefixes = validPrefixesStr.split(/[\s,;]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
// const defaultPrefix = validPrefixes.length > 0 ? validPrefixes[0] : "JX";

code = code.replace(
  /const validPrefixesStr = Config\.get\(CONFIG_KEYS\.RESI_PREFIXES\) \|\| "JX, JZ";\s*const validPrefixes = validPrefixesStr\.split\(\/[\\s,;]\+\/\)\.map\(p => p\.trim\(\)\.toUpperCase\(\)\)\.filter\(Boolean\);\s*const defaultPrefix = validPrefixes\.length > 0 \? validPrefixes\[0\] : "JX";/g,
  `const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES);\n    const validPrefixes = validPrefixesStr ? validPrefixesStr.split(/[\\s,;]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : [];\n    const defaultPrefix = validPrefixes.length > 0 ? validPrefixes[0] : "JX";`
);

// Second place (the actual validation):
// const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES) || "JX, JZ";
// const validPrefixes = validPrefixesStr.split(/[\s,;]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
// const prefixRegexPart = validPrefixes.length > 0 ? `(${validPrefixes.join("|")})` : "(JX|JZ)";
// const regex = new RegExp(`^${prefixRegexPart}\\d{10,12}$`);

code = code.replace(
  /const validPrefixesStr = Config\.get\(CONFIG_KEYS\.RESI_PREFIXES\) \|\| "JX, JZ";\s*const validPrefixes = validPrefixesStr\.split\(\/[\\s,;]\+\/\)\.map\(p => p\.trim\(\)\.toUpperCase\(\)\)\.filter\(Boolean\);\s*const prefixRegexPart = validPrefixes\.length > 0 \? `\(\\\$\{validPrefixes\.join\("\|"\)\}\)` : "\(JX\|JZ\)";/g,
  `const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES);\n    const validPrefixes = validPrefixesStr ? validPrefixesStr.split(/[\\s,;]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : [];\n    const prefixRegexPart = validPrefixes.length > 0 ? \`(\${validPrefixes.join("|")})\` : "";`
);

fs.writeFileSync('src/components/ScannerScreen.tsx', code);
