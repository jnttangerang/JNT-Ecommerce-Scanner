# 03_REFACTOR_TASK.md

# J&T Pickup Scanner PRO
## Refactor Roadmap

**Version** : 1.0.0  
**Status** : Active Development  
**Document Type** : Refactor Task List

---

# Tujuan

Dokumen ini merupakan daftar pekerjaan (Roadmap) yang harus dikerjakan selama proses refactor aplikasi.

Dokumen ini **bukan dokumen implementasi teknis**.

Setiap item pada dokumen ini memiliki dokumen task tersendiri (TASK_xx.md) yang menjelaskan detail implementasi.

---

# Target Refactor

Seluruh proses refactor bertujuan untuk meningkatkan:

- Performance
- Reliability
- Scalability
- Security
- Maintainability
- User Experience

Tanpa mengubah SOP operasional J&T Express.

---

# Ketentuan Umum

Project ini **tidak boleh di-rewrite**.

Gunakan source code yang sudah ada.

Seluruh perubahan dilakukan secara bertahap.

Semua fitur lama harus tetap berjalan.

Setiap perubahan wajib kompatibel dengan data lama.

---

# PRIORITAS 1

## Database

- [ ] Migrasi seluruh relasi menggunakan ID.
- [ ] Satukan seluruh transaksi ke MASTER_TRANSAKSI.
- [ ] Migrasi LocalStorage ke IndexedDB.
- [ ] Tambahkan Migration System.
- [ ] Implementasikan Incremental Sync.
- [ ] Optimalkan struktur Google Spreadsheet.

Dokumen:
**TASK_01_DATABASE.md**

---

## Prefix Resi

- [ ] Prefix berasal dari database.
- [ ] Tidak ada hardcode.
- [ ] Owner dapat mengelola prefix.
- [ ] Validasi scanner membaca konfigurasi database.

Dokumen:
**TASK_09_PREFIX_RESI.md**

---

## Login & Hak Akses

- [ ] Role Based Access Control.
- [ ] Backend melakukan validasi Role.
- [ ] Pisahkan hak akses Owner dan Operator.
- [ ] Pengamanan endpoint API.

Dokumen:
**TASK_08_LOGIN_ROLE.md**

---

## Responsive UI

- [ ] Mobile First.
- [ ] Perbaikan layout Android.
- [ ] Perbaikan popup.
- [ ] Perbaikan dashboard.
- [ ] Optimasi seluruh halaman.

Dokumen:
**TASK_07_RESPONSIVE.md**

---

# PRIORITAS 2

## Upload ke YoYi

- [ ] Analisis source code.
- [ ] Rancang Browser Automation.
- [ ] Implementasi Upload ke YoYi.
- [ ] Batch Upload.
- [ ] Error Handling.
- [ ] Progress Indicator.

Dokumen:
**TASK_02_UPLOAD_YOYI.md**

---

## Import YoYi

- [ ] Copy & Paste.
- [ ] Upload CSV.
- [ ] Upload Excel.
- [ ] Mapping Status.
- [ ] Sinkronisasi Status.
- [ ] Validasi Data.
- [ ] Ringkasan Import.

Dokumen:
**TASK_03_IMPORT_YOYI.md**

---

## Retry Queue

- [ ] Pisahkan Upload Foto dari Sync.
- [ ] Queue Management.
- [ ] Retry Otomatis.
- [ ] Exponential Backoff.
- [ ] Monitoring Queue.

Dokumen:
**TASK_04_RETRY_QUEUE.md**

---

## Dashboard

- [ ] Dashboard Monitoring.
- [ ] Ready Scan Sprinter.
- [ ] Status Sinkronisasi.
- [ ] Queue Monitoring.
- [ ] Statistik Operasional.
- [ ] Health Monitoring.

Dokumen:
**TASK_05_DASHBOARD.md**

---

## ORDER CANCELLED ALERT

- [ ] Alert hanya untuk Operator/Admin.
- [ ] Tidak tampil di Owner.
- [ ] Tombol Konfirmasi.
- [ ] Simpan status konfirmasi.
- [ ] Audit Log.

Dokumen:
**TASK_06_ORDER_CANCELLED.md**

---

# PRIORITAS 3

## Audit Log

- [ ] Login.
- [ ] Logout.
- [ ] Scan.
- [ ] Upload.
- [ ] Import.
- [ ] Export.
- [ ] Sync.
- [ ] Delete.
- [ ] Perubahan Status.

---

## API

- [ ] API Versioning.
- [ ] Standard Response.
- [ ] Error Code.
- [ ] Version Check.

---

## Backup

- [ ] Backup Spreadsheet.
- [ ] Backup Config.
- [ ] Backup Master Data.
- [ ] Backup Terjadwal.

---

## Performance

- [ ] Lazy Loading.
- [ ] Virtual List.
- [ ] Code Splitting.
- [ ] Bundle Optimization.
- [ ] Rendering Optimization.

---

## Security

- [ ] Input Validation.
- [ ] API Validation.
- [ ] Authorization.
- [ ] Authentication.
- [ ] Sanitization.

---

# Urutan Pengerjaan

Setiap TASK harus dikerjakan dengan urutan berikut:

1. Analisis source code existing.
2. Identifikasi file yang terdampak.
3. Analisis dampak terhadap fitur lain.
4. Buat rencana implementasi.
5. Implementasikan perubahan.
6. Lakukan testing.
7. Perbarui dokumentasi.

AI **tidak boleh langsung menulis kode** tanpa melalui tahapan analisis.

---

# Aturan Pengerjaan

- Satu chat hanya mengerjakan **satu TASK**.
- Jangan menggabungkan beberapa TASK dalam satu implementasi.
- Jangan mengubah Business Rules tanpa alasan yang jelas.
- Jangan melakukan refactor besar tanpa analisis dampak.
- Jika menemukan bug di luar TASK yang sedang dikerjakan, catat sebagai rekomendasi dan jangan langsung diperbaiki kecuali diminta.

---

# Target Akhir

Setelah seluruh roadmap selesai, aplikasi harus memiliki karakteristik berikut:

- Arsitektur lebih bersih.
- Database terpusat berbasis ID.
- Offline First yang stabil.
- Sinkronisasi cepat dan andal.
- Upload Foto menggunakan Retry Queue.
- Upload ke YoYi lebih cepat dan otomatis.
- Import YoYi stabil untuk data skala besar.
- Dashboard operasional lengkap.
- Responsive di seluruh perangkat.
- Role Based Access Control yang aman.
- Audit Log lengkap.
- API memiliki Versioning.
- Mudah dikembangkan untuk banyak Outlet, Seller, dan Operator.
- Tetap kompatibel dengan data operasional yang sudah ada.

---

# Referensi Dokumen

- `01_SYSTEM_CONTEXT.md`
- `02_DATABASE_ARCHITECTURE.md`
- `04_AI_DEVELOPER_RULE.md`

Seluruh implementasi wajib mengacu pada ketiga dokumen tersebut sebelum memulai pekerjaan pada setiap TASK.