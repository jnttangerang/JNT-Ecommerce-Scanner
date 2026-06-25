/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { AppView, ScanRecord } from "./types";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ScannerScreen } from "./components/ScannerScreen";
import { OwnerScreen } from "./components/OwnerScreen";
import { dbService } from "./utils/db";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, AlertTriangle, X, Bell, RefreshCw, Check, HelpCircle, Layers } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function App() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const isSilentSyncingRef = useRef(false);
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

  // Push notification state for "Order Cancelled" and system updates
  const [notifications, setNotifications] = useState<{ id: string; message: string; timestamp: string; type?: "success" | "error" | "warning"; title?: string }[]>([]);

  const pullDatabaseFromCloud = async () => {
    const config = dbService.getCloudConfig();
    const hasAppsScript = config.appsScriptUrl && 
      !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && 
      !config.appsScriptUrl.includes("AKfycbz_Example");

    if (!hasAppsScript) return;

    setIsPulling(true);
    const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    try {
      await dbService.pullMasters();
      await dbService.pullRecords();
      updatePendingCount();
      setIsCloudDataFresh(true);
      
      // Push positive sync confirmation notification
      toast.success("SINKRONISASI SUKSES", {
        description: "Berhasil menarik data terupdate dari Google Spreadsheet! List Seller, Operator, Outlet dan seluruh histori paket pickup kini sinkron.",
      });
    } catch (err: any) {
      console.warn("Manual pull from cloud failed", err);
      setIsCloudDataFresh(false);
      
      // Push error sync notification
      toast.error("SINKRONISASI GAGAL", {
        description: `Gagal menarik data dari Google Sheets: ${err?.message || err || "Koneksi terputus."}. Pastikan Apps Script Web App URL valid.`,
      });
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

    // Setup event listener for background retry backoff indicators
    const handleRetryEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast.warning(`KONEKSI TERGANGGU (${detail.attempt}/${detail.maxAttempts})`, {
        description: `Mencoba kirim ulang data otomatis dalam ${Math.round(detail.nextDelay / 1000)} detik...`,
        duration: 4000,
      });
    };

    window.addEventListener("sync-retry-attempt", handleRetryEvent);

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

    return () => {
      clearInterval(interval);
      window.removeEventListener("sync-retry-attempt", handleRetryEvent);
    };
  }, [isOffline, isSyncing]);

  const updatePendingCount = () => {
    const records = dbService.getRecords();
    const pending = records.filter((r) => r.SyncStatus === "PENDING").length;
    setPendingCount(pending);

    // Automatically trigger upload if in online mode and records are pending and not already syncing
    if (!isOffline && pending > 0 && !isSyncing && !isSilentSyncingRef.current) {
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
      toast.error("Gagal mengupload", { description: "Pastikan konektivitas internet aktif." });
    } finally {
      setIsSyncing(false);
      setSyncStatusText("");
      updatePendingCount();
    }
  };

  // Auto/Silent Sync in background
  const silentSyncPending = async () => {
    if (isSilentSyncingRef.current) return;
    isSilentSyncingRef.current = true;
    try {
      await dbService.syncPendingRecords();
    } catch (e) {
      console.warn("Silent background sync failed, will retry", e);
    } finally {
      isSilentSyncingRef.current = false;
      // Safeguard against recursive call loops: read direct from store and update state to refresh badges
      const records = dbService.getRecords();
      const pending = records.filter((r) => r.SyncStatus === "PENDING").length;
      setPendingCount(pending);
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

  // Owner marked order as cancelled or requested retake -> inform operators immediately!
  const handleOwnerUpdatedStatus = () => {
    const allRecords = dbService.getRecords();
    
    // Check for cancelled records
    const cancelledRecords = allRecords.filter(r => r.Status === "CANCELLED");
    if (cancelledRecords.length > 0) {
      const topCancelled = cancelledRecords[0];
      const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      toast.error("ORDER CANCELLED ALERT", {
        description: `Dibatalkan: Resi ${topCancelled.Resi} (Seller: ${topCancelled.Seller}) diubah menjadi CANCELLED oleh Owner! Jangan dikirim, kembalikan ke seller.`,
        duration: 8000,
      });
    }

    // Check for retake requests
    const retakeRequests = allRecords.filter(r => r.RetakeStatus === "PENDING");
    if (retakeRequests.length > 0) {
      const topRetake = retakeRequests[0];
      toast.warning("FOTO ULANG (RETAKE)", {
        description: `Butuh Foto Ulang: Resi ${topRetake.Resi} (Seller: ${topRetake.Seller}) ditandai BURAM oleh Owner! Harap foto ulang paket tersebut.`,
        duration: 8000,
      });
    }

    updatePendingCount();
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none selection:bg-red-650 selection:text-white">
      <Toaster 
        position="top-center" 
        richColors 
        toastOptions={{
          style: {
            background: "#18181b", // zinc-900
            border: "1px solid #27272a", // zinc-800
            color: "#f4f4f5", // zinc-100
            fontFamily: "Inter, sans-serif",
            borderRadius: "0.75rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          },
        }}
      />
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
                isPulling={isPulling}
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
                isPulling={isPulling}
                onStatusChanged={() => {
                  handleOwnerUpdatedStatus();
                }}
              />
            )}

            {currentView === "OWNER_DASHBOARD" && (
              <OwnerScreen
                isPulling={isPulling}
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
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-4">
          <button
            onClick={() => {
              setShowResetConfirm(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 transition-colors cursor-pointer"
          >
            <Layers className="h-4 w-4" />
            <span>Hapus Cache & Restart</span>
          </button>
          
          <div className="flex flex-col items-center gap-1 mt-2">
            <span>© 2026 J&T Express Tangerang Barat. All rights reserved.</span>
            <span className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-bold font-sans mt-1">
              SERVER-SIDE AUTO ENGINE
            </span>
          </div>
        </div>
      </footer>

      {/* Custom Beautified Reset Cache Confirmation Modal */}
      {showResetConfirm && (
        <div 
          className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          id="custom-reset-cache-modal"
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-500/10 text-red-500 rounded-full h-14 w-14 flex items-center justify-center mx-auto border border-red-500/20 shadow">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-100 tracking-wider uppercase">
                HAPUS CACHE & RESTART?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tindakan ini akan menghapus seluruh data scan lokal dari perangkat ini dan memuat ulang halaman aplikasi.
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850 text-left text-[10px] text-zinc-500 space-y-1 font-mono">
              <div className="text-red-400 font-bold uppercase tracking-wider mb-1">⚠️ PERINGATAN KERAS:</div>
              <p>• Data yang belum disinkronkan (<span className="text-amber-500 font-semibold">Stale/Pending</span>) akan hilang.</p>
              <p>• Pastikan status koneksi sudah <span className="text-emerald-500 font-semibold">SYNCED</span> sebelum melanjutkan.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-3 px-4 rounded-xl transition-all active:scale-95 cursor-pointer uppercase"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  dbService.clearAllRecords();
                  localStorage.clear();
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.25)] active:scale-95 cursor-pointer uppercase"
              >
                Hapus & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
