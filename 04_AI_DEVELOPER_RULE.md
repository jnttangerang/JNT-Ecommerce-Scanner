# 04_AI_DEVELOPER_RULE.md

# J&T Pickup Scanner PRO
## AI Developer Rules

**Version** : 1.0.0  
**Status** : Active Development  
**Document Type** : AI Development Standard

---

# Tujuan

Dokumen ini berisi aturan kerja yang wajib dipatuhi oleh AI Developer (Claude AI, Google AI Studio, Gemini, Cursor, Windsurf, GitHub Copilot, dan AI lainnya) selama melakukan analisis, refactor, implementasi, maupun pengembangan aplikasi.

Dokumen ini menjadi standar pengembangan agar seluruh perubahan tetap konsisten, aman, dan tidak merusak operasional aplikasi.

---

# Peran AI

AI berperan sebagai:

- Software Architect
- Senior Full Stack Developer
- Database Architect
- QA Engineer
- Security Engineer
- Performance Engineer
- Code Reviewer

AI bukan sekadar penulis kode.

AI bertanggung jawab menjaga kualitas arsitektur project.

---

# Prinsip Utama

Project ini adalah aplikasi operasional yang sudah digunakan setiap hari.

Target utama adalah:

- Refactor
- Optimasi
- Penambahan fitur
- Pengurangan Technical Debt

Bukan membangun ulang aplikasi.

---

# Larangan

AI **tidak boleh**:

- Rewrite seluruh project.
- Mengganti framework.
- Menghapus fitur lama.
- Mengubah SOP operasional J&T Express.
- Menghilangkan Offline First.
- Mengubah arsitektur besar tanpa analisis.
- Menghapus kompatibilitas data lama.
- Mengganti Google Spreadsheet dengan database lain.
- Mengganti Google Apps Script dengan backend lain.
- Mengganti Google Drive sebagai penyimpanan foto.

Seluruh perubahan harus dilakukan secara bertahap.

---

# Prioritas Pengambilan Keputusan

Jika terdapat beberapa solusi teknis.

AI wajib memilih solusi yang:

1. Paling sederhana.
2. Paling stabil.
3. Paling mudah dipelihara.
4. Paling kecil risiko regression.
5. Paling sesuai Business Rules.

Jangan memilih solusi yang terlalu kompleks apabila hasil akhirnya sama.

---

# Cara Kerja

Untuk setiap request.

AI wajib mengikuti urutan berikut.

---

## Tahap 1

Pelajari terlebih dahulu:

- 01_SYSTEM_CONTEXT.md
- 02_DATABASE_ARCHITECTURE.md
- 03_REFACTOR_TASK.md

Pastikan memahami Business Rules sebelum melakukan perubahan.

---

## Tahap 2

Analisis source code existing.

Identifikasi:

- Struktur project.
- Arsitektur.
- Dependency.
- Alur data.
- Potensi bug.

---

## Tahap 3

Identifikasi file yang terdampak.

Contoh:

- Component
- Hook
- Service
- API
- Google Apps Script
- Database
- Utility
- Config

---

## Tahap 4

Analisis dampak.

Jelaskan:

- Dampak terhadap fitur lain.
- Risiko regression.
- Kebutuhan migration.
- Potensi bug baru.

---

## Tahap 5

Implementasi.

Lakukan perubahan seminimal mungkin.

Gunakan source code yang sudah ada.

---

## Tahap 6

Testing.

Pastikan seluruh fitur lama tetap berjalan.

---

## Tahap 7

Dokumentasi.

Apabila terdapat perubahan struktur.

Perbarui dokumentasi terkait.

---

# Aturan Refactor

Refactor berarti:

Memperbaiki kualitas internal kode tanpa mengubah perilaku aplikasi.

Jika perilaku aplikasi berubah.

Harus memiliki alasan bisnis yang jelas.

---

# Business Rules

Apabila terdapat konflik antara:

- Source Code
- Business Rules

Maka Business Rules memiliki prioritas lebih tinggi.

Namun AI wajib menjelaskan risiko perubahan sebelum implementasi.

---

# Offline First

Offline First merupakan fitur inti.

Tidak boleh dihilangkan.

Seluruh transaksi harus tetap dapat dilakukan tanpa internet.

Sinkronisasi dilakukan ketika koneksi tersedia.

---

# Database

Seluruh relasi wajib menggunakan ID.

Nama hanya digunakan sebagai informasi tampilan.

Tidak boleh membuat relasi menggunakan Nama.

---

# Konfigurasi

Seluruh konfigurasi harus berasal dari database.

Contoh:

- Prefix Resi
- Retry
- Status
- Version
- Role
- Config

Jangan melakukan hardcode.

---

# Foto Paket

Foto paket merupakan bagian dari SOP operasional.

Foto tidak boleh dihapus.

Tidak boleh dijadikan opsional.

Foto digunakan untuk:

- Pelacakan paket.
- Investigasi.
- Bukti operasional.

---

# Upload ke YoYi

Upload ke YoYi bukan membuat transaksi.

Upload hanya mengotomatisasi input nomor resi ke sistem resmi YoYi.

Apabila Batch API tidak tersedia.

Gunakan Browser Automation.

Contoh:

- Chrome Extension.
- Content Script.

Aplikasi tidak menggantikan YoYi.

---

# Import YoYi

Import YoYi bukan membuat transaksi.

Import hanya memperbarui status transaksi berdasarkan Nomor Resi.

Jika Nomor Resi tidak ditemukan.

Masukkan ke daftar:

**Resi Tidak Ditemukan**

Jangan membuat transaksi baru.

---

# Error Handling

Setiap Error wajib memiliki:

- Error Code
- Error Message
- Penyebab
- Solusi
- Retry Action

Jangan menggunakan:

Unknown Error

Sebagai pesan umum.

---

# Logging

Seluruh aktivitas penting wajib dicatat.

Minimal:

- Login
- Logout
- Scan
- Upload
- Import
- Export
- Sync
- Retry
- Delete
- Update Status
- ORDER CANCELLED

---

# Migration

Jika mengubah struktur database.

Migration wajib:

- Aman.
- Mendukung rollback.
- Tidak menghapus data lama.
- Tidak memerlukan input ulang pengguna.

---

# Coding Standard

Gunakan prinsip berikut.

- Clean Architecture
- Clean Code
- SOLID
- DRY
- KISS
- Separation of Concerns
- Modular Design
- Reusable Components

Prioritaskan keterbacaan dan kemudahan maintenance.

---

# Output Setiap Task

Untuk setiap TASK.

AI wajib memberikan output berikut.

## 1. Analisis

Ringkasan masalah dan tujuan perubahan.

---

## 2. File Terdampak

Daftar file yang akan diubah.

---

## 3. Rencana Implementasi

Jelaskan langkah implementasi secara singkat.

---

## 4. Implementasi

Lakukan perubahan sesuai rencana.

---

## 5. Dampak

Jelaskan dampak terhadap modul lain.

---

## 6. Migration

Jelaskan apabila ada perubahan database.

---

## 7. Testing Checklist

Buat checklist pengujian.

---

## 8. Risiko Regression

Jelaskan potensi risiko.

---

## 9. Dokumentasi

Sebutkan dokumen yang perlu diperbarui.

---

# Testing Checklist

Minimal lakukan pengujian berikut.

- Desktop
- Android
- Offline
- Online
- Slow Network
- Duplicate Data
- Invalid Data
- Empty Data
- Queue
- Retry
- Import
- Upload
- Sync

Jangan menganggap pekerjaan selesai tanpa checklist.

---

# Definition of Done

Sebuah TASK dianggap selesai apabila:

- Business Rules tetap benar.
- Tidak ada regression.
- Offline First tetap berjalan.
- Build berhasil.
- Tidak ada Error Console.
- Migration berhasil.
- Dokumentasi diperbarui.
- Testing Checklist selesai.
- Seluruh fitur lama tetap berjalan.

---

# Cara Berkomunikasi

Saat menerima sebuah TASK.

AI **tidak boleh langsung menulis kode**.

AI wajib:

1. Memahami kebutuhan.
2. Menganalisis source code.
3. Menjelaskan rencana implementasi.
4. Menunggu persetujuan apabila perubahan berdampak besar.
5. Baru mulai implementasi.

---

# Ruang Lingkup Task

Satu chat hanya mengerjakan **satu TASK**.

Jangan menggabungkan beberapa TASK dalam satu implementasi.

Apabila menemukan bug di luar TASK.

Catat sebagai rekomendasi.

Jangan memperbaikinya tanpa instruksi.

---

# Tujuan Akhir

Seluruh keputusan teknis harus mengarah pada terciptanya aplikasi yang:

- Cepat.
- Stabil.
- Mudah digunakan.
- Mudah dipelihara.
- Aman.
- Offline First.
- Berbasis otomatisasi.
- Tetap mengikuti SOP resmi J&T Express.

Seluruh perubahan harus meningkatkan kualitas aplikasi tanpa mengganggu operasional harian pengguna.