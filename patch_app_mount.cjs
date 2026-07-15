const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  useEffect(() => {
    // Determine initial offline status based on network
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);`;

const replacement = `  useEffect(() => {
    // Determine initial offline status based on network
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
      
      // Init config sync
      if (window.navigator.onLine && dbService.getCloudConfig().spreadsheetId) {
        // Will sync data master asynchronously
        Config.sync();
      }
      
      const handleOnline = () => {
        setIsOffline(false);
        if (dbService.getCloudConfig().spreadsheetId) Config.sync();
      };
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", () => setIsOffline(true));
`;

code = code.replace(target, replacement);

// And we should clean up the old online/offline listeners further down:
// In the original code, there were probably listeners like:
// window.addEventListener("online", () => setIsOffline(false));
// window.addEventListener("offline", () => setIsOffline(true));

code = code.replace(/window\.addEventListener\("online", \(\) => setIsOffline\(false\)\);/g, '');
code = code.replace(/window\.addEventListener\("offline", \(\) => setIsOffline\(true\)\);/g, '');

fs.writeFileSync('src/App.tsx', code);
