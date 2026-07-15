const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'src/components/ScannerScreen.tsx');
let content = fs.readFileSync(p, 'utf8');

// Undo the mess
content = content.replace(/    \/\/ === RUNTIME AUDIT INSTRUMENTATION ===[\s\S]*?\/\/ ======================================/g, '    const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES);');

// Add to handleBarcodeScanned
const target = `  const handleBarcodeScanned = (scannedResi: string) => {
    if (isScanningLocked.current) return;

    const rawCode = scannedResi.trim().toUpperCase();
    if (!rawCode) return;

    const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES);`;

const replacement = `  const handleBarcodeScanned = (scannedResi: string) => {
    if (isScanningLocked.current) return;

    const rawCode = scannedResi.trim().toUpperCase();
    if (!rawCode) return;

    const validPrefixesStr = Config.get(CONFIG_KEYS.RESI_PREFIXES);
    console.log("=== RUNTIME AUDIT: SCANNER ===");
    console.log("1. Config.get returned:", validPrefixesStr);
    const tmpValidPrefixes = validPrefixesStr ? validPrefixesStr.split(/[\\s,;]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : [];
    console.log("2. Parsed validPrefixes:", tmpValidPrefixes);
    const tmpRegexPart = tmpValidPrefixes.length > 0 ? \`(\${tmpValidPrefixes.join("|")})\` : "";
    const tmpRegex = new RegExp(\`^\${tmpRegexPart}\\\\d{10,12}$\`);
    console.log("3. regex:", tmpRegex);
    console.log("4. test result:", tmpRegex.test(rawCode));
    // ======================================`;

content = content.replace(target, replacement);
fs.writeFileSync(p, content, 'utf8');
console.log("Patched!");
