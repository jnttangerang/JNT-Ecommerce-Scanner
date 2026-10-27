# 02_DATABASE_ARCHITECTURE.md

# J&T Ecommerce
## Database Architecture & Technical Design

**Version** : 1.1.0  
**Status** : Active Development  
**Document Type** : Database Architecture  
**Last Update** : September 2026

---

# 1. Tujuan

Dokumen ini menjelaskan standar arsitektur database yang digunakan pada J&T Pickup Scanner PRO.

Dokumen ini menjadi acuan seluruh pengembangan backend maupun frontend agar struktur data tetap konsisten, mudah dikembangkan, serta tetap kompatibel dengan data operasional yang sudah berjalan.

---

# 2. Prinsip Arsitektur

Seluruh pengembangan database wajib mengikuti prinsip berikut.

- Single Source of Truth
- Offline First
- ID Based Relation
- Incremental Synchronization
- Queue Based Processing
- Event Driven Sync
- Backward Compatibility
- Soft Delete
- Modular Configuration

---

# 3. Arsitektur Sistem

```
                    React + TypeScript

                           │

                     IndexedDB (Local)

                           │

                     Sync Engine

                           │

                 Google Apps Script API

                           │

                  Google Spreadsheet

                           │

                    Google Drive
```

Seluruh transaksi berasal dari aplikasi.

Google Spreadsheet berfungsi sebagai **Master Database**, bukan tempat input manual.

---

# 4. Data Flow

```
Operator

↓

J&T Pickup Scanner PRO

↓

IndexedDB

↓

Sync Queue

↓

Google Apps Script

↓

Google Spreadsheet

↓

Google Drive (Foto)
```

Semua transaksi harus melewati proses ini.

---

# 5. Database Layer
 
## Layer 1: Client-Side Hybrid Storage (IndexedDB + Safe LocalStorage)
 
### 1. IndexedDB (`JnTScannerDB`)
Database utama lokal pada browser (unlimited quota, non-blocking asynchronous).
 
Berfungsi untuk:
- Menyimpan seluruh riwayat transaksi pemindaian (`ScanRecord[]`).
- Menyimpan foto resi beresolusi tinggi (`PhotoURL`, `CancelEvidencePhoto`) dalam bentuk Base64 data URI tanpa membebani thread UI.
- Offline First storage & queue sinkronisasi cloud.
 
### 2. LocalStorage (`jt_pickup_records` Snapshot)
Hanya berfungsi sebagai **synchronous bootstrap cache** agar antarmuka pengguna (UI) dapat langsung me-render data seketika saat pertama kali halaman dimuat sebelum IndexedDB selesai terhubung secara asynchronous.
 
**Aturan Ketat LocalStorage:**
- **Zero Heavy Payloads**: Seluruh Base64 data-uri foto (`PhotoURL`, `CancelEvidencePhoto`) wajib dipangkas/diganti dengan identifier ringan (`idb_image`).
- **Bounded Snapshot**: Hanya menyimpan maksimal 50 record terakhir (~15KB) untuk menjamin penggunaan kuota browser tetap jauh di bawah batas 5MB.
- **Progressive Degradation**: Apabila browser melaporkan batas kuota tipis, snapshot mengecil secara bertahap (50 -> 20 -> 10 -> 0) dengan pre-removal (`removeItem` sebelum `setItem`) sehingga mengeliminasi `QuotaExceededError`.
 
---
 
## Layer 2
 
### Google Spreadsheet
 
Master Database terpusat.
 
Digunakan untuk:
- Master Data (Outlet, Operator, Admin, Seller, Prefix Resi)
- Rekap Transaksi Harian / Penjemputan
- Monitoring Owner & Dashboard Analitik
- Audit Log & Rekapitulasi YoYi
 
---
 
## Layer 3
 
### Google Drive
 
Penyimpanan file bukti resi paket secara cloud:
- Foto Paket & Foto Bukti Resi
- Foto Pembatalan (Cancel Evidence)
 
Spreadsheet dan database lokal hanya menyimpan URL permanen Google Drive (`thumbnail?sz=w1000&id=FILE_ID` atau file share link).

---

# 6. Primary Key

Seluruh tabel menggunakan ID.

Tidak boleh menggunakan Nama sebagai relasi.

Minimal:

- OutletID
- SellerID
- OperatorID
- AdminID
- TransactionID
- PhotoID
- QueueID
- AuditID
- ConfigID
- PrefixID
- RoleID

ID bersifat permanen.

---

# 7. Foreign Key

Relasi menggunakan ID.

Contoh:

```
OutletID

↓

SellerID

↓

TransactionID

↓

PhotoID
```

Jangan menggunakan:

- Nama Outlet
- Nama Seller
- Nama Operator

Sebagai relasi.

---

# 8. Struktur Spreadsheet

Gunakan satu Spreadsheet.

Minimal memiliki sheet berikut.

```
MASTER_OUTLET

MASTER_OPERATOR

MASTER_ADMIN

MASTER_SELLER

MASTER_TRANSAKSI

MASTER_ROLE

MASTER_PREFIX_RESI

MASTER_STATUS

MASTER_CONFIG

MASTER_QUEUE

MASTER_AUDIT

MASTER_IMPORT

MASTER_SYNC

MASTER_VERSION
```

---

# 9. MASTER_TRANSAKSI

Semua transaksi berada pada satu tabel.

Tidak lagi menggunakan:

Satu Outlet = Satu Sheet.

Minimal field.

| Field | Keterangan |
|---------|------------|
| TransactionID | Primary Key |
| WaybillNo | Nomor Resi |
| OutletID | FK |
| SellerID | FK |
| OperatorID | FK |
| AdminID | FK |
| CurrentStatus | Status Internal |
| YoYiStatus | Status Paket |
| WaybillStatus | Status Waybill |
| PhotoURL | URL Google Drive |
| SyncStatus | Status Sinkronisasi |
| UploadStatus | Status Upload Foto |
| CreatedAt | Timestamp |
| UpdatedAt | Timestamp |
| DeletedAt | Soft Delete |
| Version | Incremental Sync |

---

# 10. MASTER_OUTLET

| Field |
|---------|
| OutletID |
| OutletCode |
| OutletName |
| Address |
| Active |
| CreatedAt |
| UpdatedAt |

---

# 11. MASTER_OPERATOR

| Field |
|---------|
| OperatorID |
| OutletID |
| OperatorName |
| RoleID |
| Active |
| CreatedAt |
| UpdatedAt |

---

# 12. MASTER_ADMIN

| Field |
|---------|
| AdminID |
| AdminName |
| RoleID |
| Active |

---

# 13. MASTER_SELLER

| Field |
|---------|
| SellerID |
| OutletID |
| SellerName |
| Marketplace |
| Phone |
| Active |

---

# 14. MASTER_PREFIX_RESI

Seluruh prefix berasal dari database.

Tidak boleh di-hardcode.

| Field |
|---------|
| PrefixID |
| Prefix |
| Category |
| Description |
| Active |
| CreatedAt |
| UpdatedAt |

Contoh:

| Prefix | Category |
|---------|----------|
| JX | Ecommerce |
| JY | Ecommerce |
| JZ | Ecommerce |
| JD | Regular |

Owner dapat menambah atau menonaktifkan prefix tanpa mengubah source code.

---

# 15. MASTER_STATUS

Gunakan satu sumber status.

Minimal.

```
SCANNED

READY_UPLOAD

UPLOAD_YOYI

YOYI_IMPORTED

READY_PICKUP

PICKUP

DELIVERED

ORDER_CANCELLED

CANCELLED
```

Seluruh modul menggunakan status yang sama.

---

# 16. MASTER_CONFIG

Semua konfigurasi aplikasi disimpan di database.

Contoh.

- Retry Count
- Retry Interval
- Auto Sync
- Auto Upload
- Barcode Prefix
- Theme
- Version
- Photo Compression

Tidak boleh hardcode.

---

# 17. IndexedDB Structure

Gunakan Object Store berikut.

```
transactions

photos

queue

master

seller

outlet

operator

config

audit

cache

temp

sync
```

IndexedDB menjadi database utama aplikasi.

---

# 18. Queue Architecture

Semua proses asynchronous menggunakan Queue.

Contoh.

```
Upload Foto

↓

Queue

↓

Upload

↓

Success

↓

Remove Queue
```

Jika gagal.

```
Queue

↓

Retry

↓

Success
```

---

# 19. Retry Queue

Retry Queue digunakan untuk.

- Upload Foto
- Sync Data
- Import YoYi
- Download Master

Gunakan:

Exponential Backoff

Contoh.

```
5 detik

↓

10 detik

↓

20 detik

↓

40 detik
```

Retry maksimal dikonfigurasi melalui MASTER_CONFIG.

---

# 20. Sinkronisasi

Urutan sinkronisasi wajib.

```
Local Save

↓

Sync Transaction

↓

Server Success

↓

Upload Photo

↓

Update PhotoURL

↓

Complete
```

Foto tidak boleh diupload sebelum transaksi berhasil dibuat.

---

# 21. Sync Status

Gunakan status berikut.

```
LOCAL

PENDING

SYNCING

SYNCED

PHOTO_PENDING

PHOTO_UPLOADING

PHOTO_UPLOADED

FAILED

RETRY

COMPLETE
```

---

# 22. Incremental Sync

Jangan download seluruh master setiap aplikasi dibuka.

Gunakan.

- Version
- LastUpdated

Client mengirim:

```
lastVersion
```

Server hanya mengirim data yang berubah.

---

# 23. API Design

Gunakan REST Style.

Contoh.

```
POST /api/v1/login

GET /api/v1/master

POST /api/v1/transaction

POST /api/v1/upload

POST /api/v1/import

GET /api/v1/config
```

Semua endpoint menggunakan version.

```
v1
```

---

# 24. API Response

Format sukses.

```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

Format gagal.

```json
{
  "success": false,
  "code": "ERR001",
  "message": "",
  "errors": []
}
```

Gunakan format yang sama untuk seluruh endpoint.

---

# 25. API Validation

Backend wajib memvalidasi.

- Authentication
- Authorization
- Role
- Required Field
- Duplicate Data
- Permission
- Version

Validasi tidak boleh hanya dilakukan di Frontend.

---

# 26. Migration

Perubahan struktur database wajib menggunakan migration.

Migration harus.

- Aman.
- Tidak menghapus data lama.
- Tidak memerlukan input ulang pengguna.
- Mendukung rollback.
- Memiliki version.

---

# 27. Soft Delete

Seluruh penghapusan menggunakan Soft Delete.

Field minimal.

- DeletedAt
- DeletedBy
- IsDeleted

Data tidak langsung dihapus permanen.

---

# 28. Audit

Seluruh perubahan data menghasilkan Audit Log.

Minimal.

- AuditID
- UserID
- RoleID
- Action
- TableName
- RecordID
- OldValue
- NewValue
- Device
- Browser
- CreatedAt

---

# 29. Penyimpanan Foto

Foto tidak disimpan di Spreadsheet.

Spreadsheet hanya menyimpan.

- PhotoID
- PhotoURL
- PhotoStatus

File asli berada di Google Drive.

---

# 30. Business Rule Database

## Upload ke YoYi

Upload ke YoYi **tidak membuat transaksi baru**.

Upload hanya mengirim nomor resi yang sudah tersimpan di database lokal ke sistem YoYi melalui mekanisme Browser Automation apabila Batch API tidak tersedia.

---

## Import YoYi

Import YoYi **tidak membuat transaksi baru**.

Import hanya memperbarui:

- YoYiStatus
- WaybillStatus

berdasarkan Nomor Resi.

Apabila nomor resi tidak ditemukan.

Masukkan ke daftar:

**Resi Tidak Ditemukan**

Jangan membuat transaksi secara otomatis.

---

# 31. Target Arsitektur

Setelah seluruh refactor selesai.

Aplikasi harus memiliki karakteristik berikut.

- Seluruh relasi menggunakan ID.
- IndexedDB menjadi database utama.
- Google Spreadsheet menjadi Master Database.
- Google Drive menjadi penyimpanan foto.
- Semua konfigurasi berasal dari database.
- Semua proses asynchronous menggunakan Queue.
- Sinkronisasi bersifat Incremental.
- API memiliki Versioning.
- Mendukung ribuan transaksi per hari.
- Mendukung banyak Outlet, Seller, dan Operator.
- Mudah dikembangkan.
- Tetap kompatibel dengan data lama.
- Seluruh perubahan dilakukan melalui Migration yang aman.
