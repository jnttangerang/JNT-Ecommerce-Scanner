### Implementation Report

**Root Cause:**
1. **Stale Data (Data Log):** The `pullRecords()` and `pullMasters()` functions in `db.ts` used `GET` requests to Google Apps Script. Browsers aggressively cache identical `GET` requests, causing the 10-second polling interval in `OwnerScreen` to constantly receive stale data instead of fresh syncs.
2. **Business Filtering (Review Deck):** The "REVIEW FOTO RESI & BARCODE SCANNER DECK" generated its seller list (`sellersInFilteredSet`) and record list (`reviewDeckRecords`) directly from the global `filteredRecords`. It lacked logic to hide historical records, completed Sprinter deliveries, or sellers already marked "Selesai Scan".

**Exact Execution Path:**
1. `OwnerScreen` mounts and sets up a 10-second polling interval.
2. The interval triggers `dbService.pullRecords()`.
3. The browser intercepts the `GET` request and returns a cached response.
4. `loadData()` runs but receives no new records.
5. In the UI, the Deck mapping iterates over all historical and completed records because they are never filtered out before rendering.

**Current vs New Implementation:**
- **Cache Busting:** `db.ts` now appends a `_t=${Date.now()}` parameter to all `GET` requests, forcing the browser to fetch fresh data from Google Apps Script.
- **Deck Filtering:** Introduced `deckEligibleRecords` in `OwnerScreen.tsx` to pre-filter the dataset exclusively for the Review Deck. It explicitly removes sellers in `completedSellers`, filters out historical dates (unless they require owner action), and removes completed statuses (`DISERAHKAN`, `PICKUP`).

**Modified Files:**
- `src/utils/db.ts`
- `src/components/OwnerScreen.tsx`

**Code Diff:**
```diff
--- src/utils/db.ts
+++ src/utils/db.ts
@@ -1103,7 +1103,7 @@
         // Try GET first as it avoids CORS preflight issues on production deployments (like Vercel)
         try {
-          const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_masters`;
+          const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_masters&_t=${Date.now()}`;
           const response = await fetch(getUrl, {
@@ -1172,7 +1172,7 @@
         // Try GET first as it avoids CORS preflight issues on production deployments (like Vercel)
         try {
-          const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_records`;
+          const getUrl = `${config.appsScriptUrl}${config.appsScriptUrl.includes("?") ? "&" : "?"}action=get_records&_t=${Date.now()}`;
           const response = await fetch(getUrl, {
```
```diff
--- src/components/OwnerScreen.tsx
+++ src/components/OwnerScreen.tsx
@@ -1779,11 +1779,36 @@
   const uniqueOutlets = Array.from(new Set(allRecords.map(r => r.Outlet)));
   const uniqueSellers = Array.from(new Set(allRecords.map(r => r.Seller)));
 
+  // Business logic: Filter records specifically for the Review Deck
+  const deckEligibleRecords = React.useMemo(() => {
+    const todayStr = getTodayLocalDateString();
+    return filteredRecords.filter(r => {
+      // Must NOT display: sellers already marked "Selesai Scan"
+      if (completedSellers.includes(r.Seller)) return false;
+
+      const requiresAction = r.RetakeStatus === "PENDING" || r.alertStatus === "PENDING";
+      const isCompleted = r.Status === "DISERAHKAN" || r.Status === "PICKUP" || r.Status === "CANCELLED";
+      
+      // Show: packages requiring owner action
+      if (requiresAction) return true;
+
+      // Must NOT display: already processed Sprinter records (unless it requires action)
+      if (isCompleted) return false;
+
+      // Must NOT display: yesterday's completed work / historical records
+      const isToday = r.Tanggal === todayStr;
+      if (!isToday) return false;
+
+      // Show: seller scanned today, packages that still require Sprinter processing (SCANNED)
+      return true;
+    });
+  }, [filteredRecords, completedSellers]);
+
   // Get records specifically for the currently selected review seller
   const reviewDeckRecords = React.useMemo(() => {
     if (!selectedReviewSeller) return [];
-    return filteredRecords.filter(r => r.Seller === selectedReviewSeller);
+    return deckEligibleRecords.filter(r => r.Seller === selectedReviewSeller);
-  }, [filteredRecords, selectedReviewSeller]);
+  }, [deckEligibleRecords, selectedReviewSeller]);
 
   // Retrieve current active record for Review Deck
   const activeReviewRecord = selectedReviewSeller
@@ -1790,9 +1790,9 @@
     : null;
 
-  // Get unique list of sellers present in filteredRecords with stats
+  // Get unique list of sellers present in deckEligibleRecords with stats
   const sellersInFilteredSet = React.useMemo(() => {
     const map: Record<string, { name: string; total: number; cancelled: number; lastScanTime: string }> = {};
-    filteredRecords.forEach(r => {
+    deckEligibleRecords.forEach(r => {
       if (!map[r.Seller]) {
         map[r.Seller] = { name: r.Seller, total: 0, cancelled: 0, lastScanTime: r.Jam };
       }
@@ -1804,7 +1804,7 @@
       }
     });
     return Object.values(map).sort((a, b) => b.lastScanTime.localeCompare(a.lastScanTime));
-  }, [filteredRecords]);
+  }, [deckEligibleRecords]);
```

**Regression Checklist:**
- [x] Data Log table still displays all records (uses `filteredRecords`).
- [x] Background polling successfully pulls fresh updates from Apps Script via cache bypass.
- [x] Review Deck hides historical (yesterday's) records automatically.
- [x] Review Deck hides records marked as `DISERAHKAN` (processed Sprinter records).
- [x] Review Deck immediately hides sellers when marked "Selesai Scan Pickup".
- [x] Packages with `RetakeStatus: "PENDING"` bypass date and completion filters to ensure they are visible.
- [x] Zero TypeScript build errors.

**Build Result:**
- `npm run build` completed successfully.
