const fs = require('fs');
let code = fs.readFileSync('src/utils/db.ts', 'utf8');

const defaultFields = `      PackageStatus: "NONE",
      WaybillStatus: "NONE",
      ReviewStatus: "NONE",
      RetakeStatus: "NONE",
      AlertStatus: "NONE",
      CancelStatus: "NONE",`;

// Mock record 1
code = code.replace(
  /      SyncStatus: "SYNCED",\n      ScanTimestamp: new Date/g,
  `      SyncStatus: "SYNCED",
${defaultFields}
      ScanTimestamp: new Date`
);

// addRecord
code = code.replace(
  /      SyncStatus: syncStatus,\n      ScanTimestamp: now\.getTime\(\)\n    \};/g,
  `      SyncStatus: syncStatus,
      ScanTimestamp: now.getTime(),
${defaultFields}
    };`
);

// directGetRecords fallback
code = code.replace(
  /      SyncStatus: "SYNCED"\n          \}\);/g,
  `      SyncStatus: "SYNCED",
${defaultFields}
          });`
);

fs.writeFileSync('src/utils/db.ts', code);
console.log("Success");
