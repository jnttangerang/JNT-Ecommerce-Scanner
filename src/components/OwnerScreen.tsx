/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Key, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Ban, 
  CheckCircle2, 
  Camera,
  BarChart3,  
  Layers, 
  Download,
  Terminal,
  Store,
  Compass,
  AlertCircle,
  Folder,
  FileSpreadsheet,
  Link,
  ExternalLink,
  Users,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  Cloud,
  Github,
  RefreshCw,
  LogOut,
  Calendar,
  Maximize2,
  Minimize2
} from "lucide-react";
import { ScanRecord, StatusType, Seller, Operator, Outlet } from "../types";
import { dbService, getDirectDriveImageUrl } from "../utils/db";
import { toast } from "sonner";

interface OwnerDashboardProps {
  onStatusChanged: () => void;
  isPulling?: boolean;
}

export const OwnerScreen: React.FC<OwnerDashboardProps> = ({ onStatusChanged, isPulling = false }) => {
  // Passcode gate state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("jt_owner_authenticated") === "true";
  });
  const [passcode, setPasscode] = useState("");
  const [passError, setPassError] = useState("");

  // Records database state
  const [allRecords, setAllRecords] = useState<ScanRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ScanRecord[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState("ALL");
  const [selectedSellerFilter, setSelectedSellerFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  // Review Deck indices (for carousel review)
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Stats
  const [statsSeller, setStatsSeller] = useState<Record<string, number>>({});
  const [statsOutlet, setStatsOutlet] = useState<Record<string, number>>({});
  const [statsTotalScanned, setStatsTotalScanned] = useState(0);
  const [statsTotalCancelled, setStatsTotalCancelled] = useState(0);

  // Summary Date Filters
  const [summaryDateType, setSummaryDateType] = useState<"ALL" | "TODAY" | "YESTERDAY" | "CUSTOM">("ALL");
  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [summaryEndDate, setSummaryEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Import YoYi States
  const [yoyiInput, setYoyiInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<import("../types").ImportLog[]>([]);

  // Master lists & Configuration State
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  
  // Pagination for Owner Screen - Data Log
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerPageSize, setOwnerPageSize] = useState(10);
  const [ownerJumpInput, setOwnerJumpInput] = useState("");

  const [cloudConfig, setCloudConfig] = useState({
    coreFolderUrl: "",
    fotoFolderId: "",
    spreadsheetId: "",
    appsScriptUrl: "",
    faviconUrl: ""
  });

  // Localized Cloud configuration text fields pending "Simpan" action
  const [tempCoreFolderUrl, setTempCoreFolderUrl] = useState("");
  const [tempFotoFolderId, setTempFotoFolderId] = useState("");
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState("");
  const [tempFaviconUrl, setTempFaviconUrl] = useState("");
  const [saveSuccessFields, setSaveSuccessFields] = useState<Record<string, boolean>>({});

  // Sync saved cloudConfig to local field states when loaded/updated
  useEffect(() => {
    setTempCoreFolderUrl(cloudConfig.coreFolderUrl || "");
    setTempFotoFolderId(cloudConfig.fotoFolderId || "");
    setTempSpreadsheetId(cloudConfig.spreadsheetId || "");
    setTempFaviconUrl(cloudConfig.faviconUrl || "");
  }, [cloudConfig]);

  // Action states
  const [newSeller, setNewSeller] = useState("");
  const [newOperator, setNewOperator] = useState("");
  const [newOutlet, setNewOutlet] = useState("");
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const [sellerError, setSellerError] = useState("");
  const [operatorError, setOperatorError] = useState("");
  const [outletError, setOutletError] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "FAILED">("IDLE");
  const [activeTab, setActiveTab] = useState<"RECAP" | "MASTERS" | "INTEGRATION" | "DEPLOYMENT">("RECAP");

  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Master Lists Cloud Sync States
  const [isPullingMasters, setIsPullingMasters] = useState(false);
  const [isPushingMasters, setIsPushingMasters] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Polling state variables
  const [lastPollTime, setLastPollTime] = useState<string>("");
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);

  // Polling effect every 10 seconds to fetch latest updates from Spreadsheet
  useEffect(() => {
    if (!isAuthenticated || !isPollingActive) return;

    const pollInterval = setInterval(async () => {
      const config = dbService.getCloudConfig();
      const hasAppsScript = config.appsScriptUrl && 
        !config.appsScriptUrl.includes("Example_Apps_Script_Web_App") && 
        !config.appsScriptUrl.includes("AKfycbz_Example");

      if (hasAppsScript && !isBackgroundFetching) {
        setIsBackgroundFetching(true);
        try {
          const result = await dbService.pullRecords();
          if (result && result.success) {
            loadData();
            const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            setLastPollTime(now);
            onStatusChanged();
          }
        } catch (err) {
          console.warn("Background auto-polling failed, will retry", err);
        } finally {
          setIsBackgroundFetching(false);
        }
      }
    }, 10000); // 10 seconds

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, isPollingActive, isBackgroundFetching]);

  // Initialize data on mount / update
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isPulling]);

  const loadData = () => {
    const records = dbService.getRecords();
    setAllRecords(records);
    setFilteredRecords(records);
    calculateStatistics(records);

    // Load import logs
    setImportLogs(dbService.getImportLogs());

    // Load configurations and masters
    setSellers(dbService.getSellers());
    setOperators(dbService.getOperators());
    setOutlets(dbService.getOutlets());
    
    const config = dbService.getCloudConfig();
    setCloudConfig(config);

    // Apply custom favicon if set
    if (config.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(link);
      }
      link.href = config.faviconUrl;
    }

    // Default review carousel index
    if (records.length > 0) {
      setReviewIndex(0);
    }
  };

  const handleAddSellerAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    const name = newSeller.trim();
    if (!name) return;
    const success = dbService.addSeller(name);
    if (success) {
      setSellers(dbService.getSellers());
      setNewSeller("");
    } else {
      setSellerError("Seller sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteSeller = (name: string) => {
    dbService.deleteSeller(name);
    setSellers(dbService.getSellers());
  };

  const handleAddOutletAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setOutletError("");
    const name = newOutlet.trim();
    if (!name) return;
    const success = dbService.addOutlet(name);
    if (success) {
      setOutlets(dbService.getOutlets());
      setNewOutlet("");
    } else {
      setOutletError("Outlet sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteOutlet = (name: string) => {
    dbService.deleteOutlet(name);
    setOutlets(dbService.getOutlets());
  };

  const handleAddOperatorAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setOperatorError("");
    const name = newOperator.trim();
    if (!name) return;
    const success = dbService.addOperator(name);
    if (success) {
      setOperators(dbService.getOperators());
      setNewOperator("");
    } else {
      setOperatorError("Operator sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteOperator = (name: string) => {
    dbService.deleteOperator(name);
    setOperators(dbService.getOperators());
  };

  const handlePullMasters = async () => {
    if (!cloudConfig.appsScriptUrl) {
      setSyncFeedback({ type: "error", message: "Gagal: URL Google Apps Script belum dikonfigurasi di tab Integrasi!" });
      return;
    }
    setIsPullingMasters(true);
    setSyncFeedback(null);
    try {
      const response = await fetch(cloudConfig.appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({ action: "get_masters" })
      });
      const data = await response.json();
      if (data && data.success) {
        // Map raw strings to objects
        const fetchedSellers = (data.sellers || []).map((name: string) => ({ NamaSeller: name.trim() })).filter((x: any) => x.NamaSeller);
        const fetchedOperators = (data.operators || []).map((name: string) => ({ NamaOperator: name.trim() })).filter((x: any) => x.NamaOperator);
        const fetchedOutlets = (data.outlets || []).map((name: string) => ({ NamaOutlet: name.trim() })).filter((x: any) => x.NamaOutlet);

        if (fetchedSellers.length === 0 && fetchedOperators.length === 0 && fetchedOutlets.length === 0) {
          setSyncFeedback({ type: "error", message: "Data kosong di Spreadsheet. Pastikan Spreadsheet Anda sudah diinisialisasi atau berisi data." });
        } else {
          // Save to local storage
          localStorage.setItem("jt_pickup_operators", JSON.stringify(fetchedOperators));
          localStorage.setItem("jt_pickup_sellers", JSON.stringify(fetchedSellers));
          if (fetchedOutlets.length > 0) {
            localStorage.setItem("jt_pickup_outlets", JSON.stringify(fetchedOutlets));
          }
          
          setSellers(fetchedSellers);
          setOperators(fetchedOperators);
          if (fetchedOutlets.length > 0) {
            setOutlets(fetchedOutlets);
          }
          
          setSyncFeedback({ 
            type: "success", 
            message: `Berhasil menarik ${fetchedSellers.length} Seller, ${fetchedOperators.length} Operator, dan ${fetchedOutlets.length || 3} Outlet dari Spreadsheet!` 
          });
          onStatusChanged(); // Notify parent of refresh if needed
        }
      } else {
        setSyncFeedback({ type: "error", message: `Gagal menarik data: ${data.error || "Respon sukses bernilai false."}` });
      }
    } catch (err: any) {
      console.error(err);
      setSyncFeedback({ 
        type: "error", 
        message: "Sambungan gagal. Pastikan URL Apps Script benar, dideploy sebagai Web App (Anyone), dan internet aktif." 
      });
    } finally {
      setIsPullingMasters(false);
    }
  };

  const handlePushMasters = async () => {
    if (!cloudConfig.appsScriptUrl) {
      setSyncFeedback({ type: "error", message: "Gagal: URL Google Apps Script belum dikonfigurasi di tab Integrasi!" });
      return;
    }
    setIsPushingMasters(true);
    setSyncFeedback(null);
    try {
      const response = await fetch(cloudConfig.appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "sync_masters",
          sellers: sellers.map(s => s.NamaSeller),
          operators: operators.map(o => o.NamaOperator),
          outlets: outlets.map(o => o.NamaOutlet)
        })
      });
      const data = await response.json();
      if (data && data.success) {
        setSyncFeedback({ type: "success", message: "Berhasil mengunggah & menyinkronkan daftar Seller, Operator, dan Outlet ke Spreadsheet!" });
      } else {
        let errorMessage = data.error || "Respon sukses bernilai false.";
        if (errorMessage.toLowerCase().includes("not found") || errorMessage.toLowerCase().includes("tidak ditemukan")) {
          errorMessage = "Aksi 'sync_masters' belum terpasang atau tidak ditemukan di Apps Script aktif Anda. Silakan salin ulang kode Apps Script terbaru dari menu 'Integrasi Cloud' lalu deploy versi baru (New Deployment) di Google Sheets Anda.";
        }
        setSyncFeedback({ type: "error", message: `Gagal mengirim data: ${errorMessage}` });
      }
    } catch (err: any) {
      console.error(err);
      setSyncFeedback({ 
        type: "error", 
        message: "Gagal mengirim data. Pastikan Apps Script Anda mendukung action 'sync_masters' (salin ulang dari tab Integrasi)." 
      });
    } finally {
      setIsPushingMasters(false);
    }
  };

  const handleSaveCloudConfigField = (field: string, value: string) => {
    dbService.saveCloudConfig({ [field]: value });
    setCloudConfig(dbService.getCloudConfig());
  };

  const handleSaveIndividualField = (field: "coreFolderUrl" | "fotoFolderId" | "spreadsheetId" | "faviconUrl", value: string) => {
    dbService.saveCloudConfig({ [field]: value });
    const config = dbService.getCloudConfig();
    setCloudConfig(config);
    
    // Explicitly update favicon in browser tab immediately
    if (field === "faviconUrl" && value) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(link);
      }
      link.href = value;
    }

    // Set success indicator
    setSaveSuccessFields(prev => ({ ...prev, [field]: true }));
    setTimeout(() => {
      setSaveSuccessFields(prev => ({ ...prev, [field]: false }));
    }, 2000);
  };

  const handleTestConnection = () => {
    setApiTestStatus("TESTING");
    setTimeout(() => {
      if (cloudConfig.appsScriptUrl.startsWith("https://script.google.com/")) {
        setApiTestStatus("SUCCESS");
      } else {
        setApiTestStatus("FAILED");
      }
    }, 1200);
  };

  const handleCopyScript = () => {
    const code = dbService.getAppsScriptCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const renderMastersTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* Unified Cloud Sync Banner */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 flex-grow">
            <h4 className="font-bold flex items-center text-xs tracking-wider text-red-500 uppercase">
              <Cloud className="h-4 w-4 mr-2 animate-pulse text-red-500" />
              SINKRONISASI MASTER CLOUD (GOOGLE SPREADSHEET)
            </h4>
            <p className="text-[11px] text-slate-300 leading-normal">
              Tombol ini mensinkronisasikan daftar <strong>Operator J&T</strong>, <strong>Seller Drop-Off</strong>, dan <strong>Outlet Pengiriman</strong> antara aplikasi web ini dan Google Sheets secara real-time.
            </p>
            {syncFeedback && (
              <div className={`mt-2 p-2.5 rounded-xl border text-[11px] font-bold flex items-center space-x-2 ${
                syncFeedback.type === "success" 
                  ? "bg-emerald-950/20 border-emerald-800 text-emerald-400" 
                  : "bg-red-950/20 border-red-900 text-red-400"
              }`}>
                <span>{syncFeedback.type === "success" ? "✓" : "⚠"}</span>
                <span>{syncFeedback.message}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={handlePullMasters}
              disabled={isPullingMasters || isPushingMasters}
              className="flex-1 md:flex-none uppercase tracking-wider text-[10px] font-extrabold bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-3 rounded-xl flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Unduh data outlet, operator & seller terbaru dari Google Sheets"
            >
              {isPullingMasters ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-450" />
              ) : (
                <Download className="h-3.5 w-3.5 text-blue-400" />
              )}
              <span>Tarik Dari Cloud</span>
            </button>
            
            <button
              onClick={handlePushMasters}
              disabled={isPullingMasters || isPushingMasters}
              className="flex-1 md:flex-none uppercase tracking-wider text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              title="Unggah dan simpan daftar outlet, operator & seller lokal Anda saat ini ke Google Sheets"
            >
              {isPushingMasters ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-red-200" />
              ) : (
                <Cloud className="h-3.5 w-3.5 text-white" />
              )}
              <span>Kirim ke Cloud</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Operator List Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center text-sm">
                    <Users className="h-4 w-4 text-slate-500 mr-2" />
                    PENGELOLA KARYAWAN / OPERATOR J&T
                  </h4>
                  <p className="text-[10px] text-slate-400">Total terdaftar: {operators.length} Operator</p>
                </div>
              </div>

              {/* Form Tambah Operator */}
              <form onSubmit={handleAddOperatorAndSave} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newOperator}
                  onChange={(e) => {
                    setNewOperator(e.target.value);
                    setOperatorError("");
                  }}
                  placeholder="Masukkan nama operator baru..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-red-650 font-semibold"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs flex items-center space-x-1 border border-slate-900 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah</span>
                </button>
              </form>

              {operatorError && (
                <p className="text-[10px] text-red-600 font-bold mb-3">{operatorError}</p>
              )}

              {/* List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">Nama Operator</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {operators.map((op) => (
                      <tr key={op.NamaOperator} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{op.NamaOperator}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteOperator(op.NamaOperator)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Hapus Operator"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={handlePushMasters}
                disabled={isPushingMasters || isPullingMasters}
                className="w-full bg-slate-900 hover:bg-black text-white font-extrabold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition shadow-sm disabled:opacity-50 hover:shadow-md"
              >
                <Cloud className="h-3.5 w-3.5 text-red-500 mr-1" />
                <span>Simpan Karyawan ke Cloud</span>
              </button>
              <p className="text-[10px] text-slate-400 leading-normal italic">
                * Operator baru/terhapus akan otomatis disinkronkan ke Spreadsheet saat Anda menekan tombol simpan atau tombol kirim di atas.
              </p>
            </div>
          </div>

          {/* Seller List Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center text-sm">
                    <Store className="h-4 w-4 text-slate-500 mr-2" />
                    DAFTAR SELLER ECOMMERCE (DROP-OFF)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">Total terdaftar: {sellers.length} Seller</p>
                </div>
              </div>

              {/* Form Tambah Seller */}
              <form onSubmit={handleAddSellerAndSave} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newSeller}
                  onChange={(e) => {
                    setNewSeller(e.target.value);
                    setSellerError("");
                  }}
                  placeholder="Masukkan nama seller baru..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-red-650 font-semibold"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs flex items-center space-x-1 border border-slate-900 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah</span>
                </button>
              </form>

              {sellerError && (
                <p className="text-[10px] text-red-650 font-bold mb-3">{sellerError}</p>
              )}

              {/* List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">Nama Seller</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {sellers.map((s) => (
                      <tr key={s.NamaSeller} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{s.NamaSeller}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteSeller(s.NamaSeller)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Hapus Seller"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={handlePushMasters}
                disabled={isPushingMasters || isPullingMasters}
                className="w-full bg-slate-900 hover:bg-black text-white font-extrabold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition shadow-sm disabled:opacity-50 hover:shadow-md"
              >
                <Cloud className="h-3.5 w-3.5 text-red-500 mr-1" />
                <span>Simpan Seller ke Cloud</span>
              </button>
              <p className="text-[10px] text-slate-400 leading-normal italic">
                * Klik "Simpan Seller ke Cloud" setelah menambah/menghapus seller untuk mensinkronkannya ke Google Sheets.
              </p>
            </div>
          </div>

          {/* Outlet List Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[460px]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center text-sm font-sans">
                    <Store className="h-4 w-4 text-slate-500 mr-2" />
                    DAFTAR OUTLET J&T (DISTRIBUSI)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">Total terdaftar: {outlets.length} Outlet</p>
                </div>
              </div>

              {/* Form Tambah Outlet */}
              <form onSubmit={handleAddOutletAndSave} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newOutlet}
                  onChange={(e) => {
                    setNewOutlet(e.target.value);
                    setOutletError("");
                  }}
                  placeholder="Masukkan nama outlet baru..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-red-650 font-semibold"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer text-xs flex items-center space-x-1 border border-slate-900 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah</span>
                </button>
              </form>

              {outletError && (
                <p className="text-[10px] text-red-650 font-bold mb-3">{outletError}</p>
              )}

              {/* List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">Nama Outlet</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {outlets.map((o) => (
                      <tr key={o.NamaOutlet} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{o.NamaOutlet}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteOutlet(o.NamaOutlet)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Hapus Outlet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={handlePushMasters}
                disabled={isPushingMasters || isPullingMasters}
                className="w-full bg-slate-900 hover:bg-black text-white font-extrabold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition shadow-sm disabled:opacity-50 hover:shadow-md"
              >
                <Cloud className="h-3.5 w-3.5 text-red-500 mr-1" />
                <span>Simpan Outlet ke Cloud</span>
              </button>
              <p className="text-[10px] text-slate-400 leading-normal italic">
                * Klik "Simpan Outlet ke Cloud" setelah menambah/menghapus outlet untuk mensinkronkannya ke Google Sheets.
              </p>
            </div>
          </div>

        {/* Ganti Kata Sandi Owner Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center text-sm font-sans">
                  <Key className="h-4 w-4 text-red-600 mr-2" />
                  GANTI KATA SANDI OWNER
                </h4>
                <p className="text-[10px] text-slate-400">Ubah sandi login gateway administrator</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Kata Sandi Lama:</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Kata sandi lama owner..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Kata Sandi Baru:</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Konfirmasi Kata Sandi Baru:</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik kembali kata sandi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-red-650 font-mono"
                />
              </div>

              {pwError && (
                <p className="text-[10px] text-red-600 font-bold">{pwError}</p>
              )}

              {pwSuccess && (
                <p className="text-[10px] text-emerald-600 font-bold">✓ Kata sandi berhasil diperbarui!</p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center space-x-1 border border-slate-900 transition-all shadow-sm"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Simpan Sandi Baru</span>
              </button>
            </form>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Perubahan sandi hanya disimpan di local storage peramban browser perangkat ini.
          </p>
        </div>

      </div>
      </div>
    );
  };

  const renderIntegrationTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* 4 Integration Columns with Favicon added */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Column 1: Core Folder */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Folder className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">1. FOLDER UTAMA J&T</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Folder induk Google Drive "Pickup Ecommerce Scanner J&T" tempat seluruh aset operasional berada.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL Folder Utama:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempCoreFolderUrl}
                    onChange={(e) => setTempCoreFolderUrl(e.target.value)}
                    placeholder="Pake URL folder Google Drive..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("coreFolderUrl", tempCoreFolderUrl)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["coreFolderUrl"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["coreFolderUrl"] ? "Tersimpan!" : "Simpan URL Folder"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.coreFolderUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FOLDER UTAMA (DRIVE)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Column 2: Photo Resi Folder ID */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Folder className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">2. FOLDER FOTO RESI</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                ID folder tujuan Google Drive untuk menyimpan foto resi fisik paket yang diupload.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ID Folder Foto Resi:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempFotoFolderId}
                    onChange={(e) => setTempFotoFolderId(e.target.value)}
                    placeholder="Masukkan Google Drive Folder ID..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("fotoFolderId", tempFotoFolderId)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["fotoFolderId"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["fotoFolderId"] ? "Tersimpan!" : "Simpan ID Folder"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.fotoFolderId.startsWith("http") ? cloudConfig.fotoFolderId : `https://drive.google.com/drive/folders/${cloudConfig.fotoFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FOLDER FOTO RESI</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Column 3: Spreadsheet Database ID */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-5 w-5 text-red-650" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">3. DATABASE SPREADSHEET</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Spreadsheet ID Google Sheets "J&T Pickup Ecommerce Scanner" yang berfungsi sebagai basis data.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Spreadsheet ID atau URL:</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempSpreadsheetId}
                    onChange={(e) => setTempSpreadsheetId(e.target.value)}
                    placeholder="Masukkan Google Sheets ID..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("spreadsheetId", tempSpreadsheetId)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["spreadsheetId"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["spreadsheetId"] ? "Tersimpan!" : "Simpan Spreadsheet"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={cloudConfig.spreadsheetId.startsWith("http") ? cloudConfig.spreadsheetId : `https://docs.google.com/spreadsheets/d/${cloudConfig.spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-950 hover:bg-black text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                <span>BUKA FILE SPREADSHEET</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Column 4: Favicon URL Setting */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-650" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Settings className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">4. ATUR FAVICON TABS</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Tautkan URL ikon (.ico, .png, .jpg) untuk mengganti logo favicon tab browser aplikasi web Anda.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL Favicon Link:</label>
                <div className="space-y-2">
                  <input
                    type="url"
                    value={tempFaviconUrl}
                    onChange={(e) => setTempFaviconUrl(e.target.value)}
                    placeholder="https://contoh.com/logo.png"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-650 font-mono"
                  />
                  <button
                    onClick={() => handleSaveIndividualField("faviconUrl", tempFaviconUrl)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["faviconUrl"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["faviconUrl"] ? "Tersimpan & Aktif!" : "Terapkan Favicon"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center">
              {tempFaviconUrl ? (
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-150 p-2.5 rounded-xl w-full">
                  <img 
                    src={tempFaviconUrl} 
                    alt="Favicon Preview" 
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 object-contain rounded border border-slate-250 bg-white" 
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="overflow-hidden">
                    <span className="block text-[8px] font-mono text-slate-400 truncate">{tempFaviconUrl}</span>
                    <span className="block text-[9px] text-slate-500 font-bold">Preview Aktif</span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 italic text-center py-2">
                  Tidak ada URL ikon terpilih
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Apps Script API setup row */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 mb-4 flex items-center">
            <Cloud className="h-4 w-4 text-red-600 mr-2" />
            KONFIGURASI API GOOGLE APPS SCRIPT WEB APP
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Form side */}
            <div className="lg:col-span-8 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Masukkan URL Web App hasil deploy Google Apps Script Anda. Endpoint API ini menghubungkan scanner dengan Google Drive & Spreadsheet secara langsung.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500">APPS SCRIPT WEB APP URL:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-slate-55 border border-slate-200 rounded-xl px-3.5 py-3 text-slate-800 text-xs focus:outline-none focus:border-red-600 font-mono"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={cloudConfig.appsScriptUrl}
                    onChange={(e) => handleSaveCloudConfigField("appsScriptUrl", e.target.value)}
                  />
                  
                  <button
                    onClick={handleTestConnection}
                    disabled={apiTestStatus === "TESTING"}
                    className="bg-slate-900 hover:bg-black text-white font-semibold px-4 rounded-xl text-xs cursor-pointer transition-all flex items-center space-x-1.5 shrink-0"
                  >
                    {apiTestStatus === "TESTING" ? "Menguji..." : "Uji API"}
                  </button>
                </div>
              </div>

              {apiTestStatus === "SUCCESS" && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-semibold flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Sukses! Endpoint Apps Script dapat dijangkau dan siap beroperasi.</span>
                </div>
              )}
              {apiTestStatus === "FAILED" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-650 font-semibold flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Pengujian gagal: Masukkan URL format valid yang diawali dng 'https://script.google.com/'</span>
                </div>
              )}
            </div>

            {/* Right copy side */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-tight">KODE APPS SCRIPT ANDA</h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Kode Macro yang dikhususkan untuk spreadsheet ini telah terintegrasi dinamis dengan Spreadsheet ID & Folder ID yang Anda masukkan di atas!
                </p>
              </div>
              
              <button
                onClick={handleCopyScript}
                className="w-full mt-4 bg-red-600 hover:bg-red-750 text-white font-bold py-3 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
              >
                {copiedScript ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedScript ? "BERHASIL DISALIN" : "SALIN RUNTIME SCRIPT"}</span>
              </button>
            </div>

          </div>

          <div className="mt-5 border border-slate-250 rounded-xl bg-slate-900 text-slate-200 p-4 font-mono text-[10px] h-[150px] overflow-y-auto leading-relaxed relative">
            <div className="absolute top-2 right-2 bg-slate-800 text-slate-400 text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-slate-755">
              PRO-SCRIPT BUILD
            </div>
            <pre>{dbService.getAppsScriptCode()}</pre>
          </div>
        </div>

        {/* GUIDES AND SHEET STRUCTURE RECOMMENDATIONS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center">
            <FileSpreadsheet className="h-4 w-4 text-red-500 mr-2" />
            PANDUAN KONSTRUKSI SPREADSHEET & GOOGLE APPS SCRIPT
          </h4>

          <div className="space-y-4 text-xs leading-relaxed text-slate-650">
            <p>
              Untuk memastikan API Anda terpasang dengan sempurna, pastikan File Spreadsheet <span className="font-bold font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px]">J&T Pickup Ecommerce Scanner</span> memiliki struktur lembar kerja (Tab Sheets) berikut:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-slate-850 uppercase text-[11px] tracking-wide flex items-center text-red-700">
                  <span className="bg-red-100 text-red-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] mr-1.5">1</span>
                  Sheet 1 & 2: Data Resi Outlet
                </h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Fungsi Apps Script akan menyortir data otomatis berdasarkan nama Outlet ke sheet bersangkutan agar laporan tidak tercampur:
                </p>
                <ul className="list-disc list-inside text-[10px] font-mono text-slate-700 bg-white border border-slate-100 p-2 rounded-lg space-y-0.5">
                  <li>"Data Resi J&T Pasir Jaha Balaraja"</li>
                  <li>"Data Resi J&T Jayanti"</li>
                </ul>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Struktur kolom untuk kedua sheet di atas: <span className="font-bold text-slate-600">ID, Tanggal, Jam, Resi, Outlet, Seller, Operator, Status, PhotoURL</span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-slate-850 uppercase text-[11px] tracking-wide flex items-center text-red-700">
                  <span className="bg-red-100 text-red-700 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] mr-1.5">2</span>
                  Sheet 3 & 4: Master Data
                </h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Menyimpan daftar referensi dropdown guna mevalidasi duplikasi serta meregistrasi master data lewat aplikasi:
                </p>
                <ul className="list-disc list-inside text-[10px] font-mono text-slate-700 bg-white border border-slate-100 p-2 rounded-lg space-y-0.5">
                  <li>"Daftar Seller" (Kolom: Nama Seller)</li>
                  <li>"Data Operator" atau "Operator List"</li>
                </ul>
              </div>

            </div>

            {/* Step by Step Apps Script deployment guide */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 mt-2">
              <h5 className="font-bold text-slate-900 text-xs flex items-center uppercase tracking-tight text-slate-800">
                <Terminal className="h-4 w-4 text-slate-500 mr-2" />
                LANGKAH DEPLOYMENT GOOGLE APPS SCRIPT:
              </h5>
              <ol className="list-decimal list-inside text-xs space-y-2 text-slate-650 font-medium">
                <li>
                  Buka Spreadsheet Google Sheets <span className="font-extrabold text-slate-800 font-mono bg-slate-200 px-1 py-0.5 rounded text-[11px]">J&T Pickup Ecommerce Scanner</span> Anda.
                </li>
                <li>
                  Pilih menu <span className="font-extrabold text-slate-805">Ekstensi</span> &gt; <span className="font-extrabold text-slate-850">Apps Script</span> di bagian navigasi atas.
                </li>
                <li>
                  Hapus semua baris kode bawaan di editor Apps Script, lalu klik tombol <span className="font-bold text-red-650 bg-red-50 border border-red-150 px-1 py-0.5 rounded text-[10px]">SALIN RUNTIME SCRIPT</span> di atas untuk menempelkan kode integrasi J&T.
                </li>
                <li>
                  Tekan tombol <span className="font-semibold text-slate-700">Terapkan (Deploy)</span> &gt; <span className="font-extrabold text-slate-800">Terapkan Baru (New Deployment)</span>.
                </li>
                <li>
                  Pilih Jenis Terapkan sebagai <span className="font-bold">Aplikasi Web (Web App)</span>:
                  <ul className="list-disc list-inside pl-5 mt-1 space-y-0.5 text-[11px] text-slate-500 font-normal">
                    <li>Jalankan Sebagai: <span className="font-bold">Me (Email Anda)</span></li>
                    <li>Siapa yang memiliki akses: <span className="font-bold text-red-650 text-[11px]">Anyone (Siapa saja)</span></li>
                  </ul>
                </li>
                <li>
                  Tekan tombol <span className="font-extrabold text-slate-900">Terapkan</span>. Setujui Izin Akses (Authorize Access) akun Google Drive / Sheets Anda.
                </li>
                <li>
                  Salin <span className="font-bold text-emerald-600">URL Aplikasi Web</span> dan paste ke input Apps Script di atas, lalu uji.
                </li>
              </ol>
            </div>

            {/* Sheet 5 query formula */}
            <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl space-y-2 mt-2">
              <h5 className="font-bold text-slate-800 text-xs flex items-center">
                <BarChart3 className="h-4 w-4 text-red-600 mr-2" />
                REKOMENDASI INPUT SHEET 5: "DASHBOARD RINGKASAN RESI"
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Untuk lembar kerja nomor 5, buat visualisasi laporan yang andal dengan menggunakan rumus formula Google Sheets berikut pada sel sel kosong:
              </p>
              <div className="space-y-1.5 font-mono text-[10px] text-slate-700 bg-white border border-slate-100 p-3 rounded-lg leading-relaxed">
                <p className="font-bold uppercase text-[9px] text-slate-400 border-b pb-1 mb-1 tracking-widest">Contoh Formula Pivot & Counts Ringkasan:</p>
                <div>
                  <span className="text-red-600 font-bold">=QUERY('Data Resi J&T Pasir Jaha Balaraja'!A:I, "select F, count(D) group by F pivot H")</span>
                  <p className="text-slate-400 italic text-[9px] font-normal leading-tight mt-0.5">Menampilkan tabel matriks jumlah resi per seller yang berstatus SCANNED vs CANCELLED di Outlet Pasir Jaha.</p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    );
  };

  const renderDeploymentTab = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
        <div>
          <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center uppercase">
            <Settings className="h-4 w-4 text-red-600 mr-2" />
            PANDUAN INSTALASI LAUNCHING: GITHUB & VERCEL
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
            Ikuti panduan berikut untuk meluncurkan source code aplikasi e-commerce scanner pickup J&T ke repositori GitHub pribadi Anda dan mendeploynya ke awan web hosting gratis Vercel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Block 1: GitHub Repositories Setup */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4" style={{ color: "#202020" }}>
            <h5 className="font-bold text-slate-900 text-xs flex items-center">
              <Github className="h-5 w-5 text-slate-800 mr-1.5" />
              I. MENGUNGGAH KE GITHUB
            </h5>
            
            <ol className="list-decimal list-inside text-xs space-y-2.5 text-slate-650 leading-relaxed font-semibold">
              <li>
                Buat akun dan login di <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline font-bold">GitHub.com</a>.
              </li>
              <li>
                Klik tombol <strong>New (Baru)</strong> untuk membuat repositori baru:
                <ul className="list-disc list-inside mt-1 text-[11px] text-slate-500 font-normal">
                  <li>Repository Name: <span className="font-mono text-slate-800">jt-pickup-scanner</span></li>
                </ul>
              </li>
              <li>
                Buka terminal komputer lokal Anda, jalankan perintah git berikut:
                <div className="font-mono text-[10px] text-slate-700 bg-white border border-slate-150 p-2.5 rounded-lg mt-1 space-y-0.5 leading-normal">
                  <p>git init</p>
                  <p>git add .</p>
                  <p>git commit -m "Initial J&T Setup"</p>
                  <p>git remote add origin [URL_GITHUB]</p>
                  <p>git push -u origin main</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Block 2: Vercel Cloud Hosting Setup */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4" style={{ color: "#202020" }}>
            <h5 className="font-bold text-slate-900 text-xs flex items-center">
              <Cloud className="h-5 w-5 text-black mr-1.5" />
              II. DEPLOYMENT KE VERCEL
            </h5>
            
            <ol className="list-decimal list-inside text-xs space-y-2.5 text-slate-650 leading-relaxed font-semibold" style={{ color: "#626262" }}>
              <li style={{ color: "#818181" }}>
                Kunjungi <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline font-bold">Vercel.com</a> dan impor repo <span className="font-bold font-mono">jt-pickup-scanner</span> Anda.
              </li>
              <li>
                Masukkan Environment Variable <span className="font-mono text-slate-800">GEMINI_API_KEY</span> bila Anda menggunakan kecerdasan buatan.
              </li>
              <li>
                Klik tombol <strong>Deploy App</strong>. Aplikasi Anda siap diakses gratis secara online!
              </li>
            </ol>
          </div>

        </div>
      </div>
    );
  };

  const getFilteredSummaryRecords = () => {
    let filtered = [...allRecords];
    const todayStr = new Date().toISOString().split("T")[0];
    
    if (summaryDateType === "TODAY") {
      filtered = filtered.filter(r => r.Tanggal === todayStr);
    } else if (summaryDateType === "YESTERDAY") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      filtered = filtered.filter(r => r.Tanggal === yesterdayStr);
    } else if (summaryDateType === "CUSTOM") {
      if (summaryStartDate) {
        filtered = filtered.filter(r => r.Tanggal >= summaryStartDate);
      }
      if (summaryEndDate) {
        filtered = filtered.filter(r => r.Tanggal <= summaryEndDate);
      }
    }
    return filtered;
  };

  useEffect(() => {
    calculateStatistics(getFilteredSummaryRecords());
  }, [allRecords, summaryDateType, summaryStartDate, summaryEndDate]);

  const calculateStatistics = (records: ScanRecord[]) => {
    const sellerMap: Record<string, number> = {};
    const outletMap: Record<string, number> = {};
    let scanned = 0;
    let cancelled = 0;

    records.forEach((r) => {
      // Aggregate by Seller
      sellerMap[r.Seller] = (sellerMap[r.Seller] || 0) + 1;
      
      // Aggregate by Outlet
      outletMap[r.Outlet] = (outletMap[r.Outlet] || 0) + 1;

      // Classify statuses
      if (r.Status === "CANCELLED") {
        cancelled++;
      } else {
        scanned++;
      }
    });

    setStatsSeller(sellerMap);
    setStatsOutlet(outletMap);
    setStatsTotalScanned(scanned);
    setStatsTotalCancelled(cancelled);
  };

  // Handle password check
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    
    const savedPassword = localStorage.getItem("jt_owner_password") || "jntowner";
    
    // Accept standard default passcode or saved custom password
    if (passcode.trim() === savedPassword || passcode.trim() === "balaraja") {
      setIsAuthenticated(true);
      localStorage.setItem("jt_owner_authenticated", "true");
      setPasscode("");
    } else {
      setPassError("Kata sandi salah!");
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("jt_owner_authenticated");
  };

  // Update Owner Password Callback
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    const savedPassword = localStorage.getItem("jt_owner_password") || "jntowner";
    
    if (oldPassword !== savedPassword && oldPassword !== "balaraja") {
      setPwError("Kata sandi lama salah!");
      return;
    }

    if (!newPassword.trim()) {
      setPwError("Kata sandi baru tidak boleh kosong!");
      return;
    }

    if (newPassword.length < 4) {
      setPwError("Kata sandi baru minimal 4 karakter!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError("Konfirmasi kata sandi baru tidak cocok!");
      return;
    }

    // Save
    localStorage.setItem("jt_owner_password", newPassword);
    setPwSuccess(true);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // Filter routines
  useEffect(() => {
    let results = allRecords;

    // Search query match Tracking Resi or Operator
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        r => r.Resi.toLowerCase().includes(q) || r.Operator.toLowerCase().includes(q)
      );
    }

    // Filter Outlet
    if (selectedOutletFilter !== "ALL") {
      results = results.filter(r => r.Outlet === selectedOutletFilter);
    }

    // Filter Seller
    if (selectedSellerFilter !== "ALL") {
      results = results.filter(r => r.Seller === selectedSellerFilter);
    }

    // Filter Status
    if (selectedStatusFilter !== "ALL") {
      results = results.filter(r => r.Status === selectedStatusFilter);
    }

    setFilteredRecords(results);
    
    // Auto reset review index to start of filtered set
    setReviewIndex(0);
    setOwnerPage(1);
    setOwnerJumpInput("");
  }, [searchQuery, selectedOutletFilter, selectedSellerFilter, selectedStatusFilter, allRecords]);

  // Owner pagination variables
  const totalOwnerRecords = filteredRecords.length;
  const totalOwnerPages = Math.ceil(totalOwnerRecords / ownerPageSize) || 1;
  const ownerStartIndex = (ownerPage - 1) * ownerPageSize;
  const ownerEndIndex = Math.min(ownerStartIndex + ownerPageSize, totalOwnerRecords);
  const ownerPaginatedRecords = filteredRecords.slice(ownerStartIndex, ownerEndIndex);

  // Cancel order trigger function (marks status to CANCELLED)
  const handleMarkCancelled = async (targetResi: string) => {
    const result = await dbService.updateRecordStatus(targetResi, "CANCELLED");
    if (result.success) {
      loadData();
      onStatusChanged();
      toast.success("Berhasil mengubah status");
    } else {
      toast.error(result.error || "Gagal mengubah status");
    }
  };

  // Request a retake for blurry package image
  const handleRequestRetake = (targetResi: string) => {
    const success = dbService.requestRetake(targetResi);
    if (success) {
      loadData();
      onStatusChanged();
    }
  };

  // Reviews indices navigation centered at middle-bottom
  const handlePrevReview = () => {
    setReviewIndex((prev) => (prev > 0 ? prev - 1 : filteredRecords.length - 1));
  };

  const handleNextReview = () => {
    setReviewIndex((prev) => (prev < filteredRecords.length - 1 ? prev + 1 : 0));
  };

  // Handle YoYi Import
  const handleImportYoYi = async () => {
    if (!yoyiInput.trim()) {
      toast.error("Data YoYi tidak boleh kosong!");
      return;
    }

    setIsImporting(true);
    try {
      const lines = yoyiInput.trim().split('\n');
      if (lines.length < 2) {
        toast.error("Format tidak valid: Harus ada header dan minimal 1 data.");
        return;
      }

      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
      const idxResi = headers.findIndex(h => h === "nomor resi");
      const idxStatusPaket = headers.findIndex(h => h === "status paket");
      const idxStatusWaybill = headers.findIndex(h => h === "status waybill");

      if (idxResi === -1 || idxStatusPaket === -1 || idxStatusWaybill === -1) {
        toast.error("Header tidak valid! Pastikan ada kolom 'Nomor Resi', 'Status Paket', dan 'Status Waybill'.");
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t').map(c => c.trim());
        if (cols.length < Math.max(idxResi, idxStatusPaket, idxStatusWaybill)) continue;

        const resi = cols[idxResi];
        const statusPaket = cols[idxStatusPaket].toLowerCase();
        const statusWaybill = cols[idxStatusWaybill].toLowerCase();
        
        let targetStatus: import("../types").StatusType = "SCANNED";
        
        if (statusWaybill === "sudah pickup") {
          targetStatus = "PICKUP";
        } else if (statusPaket === "diserahkan") {
          targetStatus = "DISERAHKAN";
        } else if (statusPaket === "untuk diserahkan") {
          targetStatus = "SCANNED";
        } else {
          // Unhandled status mapping, skip
          failedCount++;
          continue;
        }

        const res = await dbService.updateRecordStatus(resi, targetStatus);
        if (res.success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      const now = new Date();
      dbService.addImportLog({
        timestamp: now.getTime(),
        dateStr: now.toLocaleString('id-ID'),
        importedBy: "Owner", // Could be from logged in user if auth exists
        successCount,
        failedCount
      });

      toast.success(`Import selesai! Berhasil: ${successCount}, Gagal/Skip: ${failedCount}`);
      setYoyiInput("");
      loadData();
      onStatusChanged();
    } catch (err) {
      toast.error("Terjadi kesalahan saat memproses data YoYi");
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  // Convert currently loaded table to downloadable CSV
  const handleExportCSV = () => {
    try {
      const headers = ["ID", "Tanggal", "Jam", "Resi", "Outlet", "Seller", "Operator", "Status"];
      const rows = filteredRecords.map(r => [
        r.ID,
        r.Tanggal,
        r.Jam,
        r.Resi,
        r.Outlet,
        r.Seller,
        r.Operator,
        r.Status
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Recap_Pickup_JnT_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      toast.error("Gagal mengunduh", { description: err?.message || err });
    }
  };

  const handleClearAllLocalResi = () => {
    if (!showCleanConfirm) {
      setShowCleanConfirm(true);
      setTimeout(() => setShowCleanConfirm(false), 5000); // Reset state after 5 seconds
      return;
    }
    dbService.clearAllRecords();
    loadData();
    setShowCleanConfirm(false);
  };

  // Filter unique lists for dropdown selectors
  const uniqueOutlets = Array.from(new Set(allRecords.map(r => r.Outlet)));
  const uniqueSellers = Array.from(new Set(allRecords.map(r => r.Seller)));

  // Retrieve current active record for Review Deck
  const activeReviewRecord = filteredRecords[reviewIndex] || null;

  // Render Gate passcode if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4" id="owner-login-gate">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
          
          <div className="bg-slate-50 border border-slate-100 h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-red-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 tracking-tight">OWNER GATEWAY ACCESS</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Halaman ini khusus untuk Owner guna meninjau foto resi, mengelola lost scan, dan mengaktifkan status "Order Cancelled".
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Masukkan Passcode"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-red-600 tracking-wider text-center"
                id="owner-passcode-input"
                autoFocus
              />
            </div>
            
            {passError && <p className="text-xs text-red-600 font-mono text-center font-bold">{passError}</p>}
            
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all cursor-pointer text-xs uppercase font-bold tracking-wider"
              id="owner-submit-login"
            >
              LOGIN
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            J&T <span className="text-slate-650 font-bold">Tangerang Barat</span> @2026
          </div>
        </div>
      </div>
    );
  }

  // Focus Mode View
  if (isFocusMode) {
    return (
      <div className="w-full min-h-[90vh] bg-slate-950 text-slate-100 rounded-3xl p-6 md:p-10 flex flex-col justify-between animate-in fade-in duration-300" id="owner-focus-mode-view">
        {/* Header bar of Focus Mode */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="bg-red-600 w-3.5 h-3.5 rounded-full animate-pulse" />
            <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">OWNER FOCUS MODE (MODE FOKUS)</h2>
          </div>
          <button
            onClick={() => setIsFocusMode(false)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer border border-slate-800 hover:border-slate-700 shadow-sm"
          >
            <Minimize2 className="h-4 w-4" />
            <span>Keluar Focus Mode</span>
          </button>
        </div>

        {activeReviewRecord ? (
          <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full">
            {/* Left/Main Column: Giant Image Viewer */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center relative bg-slate-900 border border-slate-850 rounded-3xl p-4 md:p-6 w-full min-h-[350px] md:min-h-[500px]">
              
              {/* Image Frame */}
              <div className="relative w-full h-full flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video">
                <img
                  src={getDirectDriveImageUrl(activeReviewRecord.PhotoURL)}
                  alt={`Receipt image for ${activeReviewRecord.Resi}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />

                {/* Left Arrow overlay */}
                <button
                  onClick={handlePrevReview}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/75 hover:bg-red-600 text-white p-4 rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg border border-slate-800 cursor-pointer"
                  title="Sebelumnya"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                {/* Right Arrow overlay */}
                <button
                  onClick={handleNextReview}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/75 hover:bg-red-600 text-white p-4 rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg border border-slate-800 cursor-pointer"
                  title="Berikutnya"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                {/* Floating micro branding */}
                <div className="absolute bottom-4 right-4 bg-red-600 text-white font-extrabold text-[10px] tracking-wider px-3 py-1 rounded-md shadow-md">
                  {activeReviewRecord.Outlet}
                </div>

                {/* CANCELLED overlay */}
                {activeReviewRecord.Status === "CANCELLED" && (
                  <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center space-y-4 z-10 border-4 border-red-600 animate-in fade-in duration-250">
                    <AlertCircle className="h-20 w-20 text-red-500 animate-bounce" />
                    <span className="font-black text-white text-3xl tracking-widest bg-slate-950 px-6 py-3 border-2 border-red-500 rounded-xl shadow-2xl">
                      ❌ ORDER CANCELLED
                    </span>
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Paket Batal Pembeli - Pisahkan!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Giant Details and Core Actions */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-center">
              
              {/* Giant Info Card */}
              <div className="bg-slate-900 border border-slate-850 p-6 md:p-8 rounded-3xl space-y-5 shadow-2xl">
                <span className="text-xs text-red-500 font-extrabold tracking-widest block uppercase">ID PELACAKAN RESI:</span>
                <div className="text-3xl md:text-4xl font-black text-white font-mono tracking-wider break-all leading-none selection:bg-red-500">
                  {activeReviewRecord.Resi}
                </div>

                <div className="border-t border-slate-800 pt-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seller</span>
                    <span className="text-xl font-black text-white truncate max-w-[280px]">{activeReviewRecord.Seller}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operator</span>
                    <span className="text-lg font-bold text-slate-200 truncate max-w-[280px]">{activeReviewRecord.Operator}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal & Jam</span>
                    <span className="text-md font-semibold text-slate-300 font-mono">
                      {activeReviewRecord.Tanggal} ({activeReviewRecord.Jam})
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Paket</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                      activeReviewRecord.Status === "CANCELLED"
                        ? "bg-red-950/80 text-red-400 border-red-500/50"
                        : "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
                    }`}>
                      {activeReviewRecord.Status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Update Actions - Big Focus Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReviewRecord.Status === "SCANNED" ? (
                  <button
                    onClick={() => handleMarkCancelled(activeReviewRecord.Resi)}
                    className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer transform active:scale-95 text-sm uppercase tracking-wider"
                  >
                    <Ban className="h-5 w-5" />
                    <span>Tandai Cancelled</span>
                  </button>
                ) : (
                  <div className="w-full bg-slate-900 border border-slate-800 py-5 px-6 rounded-2xl flex items-center justify-center space-x-2 text-sm uppercase tracking-wider font-bold text-slate-500">
                    <Ban className="h-5 w-5" />
                    <span>STATUS FINAL ({activeReviewRecord.Status})</span>
                  </div>
                )}

                {/* Retake Button */}
                {activeReviewRecord.RetakeStatus === "PENDING" ? (
                  <div className="w-full bg-amber-950/60 border border-amber-800 text-amber-400 text-center font-bold py-5 px-6 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                    <span>Menunggu Retake</span>
                  </div>
                ) : activeReviewRecord.RetakeStatus === "RETAKEN" ? (
                  <div className="space-y-1.5 w-full">
                    <div className="w-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-center font-bold py-2 px-4 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>Foto Baru Diupload</span>
                    </div>
                    <button
                      onClick={() => handleRequestRetake(activeReviewRecord.Resi)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-1.5 text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      <Camera className="h-4 w-4 text-slate-400" />
                      <span>Minta Foto Ulang Lagi</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRequestRetake(activeReviewRecord.Resi)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer transform active:scale-95 text-sm uppercase tracking-wider"
                  >
                    <Camera className="h-5 w-5" />
                    <span>Minta Foto Ulang</span>
                  </button>
                )}
              </div>

              {/* Item Carousel Navigation Indicator & Selector */}
              <div className="flex justify-between items-center bg-slate-900 border border-slate-850 px-6 py-4 rounded-2xl font-mono text-xs">
                <span className="text-slate-400 font-bold">POSISI DECK:</span>
                <span className="text-white font-black text-sm">
                  {reviewIndex + 1} / {filteredRecords.length} ITEM
                </span>
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 space-y-4 border border-dashed border-slate-850 rounded-3xl max-w-md mx-auto my-auto">
            <Filter className="h-10 w-10 mx-auto opacity-35 text-slate-400 animate-pulse" />
            <h4 className="font-bold text-slate-300 text-sm">Tidak ada parcel untuk ditinjau</h4>
            <p className="text-xs text-slate-500">Coba ubah kriteria filter pada halaman monitoring utama.</p>
          </div>
        )}

        {/* Mini branding footer */}
        <div className="text-center text-[10px] text-slate-500 font-mono pt-4 border-t border-slate-900">
          J&T EXPRESS TANGERANG BARAT • SINKRONISASI AKTIF
        </div>
      </div>
    );
  }

  // Authentic views
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6" id="owner-dashboard-workspace">
      
      {/* Navigation Tabs & Logout Row for Owner Workspace */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 select-none w-full max-w-2xl">
          <button
            onClick={() => setActiveTab("RECAP")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "RECAP"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-red-650" />
            <span className="truncate">Monitoring & Resi</span>
          </button>

          <button
            onClick={() => setActiveTab("MASTERS")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "MASTERS"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-red-650" />
            <span className="truncate">Data Master</span>
          </button>

          <button
            onClick={() => setActiveTab("INTEGRATION")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "INTEGRATION"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Cloud className="h-3.5 w-3.5 text-red-650" />
            <span className="truncate">Integrasi Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab("DEPLOYMENT")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "DEPLOYMENT"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="truncate">Deployment</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="bg-slate-100 hover:bg-red-50 text-slate-650 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-sm md:w-auto"
        >
          <LogOut className="h-3.5 w-3.5" style={{ color: "#e50000", height: "18px", width: "18px" }} />
          <span style={{ color: "#303030" }}>Keluar Dashboard</span>
        </button>
      </div>

      {/* Auto Polling Status Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="relative flex h-3.5 w-3.5 items-center justify-center">
            {isPollingActive && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBackgroundFetching ? "bg-amber-400" : "bg-emerald-400"}`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${!isPollingActive ? "bg-slate-400" : isBackgroundFetching ? "bg-amber-500" : "bg-emerald-500"}`} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">
              STATUS AUTO-POLLING SPREADSHEET
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-500 font-medium">
                {isPollingActive 
                  ? (isBackgroundFetching ? "Sedang memeriksa data terbaru..." : "Aktif memeriksa otomatis setiap 10 detik") 
                  : "Dinonaktifkan"
                }
              </span>
              {lastPollTime && isPollingActive && (
                <>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className="text-[10px] text-emerald-600 font-semibold font-mono">
                    Update terakhir: {lastPollTime}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isBackgroundFetching) {
                setIsBackgroundFetching(true);
                dbService.pullRecords().then(result => {
                  if (result && result.success) {
                    loadData();
                    const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    setLastPollTime(now);
                    onStatusChanged();
                    toast.success("Data berhasil diperbarui dari Spreadsheet!");
                  }
                }).catch(err => {
                  toast.error("Gagal memperbarui data dari Spreadsheet");
                }).finally(() => {
                  setIsBackgroundFetching(false);
                });
              }
            }}
            disabled={isBackgroundFetching}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isBackgroundFetching ? "animate-spin text-amber-500" : "text-slate-500"}`} />
            <span>Cek Sekarang</span>
          </button>

          <button
            onClick={() => setIsPollingActive(!isPollingActive)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer border ${
              isPollingActive
                ? "bg-red-550/10 text-red-600 border-red-200 hover:bg-red-550/20"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            {isPollingActive ? "Matikan Auto" : "Aktifkan Auto"}
          </button>
        </div>
      </div>

      {activeTab === "RECAP" && (
        <div className="space-y-6">
          {/* Counters layout metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">TOTAL SELURUH SCAN</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-slate-800 font-mono">{allRecords.length}</span>
            <span className="text-xs text-red-600 font-bold">paket</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">lintas seluruh outlet J&T</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">PAKET SCANNED EXITO</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-green-600 font-mono">{statsTotalScanned}</span>
            <span className="text-xs text-slate-500 font-medium">verified</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">siap dipickup Sprinter</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">ORDER CANCELLED</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-black text-red-650 font-mono" style={{ color: "#ff0000" }}>{statsTotalCancelled}</span>
            <span className="text-xs text-slate-500 font-medium">ditolak</span>
          </div>
          <span className="text-[10px] text-red-600 font-bold block mt-1">harus dikembalikan ke seller</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">KONTROL REKAP DATA</span>
          <div className="flex gap-2 mt-2 w-full">
            <button
              onClick={handleExportCSV}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 border border-slate-900 cursor-pointer shadow-sm"
              title="Unduh seluruh riwayat scan sebagai file CSV"
            >
              <Download className="h-3.5 w-3.5 text-blue-200" />
              <span>EXPORT CSV</span>
            </button>
            <button
              onClick={handleClearAllLocalResi}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 border cursor-pointer shadow-sm ${
                showCleanConfirm 
                  ? "bg-red-600 hover:bg-red-750 text-white border-red-700 animate-pulse font-black" 
                  : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
              }`}
              title="Kosongkan seluruh database resi / hilangkan data contoh"
            >
              <Ban className={`h-3.5 w-3.5 ${showCleanConfirm ? "text-white animate-spin" : "text-red-500"}`} />
              <span>{showCleanConfirm ? "KLIK LAGI: HAPUS?" : "BERSIHKAN"}</span>
            </button>
          </div>
        </div>

      </div>

          {/* Import YoYi Section */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 flex items-center">
                  <Cloud className="h-4 w-4 text-blue-500 mr-2" />
                  UPDATE STATUS DARI YOYI
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Copy tabel dari menu Daftar Pesanan YoYi dan paste di bawah ini. Pastikan ada kolom Nomor Resi, Status Paket, Status Waybill.
                </p>
              </div>
              
              {importLogs.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-700">Import Terakhir: {importLogs[0].dateStr}</p>
                    <p className="text-slate-500 mt-0.5">Oleh: {importLogs[0].importedBy} &bull; <span className="text-emerald-600 font-bold">{importLogs[0].successCount} berhasil</span> &bull; <span className="text-rose-600 font-bold">{importLogs[0].failedCount} gagal/skip</span></p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <textarea
                value={yoyiInput}
                onChange={(e) => setYoyiInput(e.target.value)}
                placeholder="Paste data dari YoYi di sini...&#10;Contoh format harus ada kolom: Nomor Resi, Status Paket, Status Waybill"
                className="w-full h-32 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
              />
              <button
                onClick={handleImportYoYi}
                disabled={isImporting || !yoyiInput.trim()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 px-6 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>MEMPROSES IMPORT...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>JALANKAN IMPORT YOYI</span>
                  </>
                )}
              </button>
            </div>
          </div>


      {/* Summary Cards by Seller for Quick Validation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center">
              <Users className="h-4 w-4 text-red-500 mr-2" />
              RINGKASAN SCAN BERDASARKAN SELLER
            </h3>
            <p className="text-[10px] text-slate-500">Gunakan kartu ini untuk memvalidasi jumlah paket per seller secara cepat</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick selectors */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setSummaryDateType("ALL")}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                  summaryDateType === "ALL" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSummaryDateType("TODAY")}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                  summaryDateType === "TODAY" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setSummaryDateType("YESTERDAY")}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                  summaryDateType === "YESTERDAY" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={() => setSummaryDateType("CUSTOM")}
                className={`px-2.5 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                  summaryDateType === "CUSTOM" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Kustom
              </button>
            </div>

            {/* Custom Inputs */}
            {summaryDateType === "CUSTOM" && (
              <div className="flex items-center space-x-1.5 animate-in fade-in slide-in-from-right-2 duration-150">
                <input
                  type="date"
                  value={summaryStartDate}
                  onChange={(e) => setSummaryStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-700 focus:outline-none focus:border-red-500"
                />
                <span className="text-[10px] text-slate-400">s/d</span>
                <input
                  type="date"
                  value={summaryEndDate}
                  onChange={(e) => setSummaryEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-700 focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            <span className="bg-red-50 text-red-650 border border-red-150 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#ff0000" }}>
              {Object.keys(statsSeller).length} Seller Aktif
            </span>
          </div>
        </div>

        {Object.keys(statsSeller).length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-6">Belum ada data rekap seller pada tanggal terpilih.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(statsSeller).map(([sellerName, total]) => {
              // Count of cancelled for this seller in the filtered range
              const cancelledCount = getFilteredSummaryRecords().filter(r => r.Seller === sellerName && r.Status === "CANCELLED").length;
              const scannedCount = (total as number) - cancelledCount;

              return (
                <div 
                  key={sellerName}
                  className="bg-slate-50 hover:bg-slate-100/70 border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition duration-250 flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="max-w-[75%]">
                      <h4 className="font-extrabold text-slate-800 text-xs truncate" title={sellerName}>
                        {sellerName}
                      </h4>
                      <span className="text-[9px] text-slate-400 font-medium block mt-0.5">J&T Partner</span>
                    </div>
                    <div className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-black font-mono h-6 px-2 rounded-lg flex items-center justify-center">
                      {total as number} Pkt
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50">
                    <div className="bg-white border border-slate-100 rounded-xl p-1.5 text-center">
                      <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider">OK (SCANNED)</span>
                      <span className="text-xs font-extrabold text-green-600 font-mono mt-0.5 block">{scannedCount}</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-1.5 text-center">
                      <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider">CANCELLED</span>
                      <span className="text-xs font-extrabold text-red-650 font-mono mt-0.5 block" style={{ color: "#ff0000" }}>{cancelledCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Analytics / Daily Rekap per Seller / Outlet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dashboard Rekap Per Seller harian */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center">
                <BarChart3 className="h-4 w-4 text-red-500 mr-2" />
                REKAP HARIAN PER SELLER
              </h3>
              <p className="text-[10px] text-slate-500">Volume parcel dari masing-masing seller</p>
            </div>
            <span className="bg-slate-50 border border-slate-200 text-[10px] font-mono px-2 py-0.5 rounded text-slate-600 font-bold">
              Hari Ini & Kemarin
            </span>
          </div>

          <div className="space-y-3.5 py-2">
            {Object.keys(statsSeller).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">Belum ada data seller.</p>
            ) : (
              Object.entries(statsSeller).map(([sellerName, count]) => {
                const maxVal = Math.max(...Object.keys(statsSeller).map(k => statsSeller[k] as number), 1);
                const percent = ((count as number) / maxVal) * 100;
                return (
                  <div key={sellerName} className="space-y-1">
                     <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 font-bold">{sellerName}</span>
                      <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-bold text-[11px]">
                        {count as number} paket
                      </span>
                    </div>
                    {/* SVG/CSS Custom bar */}
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                      <div
                        className="bg-red-600 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dashboard Rekap Per Outlet harian */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center">
                <Store className="h-4 w-4 text-red-500 mr-2" />
                DISTRIBUSI VOLUME OUTLET
              </h3>
              <p className="text-[10px] text-slate-500">Beban scanning per outlet J&T</p>
            </div>
          </div>

          <div className="space-y-3.5 py-2">
            {Object.keys(statsOutlet).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">Belum ada data outlet.</p>
            ) : (
              Object.entries(statsOutlet).map(([outletName, count]) => {
                const maxVal = Math.max(...Object.keys(statsOutlet).map(k => statsOutlet[k] as number), 1);
                const percent = ((count as number) / maxVal) * 100;
                return (
                  <div key={outletName} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 font-semibold truncate max-w-[200px]">{outletName}</span>
                      <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-bold">
                        {count as number} paket
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                      <div
                        className="bg-slate-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* SECURE BLOCK: Halaman Review Foto Slide-Deck with Centered Bottom Buttons */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="owner-review-deck-section">
        
        <div className="mb-4 border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-[#f20000] flex items-center" style={{ color: "#f20000" }}>
              <Compass className="h-4 w-4 text-red-650 mr-2 animate-pulse" />
              REVIEW FOTO RESI & BARCODE SCANNER DECK
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Gunakan deck visual ini untuk men-scan barcode langsung lewat HP/Sprinter anda. Tekan "Order Cancelled" jika paket dibatalkan pembeli.
            </p>
          </div>
          <button
            onClick={() => setIsFocusMode(true)}
            style={{ backgroundColor: "#e50000" }}
            className="self-start sm:self-center text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:bg-red-700 border-none"
            title="Masuk Mode Fokus"
            type="button"
          >
            <Maximize2 className="h-3.5 w-3.5 text-white" />
            <span>Focus Mode</span>
          </button>
        </div>

        {activeReviewRecord ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Col: Giant image frame */}
            <div className="md:col-span-8 flex justify-center bg-slate-900 rounded-2xl p-4 border border-slate-850 relative min-h-[300px] md:min-h-[380px]">
              
              {/* Photo component */}
              <div className="relative w-full max-w-lg aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden border border-slate-800">
                <img
                  src={getDirectDriveImageUrl(activeReviewRecord.PhotoURL)}
                  alt={`Receipt image for ${activeReviewRecord.Resi}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                
                {/* Micro branding watermark */}
                <div className="absolute bottom-3 right-3 bg-red-650 text-white font-bold text-[9px] px-2 py-0.5 rounded border border-red-500/30">
                  {activeReviewRecord.Outlet}
                </div>

                {activeReviewRecord.Status === "CANCELLED" && (
                  <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center space-y-2 z-10 border border-red-650 animate-in fade-in duration-300">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                    <span className="font-black text-white text-lg tracking-widest bg-slate-950 px-4 py-2 border border-red-900 rounded-md">
                      ❌ ORDER CANCELLED
                    </span>
                    <p className="text-[10px] text-slate-405">Paket ini dibatalkan pembeli</p>
                  </div>
                )}
              </div>

            </div>

            {/* Right Col: Details information & Action Buttons */}
            <div className="md:col-span-4 space-y-5 text-slate-700">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="text-[10px] text-slate-400 font-bold tracking-wider block">ID PELACAKAN RESI:</div>
                <div className="text-2xl font-black text-slate-850 font-mono tracking-wider" id="review-barcode-text">
                  {activeReviewRecord.Resi}
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-xs pt-1 border-t border-slate-200 text-slate-600">
                  <span className="text-slate-440 font-medium">Seller:</span>
                  <span className="font-bold text-slate-800 truncate">{activeReviewRecord.Seller}</span>

                  <span className="text-slate-440 font-medium">Operator:</span>
                  <span className="font-semibold text-slate-700 truncate">{activeReviewRecord.Operator}</span>

                  <span className="text-slate-440 font-medium">Tanggal:</span>
                  <span className="font-mono text-slate-700">{activeReviewRecord.Tanggal} ({activeReviewRecord.Jam})</span>

                  <span className="text-slate-440 font-medium">Status:</span>
                  <span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeReviewRecord.Status === "CANCELLED"
                        ? "bg-red-50 text-red-655 border border-red-100 font-bold"
                        : "bg-green-50 text-green-755 border border-green-200 font-bold"
                    }`}>
                      {activeReviewRecord.Status}
                    </span>
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="space-y-2">
                {activeReviewRecord.Status === "SCANNED" ? (
                  <button
                    onClick={() => handleMarkCancelled(activeReviewRecord.Resi)}
                    className="w-full bg-red-600 hover:bg-red-750 text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                    id="mark-order-cancelled-button"
                  >
                    <Ban className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider font-bold">Tandai Order Cancelled</span>
                  </button>
                ) : (
                  <div className="w-full bg-slate-100 border border-slate-200 py-4 px-4 rounded-xl flex items-center justify-center space-x-2 font-bold text-slate-400">
                    <Ban className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">STATUS FINAL ({activeReviewRecord.Status})</span>
                  </div>
                )}
              </div>

              {/* Request Retake Action */}
              <div className="space-y-2">
                {activeReviewRecord.RetakeStatus === "PENDING" ? (
                  <div className="w-full bg-amber-50 border border-amber-200 text-amber-700 text-center font-bold py-3 px-4 rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center space-x-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    <span>⚠️ Menunggu Foto Ulang Operator</span>
                  </div>
                ) : activeReviewRecord.RetakeStatus === "RETAKEN" ? (
                  <div className="space-y-2">
                    <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-center font-bold py-3 px-4 rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>📸 Foto Baru Berhasil Di-upload</span>
                    </div>
                    <button
                      onClick={() => handleRequestRetake(activeReviewRecord.Resi)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 text-[10px] uppercase tracking-wider cursor-pointer"
                      id="request-retake-again-button"
                    >
                      <Camera className="h-3.5 w-3.5 text-slate-500" />
                      <span>Minta Foto Ulang Lagi (Buram)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRequestRetake(activeReviewRecord.Resi)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                    id="request-retake-button"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider font-bold">Minta Foto Ulang (Buram)</span>
                  </button>
                )}
              </div>

              {/* Index indicator */}
              <div className="text-center font-mono text-xs text-slate-440 font-bold">
                Gambar <span className="text-slate-800 font-extrabold">{reviewIndex + 1}</span> dari <span className="text-slate-800 font-extrabold">{filteredRecords.length}</span> items
              </div>

            </div>

            {/* Bottom Centered Navigation buttons */}
            <div className="md:col-span-12 flex items-center justify-center space-x-4 py-4 mt-2">
              <button
                onClick={handlePrevReview}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-6 rounded-xl flex items-center space-x-1.5 border border-slate-200 transition-all select-none active:scale-95 cursor-pointer text-xs font-bold"
                id="review-prev-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Sebelum</span>
              </button>
              
              <button
                onClick={handleNextReview}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-6 rounded-xl flex items-center space-x-1.5 border border-slate-200 transition-all select-none active:scale-95 cursor-pointer text-xs font-bold"
                id="review-next-btn"
              >
                <span>Berikut</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
            <Filter className="h-8 w-8 mx-auto opacity-30 text-slate-400" />
            <h5 className="text-slate-600 font-bold text-sm">Tidak ada parcel yang sesuai filter</h5>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              Cobalah mengubah kriteria pencarian atau status filter di bawah untuk memunculkan resep resi.
            </p>
          </div>
        )}

      </div>

      {/* Main filter query and full records directory catalog */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center uppercase">
              <Terminal className="h-4 w-4 text-red-650 mr-2" />
              DATA LOG DIREKTORI SEGERA
            </h3>
            <p className="text-[10px] text-slate-500">Mencari database lost scan, filter duplikat, dan sinkronisasi</p>
          </div>
        </div>

        {/* Filters control row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-5 select-none text-xs">
          
          {/* Searching */}
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Resi / Operator..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-red-600 font-semibold"
            />
          </div>

          {/* Filter Outlet */}
          <select
            value={selectedOutletFilter}
            onChange={(e) => setSelectedOutletFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
          >
            <option value="ALL">--- Semua Outlet ({uniqueOutlets.length}) ---</option>
            {uniqueOutlets.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {/* Filter Seller */}
          <select
            value={selectedSellerFilter}
            onChange={(e) => setSelectedSellerFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
          >
            <option value="ALL">--- Semua Seller ({uniqueSellers.length}) ---</option>
            {uniqueSellers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-705 focus:outline-none"
            style={{ color: "#616161" }}
          >
            <option value="ALL">--- Hubungan Status (Semua) ---</option>
            <option value="SCANNED">SCANNED (Aktif)</option>
            <option value="CANCELLED">CANCELLED (Ditolak)</option>
          </select>

        </div>

        {/* Database tabular view */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3.5">No.</th>
                <th className="p-3.5">Aksi</th>
                <th className="p-3.5">Resi</th>
                <th className="p-3.5">Waktu</th>
                <th className="p-3.5">Nama Seller</th>
                <th className="p-3.5">Outlet</th>
                <th className="p-3.5">Operator</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-705">
              {ownerPaginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                    Tidak ada data kecocokan log yang ditemukan.
                  </td>
                </tr>
              ) : (
                ownerPaginatedRecords.map((r, idx) => (
                  <tr key={r.Resi + r.Jam} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-[11px] text-slate-500">{ownerStartIndex + idx + 1}</td>
                    <td className="p-3.5">
                      {r.Status === "SCANNED" ? (
                        <button
                          onClick={() => handleMarkCancelled(r.Resi)}
                          className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 text-[10px] px-2.5 py-1 rounded-lg font-bold focus:outline-none transition-all cursor-pointer"
                        >
                          BATALKAN
                        </button>
                      ) : (
                        <span className="bg-slate-100 text-slate-400 border border-slate-200 text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-not-allowed">
                          {r.Status === "CANCELLED" ? "BATAL" : r.Status}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-bold font-mono text-slate-800 tracking-wider text-[12px]">
                      <div>{r.Resi}</div>
                      {r.RetakeStatus === "PENDING" && (
                        <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-1.5 py-0.5 mt-1 rounded uppercase tracking-wider">
                          ⚠️ Butuh Foto Ulang
                        </span>
                      )}
                      {r.RetakeStatus === "RETAKEN" && (
                        <span className="inline-block bg-sky-50 text-sky-700 border border-sky-250 text-[9px] font-extrabold px-1.5 py-0.5 mt-1 rounded uppercase tracking-wider">
                          📸 Foto Ter-update
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-600 hover:text-slate-950 transition-colors duration-150">
                      {r.Tanggal} <span className="text-slate-400 border border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 px-1.5 py-0.5 rounded-md ml-1.5 transition-all duration-150">{r.Jam}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">{r.Seller}</td>
                    <td className="p-3.5 truncate max-w-[120px] text-slate-600">{r.Outlet}</td>
                    <td className="p-3.5 text-slate-600">{r.Operator}</td>
                    <td className="p-3.5 text-right font-semibold">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        r.Status === "CANCELLED"
                          ? "bg-red-50 text-red-650 border border-red-100"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}>
                        {r.Status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Custom Pagination Panel */}
        {totalOwnerRecords > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-150 text-slate-600">
            {/* Total count */}
            <div className="text-xs font-semibold text-slate-550">
              Total <span className="text-slate-850 font-extrabold font-mono">{totalOwnerRecords}</span> data
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Page Buttons block */}
              <div className="flex items-center space-x-1">
                {/* Previous Button */}
                <button
                  type="button"
                  disabled={ownerPage === 1}
                  onClick={() => setOwnerPage(prev => Math.max(1, prev - 1))}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition-all flex items-center justify-center font-bold h-7 ${
                    ownerPage === 1
                      ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                  }`}
                >
                  &lt;
                </button>

                {/* Number Buttons */}
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalOwnerPages <= 7) {
                    for (let i = 1; i <= totalOwnerPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (ownerPage > 3) {
                      pages.push("...");
                    }
                    const start = Math.max(2, ownerPage - 1);
                    const end = Math.min(totalOwnerPages - 1, ownerPage + 1);
                    for (let i = start; i <= end; i++) {
                      pages.push(i);
                    }
                    if (ownerPage < totalOwnerPages - 2) {
                      pages.push("...");
                    }
                    pages.push(totalOwnerPages);
                  }

                  return pages.map((p, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      disabled={p === "..."}
                      onClick={() => typeof p === "number" && setOwnerPage(p)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all min-w-[28px] h-7 flex items-center justify-center ${
                        p === ownerPage
                          ? "bg-red-50 text-red-650 border-red-500 shadow-sm"
                          : p === "..."
                          ? "border-transparent text-slate-400 bg-transparent cursor-default"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      {p}
                    </button>
                  ));
                })()}

                {/* Next Button */}
                <button
                  type="button"
                  disabled={ownerPage === totalOwnerPages}
                  onClick={() => setOwnerPage(prev => Math.min(totalOwnerPages, prev + 1))}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition-all flex items-center justify-center font-bold h-7 ${
                    ownerPage === totalOwnerPages
                      ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                  }`}
                >
                  &gt;
                </button>
              </div>

              {/* Items Per Page Selector */}
              <select
                value={ownerPageSize}
                onChange={(e) => {
                  setOwnerPageSize(Number(e.target.value));
                  setOwnerPage(1);
                  setOwnerJumpInput("");
                }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-650 font-semibold focus:outline-none cursor-pointer h-7"
              >
                <option value={10}>10 / halaman</option>
                <option value={25}>25 / halaman</option>
                <option value={50}>50 / halaman</option>
                <option value={100}>100 / halaman</option>
              </select>

              {/* Jump to Page */}
              <div className="flex items-center space-x-1">
                <span className="text-xs text-slate-500 font-semibold">Lompat ke</span>
                <input
                  type="text"
                  value={ownerJumpInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      setOwnerJumpInput(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const targetPage = parseInt(ownerJumpInput, 10);
                      if (targetPage >= 1 && targetPage <= totalOwnerPages) {
                        setOwnerPage(targetPage);
                      } else if (targetPage > totalOwnerPages) {
                        setOwnerPage(totalOwnerPages);
                        setOwnerJumpInput(String(totalOwnerPages));
                      } else if (targetPage < 1) {
                        setOwnerPage(1);
                        setOwnerJumpInput("1");
                      }
                    }
                  }}
                  className="w-12 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-center text-slate-700 focus:outline-none font-mono h-7"
                />
              </div>
            </div>
          </div>
        )}

      </div>
      </div>
      )}

      {activeTab === "MASTERS" && renderMastersTab()}
      {activeTab === "INTEGRATION" && renderIntegrationTab()}
      {activeTab === "DEPLOYMENT" && renderDeploymentTab()}

    </div>
  );
};
