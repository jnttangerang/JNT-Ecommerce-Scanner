
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StatusType = "SCANNED" | "DISERAHKAN" | "PICKUP" | "CANCELLED";
export type SyncStatusType = "PENDING" | "UPLOADING" | "SYNCED" | "FAILED";

export interface ScanRecord {
  ID: string;
  Tanggal: string;
  Jam: string;
  Resi: string;
  Outlet: string;
  Seller: string;
  Operator: string;
  Status: StatusType;
  PhotoURL: string; // Base64 data-uri or simulated URL
  SyncStatus: SyncStatusType;
  ScanTimestamp: number; // for sorting
  RetakeStatus?: string;
  alertStatus?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  PackageStatus?: string;
  WaybillStatus?: string;
  WaktuSerahTerima?: string;
  ReviewStatus?: string;
  AlertStatus?: string;
  CancelStatus?: string;
  CancelEvidencePhoto?: string;
  CancelHandledBy?: string;
  CancelHandledAt?: string;
  CancelRemark?: string;
}

export interface ImportLog {
  id: string;
  timestamp: number;
  dateStr: string;
  importedBy: string;
  successCount: number;
  failedCount: number;
}



export interface Outlet {
  NamaOutlet: string;
}

export interface Operator {
  NamaOperator: string;
}

export type AppView = "WELCOME" | "SCANNER" | "OWNER_LOGIN" | "OWNER_DASHBOARD" | "RETUR";

export type ReturStatus = "DITERIMA" | "DISERAHKAN";
export type ReturKondisi = "Baik" | "Rusak" | "Segel terbuka";
export type ReturMetode = "AMBIL_DI_OUTLET" | "ANTAR_KE_SELLER";

export const RETUR_STATUS = {
  DITERIMA: "DITERIMA" as const,
  DISERAHKAN: "DISERAHKAN" as const
};

export const RETUR_KONDISI = {
  BAIK: "Baik" as const,
  RUSAK: "Rusak" as const,
  SEGEL_TERBUKA: "Segel terbuka" as const
};
export const RETUR_KONDISI_LIST: ReturKondisi[] = ["Baik", "Rusak", "Segel terbuka"];

export const RETUR_METODE = {
  AMBIL_DI_OUTLET: "AMBIL_DI_OUTLET" as const,
  ANTAR_KE_SELLER: "ANTAR_KE_SELLER" as const
};
export const RETUR_METODE_LIST: { id: ReturMetode; label: string }[] = [
  { id: "AMBIL_DI_OUTLET", label: "Ambil di Outlet" },
  { id: "ANTAR_KE_SELLER", label: "Antar ke Seller" }
];

export interface ReturRecord {
  ReturID: string;
  Resi: string;
  SellerID: string;
  Seller: string;
  Outlet: string;
  Sumber: string;
  TglDatang: string; // Sesi kedatangan paket (YYYY-MM-DD)
  TglTerima: string;
  JamTerima: string;
  AdminTerima: string;
  Kondisi: ReturKondisi;
  IsiPaket?: string; // Keterangan isi paket per resi (maks 60 char)
  FotoTerimaURL: string;
  Status: ReturStatus;
  HandoverID?: string;
  Catatan?: string;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt?: string;
  SyncStatus?: SyncStatusType;
}

export interface ReturHandover {
  HandoverID: string;
  SellerID: string;
  Seller: string;
  Outlet: string;
  TglSerah: string;
  JamSerah: string;
  AdminSerah: string;
  Metode: ReturMetode;
  JumlahPaket: number;
  DaftarResi: string | string[];
  NamaPenerima: string;
  FotoBuktiURL: string;
  Catatan?: string;
  CreatedAt: string;
  DeletedAt?: string;
  SyncStatus?: SyncStatusType;
}

export interface DashboardStats {
  sellerDaily: Record<string, { count: number; totalWeight?: number }>;
  outletDaily: Record<string, number>;
}

export interface Seller {
  id: string;
  kodeSeller: string;
  nama: string;
  kategoriProduk?: string;
  noHp?: string;
  alamat?: string;
  gps?: string;
  statusAktif: 'ACTIVE' | 'INACTIVE';
  targetHarian?: number;
  catatan?: string;
  updatedAt?: string;
  createdAt?: string;
  syncStatus?: 'SYNCED' | 'PENDING' | 'ERROR';
}
