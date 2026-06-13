/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StatusType = "SCANNED" | "CANCELLED";

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
  SyncStatus: "PENDING" | "SYNCED";
  ScanTimestamp: number; // for sorting
  RetakeStatus?: "PENDING" | "RETAKEN";
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
