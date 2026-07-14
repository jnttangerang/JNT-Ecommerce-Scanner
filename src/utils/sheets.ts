import { ScanRecord, Outlet, Operator, Seller } from "../types";

function getSheetNameFromOutlet(outlet: string): string {
  if (outlet && outlet.includes("Jayanti")) {
    return "Data Resi J&T Jayanti";
  } else if (outlet && outlet.includes("Cikupa Mas")) {
    return "Data Resi J&T Cikupa Mas";
  }
  return "Data Resi J&T Pasir Jaha Balaraja";
}

export async function fetchWithAuth(url: string, options: any, accessToken: string) {
  const headers = new Headers(options.headers || {});
  headers.append('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...options, headers });
}

export async function directSyncRecords(
  records: ScanRecord[],
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; added: number; failedIds: string[] }> {
  let newlyScanned = 0;
  const failedIds: string[] = [];

  // Group records by sheet
  const recordsBySheet = new Map<string, ScanRecord[]>();
  for (const r of records) {
    const sheetName = getSheetNameFromOutlet(r.Outlet);
    if (!recordsBySheet.has(sheetName)) recordsBySheet.set(sheetName, []);
    recordsBySheet.get(sheetName)!.push(r);
  }

  for (const [sheetName, sheetRecords] of recordsBySheet.entries()) {
    try {
      // Ensure sheet exists or get its data to find duplicates
      let existingData: any[] = [];
      let headerRowExists = false;
      const getRes = await fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A1:I`,
        { method: 'GET' },
        accessToken
      );

      if (getRes.ok) {
        const data = await getRes.json();
        existingData = data.values || [];
        if (existingData.length > 0) headerRowExists = true;
      } else if (getRes.status === 400 && (await getRes.clone().text()).includes("Unable to parse range")) {
        // Sheet does not exist. We can create it using batchUpdate, but append will create it if we can't?
        // Actually, append does NOT create the sheet. We must create it.
        await fetchWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: sheetName } } }]
            })
          },
          accessToken
        );
      }

      if (!headerRowExists) {
        // Append headers
        await fetchWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A1:I1:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              values: [["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status", "PhotoURL"]]
            })
          },
          accessToken
        );
      }

      const existingResis = new Map<string, number>(); // resi -> row index (0-based)
      existingData.forEach((row, i) => {
        if (row[3]) existingResis.set(row[3].toString().toUpperCase(), i);
      });

      const appendValues: any[] = [];
      const appendIds: string[] = [];
      const updateRequests: any[] = [];

      for (const r of sheetRecords) {
        const resi = r.Resi.toUpperCase();
        if (existingResis.has(resi)) {
          // Update status and photo
          const rowIndex = existingResis.get(resi)!; // 0-based
          updateRequests.push({
            updateCells: {
              range: {
                sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 7, // H column is 7 (0-based)
                endColumnIndex: 9  // I column is 8 (0-based), end index is exclusive
              },
              rows: [{
                values: [
                  { userEnteredValue: { stringValue: r.Status } },
                  { userEnteredValue: { stringValue: r.PhotoURL || "" } }
                ]
              }],
              fields: "userEnteredValue"
            }
          });
          newlyScanned++;
        } else {
          // Append
          appendValues.push([
            r.ID, r.Tanggal, r.Jam, r.Resi, r.Outlet, r.Seller, r.Operator, r.Status, r.PhotoURL
          ]);
          appendIds.push(r.ID);
        }
      }

      if (appendValues.length > 0) {
        const appendRes = await fetchWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A:I:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: appendValues })
          },
          accessToken
        );
        if (appendRes.ok) {
          newlyScanned += appendValues.length;
        } else {
          failedIds.push(...appendIds);
        }
      }

      if (updateRequests.length > 0) {
        await fetchWithAuth(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: updateRequests })
          },
          accessToken
        );
      }

    } catch (err) {
      console.error("Direct sync error for sheet", sheetName, err);
      failedIds.push(...sheetRecords.map(r => r.ID));
    }
  }

  return { success: failedIds.length === 0, added: newlyScanned, failedIds };
}

let sheetIdsCache: Record<string, number> = {};
async function getSheetId(spreadsheetId: string, sheetName: string, accessToken: string): Promise<number | undefined> {
  if (sheetIdsCache[sheetName] !== undefined) return sheetIdsCache[sheetName];
  
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    { method: 'GET' },
    accessToken
  );
  if (res.ok) {
    const data = await res.json();
    for (const sheet of data.sheets) {
      sheetIdsCache[sheet.properties.title] = sheet.properties.sheetId;
    }
  }
  return sheetIdsCache[sheetName];
}

export async function directAddMaster(
  listName: string, // "Seller List" | "Data Operator" | "Daftar Outlet"
  header: string,
  value: string,
  spreadsheetId: string,
  accessToken: string
) {
  let existingData: any[] = [];
  const getRes = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(listName)}'!A1:A`,
    { method: 'GET' },
    accessToken
  );

  if (getRes.ok) {
    const data = await getRes.json();
    existingData = data.values || [];
  } else if (getRes.status === 400 && (await getRes.clone().text()).includes("Unable to parse range")) {
    await fetchWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: listName } } }] })
      },
      accessToken
    );
  }

  if (existingData.length === 0) {
    await fetchWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(listName)}'!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[header]] })
      },
      accessToken
    );
  } else {
    const exists = existingData.some(row => row[0] && row[0].toString().toLowerCase() === value.toLowerCase());
    if (exists) return { success: false, error: "Already exists" };
  }

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(listName)}'!A:A:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[value]] })
    },
    accessToken
  );
  return { success: true };
}

export async function directGetMasters(spreadsheetId: string, accessToken: string) {
  const lists = [
    { name: "Seller List", alt: "Daftar Seller" },
    { name: "Data Operator", alt: "Operator List" },
    { name: "Daftar Outlet", alt: "Outlet List" }
  ];

  const results: any = { sellers: [], operators: [], outlets: [] };

  const getSheetData = async (primary: string, alt: string) => {
    let res = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(primary)}'!A2:A`, { method: 'GET' }, accessToken);
    if (!res.ok) {
      res = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(alt)}'!A2:A`, { method: 'GET' }, accessToken);
    }
    if (res.ok) {
      const data = await res.json();
      return (data.values || []).map((r: any) => r[0]).filter(Boolean);
    }
    return [];
  };

  results.sellers = await getSheetData(lists[0].name, lists[0].alt);
  results.operators = await getSheetData(lists[1].name, lists[1].alt);
  results.outlets = await getSheetData(lists[2].name, lists[2].alt);

  return { success: true, ...results };
}

export async function directGetRecords(spreadsheetId: string, accessToken: string) {
  const res = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { method: 'GET' }, accessToken);
  if (!res.ok) throw new Error("Failed to load spreadsheet");

  const data = await res.json();
  const sheets = data.sheets;
  const records: ScanRecord[] = [];

  for (const sheet of sheets) {
    const sName = sheet.properties.title;
    if (sName.startsWith("Data Resi")) {
      const getRes = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sName)}'!A2:I`, { method: 'GET' }, accessToken);
      if (getRes.ok) {
        const sData = await getRes.json();
        for (const row of (sData.values || [])) {
          records.push({
            ID: row[0] || "",
            Tanggal: row[1] || "",
            Jam: row[2] || "",
            Resi: row[3] || "",
            Outlet: row[4] || "",
            Seller: row[5] || "",
            Operator: row[6] || "",
            Status: row[7] || "SCANNED", ScanTimestamp: Date.now(),
            PhotoURL: row[8] || "",
            SyncStatus: "SYNCED",
            PackageStatus: "NONE",
            WaybillStatus: "NONE",
            ReviewStatus: "NONE",
            RetakeStatus: "NONE",
            AlertStatus: "NONE",
            CancelStatus: "NONE",
          });
        }
      }
    }
  }

  return { success: true, records };
}
