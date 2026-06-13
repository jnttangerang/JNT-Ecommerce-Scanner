/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppView, ScanRecord } from "./types";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ScannerScreen } from "./components/ScannerScreen";
import { OwnerScreen } from "./components/OwnerScreen";
import { dbService } from "./utils/db";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, X, Bell, RefreshCw } from "lucide-react";

export default function App() {
  const [currentView, setView] = useState<AppView>(() => {
    const savedView = localStorage.getItem("jt_current_view") as AppView;
    if (savedView === "SCANNER") {
      const savedOut = localStorage.getItem("jt_saved_outlet") || "";
      const savedSel = localStorage.getItem("jt_saved_seller") || "";
      const savedOp = localStorage.getItem("jt_saved_operator") || "";
      if (savedOut && savedSel && savedOp) {
        return "SCANNER";
      }
    }
    if (savedView === "OWNER_DASHBOARD" && localStorage.getItem("jt_owner_authenticated") === "true") {
      return "OWNER_DASHBOARD";
    }
    return "WELCOME";
  });

  const changeView = (view: AppView) => {
    setView(view);
    localStorage.setItem("jt_current_view", view);
  };

  // Selection state
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");

  // Sync state
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isCloudDataFresh, setIsCloudDataFresh] = useState<boolean>(() => {
    return localStorage.getItem("jt_is_cloud_data_fresh") === "true";
  });

  useEffect(() => {
    localStorage.setItem("jt_is_cloud_data_fresh", String(isCloudDataFresh));
  }, [isCloudDataFresh]);

  // Push notification state for "Order Cancelled" updates
  const [notifications, setNotifications] = useState<{ id: string; message: string; timestamp: string }[]>([]);

  const pullDatabaseFromCloud = async () => {
    const config = dbService.getCloudConfig();
    const hasAppsScript = config.appsScriptUrl && 
      !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && 
      !config.appsScriptUrl.includes("AKfycbz_Example");

    if (!hasAppsScript) return;

    setIsPulling(true);
    try {
      await dbService.pullMasters();
      await dbService.pullRecords();
      updatePendingCount();
      setIsCloudDataFresh(true);
    } catch (err) {
      console.warn("Manual pull from cloud failed", err);
      setIsCloudDataFresh(false);
    } finally {
      setIsPulling(false);
    }
  };

  // Load state on mount
  useEffect(() => {
    // Check initial offline preference
    const pref = dbService.getOfflinePreference();
    setIsOffline(pref);

    // Retrieve previous selected batch setup
    const savedOut = localStorage.getItem("jt_saved_outlet") || "";
    const savedSel = localStorage.getItem("jt_saved_seller") || "";
    const savedOp = localStorage.getItem("jt_saved_operator") || "";

    setSelectedOutlet(savedOut);
    setSelectedSeller(savedSel);
    setSelectedOperator(savedOp);

    updatePendingCount();

    // Auto pull data from Spreadsheet on startup if online and appsScriptUrl is configured
    const autoPullData = async () => {
      const config = dbService.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && 
        !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && 
        !config.appsScriptUrl.includes("AKfycbz_Example");
      
      if (hasAppsScript && !pref) {
        setIsPulling(true);
        try {
          await dbService.pullMasters();
          await dbService.pullRecords();
          updatePendingCount();
          setIsCloudDataFresh(true);
        } catch (err) {
          console.warn("Auto pull on startup failed, using local cache", err);
          setIsCloudDataFresh(false);
        } finally {
          setIsPulling(false);
        }
      } else {
        setIsCloudDataFresh(false);
      }
    };

    autoPullData();

    // Set up a periodic background sync simulation if online
    const interval = setInterval(() => {
      if (!isOffline && !isSyncing) {
        // Look for any pending check to auto sync
        const pending = dbService.getRecords().filter(r => r.SyncStatus === "PENDING").length;
        if (pending > 0) {
          silentSyncPending();
        }
      }
    }, 15000); // check ever 15 seconds

    return () => clearInterval(interval);
  }, [isOffline, isSyncing]);

  const updatePendingCount = () => {
    const records = dbService.getRecords();
    const pending = records.filter((r) => r.SyncStatus === "PENDING").length;
    setPendingCount(pending);

    // Automatically trigger upload if in online mode and records are pending
    if (!isOffline && pending > 0 && !isSyncing) {
      silentSyncPending();
    }
  };

  // Handles manual batch upload trigger ("Upload Sekarang")
  const triggerSync = async () => {
    if (isSyncing || pendingCount === 0) return;
    
    setIsSyncing(true);
    setSyncStatusText("Menghubungkan ke Google Apps Script API...");

    try {
      // Simulate real-time upload latency with visual alerts
      await new Promise(resolve => setTimeout(resolve, 800));
      setSyncStatusText("Mengupload foto resi terkompresi ke Google Drive...");
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setSyncStatusText("Menyisipkan entri rekaman data ke Google Spreadsheet 'Pickup Ecommerce'...");

      const stats = await dbService.syncPendingRecords();
      setSyncStatusText(`Sukses mensinkronkan ${stats.successCount} data paket pickup!`);
      
      // Keep successful prompt briefly
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error("Sync error", err);
      alert("Gagal mengupload: Pastikan konektivitas internet aktif.");
    } finally {
      setIsSyncing(false);
      setSyncStatusText("");
      updatePendingCount();
    }
  };

  // Auto/Silent Sync in background
  const silentSyncPending = async () => {
    try {
      await dbService.syncPendingRecords();
      updatePendingCount();
    } catch (e) {
      console.warn("Silent background sync failed, will retry", e);
    }
  };

  const handleStartScanning = (config: {
    outlet: string;
    seller: string;
    operator: string;
  }) => {
    // Cache setup parameters
    setSelectedOutlet(config.outlet);
    setSelectedSeller(config.seller);
    setSelectedOperator(config.operator);

    localStorage.setItem("jt_saved_outlet", config.outlet);
    localStorage.setItem("jt_saved_seller", config.seller);
    localStorage.setItem("jt_saved_operator", config.operator);

    changeView("SCANNER");
    updatePendingCount();
  };

  // Owner marked order as cancelled -> inform operators immediately!
  const handleOwnerUpdatedStatus = () => {
    const allRecords = dbService.getRecords();
    // Seek for latest cancelled orders to construct a beautiful push notification list
    const cancelledRecords = allRecords.filter(r => r.Status === "CANCELLED");
    if (cancelledRecords.length > 0) {
      const topCancelled = cancelledRecords[0];
      
      // Avoid duplicate notification IDs
      const id = `${topCancelled.Resi}-${topCancelled.ScanTimestamp}`;
      if (!notifications.some(n => n.id === id)) {
        const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        const newNotif = {
          id,
          message: `Dibatalkan: Resi *${topCancelled.Resi}* (Seller: ${topCancelled.Seller}) diubah menjadi CANCELLED oleh Owner! Jangan dikirim, kembalikan ke seller.`,
          timestamp: time
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 5)); // cap at 5 notifications
      }
    }
    updatePendingCount();
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none selection:bg-red-650 selection:text-white">
      {/* Header bar component */}
      <Header
        currentView={currentView}
        setView={(view) => {
          changeView(view);
          updatePendingCount();
        }}
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        pendingCount={pendingCount}
        triggerSync={triggerSync}
        isSyncing={isSyncing}
        selectedOperator={selectedOperator}
        isPulling={isPulling}
        onPullFromCloud={pullDatabaseFromCloud}
        isCloudDataFresh={isCloudDataFresh}
      />

      {/* Real-time push notification toaster alerts */}
      <div className="fixed top-20 right-4 z-50 pointer-events-none max-w-sm w-full space-y-2 px-4 sm:px-0">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-auto bg-zinc-900 border-2 border-red-500 rounded-xl p-4 shadow-2xl flex items-start space-x-3 text-xs relative max-w-sm"
              id={`push-notif-${notif.id}`}
            >
              <div className="bg-red-950 text-red-400 p-2 rounded-lg shrink-0 border border-red-900/40">
                <Bell className="h-4 w-4 animate-ring" />
              </div>
              <div className="flex-grow pr-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-red-500 tracking-wider">ORDER CANCELLED ALERT</span>
                  <span className="text-[10px] text-zinc-550 font-mono">{notif.timestamp}</span>
                </div>
                <p className="text-zinc-300 mt-1 leading-relaxed">
                  {notif.message.split("*").map((chunk, ind) => 
                    ind % 2 === 1 ? <strong key={ind} className="font-bold text-white font-mono">{chunk}</strong> : chunk
                  )}
                </p>
                <div className="mt-2 text-[10px] text-zinc-500 font-bold uppercase">
                  ✓ SINKRON OPERASIONAL J&T
                </div>
              </div>
              <button
                onClick={() => removeNotification(notif.id)}
                className="absolute right-2 top-2 text-zinc-550 hover:text-zinc-300 cursor-pointer p-1"
                title="Tutup dismissed alert"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow py-6 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {/* View routing router */}
            {currentView === "WELCOME" && (
              <WelcomeScreen
                onStartScanning={handleStartScanning}
                savedOutlet={selectedOutlet}
                savedSeller={selectedSeller}
                savedOperator={selectedOperator}
              />
            )}

            {currentView === "SCANNER" && (
              <ScannerScreen
                config={{
                  outlet: selectedOutlet,
                  seller: selectedSeller,
                  operator: selectedOperator
                }}
                onBack={() => changeView("WELCOME")}
                isOffline={isOffline}
                pendingCount={pendingCount}
                triggerSync={triggerSync}
                isSyncing={isSyncing}
                onRecordAdded={updatePendingCount}
                isPulling={isPulling}
                isCloudDataFresh={isCloudDataFresh}
              />
            )}

            {currentView === "OWNER_LOGIN" && (
              <OwnerScreen
                onStatusChanged={() => {
                  handleOwnerUpdatedStatus();
                }}
              />
            )}

            {currentView === "OWNER_DASHBOARD" && (
              <OwnerScreen
                onStatusChanged={() => {
                  handleOwnerUpdatedStatus();
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Syncing Global Modal HUD Overlay Block */}
      {isSyncing && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative h-14 w-14 mx-auto flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-zinc-150 font-bold uppercase tracking-wider text-xs">Singkronisasi Data</h3>
              <p className="text-[11px] text-zinc-400 font-mono">{syncStatusText}</p>
            </div>

            {/* Custom loader bar */}
            <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden p-0.5 border border-zinc-850">
              <div className="bg-amber-500 h-full rounded-full animate-[loading_2s_infinite] w-2/3" />
            </div>

            <p className="text-[10px] text-zinc-550 leading-relaxed pt-1">
              Data ditarik dari local storage, kemudian ditiupkan ke baris Google Sheet & Drive Cloud. Hal ini menghapus cache pending dan menghemat sisa memori HP.
            </p>
          </div>
        </div>
      )}

      {/* Deep workspace credit footnotes with respect to guidelines (Architechtural Honesty - No telemetry clutters, Humble and clean footer layout) */}
      <footer className="py-6 border-t border-zinc-900 text-center text-[11px] text-zinc-650 font-mono mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 J&T Express Tangerang Barat. All rights reserved.</span>
          <span className="flex items-center space-x-1">
            <span className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-bold font-sans">
              SERVER-SIDE AUTO ENGINE
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
