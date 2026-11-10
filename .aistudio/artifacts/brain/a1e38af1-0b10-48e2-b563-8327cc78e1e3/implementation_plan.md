# Penyesuaian Fitur Paket Retur (Admin Penerima, Seller Dropdown, & Hapus Sumber)

Rencana penyesuaian alur kerja operasional fitur Paket Retur di outlet: menambahkan identitas Admin/Operator penerima pada form Terima Retur (otomatis terisi dari sesi aktif dengan opsi ganti langsung), menyederhanakan tampilan dropdown seller agar hanya menampilkan nama toko/seller tanpa kode, serta menghapus kolom Sumber Pengiriman (DP/Gudang) dari form input dan daftar riwayat.

## User Review & Critical Decisions

> [!IMPORTANT] Ringkasan keputusan hasil klarifikasi:
> - **Identitas Admin/Operator Penerima**: Diambil otomatis dari operator yang sedang aktif login di aplikasi, dengan kontrol dropdown/ganti operator langsung di panel form Terima Retur agar fleksibel saat pergantian shift.
> - **Penghapusan Sumber Pengiriman**: Dihilangkan sepenuhnya dari form input "Terima Retur" dan tampilan badge/kartu "Daftar Retur", serta dilepaskan dari validasi wajib simpan di sisi klien dan server.
> - **Penyederhanaan Dropdown Seller**: Menghilangkan label kode seller `(KS-...)` atau `(Master)`, sehingga opsi murni menampilkan nama toko/seller saja untuk kemudahan visual admin.

---

## 1. Overview & Core Concept

- **Apa yang disesuaikan**:
  1. **Form Terima Retur**: Menyederhanakan form dengan menghapus kolom "Sumber Pengirim (Gudang/DP)" dan menambahkan pemilih/penampil "Petugas Penerima (Admin/Operator)" yang otomatis terisi dari akun aktif dengan kemampuan ganti nama petugas langsung.
  2. **Dropdown Seller**: Menghilangkan teks tambahan kode seller seperti `(KS-XXX)` atau `(Master)` pada menu dropdown pemilihan seller di form Terima Retur, Serah ke Seller, dan filter Daftar Retur.
  3. **Tampilan Daftar Retur**: Menghapus teks/badge sumber pengirim pada kartu riwayat, dan menegaskan badge identitas admin penerima (`AdminTerima`).
- **Target Pengguna**: Admin outlet dan operator scanner J&T Tangerang Barat saat mencatat paket retur datang dan serah terima ke toko/seller.
- **Nilai Manfaat**: Proses scan terima paket retur lebih cepat tanpa perlu mengetik ulang gudang asal, akuntabilitas petugas penerima tercatat akurat per shift, dan dropdown seller lebih bersih dan mudah dibaca.

---

## 2. User Experience & Visual Design

### Alur Form Terima Retur (Alur A)
1. **Panel Sesi & Petugas (Bagian Atas)**:
   - Menampilkan tanggal kedatangan paket (Sesi Kedatangan).
   - Menampilkan nama Admin/Operator penerima yang aktif dengan tombol/dropdown "Ganti Petugas". Petugas yang dipilih disimpan ke sesi lokal dan disematkan ke setiap paket yang di-scan.
2. **Scan Resi & Autofill Seller**:
   - Petugas scan atau ketik resi paket retur.
   - Dropdown seller tujuan menampilkan daftar nama seller bersih: `[Nama Toko]` tanpa imbuhan kode.
3. **Penyimpanan**:
   - Kolom "Sumber Pengirim" ditiadakan dari form dan validasi wajib dihilangkan.
   - Admin hanya perlu mengambil foto fisik kondisi paket dan menekan "Simpan Paket Retur Masuk".
4. **Daftar Retur (Tab 4)**:
   - Kartu menampilkan: No Resi, Nama Seller, Tanggal & Jam Terima, Petugas Penerima (`AdminTerima`), Kondisi Paket, dan Isi Paket. Tidak ada lagi label "Sumber Pengirim".

---

## 3. Key Product Decisions & Trade-Offs

- **Penetapan AdminTerima**:
  - *Pendekatan*: Default ke `currentOperator` dari sesi Welcome/Login, namun menyediakan state lokal `terimaOperator` di dalam `ReturScreen` dengan daftar operator dari `Config` (Master Operator).
  - *Alasan*: Operator outlet sering bergantian meja scan tanpa logout penuh dari aplikasi. Pilihan langsung di form menjaga data akurat tanpa mengganggu sesi utama.
- **Backward Compatibility Data Lama**:
  - Kolom `Sumber` di database spreadsheet (`DATA_RETUR`) tetap dipertahankan pada header kolom agar struktur file historis tidak rusak, namun nilai untuk rekaman baru diisi string kosong `""` atau `"-"` secara transparan.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   App.tsx (Sesi Login)                │
│             currentOperator: "M. DANANG"               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                    ReturScreen.tsx                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Panel Sesi:                                      │  │
│  │ • Tanggal Kedatangan: [YYYY-MM-DD]               │  │
│  │ • Petugas Penerima: [Select Operator / M. DANANG]│  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Form Scan & Input:                               │  │
│  │ • Resi: [SCAN / INPUT]                           │  │
│  │ • Seller: [Dropdown: Murni Nama Toko]           │  │
│  │ • (Sumber Pengirim: DIHAPUS)                     │  │
│  │ • Kondisi: [Baik / Rusak / Terbuka]              │  │
│  │ • Isi Paket: [Input Opsional]                    │  │
│  │ • Foto: [Ambil Kamera]                           │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                             │
│                          ▼                             │
│             dbService.addRetur(...)                    │
│      (adminTerima = terimaOperator, sumber = "")       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│        IndexedDB (JnTScannerDB) & Google Sheets        │
│       Field: AdminTerima tercatat, Sumber = ""         │
└────────────────────────────────────────────────────────┘
```

### Rincian Perubahan File:
1. `src/components/ReturScreen.tsx`:
   - Tambah state `terimaOperator` (inisialisasi dari `currentOperator || operators[0] || "Admin Outlet"`).
   - Tambah komponen pemilih operator pada bar Sesi Kedatangan form Terima Retur.
   - Hapus state `terimaSumber` dan elemen `<input>` Sumber Pengirim (Gudang/DP).
   - Hapus validasi `if (!terimaSumber.trim())` pada `handleSubmitTerima`.
   - Modifikasi pemanggilan `dbService.addRetur`: kirim `sumber: ""` dan `adminTerima: terimaOperator`.
   - Modifikasi opsi dropdown seller: `{s.nama}` (hapus `({s.kodeSeller || "Master"})`).
   - Pada kartu Tab "DAFTAR", hapus badge/label `r.Sumber`.
2. `src/utils/db.ts`:
   - Ubah validasi `addRetur`: hapus blok pengecekan wajib `params.sumber` agar tidak menolak string kosong.
   - Fallback `sumber: (params.sumber || "").trim()`.
3. `Kode.gs`:
   - Pastikan `r.Sumber || ""` tetap aman ditulis ke baris spreadsheet tanpa error.
