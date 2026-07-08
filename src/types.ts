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
  RetakeStatus?: "PENDING" | "RETAKEN";
  alertStatus?: "PENDING" | "CONFIRMED";
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface ImportLog {
  id: string;
  timestamp: number;
  dateStr: string;
  importedBy: string;
  successCount: number;
  failedCount: number;
}

export interface Seller {
  NamaSeller: string;
}

export interface Outlet {
  NamaOutlet: string;
}

export interface Operator {
  NamaOperator: string;
}

export type AppView = "WELCOME" | "SCANNER" | "OWNER_LOGIN" | "OWNER_DASHBOARD";

export interface DashboardStats {
  sellerDaily: Record<string, { count: number; totalWeight?: number }>;
  outletDaily: Record<string, number>;
}
