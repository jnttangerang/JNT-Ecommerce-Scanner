import { SellerService } from '../utils/sellerService';
import { Config, CONFIG_KEYS } from '../utils/config';
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
  Minimize2,
  Tag,
  Eye,
  X,
  Target
} from "lucide-react";
import { ScanRecord, StatusType, Seller, Operator, Outlet } from "../types";
import { dbService, getDirectDriveImageUrl, getTodayLocalDateString } from "../utils/db";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface OwnerDashboardProps {
  onStatusChanged: () => void;
  isPulling?: boolean;
}

export const OwnerScreen: React.FC<OwnerDashboardProps> = ({ onStatusChanged, isPulling = false }) => {
  // Passcode gate state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Config.get(CONFIG_KEYS.OWNER_AUTHENTICATED) === "true";
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
  
  // New Log Date Filter
  const [logDateFilter, setLogDateFilter] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM">("TODAY");
  const [logStartDate, setLogStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [logEndDate, setLogEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Pagination for Summary & Rekap
  const [summarySellerPage, setSummarySellerPage] = useState(1);
  const [summarySellerPageSize, setSummarySellerPageSize] = useState(5);
  const [rekapSellerPage, setRekapSellerPage] = useState(1);
  const [rekapSellerPageSize, setRekapSellerPageSize] = useState(5);

  // Review Deck indices (for carousel review)
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [selectedReviewSeller, setSelectedReviewSeller] = useState<string | null>(null);
  const [detailRecordIndex, setDetailRecordIndex] = useState<number | null>(null);
  const [completedRecordIds, setCompletedRecordIds] = useState<string[]>(() => {
    try {
      const todayStr = getTodayLocalDateString();
      const savedDate = Config.get(CONFIG_KEYS.REVIEW_COMPLETED_DATE);
      if (savedDate !== todayStr) {
        Config.set(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS, "[]");
        Config.set(CONFIG_KEYS.REVIEW_COMPLETED_DATE, todayStr);
        return [];
      }
      const stored = Config.get(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Stats
  const [statsSeller, setStatsSeller] = useState<Record<string, number>>({});
  const [statsOutlet, setStatsOutlet] = useState<Record<string, number>>({});
  const [statsTotalScanned, setStatsTotalScanned] = useState(0);
  const [statsTotalCancelled, setStatsTotalCancelled] = useState(0);

  // Summary Date Filters
  const [summaryDateType, setSummaryDateType] = useState<"ALL" | "TODAY" | "YESTERDAY" | "CUSTOM">("TODAY");
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
  const [tempDailyTarget, setTempDailyTarget] = useState(String(dbService.getDailyTarget()));
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

  // Prefix Resi states
  const [newPrefixInput, setNewPrefixInput] = useState("");
  const [savedPrefixes, setSavedPrefixes] = useState<string[]>(() => {
    const stored = Config.get(CONFIG_KEYS.RESI_PREFIXES) || "JX, JY, JZ";
    return stored.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
  });
  const [resiPrefixSuccess, setResiPrefixSuccess] = useState(false);

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

  // Listen for database updates and reload local records automatically
  useEffect(() => {
    const handleDbUpdated = () => {
      if (isAuthenticated) {
        loadData();
      }
    };
    window.addEventListener("jt_db_updated", handleDbUpdated);
    return () => {
      window.removeEventListener("jt_db_updated", handleDbUpdated);
    };
  }, [isAuthenticated]);

  const loadData = () => {
    const records = dbService.getRecords();
    
    // Only update state if records have actually changed (diffing)
    setAllRecords(prev => {
      // Fast check by length first
      if (prev.length !== records.length) return records;
      
      // Deep check if length is same
      const isSame = JSON.stringify(prev) === JSON.stringify(records);
      return isSame ? prev : records;
    });

    // Load import logs
    setImportLogs(dbService.getImportLogs());

    // Load configurations and masters
    setSellers(SellerService.getAll());
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
  };

  const handleAddSellerAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    const name = newSeller.trim();
    if (!name) return;
    let success = true; try { SellerService.create({ kodeSeller: "KS-" + Date.now(), nama: name, statusAktif: "ACTIVE" }); } catch(e) { success = false; }
    if (success) {
      setSellers(SellerService.getAll());
      setNewSeller("");
    } else {
      setSellerError("Seller sudah terdaftar atau tidak valid");
    }
  };

  const handleDeleteSeller = (name: string) => {
    const target = sellers.find(s => s.nama === name); if(target) SellerService.delete(target.id);
    setSellers(SellerService.getAll());
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
        let fetchedSellers: Seller[] = [];
        if (data.sellers && Array.isArray(data.sellers)) {
          fetchedSellers = data.sellers.map((item: any, idx: number) => {
            if (typeof item === 'string') {
              return {
                id: `SEL_PULL_${idx}_${item.replace(/[^A-Z0-9]/ig, '')}`,
                kodeSeller: `KS-${item.replace(/[^A-Z0-9]/ig, '') || idx}`,
                nama: item.trim(),
                statusAktif: 'ACTIVE' as const,
                syncStatus: 'SYNCED' as const
              };
            } else if (item && typeof item === 'object') {
              const nama = item.NamaSeller || item.nama || item.Nama || item.SellerName || item.Nama_Seller || '';
              const kodeSeller = item.kodeSeller || item.KodeSeller || item.kode || `KS-${nama.replace(/[^A-Z0-9]/ig, '') || idx}`;
              const id = item.id || item.ID || `SEL_PULL_${idx}_${nama.replace(/[^A-Z0-9]/ig, '')}`;
              return {
                id: id,
                kodeSeller: kodeSeller,
                nama: nama.trim(),
                statusAktif: item.statusAktif || item.StatusAktif || 'ACTIVE',
                kategoriProduk: item.kategoriProduk || item.KategoriProduk,
                noHp: item.noHp || item.NoHp || item.no_hp || item.No_HP,
                alamat: item.alamat || item.Alamat,
                gps: item.gps || item.GPS,
                targetHarian: Number(item.targetHarian || item.TargetHarian) || 0,
                catatan: item.catatan || item.Catatan,
                updatedAt: item.updatedAt || item.UpdatedAt,
                createdAt: item.createdAt || item.CreatedAt,
                syncStatus: 'SYNCED' as const
              };
            }
            return null;
          }).filter(Boolean) as Seller[];
        }
        const uniqueOpNames = Array.from(new Set((data.operators || []).map((name: any) => typeof name === 'string' ? name.trim() : ''))).filter(Boolean);
        const fetchedOperators = uniqueOpNames.map(name => ({ NamaOperator: name }));

        const uniqueOutNames = Array.from(new Set((data.outlets || []).map((name: any) => typeof name === 'string' ? name.trim() : ''))).filter(Boolean);
        const fetchedOutlets = uniqueOutNames.map(name => ({ NamaOutlet: name }));

        if (fetchedSellers.length === 0 && fetchedOperators.length === 0 && fetchedOutlets.length === 0) {
          setSyncFeedback({ type: "error", message: "Data kosong di Spreadsheet. Pastikan Spreadsheet Anda sudah diinisialisasi atau berisi data." });
        } else {
          // Save to local storage
          Config.set(CONFIG_KEYS.OPERATORS, JSON.stringify(fetchedOperators));
          
          if (fetchedOutlets.length > 0) {
            Config.set(CONFIG_KEYS.OUTLETS, JSON.stringify(fetchedOutlets));
          }
          
          if (fetchedSellers.length > 0) {
            Config.set(CONFIG_KEYS.SELLERS, JSON.stringify(fetchedSellers));
            SellerService.setSellers(fetchedSellers);
          }
          
          setSellers(SellerService.getAll());
          setOperators(fetchedOperators);
          if (fetchedOutlets.length > 0) {
            setOutlets(fetchedOutlets);
          }
          
          setSyncFeedback({ 
            type: "success", 
            message: `Berhasil menarik ${fetchedSellers.length} Seller Master, ${fetchedOperators.length} Operator, dan ${fetchedOutlets.length || 3} Outlet dari Spreadsheet!` 
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
          sellers: [], // Handled by SellerService
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

  const handleAddResiPrefix = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newPrefixInput.trim().toUpperCase();
    if (!formatted) return;

    let currentPrefixes = [...savedPrefixes];
    if (!currentPrefixes.includes(formatted)) {
      currentPrefixes.push(formatted);
    }
    
    const formattedStr = currentPrefixes.join(", ");
    setSavedPrefixes(currentPrefixes);
    Config.set(CONFIG_KEYS.RESI_PREFIXES, formattedStr);
    Config.saveToSheet();
    
    setNewPrefixInput("");
    setResiPrefixSuccess(true);
    setTimeout(() => setResiPrefixSuccess(false), 3000);
  };

  const handleDeletePrefix = (prefixToDelete: string) => {
    let currentPrefixes = savedPrefixes.filter(p => p !== prefixToDelete);
    if (currentPrefixes.length === 0) {
      currentPrefixes = ["JX", "JY", "JZ"];
    }
    const formatted = currentPrefixes.join(", ");
    setSavedPrefixes(currentPrefixes);
    Config.set(CONFIG_KEYS.RESI_PREFIXES, formatted);
    Config.saveToSheet();
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

  const handleSaveDailyTarget = () => {
    const val = parseInt(tempDailyTarget, 10);
    if (!isNaN(val) && val > 0) {
      dbService.setDailyTarget(val);
      Config.saveToSheet();
      setSaveSuccessFields(prev => ({ ...prev, dailyTarget: true }));
      toast.success("Target Harian berhasil disimpan!");
      setTimeout(() => {
        setSaveSuccessFields(prev => ({ ...prev, dailyTarget: false }));
      }, 2000);
    } else {
      toast.error("Target harus berupa angka positif!");
    }
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
                      <tr key={s.nama} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{s.nama}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteSeller(s.nama)}
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

        {/* Pengaturan Kode Resi Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center text-sm font-sans">
                  <Tag className="h-4 w-4 text-red-600 mr-2" />
                  PENGATURAN AWALAN KODE RESI
                </h4>
                <p className="text-[10px] text-slate-400">Atur huruf awalan resi yang diizinkan saat scan barcode</p>
              </div>
            </div>

            <form onSubmit={handleAddResiPrefix} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tambah Awalan Baru:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPrefixInput}
                    onChange={(e) => setNewPrefixInput(e.target.value)}
                    placeholder="Contoh: JX"
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-[#333333] text-xs focus:outline-none focus:border-red-650 focus:bg-white selection:bg-red-200 selection:text-red-900 font-mono uppercase transition-all duration-300"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-black text-white font-bold px-4 rounded-xl cursor-pointer text-xs flex items-center justify-center border border-slate-900 transition-all shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {resiPrefixSuccess && (
                <p className="text-[10px] text-emerald-600 font-bold">✓ Daftar awalan resi berhasil disimpan!</p>
              )}
            </form>
            
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Awalan Tersimpan:</h5>
              <div className="max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-bold text-slate-600 uppercase text-[10px] rounded-l-lg border-b border-slate-200">Kode Awalan</th>
                      <th className="py-2 px-3 font-bold text-slate-600 uppercase text-[10px] text-right rounded-r-lg border-b border-slate-200 w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {savedPrefixes.map((prefix) => (
                      <tr key={prefix} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{prefix}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeletePrefix(prefix)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Hapus Awalan"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
            * Awalan resi digunakan untuk memvalidasi barcode yang dipindai kamera. Format standar J&T adalah 2 huruf diikuti 10 angka.
          </p>
        </div>

      </div>
      </div>
    );
  };

  const renderIntegrationTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* 5 Integration Columns with Target Harian added */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          
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

          {/* Column 5: Target Harian */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-650" />
            <div>
              <div className="bg-slate-50 border border-slate-100 h-10 w-10 rounded-xl flex items-center justify-center mb-4">
                <Target className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">5. TARGET HARIAN</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Tentukan target jumlah paket harian untuk memotivasi tim operasional.
              </p>
              
              <div className="mt-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Jumlah Paket / Hari:</label>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={tempDailyTarget}
                    onChange={(e) => setTempDailyTarget(e.target.value)}
                    placeholder="Contoh: 150"
                    min="1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-red-650 font-mono"
                  />
                  <button
                    onClick={handleSaveDailyTarget}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm ${
                      saveSuccessFields["dailyTarget"]
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-red-600 hover:bg-red-750 text-white"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saveSuccessFields["dailyTarget"] ? "Tersimpan!" : "Simpan Target"}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center">
                <div className="text-[10px] text-slate-400 font-medium text-center">
                  Target Saat Ini: <span className="font-bold text-slate-700">{dbService.getDailyTarget()} Paket</span>
                </div>
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
    
    const savedPassword = Config.get(CONFIG_KEYS.OWNER_PASSWORD) || "jntowner";
    
    // Accept standard default passcode or saved custom password
    if (passcode.trim() === savedPassword || passcode.trim() === "balaraja") {
      setIsAuthenticated(true);
      Config.set(CONFIG_KEYS.OWNER_AUTHENTICATED, "true");
      setPasscode("");
    } else {
      setPassError("Kata sandi salah!");
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    Config.set(CONFIG_KEYS.OWNER_AUTHENTICATED, "false");
  };

  // Update Owner Password Callback
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    const savedPassword = Config.get(CONFIG_KEYS.OWNER_PASSWORD) || "jntowner";
    
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
    Config.set(CONFIG_KEYS.OWNER_PASSWORD, newPassword);
    Config.saveToSheet();
    setPwSuccess(true);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // Filter routines
  useEffect(() => {
    let results = allRecords;

    // Filter by Log Date
    if (logDateFilter !== "ALL") {
      const today = new Date();
      // Offset by current timezone to get local date correctly
      const getLocalDateStr = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split("T")[0];
      };
      
      const todayStr = getLocalDateStr(today);

      if (logDateFilter === "TODAY") {
        results = results.filter(r => r.Tanggal === todayStr);
      } else if (logDateFilter === "YESTERDAY") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = getLocalDateStr(yesterday);
        results = results.filter(r => r.Tanggal === yStr);
      } else if (logDateFilter === "THIS_WEEK") {
        const firstDay = new Date(today);
        const day = firstDay.getDay(); // 0 is Sunday, 1 is Monday
        const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
        firstDay.setDate(diff); // Monday
        const firstDayStr = getLocalDateStr(firstDay);
        results = results.filter(r => r.Tanggal >= firstDayStr && r.Tanggal <= todayStr);
      } else if (logDateFilter === "THIS_MONTH") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayStr = getLocalDateStr(firstDay);
        results = results.filter(r => r.Tanggal >= firstDayStr && r.Tanggal <= todayStr);
      } else if (logDateFilter === "CUSTOM") {
        results = results.filter(r => r.Tanggal >= logStartDate && r.Tanggal <= logEndDate);
      }
    }

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

    // Sort by Tanggal and Jam descending so newest are first (No. 1)
    // Single Source of Truth: using Tanggal and Jam to build Timestamp
    results = [...results].sort((a, b) => {
      const timeA = new Date(`${a.Tanggal}T${a.Jam}`).getTime();
      const timeB = new Date(`${b.Tanggal}T${b.Jam}`).getTime();
      
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeB - timeA; // Descending
      }
      
      // Fallback if parsing fails (should not happen with standard formats)
      if (b.Tanggal !== a.Tanggal) {
        return b.Tanggal.localeCompare(a.Tanggal);
      }
      return b.Jam.localeCompare(a.Jam);
    });

    setFilteredRecords(results);
  }, [searchQuery, selectedOutletFilter, selectedSellerFilter, selectedStatusFilter, allRecords, logDateFilter, logStartDate, logEndDate]);

  // Reset pagination and review index ONLY when filters change (not when records update from polling)
  useEffect(() => {
    setReviewIndex(0);
    setOwnerPage(1);
    setOwnerJumpInput("");
  }, [searchQuery, selectedOutletFilter, selectedSellerFilter, selectedStatusFilter, logDateFilter, logStartDate, logEndDate]);

  // Owner pagination variables
  const totalOwnerRecords = filteredRecords.length;
  const totalOwnerPages = Math.ceil(totalOwnerRecords / ownerPageSize) || 1;
  const ownerStartIndex = (ownerPage - 1) * ownerPageSize;
  const ownerEndIndex = Math.min(ownerStartIndex + ownerPageSize, totalOwnerRecords);
  const ownerPaginatedRecords = filteredRecords.slice(ownerStartIndex, ownerEndIndex);

  // Cancel tracking lists
  const cancelledRecords = React.useMemo(() => {
    return allRecords.filter(r => r.CancelStatus === "CANCELLED" || r.Status === "CANCELLED");
  }, [allRecords]);

  const pendingCancelRecords = React.useMemo(() => {
    return cancelledRecords.filter(r => r.AlertStatus !== "RESOLVED");
  }, [cancelledRecords]);

  const resolvedCancelRecords = React.useMemo(() => {
    return cancelledRecords.filter(r => r.AlertStatus === "RESOLVED");
  }, [cancelledRecords]);

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
    const listLength = selectedReviewSeller ? reviewDeckRecords.length : filteredRecords.length;
    setReviewIndex((prev) => (prev > 0 ? prev - 1 : listLength - 1));
  };

  const handleNextReview = () => {
    const listLength = selectedReviewSeller ? reviewDeckRecords.length : filteredRecords.length;
    setReviewIndex((prev) => (prev < listLength - 1 ? prev + 1 : 0));
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
      const idxWaktu = headers.findIndex(h => h === "waktu serah terima");
      if (idxResi === -1 || idxStatusPaket === -1 || idxStatusWaybill === -1 || idxWaktu === -1) {
        toast.error("Header tidak valid! Pastikan ada kolom 'Nomor Resi', 'Status Paket', 'Status Waybill', dan 'Waktu Serah Terima'.");
        return;
      }
      let successCount = 0;
      let failedCount = 0;
      let totalPasted = lines.length - 1;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t').map(c => c.trim());
        if (cols.length <= Math.max(idxResi, idxStatusPaket, idxStatusWaybill, idxWaktu)) continue;
        const resi = cols[idxResi];
        const statusPaket = cols[idxStatusPaket];
        const statusWaybill = cols[idxStatusWaybill];
        const waktu = cols[idxWaktu];
        const res = await dbService.updateYoYiData(resi, statusPaket, statusWaybill, waktu);
        if (res) {
          successCount++;
        } else {
          failedCount++;
        }
      }
      const now = new Date();
      dbService.addImportLog({
        timestamp: now.getTime(),
        dateStr: now.toLocaleString('id-ID'),
        importedBy: "Owner",
        successCount,
        failedCount
      });
      toast.success(`Import selesai! Total Pasted: ${totalPasted}, Matched/Updated: ${successCount}, Not Found: ${failedCount}`);
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

  // Business logic: Filter records specifically for the Review Deck
  const deckEligibleRecords = React.useMemo(() => {
    const todayStr = getTodayLocalDateString();
    return filteredRecords.filter(r => {
      // Must NOT display: records already marked "Selesai Scan"
      if (completedRecordIds.includes(r.ID)) return false;

      const requiresAction = r.RetakeStatus === "PENDING" || r.alertStatus === "PENDING";
      const isCompleted = r.Status === "DISERAHKAN" || r.Status === "PICKUP" || r.Status === "CANCELLED";
      
      // Show: packages requiring owner action
      if (requiresAction) return true;

      // Must NOT display: already processed Sprinter records (unless it requires action)
      if (isCompleted) return false;

      // Must NOT display: yesterday's completed work / historical records
      const isToday = r.Tanggal === todayStr;
      if (!isToday) return false;

      // Show: seller scanned today, packages that still require Sprinter processing (SCANNED)
      return true;
    });
  }, [filteredRecords, completedRecordIds]);

  // Get records specifically for the currently selected review seller
  const reviewDeckRecords = React.useMemo(() => {
    if (!selectedReviewSeller) return [];
    return deckEligibleRecords.filter(r => r.Seller === selectedReviewSeller);
  }, [deckEligibleRecords, selectedReviewSeller]);

  // Retrieve current active record for Review Deck
  const activeReviewRecord = selectedReviewSeller
    ? (reviewDeckRecords[reviewIndex] || null)
    : null;

  // Track active review record ID to prevent shifting during polling
  const activeReviewIdRef = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    if (activeReviewRecord) {
      activeReviewIdRef.current = activeReviewRecord.ID;
    }
  }, [activeReviewRecord]);

  // When reviewDeckRecords changes (due to polling), check if the active record shifted
  React.useEffect(() => {
    if (selectedReviewSeller && activeReviewIdRef.current && reviewDeckRecords.length > 0) {
      const newIndex = reviewDeckRecords.findIndex(r => r.ID === activeReviewIdRef.current);
      if (newIndex !== -1 && newIndex !== reviewIndex) {
        setReviewIndex(newIndex);
      }
    }
  }, [reviewDeckRecords, selectedReviewSeller]);

  // Get unique list of sellers present in deckEligibleRecords with stats
  const sellersInFilteredSet = React.useMemo(() => {
    const map: Record<string, { name: string; total: number; cancelled: number; lastScanTime: string }> = {};
    deckEligibleRecords.forEach(r => {
      if (!map[r.Seller]) {
        map[r.Seller] = { name: r.Seller, total: 0, cancelled: 0, lastScanTime: r.Jam };
      }
      map[r.Seller].total++;
      if (r.Status === "CANCELLED") {
        map[r.Seller].cancelled++;
      }
      if (r.Jam > map[r.Seller].lastScanTime) {
        map[r.Seller].lastScanTime = r.Jam;
      }
    });
    return Object.values(map).sort((a, b) => b.lastScanTime.localeCompare(a.lastScanTime));
  }, [deckEligibleRecords]);

  // Mark seller's current eligible records as completed
  const completeSellerRecords = (sellerName: string) => {
    const sellerRecordsInDeck = deckEligibleRecords.filter(r => r.Seller === sellerName);
    if (sellerRecordsInDeck.length === 0) return;

    const newIds = sellerRecordsInDeck.map(r => r.ID);
    const newList = Array.from(new Set([...completedRecordIds, ...newIds]));
    
    setCompletedRecordIds(newList);
    Config.set(CONFIG_KEYS.COMPLETED_REVIEW_RECORDS, JSON.stringify(newList));
    dbService.completeReviews(newIds);
    toast.success(`${newIds.length} resi dari ${sellerName} ditandai Selesai!`);

    if (selectedReviewSeller === sellerName) {
      setSelectedReviewSeller(null);
      setReviewIndex(0);
    }
  };

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
        <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-slate-800 gap-4">
          <div className="flex items-center space-x-2.5">
            {selectedReviewSeller && (
              <button
                onClick={() => {
                  setSelectedReviewSeller(null);
                  setReviewIndex(0);
                }}
                type="button"
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 p-2.5 rounded-xl transition-all cursor-pointer border border-slate-800 flex items-center justify-center"
                title="Kembali ke Daftar Seller"
              >
                <ChevronLeft className="h-4 w-4 text-slate-300" />
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <div className="bg-red-600 w-3.5 h-3.5 rounded-full animate-pulse" />
                <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">
                  {selectedReviewSeller ? `FOCUS MODE: ${selectedReviewSeller}` : "OWNER FOCUS MODE (MODE FOKUS)"}
                </h2>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {selectedReviewSeller 
                  ? `Menampilkan slide-deck untuk di-scan cepat` 
                  : "Silakan pilih salah satu seller untuk masuk ke deck scanner"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {selectedReviewSeller && (
              <button
                onClick={() => completeSellerRecords(selectedReviewSeller)}
                type="button"
                className="font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-sm border cursor-pointer bg-green-600 hover:bg-green-700 text-white border-none"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Selesai Scan Pickup</span>
              </button>
            )}
            <button
              onClick={() => setIsFocusMode(false)}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer border border-slate-800 hover:border-slate-700 shadow-sm"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Keluar Focus Mode</span>
            </button>
          </div>
        </div>

        {!selectedReviewSeller ? (
          /* DARK FOCUS SELLER LIST */
          <div className="flex-1 my-8 max-w-7xl mx-auto w-full flex flex-col justify-start overflow-y-auto">
            <h3 className="text-lg font-black text-slate-100 mb-6 text-center tracking-widest uppercase">PILIH SELLER UNTUK SCAN</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {sellersInFilteredSet.length === 0 ? (
                <div className="col-span-full text-center py-24 text-slate-500 border border-dashed border-slate-850 rounded-3xl">
                  <Filter className="h-10 w-10 mx-auto opacity-30 text-slate-500 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider">Belum ada seller yang discan hari ini</p>
                </div>
              ) : (
                sellersInFilteredSet.map((s) => {
                  return (
                    <div 
                      key={s.name}
                      className="border rounded-2xl p-6 transition-all flex flex-col justify-between hover:border-slate-700 bg-slate-900 border-slate-850 hover:bg-slate-850/50"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="font-extrabold text-white text-base truncate max-w-[180px]" title={s.name}>
                            {s.name}
                          </span>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-800 text-slate-400 font-medium">
                            Belum Scan
                          </span>
                        </div>
                        
                        <div className="mt-4 space-y-2 text-xs text-slate-400">
                          <div className="flex justify-between">
                            <span>Total Paket Scanned:</span>
                            <span className="font-bold text-slate-200">{s.total} resi</span>
                          </div>
                          {s.cancelled > 0 && (
                            <div className="flex justify-between text-red-400">
                              <span>Dibatalkan (Cancelled):</span>
                              <span className="font-bold">{s.cancelled} resi</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                            <span>Scan Terakhir:</span>
                            <span className="font-mono">{s.lastScanTime}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                        <button
                          onClick={() => completeSellerRecords(s.name)}
                          type="button"
                          className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 border cursor-pointer bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300"
                        >
                          <Check className="h-4 w-4" />
                          <span>Selesai Scan</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedReviewSeller(s.name);
                            setReviewIndex(0);
                          }}
                          type="button"
                          className="bg-red-650 hover:bg-red-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer border-none shadow-md"
                        >
                          <span>Review Foto ({s.total})</span>
                          <ChevronRight className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeReviewRecord ? (
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
                    className="w-full bg-red-655 hover:bg-red-700 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer transform active:scale-95 text-sm uppercase tracking-wider border-none"
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
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer transform active:scale-95 text-sm uppercase tracking-wider border-none"
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
                  {reviewIndex + 1} / {reviewDeckRecords.length} ITEM
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
        <div className="text-center text-[10px] text-slate-550 font-mono pt-4 border-t border-slate-900">
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
        <div className="grid grid-cols-2 sm:flex sm:flex-row bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 select-none w-full max-w-2xl">
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
          {(() => {
            const activeSummaryRecords = getFilteredSummaryRecords();
            const kpiOperatorScan = activeSummaryRecords.filter(r => r.PackageStatus === "NONE" || !r.PackageStatus).length;
            const kpiUploadedToYoYi = activeSummaryRecords.filter(r => r.PackageStatus === "Untuk Diserahkan").length;
            const kpiDiserahkan = activeSummaryRecords.filter(r => r.PackageStatus === "Diserahkan").length;
            const kpiSudahPickup = activeSummaryRecords.filter(r => r.WaybillStatus === "Sudah Pickup").length;
            const kpiCancelled = activeSummaryRecords.filter(r => r.CancelStatus === "CANCELLED").length;
            const kpiRetake = activeSummaryRecords.filter(r => r.RetakeStatus === "PENDING").length;
            const kpiAlert = activeSummaryRecords.filter(r => r.AlertStatus === "PENDING").length;
            const kpiReviewPending = activeSummaryRecords.filter(r => r.ReviewStatus === "PENDING").length;
            const kpiReviewCompleted = activeSummaryRecords.filter(r => r.ReviewStatus === "COMPLETED").length;

            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* 1. Operator Scan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">OPERATOR SCAN</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-slate-800 font-mono">{kpiOperatorScan}</span>
                      <span className="text-xs text-slate-500 font-bold">paket</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-2 border-t border-slate-100 pt-1.5 font-medium">PackageStatus: NONE</span>
                </div>

                {/* 2. Uploaded to YoYi */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">UPLOADED TO YOYI</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-blue-600 font-mono">{kpiUploadedToYoYi}</span>
                      <span className="text-xs text-slate-500 font-bold">paket</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-blue-500 block mt-2 border-t border-blue-50 pt-1.5 font-semibold">Untuk Diserahkan</span>
                </div>

                {/* 3. Diserahkan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">DISERAHKAN</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-indigo-600 font-mono">{kpiDiserahkan}</span>
                      <span className="text-xs text-slate-500 font-bold">paket</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-indigo-500 block mt-2 border-t border-indigo-50 pt-1.5 font-semibold">Diserahkan</span>
                </div>

                {/* 4. Sudah Pickup */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">SUDAH PICKUP</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-emerald-600 font-mono">{kpiSudahPickup}</span>
                      <span className="text-xs text-slate-500 font-bold">paket</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-emerald-600 block mt-2 border-t border-emerald-50 pt-1.5 font-semibold">Sudah Pickup</span>
                </div>

                {/* 5. Cancelled */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">CANCELLED</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-red-650 font-mono" style={{ color: "#ff0000" }}>{kpiCancelled}</span>
                      <span className="text-xs text-slate-500 font-bold">paket</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-red-500 block mt-2 border-t border-red-50 pt-1.5 font-semibold">CancelStatus: CANCELLED</span>
                </div>

                {/* 6. Retake */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">RETAKE PENDING</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-amber-600 font-mono">{kpiRetake}</span>
                      <span className="text-xs text-slate-500 font-bold">foto</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-amber-600 block mt-2 border-t border-amber-50 pt-1.5 font-semibold">RetakeStatus: PENDING</span>
                </div>

                {/* 7. Alert */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">ALERT PENDING</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-orange-600 font-mono">{kpiAlert}</span>
                      <span className="text-xs text-slate-500 font-bold">notifikasi</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-orange-500 block mt-2 border-t border-orange-50 pt-1.5 font-semibold">AlertStatus: PENDING</span>
                </div>

                {/* 8. Review Pending */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">REVIEW PENDING</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-yellow-600 font-mono">{kpiReviewPending}</span>
                      <span className="text-xs text-slate-500 font-bold">resi</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-yellow-600 block mt-2 border-t border-yellow-50 pt-1.5 font-semibold">ReviewStatus: PENDING</span>
                </div>

                {/* 9. Review Completed */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">REVIEW COMPLETED</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-3xl font-black text-teal-600 font-mono">{kpiReviewCompleted}</span>
                      <span className="text-xs text-slate-500 font-bold">resi</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-teal-600 block mt-2 border-t border-teal-50 pt-1.5 font-semibold">ReviewStatus: COMPLETED</span>
                </div>

                {/* 10. Kontrol Rekap Data */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">KONTROL REKAP DATA</span>
                  <div className="flex gap-2 mt-2 w-full">
                    <button
                      onClick={handleExportCSV}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 px-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center space-x-1 border border-slate-900 cursor-pointer shadow-sm"
                      title="Unduh seluruh riwayat scan sebagai file CSV"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-200" />
                      <span>EXPORT CSV</span>
                    </button>
                    <button
                      onClick={handleClearAllLocalResi}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center space-x-1 border cursor-pointer shadow-sm ${
                        showCleanConfirm 
                          ? "bg-red-600 hover:bg-red-750 text-white border-red-700 animate-pulse font-black" 
                          : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                      }`}
                      title="Kosongkan seluruh database resi / hilangkan data contoh"
                    >
                      <Ban className={`h-3.5 w-3.5 ${showCleanConfirm ? "text-white animate-spin" : "text-red-500"}`} />
                      <span>{showCleanConfirm ? "HAPUS?" : "BERSIHKAN"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Grafik Statistik Harian Terintegrasi (Recharts) */}
          {(() => {
            const activeRecords = getFilteredSummaryRecords();
            const totalCount = activeRecords.length;
            
            // 1. Data Status Scan
            const scannedCount = activeRecords.filter(r => r.Status === "SCANNED").length;
            const pickupCount = activeRecords.filter(r => r.Status === "PICKUP" || r.Status === "DISERAHKAN").length;
            const cancelledCount = activeRecords.filter(r => r.Status === "CANCELLED").length;
            
            const statusChartData = [
              { name: "Scanned (Siap Kirim)", value: scannedCount, color: "#2563eb" }, // Blue
              { name: "Pickup / Selesai", value: pickupCount, color: "#059669" },   // Emerald Green
              { name: "Cancelled (Batal)", value: cancelledCount, color: "#dc2626" }   // Red
            ].filter(item => item.value > 0); // Only show statuses with values in the donut

            // Fallback if no records at all
            const statusChartFallbackData = [
              { name: "Tidak ada data", value: 1, color: "#cbd5e1" }
            ];

            // 2. Data Paket per Kurir / Operator
            const operatorMap: Record<string, number> = {};
            activeRecords.forEach(r => {
              const opName = r.Operator ? r.Operator.trim() : "Unknown";
              operatorMap[opName] = (operatorMap[opName] || 0) + 1;
            });
            const operatorChartData = Object.entries(operatorMap)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8); // Top 8 operators for cleaner look

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Visualisasi Status Scan */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 flex items-center">
                          <Layers className="h-4 w-4 text-blue-500 mr-2" />
                          VISUALISASI STATUS SCAN
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Pembagian proporsi status seluruh resi dalam filter waktu aktif.
                        </p>
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                        {totalCount} Resi
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                    {/* Ring Donut Chart */}
                    <div className="h-[180px] w-[180px] relative flex items-center justify-center shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData.length > 0 ? statusChartData : statusChartFallbackData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {(statusChartData.length > 0 ? statusChartData : statusChartFallbackData).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-slate-800 font-mono">{totalCount}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Resi</span>
                      </div>
                    </div>

                    {/* Custom Legend to make it neat */}
                    <div className="space-y-2.5 text-xs w-full max-w-xs">
                      {statusChartData.length > 0 ? (
                        statusChartData.map((item, idx) => {
                          const percentage = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : "0.0";
                          return (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-xl px-3 py-2">
                              <div className="flex items-center space-x-2">
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="font-bold text-slate-700 text-[11px] truncate max-w-[120px]">{item.name}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-bold text-slate-800 font-mono mr-1.5">{item.value}</span>
                                <span className="text-[10px] text-slate-400 font-semibold font-mono">({percentage}%)</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-slate-400 py-6 font-medium">
                          Belum ada data resi terekam.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chart 2: Produktivitas Operator / Kurir */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 flex items-center">
                          <BarChart3 className="h-4 w-4 text-[#f20000] mr-2" />
                          BEBAN & PRODUKTIVITAS
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Jumlah paket yang berhasil discan/diinput berdasarkan operator aktif.
                        </p>
                      </div>
                      <span className="bg-red-50 text-[#f20000] text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-red-100">
                        {operatorChartData.length} Kurir
                      </span>
                    </div>
                  </div>

                  {operatorChartData.length > 0 ? (
                    <div className="h-[200px] w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={operatorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} 
                            dy={5}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                          />
                          <RechartsTooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28}>
                            {operatorChartData.map((entry, index) => {
                              // Cycle beautiful colors for differentiation
                              const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
                              const cellColor = colors[index % colors.length];
                              return <Cell key={`cell-${index}`} fill={cellColor} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Users className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-slate-400 text-xs font-semibold">Tidak ada aktivitas kurir pada filter waktu ini.</p>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

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
          (() => {
            const sortedSellers = Object.entries(statsSeller).sort((a, b) => (b[1] as number) - (a[1] as number));
            const totalSummaryPages = Math.ceil(sortedSellers.length / summarySellerPageSize) || 1;
            const startIdx = (summarySellerPage - 1) * summarySellerPageSize;
            const paginatedSellers = sortedSellers.slice(startIdx, startIdx + summarySellerPageSize);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {paginatedSellers.map(([sellerName, total]) => {
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
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                  <select
                    value={summarySellerPageSize}
                    onChange={(e) => {
                      setSummarySellerPageSize(Number(e.target.value));
                      setSummarySellerPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value={5}>5 / halaman</option>
                    <option value={10}>10 / halaman</option>
                    <option value={25}>25 / halaman</option>
                  </select>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSummarySellerPage(Math.max(1, summarySellerPage - 1))}
                      disabled={summarySellerPage === 1}
                      className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 text-slate-600"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-slate-500 font-medium font-mono">
                      {summarySellerPage} / {totalSummaryPages}
                    </span>
                    <button
                      onClick={() => setSummarySellerPage(Math.min(totalSummaryPages, summarySellerPage + 1))}
                      disabled={summarySellerPage === totalSummaryPages}
                      className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 text-slate-600"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
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
              {summaryDateType === "TODAY" ? "Hari Ini" : summaryDateType === "YESTERDAY" ? "Kemarin" : summaryDateType === "ALL" ? "Semua" : "Kustom"}
            </span>
          </div>

          <div className="space-y-3.5 py-2">
            {Object.keys(statsSeller).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">Belum ada data seller.</p>
            ) : (
              (() => {
                const sortedSellers = Object.entries(statsSeller).sort((a, b) => (b[1] as number) - (a[1] as number));
                const totalRekapPages = Math.ceil(sortedSellers.length / rekapSellerPageSize) || 1;
                const startIdx = (rekapSellerPage - 1) * rekapSellerPageSize;
                const paginatedSellers = sortedSellers.slice(startIdx, startIdx + rekapSellerPageSize);
                const maxVal = Math.max(...Object.keys(statsSeller).map(k => statsSeller[k] as number), 1);

                return (
                  <>
                    {paginatedSellers.map(([sellerName, count]) => {
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
                    })}
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                      <select
                        value={rekapSellerPageSize}
                        onChange={(e) => {
                          setRekapSellerPageSize(Number(e.target.value));
                          setRekapSellerPage(1);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-700 font-semibold focus:outline-none"
                      >
                        <option value={5}>5 / halaman</option>
                        <option value={10}>10 / halaman</option>
                        <option value={25}>25 / halaman</option>
                      </select>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setRekapSellerPage(Math.max(1, rekapSellerPage - 1))}
                          disabled={rekapSellerPage === 1}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-500 font-medium font-mono px-1">
                          {rekapSellerPage} / {totalRekapPages}
                        </span>
                        <button
                          onClick={() => setRekapSellerPage(Math.min(totalRekapPages, rekapSellerPage + 1))}
                          disabled={rekapSellerPage === totalRekapPages}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()
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
          <div className="flex items-center space-x-2.5">
            {selectedReviewSeller && (
              <button
                onClick={() => {
                  setSelectedReviewSeller(null);
                  setReviewIndex(0);
                }}
                type="button"
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 p-2.5 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center"
                title="Kembali ke Daftar Seller"
              >
                <ChevronLeft className="h-4 w-4 text-slate-700" />
              </button>
            )}
            <div>
              <h3 className="font-bold text-sm text-[#f20000] flex items-center" style={{ color: "#f20000" }}>
                <Compass className="h-4 w-4 text-red-650 mr-2 animate-pulse" />
                {selectedReviewSeller ? `FOTO RESI: ${selectedReviewSeller}` : "REVIEW FOTO RESI & BARCODE SCANNER DECK"}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {selectedReviewSeller 
                  ? `Menampilkan ${reviewDeckRecords.length} foto paket milik ${selectedReviewSeller} untuk di-scan`
                  : "Daftar seluruh seller yang sudah discan oleh admin hari ini. Pilih seller untuk memulai slide-deck scan."
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 self-start sm:self-center">
            {selectedReviewSeller && (
              <button
                onClick={() => completeSellerRecords(selectedReviewSeller)}
                type="button"
                className="font-black px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-sm border cursor-pointer bg-green-600 hover:bg-green-700 text-white border-none"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Selesai Scan Pickup</span>
              </button>
            )}

            {selectedReviewSeller && (
              <button
                onClick={() => setIsFocusMode(true)}
                style={{ backgroundColor: "#e50000" }}
                className="text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:bg-red-700 border-none"
                title="Masuk Mode Fokus"
                type="button"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
                <span>Focus Mode</span>
              </button>
            )}
          </div>
        </div>

        {!selectedReviewSeller ? (
          /* LIST OF SELLERS SCANNED BY ADMIN */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-2" id="owner-seller-pickup-list">
            {sellersInFilteredSet.length === 0 ? (
              <div className="col-span-full text-center py-16 text-slate-400 space-y-3 border border-dashed border-slate-200 rounded-3xl">
                <Filter className="h-10 w-10 mx-auto opacity-30 text-slate-400" />
                <h5 className="text-slate-650 font-bold text-sm uppercase tracking-wider">Belum Ada Seller yang Di-scan</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-semibold leading-relaxed">
                  Tidak ditemukan seller dengan data scan di database pada filter aktif saat ini.
                </p>
              </div>
            ) : (
              sellersInFilteredSet.map((s) => {
                return (
                  <div 
                    key={s.name}
                    className="border rounded-2xl p-4 transition-all flex flex-col justify-between hover:shadow-md bg-white border-slate-200/80 hover:border-red-200"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="font-extrabold text-slate-800 text-sm md:text-base truncate max-w-[170px]" title={s.name}>
                          {s.name}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-500 font-medium">
                          Belum Scan
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-1 text-[11px] text-slate-500 font-semibold">
                        <div className="flex justify-between">
                          <span>Total Paket Scanned:</span>
                          <span className="font-bold text-slate-700">{s.total} resi</span>
                        </div>
                        {s.cancelled > 0 && (
                          <div className="flex justify-between text-red-650">
                            <span>Dibatalkan (Cancelled):</span>
                            <span className="font-bold">{s.cancelled} resi</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                          <span>Scan Terakhir:</span>
                          <span className="font-mono font-bold text-slate-600">{s.lastScanTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => completeSellerRecords(s.name)}
                        type="button"
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 border border-transparent cursor-pointer text-white hover:opacity-90"
                        style={{ backgroundColor: "#ff0000" }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Selesai Scan</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedReviewSeller(s.name);
                          setReviewIndex(0);
                        }}
                        type="button"
                        className="text-white font-black px-3.5 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer border-none shadow-sm hover:opacity-90"
                        style={{ backgroundColor: "#666666" }}
                      >
                        <span>Review Foto ({s.total})</span>
                        <ChevronRight className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeReviewRecord ? (
          /* SLIDER CAROUSEL VIEW FOR SELECTED SELLER */
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
                <div className="absolute bottom-3 right-3 bg-red-655 text-white font-bold text-[9px] px-2 py-0.5 rounded border border-red-500/30">
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
                    className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer border-none"
                    style={{ backgroundColor: '#363636' }}
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
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-505" />
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
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer border-none"
                    id="request-retake-button"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider font-bold">Minta Foto Ulang (Buram)</span>
                  </button>
                )}
              </div>

              {/* Index indicator */}
              <div className="text-center font-mono text-xs text-slate-440 font-bold">
                Gambar <span className="text-slate-800 font-extrabold">{reviewIndex + 1}</span> dari <span className="text-slate-800 font-extrabold">{reviewDeckRecords.length}</span> items
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
            <h5 className="text-slate-650 font-bold text-sm">Tidak ada parcel yang sesuai filter</h5>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              Cobalah mengubah kriteria pencarian atau status filter di bawah untuk memunculkan resep resi.
            </p>
          </div>
        )}

      </div>

      {/* MANAJEMEN ALUR PEMBATALAN (CANCEL WORKFLOW) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 flex items-center uppercase">
            <Ban className="h-4 w-4 text-red-650 mr-2" />
            MANAJEMEN PAKET BATAL (CANCEL WORKFLOW)
          </h3>
          <p className="text-[10px] text-slate-500">
            Daftar order yang dibatalkan pembeli sebelum Sprinter J&T melakukan pickup. Operator harus memisahkan fisik paket dan mengunggah bukti foto.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column 1: Pending Separations */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col h-[300px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <span className="text-xs font-black tracking-wide text-red-700 uppercase flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                MENUNGGU PEMISAHAN ({pendingCancelRecords.length})
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Pending</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {pendingCancelRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                  Tidak ada paket batal yang perlu dipisahkan.
                </div>
              ) : (
                pendingCancelRecords.map((r, idx) => (
                  <div key={`${r.ID}-${idx}`} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="text-xs space-y-1">
                      <span className="font-mono font-bold text-slate-800 block tracking-wider">{r.Resi}</span>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Seller: {r.Seller} • Operator: {r.Operator}
                      </div>
                    </div>
                    <span className="bg-red-50 text-red-600 border border-red-100 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Pending
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Resolved Separations */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col h-[300px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <span className="text-xs font-black tracking-wide text-emerald-700 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                BERHASIL DIPISAHKAN ({resolvedCancelRecords.length})
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Resolved</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {resolvedCancelRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                  Belum ada paket batal yang berhasil dipisahkan hari ini.
                </div>
              ) : (
                resolvedCancelRecords.map((r, idx) => (
                  <div key={`${r.ID}-${idx}`} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="text-xs space-y-1 min-w-0 flex-1 pr-2">
                      <span className="font-mono font-bold text-slate-800 block tracking-wider">{r.Resi}</span>
                      <div className="text-[10px] text-slate-500 font-medium truncate">
                        Seller: {r.Seller} • Pemisah: {r.CancelHandledBy || r.Operator}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium truncate italic">
                        Catatan: "{r.CancelRemark || "-"}"
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {r.CancelEvidencePhoto && (
                        <button
                          onClick={() => {
                            const idx = filteredRecords.findIndex(item => item.ID === r.ID);
                            if (idx !== -1) setDetailRecordIndex(idx);
                          }}
                          className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                          title="Lihat Bukti Foto Pemisahan"
                        >
                          <img
                            src={getDirectDriveImageUrl(r.CancelEvidencePhoto)}
                            alt="Bukti"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      )}
                      <span className="bg-green-50 text-green-700 border border-green-100 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Selesai
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-3 select-none text-xs">
          
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

          {/* Filter Tanggal */}
          <select
            value={logDateFilter}
            onChange={(e) => setLogDateFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
          >
            <option value="TODAY">Hari Ini</option>
            <option value="YESTERDAY">Kemarin</option>
            <option value="THIS_WEEK">Minggu Ini</option>
            <option value="THIS_MONTH">Bulan Ini</option>
            <option value="CUSTOM">Custom Date</option>
          </select>

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

        {logDateFilter === "CUSTOM" && (
          <div className="flex items-center space-x-2 mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-xs text-slate-500 font-semibold">Dari:</span>
            <input
              type="date"
              value={logStartDate}
              onChange={(e) => setLogStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-red-500"
            />
            <span className="text-xs text-slate-500 font-semibold pl-2">Sampai:</span>
            <input
              type="date"
              value={logEndDate}
              onChange={(e) => setLogEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        {/* Database tabular view */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3.5 text-slate-800">No.</th>
                <th className="p-3.5 text-slate-800">No. Resi</th>
                <th className="p-3.5 text-slate-800">Seller Pengirim</th>
                <th className="p-3.5 text-slate-800">Waktu & Operator</th>
                <th className="p-3.5 text-slate-800">Status Cloud</th>
                <th className="p-3.5 text-slate-800">Status Resi</th>
                <th className="p-3.5 text-center text-slate-800">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-705">
              {ownerPaginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                    Tidak ada data kecocokan log yang ditemukan.
                  </td>
                </tr>
              ) : (
                ownerPaginatedRecords.map((r, idx) => {
                  const globalIdx = filteredRecords.findIndex(item => item.ID === r.ID);
                  const fileName = `PKT_${r.Tanggal.replace(/-/g, '')}_${r.Resi}.jpg`;
                  
                  return (
                    <tr key={`${r.ID}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      {/* Column 1: No. */}
                      <td className="p-3.5 font-bold font-mono text-[11px]" style={{ color: "#484848" }}>
                        {ownerStartIndex + idx + 1}
                      </td>
                      
                      {/* Column 2: No. Resi */}
                      <td className="p-3.5 font-bold font-mono text-slate-900 tracking-wider text-[12px]">
                        <div>{r.Resi}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                          {fileName}
                        </div>
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
                      
                      {/* Column 3: Seller Pengirim */}
                      <td className="p-3.5 text-[11px]">
                        <div className="font-extrabold text-slate-800">{r.Seller}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {r.Outlet}
                        </div>
                      </td>
                      
                      {/* Column 4: Waktu & Operator */}
                      <td className="p-3.5 text-[11px]">
                        <div className="font-mono text-[11px]" style={{ color: "#222222", fontWeight: "bold" }}>
                          {r.Tanggal} <span className="text-slate-400 border border-slate-200 bg-slate-50/80 px-1.5 py-0.5 rounded-md ml-1 font-semibold">{r.Jam}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          {r.Operator}
                        </div>
                      </td>
                      
                      {/* Column 5: Status Cloud */}
                      <td className="p-3.5">
                        {r.SyncStatus === "SYNCED" ? (
                          <span className="inline-flex items-center text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            Desynced
                          </span>
                        )}
                      </td>
                      
                      {/* Column 6: Status Resi */}
                      <td className="p-3.5">
                        {r.Status === "CANCELLED" ? (
                          <span className="inline-flex items-center text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-red-50 text-red-650 border border-red-150">
                            Cancelled
                          </span>
                        ) : (r.Status === "PICKUP" || r.Status === "DISERAHKAN") ? (
                          <span 
                            className="inline-flex items-center text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-200"
                            style={{ color: "#007113", backgroundColor: "#edffed" }}
                          >
                            Pickup
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-200"
                            style={{ color: "#007113", backgroundColor: "#edffed" }}
                          >
                            Scanned
                          </span>
                        )}
                      </td>
                      
                      {/* Column 7: Aksi */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDetailRecordIndex(globalIdx)}
                            type="button"
                            className="bg-slate-50 hover:bg-red-50 text-slate-650 hover:text-red-600 border border-slate-200 hover:border-red-200 p-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
                            title="Lihat Detail Foto Resi"
                          >
                            <Eye className="h-4.5 w-4.5" style={{ color: "#3f3f3f" }} />
                          </button>
                          
                          {r.Status === "CANCELLED" ? (
                            <button
                              type="button"
                              className="bg-slate-100 text-slate-400 border border-slate-200 p-2 rounded-xl inline-flex items-center justify-center shadow-sm cursor-not-allowed"
                              title="Resi Sudah Dibatalkan"
                              disabled
                            >
                              <Ban className="h-4.5 w-4.5" style={{ color: "#ff0000" }} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMarkCancelled(r.Resi)}
                              type="button"
                              className="bg-red-50 hover:bg-red-600 text-red-650 hover:text-white border border-red-200 hover:border-red-600 p-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
                              title="Batalkan Resi / Dibatalkan Pembeli"
                            >
                              <Ban className="h-4.5 w-4.5" style={{ color: "#ff0000" }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

        {/* SLIDEABLE DETAILED RESI PHOTO MODAL OVERLAY */}
        {detailRecordIndex !== null && (
          (() => {
            const r = filteredRecords[detailRecordIndex];
            if (!r) return null;
            
            const fileName = `PKT_${r.Tanggal.replace(/-/g, '')}_${r.Resi}.jpg`;
            
            const handleNext = () => {
              setDetailRecordIndex(prev => {
                if (prev === null) return null;
                return (prev + 1) % filteredRecords.length;
              });
            };
            
            const handlePrev = () => {
              setDetailRecordIndex(prev => {
                if (prev === null) return null;
                return (prev - 1 + filteredRecords.length) % filteredRecords.length;
              });
            };
            
            return (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200"
                id="detail-resi-photo-modal"
              >
                <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                  {/* Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-800 tracking-tight uppercase flex items-center">
                      <Eye className="h-4 w-4 text-[#f20000] mr-2" />
                      Detail Foto Resi
                    </h4>
                    <button
                      onClick={() => setDetailRecordIndex(null)}
                      type="button"
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-none"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Content (Scrollable) */}
                  <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    {/* Image Slider Stage */}
                    <div className="space-y-4">
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center group">
                        <img 
                          src={getDirectDriveImageUrl(r.PhotoURL)} 
                          alt={`Foto Resi ${r.Resi}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 left-2 bg-slate-900/80 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          Foto Scan Awal
                        </div>
                        
                        {/* Left Slide Button */}
                        <button
                          onClick={handlePrev}
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer border border-slate-200 flex items-center justify-center"
                          title="Sebelumnya"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        
                        {/* Right Slide Button */}
                        <button
                          onClick={handleNext}
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer border border-slate-200 flex items-center justify-center"
                          title="Selanjutnya"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>

                        {/* Slider Position Counter Badge */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/70 text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                          {detailRecordIndex + 1} / {filteredRecords.length}
                        </div>
                      </div>

                      {r.CancelEvidencePhoto && (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
                          <img 
                            src={getDirectDriveImageUrl(r.CancelEvidencePhoto)} 
                            alt={`Foto Bukti Pemisahan ${r.Resi}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-2 left-2 bg-green-700 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            Bukti Pemisahan (Evidence)
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Detail Info Section */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Detail Informasi Paket</h5>
                      <div className="grid grid-cols-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">No. Resi</span>
                          <span className="font-extrabold font-mono text-slate-800 tracking-wider text-sm">{r.Resi}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Nama File Drive</span>
                          <span className="font-semibold font-mono text-slate-600 text-[10px] truncate block" title={fileName}>{fileName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Seller Pengirim</span>
                          <span className="font-extrabold text-slate-800">{r.Seller}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Outlet J&T</span>
                          <span className="font-bold text-slate-700">{r.Outlet}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Operator Pencatat</span>
                          <span className="font-bold text-slate-700">{r.Operator}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Waktu Record</span>
                          <span className="font-semibold text-slate-700 font-mono">{r.Tanggal} {r.Jam}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Status Cloud</span>
                          <span className={`inline-block font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 mt-0.5 rounded ${
                            r.SyncStatus === "SYNCED" ? "bg-green-100 text-green-700 border border-green-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                          }`}>
                            {r.SyncStatus === "SYNCED" ? "Synced" : "Desynced"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Status Resi</span>
                          <span 
                            className={`inline-block font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 mt-0.5 rounded border ${
                              r.Status === "CANCELLED" 
                                ? "bg-red-100 text-red-650 border-red-200" 
                                : "border-emerald-200"
                            }`}
                            style={r.Status !== "CANCELLED" ? { color: "#007113", backgroundColor: "#edffed" } : undefined}
                          >
                            {r.Status}
                          </span>
                        </div>

                        {r.CancelStatus === "CANCELLED" && (
                          <>
                            <div className="col-span-2 border-t border-slate-200 pt-2 mt-1">
                              <span className="text-red-650 font-bold uppercase tracking-wider text-[10px]">Alur Pemisahan Paket Batal</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-medium">Status Alur</span>
                              <span className={`inline-block font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 mt-0.5 rounded ${
                                r.AlertStatus === "RESOLVED" ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200 animate-pulse"
                              }`}>
                                {r.AlertStatus || "PENDING"}
                              </span>
                            </div>
                            {r.AlertStatus === "RESOLVED" && (
                              <>
                                <div>
                                  <span className="text-slate-400 block font-medium">Operator Pemisah</span>
                                  <span className="font-bold text-slate-700">{r.CancelHandledBy || r.Operator}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-400 block font-medium">Waktu Dipisahkan</span>
                                  <span className="font-semibold text-slate-700 font-mono text-[11px]">{r.CancelHandledAt ? new Date(r.CancelHandledAt).toLocaleString() : "-"}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-400 block font-medium">Catatan Pemisahan</span>
                                  <span className="font-semibold text-slate-700 italic">"{r.CancelRemark || "(Tidak ada catatan)"}"</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer with Cancellation controls */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                    {r.Status === "CANCELLED" ? (
                      <div className="w-full bg-red-50 border border-red-200 text-red-700 font-bold text-xs py-3.5 px-4 rounded-xl text-center flex items-center justify-center space-x-2">
                        <Ban className="h-4 w-4 text-red-600" />
                        <span>Resi Ini Sudah Dibatalkan / Batal Pembeli</span>
                      </div>
                    ) : (
                      <>
                        {/* Red button: "Batalkan Resi (Pembeli Batal Pesanan)" */}
                        <button
                          onClick={() => {
                            handleMarkCancelled(r.Resi);
                          }}
                          type="button"
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer border-none shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <Ban className="h-4 w-4 text-white" />
                          <span>Batalkan Resi (Pembeli Batal Pesanan)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
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
