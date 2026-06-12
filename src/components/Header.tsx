/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, Truck, Wifi, WifiOff, RefreshCw, Layers } from "lucide-react";
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
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setView,
  isOffline,
  setIsOffline,
  pendingCount,
  triggerSync,
  isSyncing,
  selectedOperator
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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo and Title */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView("WELCOME")}>
          <div className="bg-red-600 text-white rounded-lg px-2.5 py-1.5 font-bold tracking-widest text-lg flex items-center justify-center shadow-sm">
            J&T
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center uppercase">
              Pickup Scanner Pro
              <span className="ml-2 bg-red-50 text-red-600 border border-red-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                E-COMM
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Tangerang Barat •</p>
          </div>
        </div>

        {/* Status Indicators & Navigation Menu */}
        <div className="flex items-center space-x-3">
          {/* Real-time Clock (Desktop-friendly) */}
          <div className="hidden md:flex flex-col items-end mr-2 font-mono text-xs text-slate-500">
            <span className="text-slate-400 text-[10px] font-bold">TIME</span>
            <span className="font-semibold text-slate-700">{currentTime}</span>
          </div>

          {/* Sync Button for Offline Storage */}
          {pendingCount > 0 && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all ${
                isSyncing
                  ? "bg-amber-100 text-amber-700 border border-amber-200 cursor-wait"
                  : "bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-sm animate-pulse"
              }`}
              id="sync-button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Sync..." : `Sync (${pendingCount})`}</span>
            </button>
          )}

          {/* Interactive Network status toggle */}
          <button
            onClick={handleToggleOffline}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors select-none ${
              isOffline
                ? "bg-slate-50 text-slate-500 border-slate-200 hover:border-red-600 hover:text-red-600"
                : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100/70"
            }`}
            title={isOffline ? "Mode Offline Aktif (Simulasi Offline)" : "Mode Online Aktif"}
            id="network-status-toggle"
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-slate-450" />
                <span className="hidden sm:inline">OFFLINE MODE</span>
                <span className="inline sm:hidden font-bold">OFF</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-600 animate-pulse" />
                <span className="hidden sm:inline">ONLINE SYNC</span>
                <span className="inline sm:hidden font-bold">ON</span>
              </>
            )}
          </button>

          {/* Operator Context badge */}
          {selectedOperator && currentView === "SCANNER" && (
            <div className="hidden sm:flex items-center space-x-1 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-700">
              <span className="text-slate-450 font-bold">Op:</span>
              <span className="text-slate-900 font-bold max-w-[80px] truncate">{selectedOperator}</span>
            </div>
          )}

          {/* View switcher (Operator <-> Owner) */}
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1" id="view-mode-selector">
            <button
              onClick={() => setView("WELCOME")}
              className={`p-1.5 rounded-md text-xs flex items-center space-x-1 transition-all ${
                currentView === "WELCOME" || currentView === "SCANNER"
                  ? "bg-red-600 text-white shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-900 font-medium"
              }`}
              title="Portal Operator Scan"
            >
              <Truck className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Operator</span>
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
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Owner</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
