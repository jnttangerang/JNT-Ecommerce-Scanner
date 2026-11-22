/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, Truck, Wifi, WifiOff, RefreshCw, Layers, Package } from "lucide-react";
import { AppView } from "../types";
import { dbService } from "../utils/db";

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  isOffline: boolean;
  setIsOffline: (val: boolean) => void;
  pendingCount: number;
  triggerSync: () => void;
  isSyncing: boolean;
  selectedOperator: string;
  isPulling?: boolean;
  onPullFromCloud?: () => void;
  isCloudDataFresh?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setView,
  isOffline,
  setIsOffline,
  pendingCount,
  triggerSync,
  isSyncing,
  selectedOperator,
  isPulling = false,
  onPullFromCloud,
  isCloudDataFresh = false
}) => {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOffline = () => {
    const nextState = !isOffline;
    setIsOffline(nextState);
    dbService.setOfflinePreference(nextState);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
        {/* Row 1 (Mobile) / Left (Desktop): Brand Logo and Title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => setView("WELCOME")}>
            <div className="bg-red-600 text-white rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 font-bold tracking-widest text-sm sm:text-lg flex items-center justify-center shadow-sm">
              J&T
            </div>
            <div className="leading-tight">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex items-center uppercase">
                <span>Pickup Scanner Pro</span>
                <span className="ml-1.5 sm:ml-2 bg-red-50 text-red-600 border border-red-200 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  E-COMM
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">Tangerang Barat •</p>
            </div>
          </div>

          {selectedOperator && currentView === "SCANNER" && (
            <div className="flex md:hidden items-center space-x-1 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-[10px] text-slate-700">
              <span className="text-slate-400 font-bold">Op:</span>
              <span className="text-slate-900 font-bold max-w-[75px] truncate">{selectedOperator}</span>
            </div>
          )}
        </div>

        {/* Row 2 (Mobile) / Right (Desktop): Time, Sync, Tarik Sheet, SYNCED, ONLINE/OFFLINE + Desktop Nav */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2.5 pt-1.5 border-t border-slate-100 md:pt-0 md:border-t-0 flex-wrap">
          {/* Real-time Clock (Visible on Mobile & Desktop) */}
          <div className="flex items-center md:flex-col md:items-end gap-1 md:gap-0 md:mr-1 font-mono text-[11px] sm:text-xs text-slate-500">
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold">TIME</span>
            <span className="font-semibold text-slate-700 tabular-nums">{currentTime}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Sync Button for Offline Storage */}
            {pendingCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className={`flex items-center space-x-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold select-none transition-all ${
                  isSyncing
                    ? "bg-amber-100 text-amber-700 border border-amber-200 cursor-wait"
                    : "bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-sm animate-pulse"
                }`}
                id="sync-button"
              >
                <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Sync..." : `Sync (${pendingCount})`}</span>
              </button>
            )}

            {/* Tarik Sheet Button to Fetch Live Data if Apps Script is configured */}
            {(() => {
              const config = dbService.getCloudConfig();
              const hasAppsScript = config.appsScriptUrl && 
                !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && 
                !config.appsScriptUrl.includes("AKfycbz_Example");
              if (!hasAppsScript) return null;
              return (
                <button
                  onClick={onPullFromCloud}
                  disabled={isPulling || isOffline}
                  className={`flex items-center justify-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-semibold select-none transition-all ${
                    isPulling
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-wait"
                      : isOffline
                      ? "bg-slate-50 text-slate-350 border-slate-150 cursor-not-allowed"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 active:scale-95 cursor-pointer"
                  }`}
                  title="Tarik/Seleraskan Data Master & Resi dari Spreadsheet"
                  id="pull-from-cloud-button"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isPulling ? "animate-spin text-amber-500" : "text-slate-500"}`} />
                  <span className="ml-1 sm:ml-1.5 text-slate-705 whitespace-nowrap">Tarik Sheet</span>
                </button>
              );
            })()}

            {/* Synced vs Stale Local Cache Indicator Badge */}
            {(() => {
              const isDataRealtime = !isOffline && pendingCount === 0 && isCloudDataFresh;
              return isDataRealtime ? (
                <div 
                  className="flex items-center space-x-1 sm:space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold select-none"
                  title="Data di aplikasi Anda 100% sinkron dan up-to-date dengan Spreadsheet cloud!"
                  id="synced-cloud-badge"
                >
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>SYNCED</span>
                </div>
              ) : (
                <div 
                  className="flex items-center space-x-1 sm:space-x-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold select-none"
                  title="Menampilkan data cache lokal (Stale). Klik tombol 'Tarik Sheet' atau hubungkan jaringan untuk memuat ulang."
                  id="stale-cache-badge"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-[pulse_1.5s_infinite] flex-shrink-0" />
                  <span>STALE</span>
                </div>
              );
            })()}

            {/* Interactive Network status toggle */}
            <button
              onClick={handleToggleOffline}
              className={`flex items-center space-x-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium transition-colors select-none ${
                isOffline
                  ? "bg-slate-50 text-slate-500 border-slate-200 hover:border-red-600 hover:text-red-600"
                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100/70"
              }`}
              title={isOffline ? "Mode Offline Aktif (Simulasi Offline)" : "Mode Online Aktif"}
              id="network-status-toggle"
            >
              {isOffline ? (
                <>
                  <WifiOff className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-450 flex-shrink-0" />
                  <span>OFFLINE</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600 animate-pulse flex-shrink-0" />
                  <span>ONLINE</span>
                </>
              )}
            </button>

            {/* Operator Context badge (Desktop) */}
            {selectedOperator && currentView === "SCANNER" && (
              <div className="hidden md:flex items-center space-x-1 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-700">
                <span className="text-slate-450 font-bold">Op:</span>
                <span className="text-slate-900 font-bold max-w-[80px] truncate">{selectedOperator}</span>
              </div>
            )}

            {/* View switcher (Desktop only — Mobile uses Bottom Navigation) */}
            <div className="hidden md:flex bg-slate-100 border border-slate-200 rounded-lg p-1" id="view-mode-selector">
              <button
                onClick={() => setView("WELCOME")}
                className={`p-1.5 rounded-md text-xs flex items-center space-x-1 transition-all ${
                  currentView === "WELCOME" || currentView === "SCANNER"
                    ? "bg-red-600 text-white shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
                title="Portal Operator Scan"
              >
                <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Scan</span>
              </button>
              <button
                onClick={() => setView("RETUR")}
                className={`p-1.5 rounded-md text-xs flex items-center space-x-1 transition-all ${
                  currentView === "RETUR"
                    ? "bg-red-600 text-white shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
                title="Paket Retur"
              >
                <Package className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Retur</span>
              </button>
              <button
                onClick={() => setView(currentView === "OWNER_DASHBOARD" ? "OWNER_DASHBOARD" : "OWNER_LOGIN")}
                className={`p-1.5 rounded-md text-xs flex items-center space-x-1 transition-all ${
                  currentView === "OWNER_LOGIN" || currentView === "OWNER_DASHBOARD"
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
                title="Portal Owner Review"
              >
                <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Owner</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
