# 01_SYSTEM_CONTEXT.md

# J&T Pickup Scanner PRO
## System Context & Business Rules

**Version** : 1.0.0  
**Status** : Active Development  
**Document Type** : System Context  
**Last Update** : July 2026

---

# 1. Project Overview

J&T Pickup Scanner PRO adalah aplikasi operasional internal yang dikembangkan untuk membantu proses penerimaan, pengelolaan, monitoring, dan pickup paket ecommerce di Outlet / Mini Drop Point (MDP) J&T Express.

Aplikasi ini **bukan pengganti sistem resmi J&T Express** seperti YoYi maupun J&T Sprinter.

Peran aplikasi adalah menjadi **Automation Layer** yang mengurangi pekerjaan manual operator, meningkatkan akurasi data, mempercepat proses operasional, serta menyediakan dashboard monitoring yang terintegrasi.

Seluruh pengembangan wajib tetap mengikuti SOP resmi J&T Express.

---

# 2. Tujuan Pengembangan

Project ini dibuat untuk menyelesaikan berbagai permasalahan operasional yang terjadi setiap hari.

Target utama:

- Mengurangi pekerjaan manual operator.
- Mengurangi input data berulang.
- Mempercepat proses penerimaan paket ecommerce.
- Mengurangi human error.
- Menyediakan monitoring operasional secara realtime.
- Menyediakan dokumentasi foto paket.
- Menjaga hak komisi ecommerce outlet.
- Meningkatkan kualitas data operasional.

Project ini bukan sekadar aplikasi scanner, tetapi akan berkembang menjadi pusat operasional ecommerce outlet.

---

# 3. Permasalahan Operasional Saat Ini

Beberapa kendala yang terjadi di lapangan:

## Operator

- Harus scan resi menggunakan YoYi.
- Tetap harus memfoto paket.
- Mengirim foto ke WhatsApp Owner.
- Banyak pekerjaan dilakukan dua kali.
- Memori HP cepat penuh karena ribuan foto.

---

## Owner

- Harus scan ulang menggunakan J&T Sprinter.
- Sulit mengetahui paket mana yang sudah siap discan.
- Monitoring transaksi masih manual.
- Sulit mengetahui status sinkronisasi.
- Berisiko kehilangan komisi ecommerce apabila scan Sprinter didahului Gudang.

---

## Operasional

- Monitoring belum terpusat.
- Banyak proses manual.
- Sulit melakukan audit.
- Sulit mengetahui paket yang belum diproses.
- Sinkronisasi data belum optimal.

---

# 4. Solusi Yang Dibangun

J&T Pickup Scanner PRO akan menjadi pusat operasional ecommerce dengan kemampuan:

- Scanner Barcode
- Scanner QR Code
- Penyimpanan Foto
- Dashboard Monitoring
- Upload ke YoYi
- Import Status YoYi
- Sinkronisasi Data
- Upload Foto ke Google Drive
- Offline First
- Audit Log
- Reporting

Semua proses tersebut dilakukan dalam satu aplikasi.

---

# 5. Teknologi

## Frontend

- React
- TypeScript
- Vite

## Backend

- Google Apps Script

## Database

- Google Spreadsheet

## Local Database

- IndexedDB

## Cloud Storage

- Google Drive

## Deployment

- Vercel

---

# 6. Role Pengguna

Saat ini aplikasi memiliki dua role utama.

## Owner

Memiliki akses:

- Dashboard
- Monitoring
- Import YoYi
- Scan J&T Sprinter
- Master Data
- Pengaturan
- Audit
- Laporan

Owner tidak terlibat dalam proses penerimaan paket.

---

## Operator

Memiliki akses:

- Scan Paket
- Foto Paket
- Upload ke YoYi
- Daftar Scan
- Sinkronisasi
- Upload Foto

Operator tidak memiliki akses ke konfigurasi sistem.

---

Role lain dapat ditambahkan di masa depan tanpa mengubah arsitektur aplikasi.

---

# 7. Workflow Operasional Saat Ini

## Langkah 1

Seller datang ke Outlet / MDP.

---

## Langkah 2

Operator menerima paket.

---

## Langkah 3

Operator memfoto paket.

Foto paket wajib mencakup:

- Paket
- Resi

Foto digunakan sebagai bukti operasional apabila terjadi paket bermasalah atau diperlukan pelacakan oleh Gudang.

---

## Langkah 4

Operator melakukan **Penyerahan Skala Paket Besar** di YoYi.

Setelah berhasil, status paket berubah menjadi:

**Diserahkan**

---

## Langkah 5

Operator mencetak dokumen Serah Terima.

Dokumen tersebut ditandatangani oleh Supir Pickup sebagai bukti perpindahan paket dari Outlet menuju Gudang / DP.

---

## Langkah 6

Owner menerima barcode resi.

Biasanya melalui:

- Foto WhatsApp
- Foto Operator
- Tampilan Laptop (Whatsapp Web)

---

## Langkah 7

Owner melakukan scan menggunakan J&T Sprinter.

Scan dilakukan segera setelah status YoYi menjadi:

**Diserahkan**

Tujuannya agar barcode tidak lebih dahulu discan oleh Gudang sehingga outlet tetap memperoleh komisi ecommerce.

---

## Langkah 8

Paket diangkut menuju Gudang / DP.

---

# 8. Workflow Target

Workflow baru yang ingin dicapai.

## Langkah 1

Seller datang ke Outlet.

---

## Langkah 2

Operator membuka aplikasi J&T Pickup Scanner PRO.

---

## Langkah 3

Operator hanya memfoto paket.

Aplikasi otomatis:

- Membaca Barcode Code128.
- Membaca QR Code.
- Mengambil Nomor Resi.
- Menyimpan transaksi.
- Menyimpan foto.

Operator tidak lagi melakukan scan manual di Aplikasi YoYi.

---

## Langkah 4

Operator menekan tombol:

**Upload ke YoYi**

Aplikasi mengotomatisasi proses input nomor resi ke halaman Scan Masuk Gudang YoYi.

---

## Langkah 5

Operator melakukan Penyerahan Skala Paket Besar di YoYi.

---

## Langkah 6

Operator mencetak Serah Terima.

---

## Langkah 7

Owner melihat daftar resi yang siap discan melalui Dashboard.

---

## Langkah 8

Owner melakukan scan menggunakan J&T Sprinter.

---

## Langkah 9

Paket dibawa menuju Gudang / DP.

---

# 9. Business Rules

## Rule 1

Foto paket merupakan bagian dari SOP operasional.

Foto **tidak boleh dihilangkan**.

---

## Rule 2

Nomor resi adalah identitas utama transaksi.

Seluruh proses menggunakan Nomor Resi sebagai identitas operasional.

---

## Rule 3

Owner tidak boleh melakukan scan J&T Sprinter sebelum status paket menjadi:

**Diserahkan**

---

## Rule 4

Setelah status menjadi Diserahkan, Owner harus segera melakukan scan J&T Sprinter.

Semakin cepat dilakukan, semakin kecil risiko barcode didahului scan Gudang.

---

## Rule 5

Import YoYi **bukan membuat transaksi baru**.

Import hanya digunakan untuk memperbarui status transaksi yang sudah ada.

---

## Rule 6

Upload ke YoYi adalah proses otomatisasi browser.

Aplikasi membantu operator melakukan input lebih cepat tanpa mengubah sistem resmi YoYi.

---

## Rule 7

Seluruh transaksi harus tetap dapat dilakukan ketika internet terputus.

Sinkronisasi dilakukan setelah koneksi tersedia.

---

# 10. Mapping Status YoYi

## Status Paket

- Untuk Diserahkan
- Diserahkan

## Status Waybill

- Belum di ambil
- Sudah Pickup

Makna operasional:

### Untuk Diserahkan

Nomor resi telah berhasil masuk ke YoYi namun belum dilakukan Penyerahan Skala Paket Besar.

Owner belum boleh melakukan scan J&T Sprinter.

---

### Diserahkan

Penyerahan Skala Paket Besar telah selesai.

Owner sudah boleh melakukan scan J&T Sprinter.

---

### Belum di ambil

Belum dilakukan scan menggunakan J&T Sprinter.

---

### Sudah Pickup

Owner telah melakukan scan menggunakan J&T Sprinter.

Marketplace seller akan memperbarui status menjadi "Paket Sudah Pickup".

Saat ini aplikasi **tidak perlu mendukung status YoYi lainnya**.

---

# 11. Scope Aplikasi

Aplikasi menangani proses berikut:

- Scan Barcode
- Scan QR Code
- Penyimpanan Foto
- Dashboard
- Upload ke YoYi
- Import YoYi
- Monitoring Outlet
- Monitoring Operator
- Monitoring Seller
- Sinkronisasi
- Upload Foto
- Audit Log
- Reporting

Aplikasi **bukan** sistem pengiriman dan **bukan** pengganti YoYi maupun J&T Sprinter.

---

# 12. Visi Jangka Panjang

J&T Pickup Scanner PRO dirancang sebagai pusat operasional ecommerce untuk Outlet J&T Express.

Target akhirnya adalah:

- Satu aplikasi untuk seluruh operasional pickup ecommerce.
- Mengurangi pekerjaan manual operator.
- Meminimalkan human error.
- Menyediakan dashboard operasional yang lengkap.
- Mempermudah monitoring Owner.
- Memastikan seluruh proses tetap sesuai SOP resmi J&T Express.
- Memiliki arsitektur yang mudah dikembangkan seiring pertumbuhan jumlah Outlet, Operator, dan Seller.

Seluruh pengembangan berikutnya harus mengacu pada visi tersebut dan tidak mengubah Business Rules yang telah ditetapkan dalam dokumen ini.