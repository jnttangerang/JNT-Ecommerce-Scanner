### 1. Business Rule Compliance

**PackageStatus (YoYi)**
- **Status:** ✗ Not compliant
- **Reason:** The values `Untuk Diserahkan` and `Diserahkan` defined by YoYi are not fully supported independently. The application uses a generic `StatusType` field where `Untuk Diserahkan` is forcibly mapped to `"SCANNED"`. It does not exist as an independent state machine.

**WaybillStatus (YoYi)**
- **Status:** ✗ Not compliant
- **Reason:** WaybillStatus (`Belum Diambil` / `Sudah Pickup`) does not exist as its own field. When a Waybill becomes "Sudah Pickup", the application overwrites the package's global `Status` field to `"PICKUP"`, destroying the `PackageStatus` history.

**SyncStatus (Application)**
- **Status:** ⚠ Partially compliant
- **Reason:** `SyncStatus` correctly remains independent of business logic and determines Google Sheets upload status. However, it lacks the `LOCAL` state defined in the spec, relying instead on a combined `PENDING` approach.

**ReviewStatus (Application)**
- **Status:** ✓ Fully compliant
- **Reason:** The application correctly uses `completedRecordIds` and a daily reset cache (`jt_review_completed_date`) to manage Review workflow entirely independently without polluting YoYi domains. 

**RetakeStatus (Application)**
- **Status:** ✗ Not compliant
- **Reason:** Retake is stored as `RetakeStatus`, but when an Owner requests a retake, the application illegally modifies the package's primary `Status` back to `"SCANNED"`.

**AlertStatus (Application)**
- **Status:** ✗ Not compliant
- **Reason:** Stored as `alertStatus`, but it is illegally tied to `CancelStatus`. Whenever a package is marked as `"CANCELLED"`, the `alertStatus` is automatically forced to `"PENDING"`.

**CancelStatus (Application)**
- **Status:** ✗ Not compliant
- **Reason:** Does not exist as its own independent state. It acts by permanently overwriting the package's core `Status` to `"CANCELLED"`.

---

### 2. Invalid State Mixing

| File | Function | Reason | Business Impact |
|---|---|---|---|
| `src/types.ts` | `StatusType` | Merges `PackageStatus`, `WaybillStatus`, and `CancelStatus` into a single `"SCANNED" \| "DISERAHKAN" \| "PICKUP" \| "CANCELLED"` type. | Fails to represent reality. An item cannot simultaneously retain its YoYi PackageStatus while being tracked for Cancellation or Pickup. |
| `src/components/OwnerScreen.tsx` | `handleImportYoYi` | Converts both `status waybill` ("sudah pickup") and `status paket` ("untuk diserahkan", "diserahkan") into a single `targetStatus` variable. | Permanently loses the distinction between Waybill tracking and Package tracking. Maps YoYi's "Untuk Diserahkan" to the App's "SCANNED". |
| `src/utils/db.ts` | `requestRetake` | Executes `Status: "SCANNED"` when `RetakeStatus` becomes `PENDING`. | A retake request illegally alters the YoYi PackageStatus, forcing it back to an initial state. |
| `src/utils/db.ts` | `updateRecordStatus` | Executes `alertStatus = "PENDING"` automatically when `Status` becomes `"CANCELLED"`. | Alert workflow cannot be used independently. It is artificially glued to the cancellation workflow. |

---

### 3. Invalid State Transition

The business specification dictates specific, isolated transitions (e.g., `NONE → Untuk Diserahkan → Diserahkan` for PackageStatus). 

**Violations Found:**
- **Pipeline Hardcoding:** The file `src/utils/db.ts` contains a `validateStateTransition` function that strictly enforces: `SCANNED → DISERAHKAN → PICKUP`. This illegally dictates that `WaybillStatus` (Pickup) is just the next step of `PackageStatus` (Diserahkan). 
- **Backwards Mutation:** `requestRetake` illegally forces the `Status` state backward to `"SCANNED"`, violating the "Transitions must only move forward" rule.
- **Manual Overrides:** `handleMarkCancelled` manually overrides the `Status` to `"CANCELLED"`, violating the rule that PackageStatus transitions must only come from YoYi imports.

---

### 4. Source of Truth Audit

- **PackageStatus:** ✗ **Violation.** Suppose to originate strictly from YoYi, but the application manually initializes it as `"SCANNED"` on local save, and modifies it via manual Owner actions (Cancel/Retake).
- **WaybillStatus:** ✗ **Violation.** Suppose to originate from YoYi, but it does not exist as an independent field.
- **ReviewStatus:** ✓ **Compliant.** Controlled by Owner UI.
- **SyncStatus:** ✓ **Compliant.** Controlled by Application upload logic.
- **RetakeStatus:** ✗ **Violation.** While triggered by Owner, it poisons the YoYi PackageStatus.
- **AlertStatus:** ✗ **Violation.** Controlled by the Cancel workflow, not purely by the Owner.
- **CancelStatus:** ✗ **Violation.** Used to overwrite the YoYi PackageStatus.

---

### 5. Workflow Audit

**Mismatch 1: Package Initial State**
- **Expected:** `Save Local → Sync → Upload YoYi → PackageStatus = Untuk Diserahkan`
- **Current:** The system immediately sets `Status = "SCANNED"` right at the "Save Local" step, blending an internal scanning stage with YoYi's official statuses. 

**Mismatch 2: Waybill Pickup Workflow**
- **Expected:** `Owner Review → Owner Scan → WaybillStatus = Sudah Pickup`
- **Current:** The system treats "PICKUP" as a terminal `StatusType` that overrides "DISERAHKAN", erasing the underlying package handover context.

**Mismatch 3: Review Completion**
- **Expected:** Review workflow stands apart from PackageStatus and WaybillStatus.
- **Current:** The UI still relies heavily on `Status === "CANCELLED"` and `Status === "SCANNED"` checks within the Review Deck rendering loop (`OwnerScreen.tsx`), confusing what should be displayed.

---

### 6. High Risk Business Bugs

1. **State Collapse:** `PackageStatus`, `WaybillStatus`, and `CancelStatus` are collapsed into a single `Status` field in `ScanRecord`.
2. **Import Data Loss:** `handleImportYoYi` discards separate Waybill and Package statuses from the spreadsheet, forcing them into a single local enum.
3. **Retake Status Corruption:** `requestRetake` illegally alters `PackageStatus` by reverting it to `"SCANNED"`.
4. **Cancellation Status Corruption:** `updateRecordStatus` illegally overwrites `PackageStatus` to `"CANCELLED"` instead of maintaining it independently.
5. **Alert Coupling:** `alertStatus` triggers automatically on cancellation rather than acting as an independent notification tool.

---

### 7. Fix Priority

- **Critical:** Disentangle `StatusType`. Introduce separate `PackageStatus`, `WaybillStatus`, and `CancelStatus` fields to the `ScanRecord` interface.
- **Critical:** Rewrite `handleImportYoYi` to respect and store independent YoYi columns.
- **High:** Remove `validateStateTransition` pipeline that strings PackageStatus and WaybillStatus together linearly.
- **High:** Remove `Status = "SCANNED"` from `requestRetake` logic.
- **Medium:** Decouple `alertStatus` from cancellation logic.
