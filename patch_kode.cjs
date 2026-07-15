const fs = require('fs');
let code = fs.readFileSync('Kode.gs', 'utf8');

code = code.replace(
  /if \(action === "get_masters"\) \{/,
  `if (action === "get_data_master") {
      return handleGetDataMaster();
    } else if (action === "get_masters") {`
);

code = code.replace(
  /if \(action === "sync_batch"\) \{/,
  `if (action === "save_data_master") {
      return handleSaveDataMaster(payload.keysValues);
    } else if (action === "sync_batch") {`
);

fs.writeFileSync('Kode.gs', code);
