/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
  Package, 
  Send, 
  ListFilter, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  X, 
  Eye, 
  CheckSquare, 
  Square, 
  UploadCloud,
  FileText,
  User,
  Home,
  Truck,
  Trash2,
  Printer,
  Calendar,
  Sparkles
} from "lucide-react";
import { 
  ReturRecord, 
  ReturHandover, 
  ReturKondisi, 
  ReturMetode, 
  RETUR_STATUS, 
  RETUR_KONDISI, 
  RETUR_METODE,
  Seller
} from "../types";
import { dbService, getDirectDriveImageUrl, getTodayLocalDateString } from "../utils/db";
import { SellerService } from "../utils/sellerService";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

interface ReturScreenProps {
  currentOutlet?: string;
  currentOperator?: string;
  onBack?: () => void;
  isReadOnly?: boolean;
}

export const ReturScreen: React.FC<ReturScreenProps> = ({
  currentOutlet = "",
  currentOperator = "",
  onBack,
  isReadOnly = false
}) => {
  // Tab state: "TERIMA" | "SERAHKAN" | "MANIFEST" | "DAFTAR"
  const [activeTab, setActiveTab] = useState<"TERIMA" | "SERAHKAN" | "MANIFEST" | "DAFTAR">(
    isReadOnly ? "DAFTAR" : "TERIMA"
  );

  // Database lists
  const [returs, setReturs] = useState<ReturRecord[]>([]);
  const [handovers, setHandovers] = useState<ReturHandover[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [pendingReturCount, setPendingReturCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active Photo Modal
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // ==========================================
  // TAB 1: FORM TERIMA (DENGAN SESI & AUTOFILL)
  // ==========================================
  const [sessionTglDatang, setSessionTglDatang] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("jt_retur_session_tgldatang");
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
    } catch (_) {}
    return getTodayLocalDateString();
  });

  const [terimaResi, setTerimaResi] = useState("");
  const [terimaSellerId, setTerimaSellerId] = useState("");
  const [terimaSellerName, setTerimaSellerName] = useState("");
  const [terimaSumber, setTerimaSumber] = useState("");
  const [terimaKondisi, setTerimaKondisi] = useState<ReturKondisi>(RETUR_KONDISI.BAIK);
  const [terimaIsiPaket, setTerimaIsiPaket] = useState("");
  const [terimaCatatan, setTerimaCatatan] = useState("");
  const [terimaPhoto, setTerimaPhoto] = useState<string>("");
  const [isTerimaScannerOpen, setIsTerimaScannerOpen] = useState(false);
  const [isSubmittingTerima, setIsSubmittingTerima] = useState(false);

  // Autofill & Manual Seller Input State
  const [autofillBadge, setAutofillBadge] = useState<{ found: boolean; tanggal?: string; seller?: string } | null>(null);
  const [isManualSeller, setIsManualSeller] = useState(false);
  const [manualSellerText, setManualSellerText] = useState("");

  // ==========================================
  // TAB 2: FORM SERAHKAN
  // ==========================================
  const [serahSellerId, setSerahSellerId] = useState("");
  const [serahSellerName, setSerahSellerName] = useState("");
  const [serahSelectedResis, setSerahSelectedResis] = useState<string[]>([]);
  const [serahMetode, setSerahMetode] = useState<ReturMetode>(RETUR_METODE.AMBIL_DI_OUTLET);
  const [serahNamaPenerima, setSerahNamaPenerima] = useState("");
  const [serahCatatan, setSerahCatatan] = useState("");
  const [serahPhoto, setSerahPhoto] = useState<string>("");
  const [serahResiQuickInput, setSerahResiQuickInput] = useState("");
  const [isSubmittingSerah, setIsSubmittingSerah] = useState(false);

  // ==========================================
  // TAB 3: MANIFEST HAND OVER RETURAN
  // ==========================================
  const [manifestSellerId, setManifestSellerId] = useState("");
  const [manifestSelectedResis, setManifestSelectedResis] = useState<string[]>([]);
  const [manifestOutlet, setManifestOutlet] = useState(currentOutlet || "J&T Express");
  const [manifestPetugas, setManifestPetugas] = useState(currentOperator || "Admin J&T");

  // ==========================================
  // TAB 4: DAFTAR FILTERS
  // ==========================================
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "DITERIMA" | "DISERAHKAN">("ALL");
  const [filterSeller, setFilterSeller] = useState("ALL");

  // Camera scanner ref
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Refresh data from dbService
  const loadData = () => {
    setReturs(dbService.getReturs());
    setHandovers(dbService.getHandovers());
    setPendingReturCount(dbService.getPendingReturCount());
    setSellers(SellerService.getAll());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("jt_retur_updated", handleUpdate);
    window.addEventListener("jt_sellers_updated", handleUpdate);
    return () => {
      window.removeEventListener("jt_retur_updated", handleUpdate);
      window.removeEventListener("jt_sellers_updated", handleUpdate);
    };
  }, []);

  // Cleanup scanner on unmount or tab change
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear();
        } catch (_) {}
      }
    };
  }, [activeTab]);

  // Helper lookup resi dari pickup record (memory cache dulu, fallback IndexedDB, tanpa network)
  const lookupSellerForResi = async (rawResi: string) => {
    const clean = rawResi.trim().toUpperCase();
    if (!clean) {
      setAutofillBadge(null);
      return;
    }
    const res = await dbService.findPickupRecordByResi(clean);
    if (res.found && res.record && res.record.Seller) {
      const sName = res.record.Seller.trim();
      setAutofillBadge({ found: true, tanggal: res.record.Tanggal, seller: sName });
      const matched = sellers.find(s => s.nama.trim().toLowerCase() === sName.toLowerCase());
      if (matched) {
        setTerimaSellerId(matched.id || matched.kodeSeller || "SELLER-" + matched.nama);
        setTerimaSellerName(matched.nama);
        setIsManualSeller(false);
        setManualSellerText("");
      } else {
        setTerimaSellerId("MANUAL:" + sName.toUpperCase().trim());
        setTerimaSellerName(sName);
        setIsManualSeller(true);
        setManualSellerText(sName);
      }
      toast.info(`Seller terdeteksi otomatis: ${sName}`);
    } else {
      setAutofillBadge(null);
    }
  };

  // Handle starting barcode scanner in Terima tab
  const toggleTerimaScanner = async () => {
    if (isTerimaScannerOpen) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }
      setIsTerimaScannerOpen(false);
    } else {
      setIsTerimaScannerOpen(true);
      setTimeout(async () => {
        try {
          const qr = new Html5Qrcode("retur-camera-reader");
          scannerRef.current = qr;
          await qr.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: { width: 260, height: 160 }
            },
            (decodedText) => {
              const cleaned = decodedText.trim().toUpperCase();
              setTerimaResi(cleaned);
              lookupSellerForResi(cleaned);
              toast.success("Resi terdeteksi: " + cleaned);
              // Auto stop scanner after reading
              try {
                qr.stop().then(() => qr.clear()).catch(() => {});
              } catch (_) {}
              scannerRef.current = null;
              setIsTerimaScannerOpen(false);
            },
            () => {}
          );
        } catch (err: any) {
          console.warn("Camera start failed:", err);
          toast.error("Gagal membuka kamera: " + (err?.message || "Izin ditolak"));
          setIsTerimaScannerOpen(false);
        }
      }, 150);
    }
  };

  // Compress image helper (max 640px, JPEG 70%)
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 640;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas error"));
          ctx.drawImage(img, 0, 0, w, h);

          // Add timestamp watermark
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(8, h - 28, 240, 22);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px monospace";
          ctx.fillText(`RETUR • ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`, 14, h - 13);

          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error("Gagal membaca gambar"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("File error"));
      reader.readAsDataURL(file);
    });
  };

  // Handle Photo input for Terima
  const handleTerimaPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await processImageFile(file);
      setTerimaPhoto(compressed);
      toast.success("Foto kondisi paket berhasil diambil!");
    } catch (err: any) {
      toast.error("Gagal memproses foto: " + err.message);
    }
  };

  // Handle Photo input for Serah
  const handleSerahPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await processImageFile(file);
      setSerahPhoto(compressed);
      toast.success("Foto bukti penyerahan berhasil diambil!");
    } catch (err: any) {
      toast.error("Gagal memproses foto: " + err.message);
    }
  };

  // Submit Alur A: Terima Retur
  const handleSubmitTerima = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTerima) return;

    if (!terimaResi.trim()) {
      toast.error("Validasi Gagal", { description: "Nomor resi retur wajib diisi!" });
      return;
    }
    if (!terimaSellerId || !terimaSellerName) {
      toast.error("Validasi Gagal", { description: "Pilih seller tujuan retur terlebih dahulu!" });
      return;
    }
    if (!terimaSumber.trim()) {
      toast.error("Validasi Gagal", { description: "Sumber pengirim (Gudang/DP) wajib diisi!" });
      return;
    }
    if (!terimaPhoto) {
      toast.error("Validasi Gagal", { description: "Foto kondisi paket + resi wajib diambil (Rule 1)!" });
      return;
    }

    setIsSubmittingTerima(true);
    try {
      const result = await dbService.addRetur({
        resi: terimaResi,
        sellerId: terimaSellerId,
        seller: terimaSellerName,
        outlet: currentOutlet || "Outlet Pusat",
        sumber: terimaSumber,
        tglDatang: sessionTglDatang,
        kondisi: terimaKondisi,
        isiPaket: terimaIsiPaket,
        fotoTerima: terimaPhoto,
        catatan: terimaCatatan,
        adminTerima: currentOperator || "Admin Outlet"
      });

      if (result.success) {
        toast.success("Paket Retur Berhasil Diterima!", {
          description: `Resi ${terimaResi.toUpperCase()} telah dicatat dengan status DITERIMA.`
        });
        // Reset form (IsiPaket dikosongkan per resi, sessionTglDatang tetap utuh)
        setTerimaResi("");
        setTerimaIsiPaket("");
        setTerimaSumber("");
        setTerimaCatatan("");
        setTerimaPhoto("");
        setAutofillBadge(null);
        setTerimaKondisi(RETUR_KONDISI.BAIK);
        loadData();
      } else {
        toast.error("Gagal Menyimpan Retur", {
          description: result.error || "Terjadi kesalahan saat menyimpan data."
        });
      }
    } finally {
      setIsSubmittingTerima(false);
    }
  };

  // Submit Alur B: Serah Terima
  const handleSubmitSerah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingSerah) return;

    if (!serahSellerId || !serahSellerName) {
      toast.error("Validasi Gagal", { description: "Pilih seller terlebih dahulu!" });
      return;
    }
    if (serahSelectedResis.length === 0) {
      toast.error("Validasi Gagal", { description: "Pilih minimal 1 resi retur yang akan diserahkan!" });
      return;
    }
    if (!serahNamaPenerima.trim()) {
      toast.error("Validasi Gagal", { description: "Nama penerima wajib diisi!" });
      return;
    }
    if (!serahPhoto) {
      toast.error("Validasi Gagal", { description: "Foto bukti penyerahan paket wajib diambil!" });
      return;
    }

    setIsSubmittingSerah(true);
    try {
      const result = await dbService.createHandover({
        sellerId: serahSellerId,
        seller: serahSellerName,
        outlet: currentOutlet || "Outlet Pusat",
        adminSerah: currentOperator || "Admin Outlet",
        metode: serahMetode,
        resiList: serahSelectedResis,
        namaPenerima: serahNamaPenerima,
        fotoBukti: serahPhoto,
        catatan: serahCatatan
      });

      if (result.success) {
        toast.success("Serah Terima Berhasil Disimpan!", {
          description: `${serahSelectedResis.length} resi retur telah diserahkan (ID: ${result.handover?.HandoverID}).`
        });
        // Reset form
        setSerahSelectedResis([]);
        setSerahNamaPenerima("");
        setSerahCatatan("");
        setSerahPhoto("");
        loadData();
      } else {
        toast.error("Gagal Serah Terima", {
          description: result.error || "Terjadi kesalahan validasi di database."
        });
      }
    } finally {
      setIsSubmittingSerah(false);
    }
  };

  // Manual Trigger Sync
  const handleSyncRetur = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await dbService.syncPendingReturs();
      if (res.errors.length > 0) {
        toast.error("Sinkronisasi Parsial", {
          description: res.errors.join("; ")
        });
      } else {
        toast.success("Sinkronisasi Selesai", {
          description: `Berhasil sinkron ${res.syncedReturs} retur dan ${res.syncedHandovers} serah terima.`
        });
      }
      loadData();
    } catch (e: any) {
      toast.error("Sinkronisasi Gagal", { description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // Available returs for selected seller in Serah Terima
  const availableRetursForSeller = returs.filter(
    r => r.SellerID === serahSellerId && r.Status === RETUR_STATUS.DITERIMA && !r.DeletedAt
  );

  // Quick toggle resi in Serah Terima
  const toggleResiSelection = (resi: string) => {
    setSerahSelectedResis(prev => 
      prev.includes(resi) ? prev.filter(r => r !== resi) : [...prev, resi]
    );
  };

  // Select all or deselect all for current seller in Serah Terima
  const toggleSelectAllResis = () => {
    if (serahSelectedResis.length === availableRetursForSeller.length) {
      setSerahSelectedResis([]);
    } else {
      setSerahSelectedResis(availableRetursForSeller.map(r => r.Resi));
    }
  };

  // Handle quick scan resi into Serah selection
  const handleQuickAddResiToSerah = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = serahResiQuickInput.trim().toUpperCase();
    if (!clean) return;

    const matched = availableRetursForSeller.find(r => r.Resi === clean);
    if (!matched) {
      toast.error(`Resi ${clean} tidak ditemukan atau bukan berstatus DITERIMA milik ${serahSellerName}.`);
    } else {
      if (!serahSelectedResis.includes(clean)) {
        setSerahSelectedResis(prev => [...prev, clean]);
        toast.success(`Resi ${clean} ditambahkan ke daftar serah terima!`);
      } else {
        toast.info(`Resi ${clean} sudah dipilih.`);
      }
    }
    setSerahResiQuickInput("");
  };

  // ==========================================
  // MANIFEST HELPERS & DATA
  // ==========================================
  const sellersWithDiterima = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    returs.forEach(r => {
      if (r.Status === RETUR_STATUS.DITERIMA && !r.DeletedAt) {
        const existing = map.get(r.SellerID);
        if (!existing) {
          map.set(r.SellerID, { id: r.SellerID, name: r.Seller || r.SellerID, count: 1 });
        } else {
          existing.count++;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [returs]);

  const manifestAvailableReturs = React.useMemo(() => {
    if (!manifestSellerId) return [];
    return returs.filter(
      r => r.SellerID === manifestSellerId && r.Status === RETUR_STATUS.DITERIMA && !r.DeletedAt
    );
  }, [manifestSellerId, returs]);

  useEffect(() => {
    if (!manifestSellerId && sellersWithDiterima.length > 0) {
      setManifestSellerId(sellersWithDiterima[0].id);
    }
  }, [sellersWithDiterima, manifestSellerId]);

  useEffect(() => {
    if (manifestSellerId) {
      const items = returs.filter(r => r.SellerID === manifestSellerId && r.Status === RETUR_STATUS.DITERIMA && !r.DeletedAt);
      setManifestSelectedResis(items.map(r => r.Resi));
    } else {
      setManifestSelectedResis([]);
    }
  }, [manifestSellerId, returs]);

  const selectedManifestRecords = manifestAvailableReturs.filter(r => manifestSelectedResis.includes(r.Resi));
  const blankRowsCount = Math.max(0, 10 - selectedManifestRecords.length);

  const toggleManifestResiSelection = (resi: string) => {
    setManifestSelectedResis(prev =>
      prev.includes(resi) ? prev.filter(r => r !== resi) : [...prev, resi]
    );
  };

  const toggleSelectAllManifestResis = () => {
    if (manifestSelectedResis.length === manifestAvailableReturs.length) {
      setManifestSelectedResis([]);
    } else {
      setManifestSelectedResis(manifestAvailableReturs.map(r => r.Resi));
    }
  };

  const handlePrintManifest = () => {
    if (selectedManifestRecords.length === 0) {
      toast.error("Pilih minimal 1 resi retur untuk dicetak!");
      return;
    }
    window.print();
  };

  const handleLanjutSerahTerima = () => {
    if (selectedManifestRecords.length === 0) {
      toast.error("Pilih minimal 1 resi retur terlebih dahulu!");
      return;
    }
    const currentSellerObj = sellersWithDiterima.find(s => s.id === manifestSellerId);
    const sName = currentSellerObj?.name || (selectedManifestRecords[0]?.Seller) || manifestSellerId;
    setSerahSellerId(manifestSellerId);
    setSerahSellerName(sName);
    setSerahSelectedResis([...manifestSelectedResis]);
    setActiveTab("SERAHKAN");
    toast.success(`${manifestSelectedResis.length} resi dialihkan ke tab Serah Terima`);
  };

  // Filtered returs for Tab 4 (Daftar)
  const filteredReturs = returs.filter(r => {
    if (r.DeletedAt) return false;
    if (filterStatus !== "ALL" && r.Status !== filterStatus) return false;
    if (filterSeller !== "ALL" && r.SellerID !== filterSeller && r.Seller !== filterSeller) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toUpperCase();
      const matchResi = r.Resi.toUpperCase().includes(q);
      const matchSeller = r.Seller.toUpperCase().includes(q);
      const matchSumber = (r.Sumber || "").toUpperCase().includes(q);
      const matchHandover = (r.HandoverID || "").toUpperCase().includes(q);
      if (!matchResi && !matchSeller && !matchSumber && !matchHandover) return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-5 overflow-x-hidden">
      {/* Top Header & Context Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-red-50 text-red-650 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                FASE 1
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                📦 Kelola Paket Retur
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan siklus paket retur dari DP/Gudang ke outlet hingga serah terima seller.
            </p>
          </div>
        </div>

        {/* Sync Status Badge & Action */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {pendingReturCount > 0 ? (
            <button
              onClick={handleSyncRetur}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Upload perubahan retur ke Google Sheets"
            >
              <UploadCloud className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkron..." : `${pendingReturCount} Pending Sync`}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Semua Retur Sinkron</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Row (Terima | Serahkan | Manifest | Daftar) */}
      <div className={`grid ${isReadOnly ? "grid-cols-2" : "grid-cols-4"} bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1 text-xs font-bold select-none no-print`}>
        {!isReadOnly && (
          <button
            onClick={() => setActiveTab("TERIMA")}
            className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === "TERIMA"
                ? "bg-red-600 text-white shadow-sm font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Terima Retur</span>
          </button>
        )}

        {!isReadOnly && (
          <button
            onClick={() => setActiveTab("SERAHKAN")}
            className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === "SERAHKAN"
                ? "bg-red-600 text-white shadow-sm font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Serah ke Seller</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("MANIFEST")}
          className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "MANIFEST"
              ? "bg-red-600 text-white shadow-sm font-extrabold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Manifest Cetak</span>
        </button>

        <button
          onClick={() => setActiveTab("DAFTAR")}
          className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "DAFTAR"
              ? "bg-red-600 text-white shadow-sm font-extrabold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ListFilter className="h-3.5 w-3.5" />
          <span>Daftar Retur ({returs.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TERIMA RETUR                                      */}
      {/* ======================================================== */}
      {activeTab === "TERIMA" && !isReadOnly && (
        <form onSubmit={handleSubmitTerima} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center">
              <Package className="h-4 w-4 mr-2 text-red-600" />
              Alur A — Retur Masuk (Paket Datang ke Outlet)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Admin scan resi dan ambil foto kondisi paket saat paket retur tiba di outlet.
            </p>
          </div>

          {/* Panel Sesi Kedatangan (Per Koli / DP) */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-amber-900 flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-amber-700" /> Sesi Tanggal Kedatangan:
              </span>
              <input
                type="date"
                value={sessionTglDatang}
                onChange={(e) => {
                  const val = e.target.value;
                  setSessionTglDatang(val);
                  try {
                    localStorage.setItem("jt_retur_session_tgldatang", val);
                  } catch (_) {}
                }}
                className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-red-600"
              />
            </div>
            <span className="text-[11px] text-amber-800/80 italic">
              * Tanggal kedatangan berlaku untuk seluruh resi dalam sesi kedatangan/koli ini.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Resi & Kamera Scanner Button */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nomor Resi Retur <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={terimaResi}
                  onChange={(e) => {
                    const clean = e.target.value.trim().toUpperCase();
                    setTerimaResi(clean);
                    lookupSellerForResi(clean);
                  }}
                  onBlur={() => {
                    if (terimaResi) lookupSellerForResi(terimaResi);
                  }}
                  placeholder="Scan atau ketik nomor resi..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={toggleTerimaScanner}
                  className={`px-3 py-2.5 rounded-xl border flex items-center justify-center text-xs font-bold transition-all ${
                    isTerimaScannerOpen
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                  title="Scan pakai kamera"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  <span>{isTerimaScannerOpen ? "Tutup" : "Scan"}</span>
                </button>
              </div>

              {/* In-page Camera Reader Container */}
              {isTerimaScannerOpen && (
                <div className="mt-2 border-2 border-red-400 rounded-2xl p-2 bg-black overflow-hidden relative">
                  <div id="retur-camera-reader" className="w-full h-56 rounded-xl overflow-hidden bg-black" />
                  <p className="text-center text-[10px] text-zinc-400 mt-1 font-medium">
                    Arahkan kamera ke barcode resi paket retur.
                  </p>
                </div>
              )}
            </div>

            {/* Seller Selection with Autofill Badge & Manual Override */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Seller Tujuan <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualSeller(prev => !prev);
                    if (!isManualSeller) {
                      setManualSellerText(terimaSellerName);
                      if (terimaSellerName) {
                        setTerimaSellerId("MANUAL:" + terimaSellerName.toUpperCase().trim());
                      }
                    }
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline"
                >
                  {isManualSeller ? "Pilih dari Master Seller" : "+ Ketik Nama Toko Manual"}
                </button>
              </div>

              {autofillBadge?.found && (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <span className="flex items-center">
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Terisi otomatis dari data pickup (tgl {autofillBadge.tanggal})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAutofillBadge(null);
                      setTerimaSellerId("");
                      setTerimaSellerName("");
                      setManualSellerText("");
                    }}
                    className="text-red-600 hover:underline font-bold text-[10px]"
                  >
                    Ganti
                  </button>
                </div>
              )}

              {isManualSeller ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={manualSellerText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualSellerText(val);
                      setTerimaSellerName(val);
                      setTerimaSellerId("MANUAL:" + val.toUpperCase().trim());
                    }}
                    placeholder="Ketik nama toko/seller manual sesuai resi..."
                    className="w-full bg-slate-50 border border-blue-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  <p className="text-[10px] text-blue-600 italic">
                    Mode input manual (untuk toko online berbeda atau belum ada di master seller).
                  </p>
                </div>
              ) : (
                <select
                  value={terimaSellerId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    if (selId === "__CUSTOM__") {
                      setIsManualSeller(true);
                      setManualSellerText("");
                      setTerimaSellerId("");
                      setTerimaSellerName("");
                      return;
                    }
                    setTerimaSellerId(selId);
                    const s = sellers.find(x => x.id === selId || x.kodeSeller === selId || x.nama === selId);
                    setTerimaSellerName(s ? s.nama : selId);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                >
                  <option value="">-- Pilih Seller Pemilik Paket --</option>
                  {sellers.map((s, idx) => (
                    <option key={`sel-opt-${idx}-${s.id || s.nama}`} value={s.id || s.nama}>
                      {s.nama} ({s.kodeSeller || "Master"})
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Ketik Nama Toko / Seller Manual...</option>
                </select>
              )}
            </div>

            {/* Sumber Pengirim (Gudang/DP) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Sumber Pengirim (Gudang / DP) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={terimaSumber}
                onChange={(e) => setTerimaSumber(e.target.value)}
                placeholder="Contoh: DP Balaraja, Gudang DC Bitung, dll."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              />
            </div>

            {/* Kondisi Paket */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kondisi Paket <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[RETUR_KONDISI.BAIK, RETUR_KONDISI.RUSAK, RETUR_KONDISI.SEGEL_TERBUKA].map((kondisi) => (
                  <button
                    key={kondisi}
                    type="button"
                    onClick={() => setTerimaKondisi(kondisi)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      terimaKondisi === kondisi
                        ? kondisi === RETUR_KONDISI.BAIK
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                          : "bg-red-600 text-white border-red-700 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {kondisi}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Isi Paket / Keterangan Barang (Opsional, per resi, maks 60 char) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Isi Paket / Keterangan Barang (Opsional)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {terimaIsiPaket.length}/60
              </span>
            </div>
            <input
              type="text"
              maxLength={60}
              value={terimaIsiPaket}
              onChange={(e) => setTerimaIsiPaket(e.target.value.slice(0, 60))}
              placeholder="Contoh: Baju Gamis Merah / Sepatu Uk 42 (Maks 60 char)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
            />
          </div>

          {/* Catatan Opsional */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Catatan Paket (Opsional)
            </label>
            <input
              type="text"
              value={terimaCatatan}
              onChange={(e) => setTerimaCatatan(e.target.value)}
              placeholder="Keterangan tambahan jika paket rusak/robek..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
            />
          </div>

          {/* Foto Kondisi Paket (WAJIB - Rule 1) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center">
                <Camera className="h-4 w-4 mr-1.5 text-red-600" />
                Foto Kondisi Paket & Resi <span className="text-red-500 ml-1">* WAJIB</span>
              </span>
              {terimaPhoto && (
                <button
                  type="button"
                  onClick={() => setTerimaPhoto("")}
                  className="text-[11px] text-red-600 hover:underline font-bold"
                >
                  Hapus / Ambil Ulang
                </button>
              )}
            </label>

            {terimaPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 w-full max-w-sm mx-auto">
                <img src={terimaPhoto} alt="Kondisi Paket" className="w-full h-48 object-cover" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-lg flex items-center justify-between">
                  <span>✓ Foto Terlampir</span>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({ url: terimaPhoto, title: "Foto Kondisi Paket Terima" })}
                    className="underline font-bold flex items-center"
                  >
                    <Eye className="h-3 w-3 mr-1" /> Perbesar
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 rounded-2xl p-6 cursor-pointer transition-all">
                <Camera className="h-8 w-8 text-red-500 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  Ambil Foto Kondisi Paket
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Foto langsung dengan kamera HP atau unggah bukti foto (Max 640px)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleTerimaPhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmittingTerima}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all text-sm"
            >
              {isSubmittingTerima ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyimpan Retur...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Paket Retur Masuk (DITERIMA)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SERAH TERIMA KE SELLER                            */}
      {/* ======================================================== */}
      {activeTab === "SERAHKAN" && !isReadOnly && (
        <form onSubmit={handleSubmitSerah} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center">
              <Send className="h-4 w-4 mr-2 text-red-600" />
              Alur B — Serah Terima Paket ke Seller
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih seller, centang paket retur yang diserahkan, isi nama penerima dan foto bukti penyerahan.
            </p>
          </div>

          {/* Step 1: Pilih Seller */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Pilih Seller <span className="text-red-500">*</span>
            </label>
            <select
              value={serahSellerId}
              onChange={(e) => {
                const selId = e.target.value;
                setSerahSellerId(selId);
                const s = sellers.find(x => x.id === selId || x.kodeSeller === selId || x.nama === selId);
                setSerahSellerName(s ? s.nama : selId);
                setSerahSelectedResis([]); // reset selections on seller switch
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
            >
              <option value="">-- Pilih Seller Penerima Paket --</option>
              {sellers.map((s, idx) => (
                <option key={`serah-sel-${idx}-${s.id || s.nama}`} value={s.id || s.nama}>
                  {s.nama} ({s.kodeSeller || "Master"})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Pilih Resi yang Diserahkan */}
          {serahSellerId && (
            <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Paket Retur Siap Diserahkan ({availableRetursForSeller.length} Tersedia)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Jumlah Paket Terpilih: <strong className="text-red-600 font-mono text-xs">{serahSelectedResis.length}</strong> (Dihitung otomatis)
                  </p>
                </div>
                {availableRetursForSeller.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllResis}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    {serahSelectedResis.length === availableRetursForSeller.length ? "Batal Semua" : "Pilih Semua"}
                  </button>
                )}
              </div>

              {/* Quick Scan to Check Resi */}
              <div className="pt-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={serahResiQuickInput}
                    onChange={(e) => setSerahResiQuickInput(e.target.value)}
                    placeholder="Scan / ketik resi untuk mencentang..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddResiToSerah}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold"
                  >
                    Centang
                  </button>
                </div>
              </div>

              {/* List of Available Resis */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2">
                {availableRetursForSeller.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                    Tidak ada paket retur berstatus DITERIMA untuk seller ini.
                  </div>
                ) : (
                  availableRetursForSeller.map((r) => {
                    const isSelected = serahSelectedResis.includes(r.Resi);
                    return (
                      <div
                        key={r.ReturID}
                        onClick={() => toggleResiSelection(r.Resi)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? "bg-red-50 border-red-300 text-slate-900"
                            : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-red-600 flex-shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          )}
                          <div>
                            <span className="font-mono font-bold text-xs">{r.Resi}</span>
                            <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                              <span>Dari: {r.Sumber}</span>
                              <span>•</span>
                              <span>Kondisi: {r.Kondisi}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.TglTerima}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 3: Metode & Penerima */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. Metode Penyerahan <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSerahMetode(RETUR_METODE.AMBIL_DI_OUTLET)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                    serahMetode === RETUR_METODE.AMBIL_DI_OUTLET
                      ? "bg-red-600 text-white border-red-700 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Ambil di Outlet
                </button>
                <button
                  type="button"
                  onClick={() => setSerahMetode(RETUR_METODE.ANTAR_KE_SELLER)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                    serahMetode === RETUR_METODE.ANTAR_KE_SELLER
                      ? "bg-red-600 text-white border-red-700 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Antar ke Seller
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                4. Nama Penerima <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={serahNamaPenerima}
                onChange={(e) => setSerahNamaPenerima(e.target.value)}
                placeholder="Nama pihak seller yang menerima..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Catatan Serah */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Catatan Penyerahan (Opsional)
            </label>
            <input
              type="text"
              value={serahCatatan}
              onChange={(e) => setSerahCatatan(e.target.value)}
              placeholder="Contoh: Diserahkan langsung ke staf gudang..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
            />
          </div>

          {/* Foto Bukti Penyerahan (WAJIB - Rule 1) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center">
                <Camera className="h-4 w-4 mr-1.5 text-red-600" />
                5. Foto Bukti Penyerahan Paket <span className="text-red-500 ml-1">* WAJIB</span>
              </span>
              {serahPhoto && (
                <button
                  type="button"
                  onClick={() => setSerahPhoto("")}
                  className="text-[11px] text-red-600 hover:underline font-bold"
                >
                  Hapus / Ambil Ulang
                </button>
              )}
            </label>

            {serahPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 w-full max-w-sm mx-auto">
                <img src={serahPhoto} alt="Bukti Penyerahan" className="w-full h-48 object-cover" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-lg flex items-center justify-between">
                  <span>✓ Foto Bukti Terlampir</span>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({ url: serahPhoto, title: "Foto Bukti Penyerahan" })}
                    className="underline font-bold flex items-center"
                  >
                    <Eye className="h-3 w-3 mr-1" /> Perbesar
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 rounded-2xl p-6 cursor-pointer transition-all">
                <Camera className="h-8 w-8 text-red-500 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  Ambil Foto Bukti Penyerahan
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Foto serah terima paket bersama penerima
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleSerahPhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Submit Serah */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmittingSerah || serahSelectedResis.length === 0}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all text-sm"
            >
              {isSubmittingSerah ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyimpan Serah Terima...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Konfirmasi Serahkan {serahSelectedResis.length} Paket (DISERAHKAN)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MANIFEST HAND OVER RETURAN                        */}
      {/* ======================================================== */}
      {activeTab === "MANIFEST" && (
        <div className="space-y-4">
          {/* Controls & Seller Selector (no-print) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 no-print">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center">
                  <Printer className="h-4 w-4 mr-2 text-red-600" />
                  Manifest Hand Over Returan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cetak lembar resmi serah terima paket retur A4 dengan tanda tangan dan paraf bukti fisik.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintManifest}
                  disabled={selectedManifestRecords.length === 0}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Manifest (A4)</span>
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleLanjutSerahTerima}
                    disabled={selectedManifestRecords.length === 0}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Lanjut Serah Terima</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Seller filter (hanya seller yang punya paket DITERIMA) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Seller (Ada Paket Diterima) <span className="text-red-500">*</span>
                </label>
                <select
                  value={manifestSellerId}
                  onChange={(e) => setManifestSellerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                >
                  {sellersWithDiterima.length === 0 ? (
                    <option value="">(Belum ada paket retur DITERIMA)</option>
                  ) : (
                    sellersWithDiterima.map((s) => (
                      <option key={`man-sel-${s.id}`} value={s.id}>
                        {s.name} ({s.count} paket)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Outlet Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Outlet
                </label>
                <input
                  type="text"
                  value={manifestOutlet}
                  onChange={(e) => setManifestOutlet(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>

              {/* Petugas J&T */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Petugas J&T
                </label>
                <input
                  type="text"
                  value={manifestPetugas}
                  onChange={(e) => setManifestPetugas(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Resi Selection Checklist */}
            {manifestAvailableReturs.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Pilih Resi Untuk Dicetak ({selectedManifestRecords.length} dari {manifestAvailableReturs.length} dipilih)
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAllManifestResis}
                    className="text-red-600 hover:underline font-bold text-xs"
                  >
                    {manifestSelectedResis.length === manifestAvailableReturs.length ? "Batal Semua" : "Pilih Semua"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {manifestAvailableReturs.map((r) => {
                    const checked = manifestSelectedResis.includes(r.Resi);
                    return (
                      <button
                        key={r.ReturID}
                        type="button"
                        onClick={() => toggleManifestResiSelection(r.Resi)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
                          checked
                            ? "bg-red-50 border-red-300 text-red-700 shadow-xs"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {checked ? <CheckSquare className="h-3.5 w-3.5 text-red-600" /> : <Square className="h-3.5 w-3.5 text-slate-400" />}
                        <span>{r.Resi}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Printable Manifest Sheet (.manifest-print-root) */}
          <div className="manifest-print-root bg-white border border-slate-300 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-black">
            {/* Scoped print CSS (strictly isolating .manifest-print-root) */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 10mm 10mm 10mm 10mm;
                }
                body * {
                  visibility: hidden !important;
                }
                .manifest-print-root, .manifest-print-root * {
                  visibility: visible !important;
                }
                .manifest-print-root {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 8mm 10mm !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: none !important;
                  box-shadow: none !important;
                  display: block !important;
                }
                .no-print {
                  display: none !important;
                }
                table.manifest-table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                }
                table.manifest-table thead {
                  display: table-header-group !important;
                }
                table.manifest-table tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                table.manifest-table th, table.manifest-table td {
                  border: 1px solid #111111 !important;
                  color: #000000 !important;
                }
                .manifest-signature-block {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  margin-top: 20px !important;
                }
              }
            `}</style>

            {/* Manifest Header */}
            <div className="border-b-2 border-black pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-red-650 print:text-black">
                    J&T EXPRESS
                  </h1>
                  <p className="text-[10px] text-slate-600 print:text-black font-semibold">
                    PT. GLOBAL JET EXPRESS • E-COMMERCE PICKUP & RETUR
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] border border-black px-2 py-0.5 rounded font-mono font-bold">
                    DOKUMEN RESMI OUTLET
                  </span>
                </div>
              </div>

              <div className="text-center pt-1 pb-1">
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase underline">
                  MANIFEST HAND OVER RETURAN
                </h2>
                <p className="text-[11px] text-slate-600 print:text-black italic">
                  Lembar Tanda Terima Fisik Paket Retur dari Outlet ke Seller / Toko
                </p>
              </div>

              {/* Header Info Meta Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border border-black p-2.5 rounded bg-slate-50/50 print:bg-transparent">
                <div>
                  <span className="font-bold">Nama Seller / Toko: </span>
                  <span className="font-semibold underline">
                    {sellersWithDiterima.find(s => s.id === manifestSellerId)?.name || (selectedManifestRecords[0]?.Seller) || "-"}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Tanggal Cetak: </span>
                  <span>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <div>
                  <span className="font-bold">Outlet Asal: </span>
                  <span>{manifestOutlet || "-"}</span>
                </div>
                <div>
                  <span className="font-bold">Petugas J&T: </span>
                  <span>{manifestPetugas || "-"}</span>
                </div>
              </div>
            </div>

            {/* Table Resi with Repeating Header and Minimum 10 Rows */}
            <div className="overflow-x-auto">
              <table className="manifest-table w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200 text-black font-bold border-b border-black">
                    <th className="border border-black px-2 py-1.5 text-center w-10">No</th>
                    <th className="border border-black px-2 py-1.5 text-left w-36">No. Resi Retur</th>
                    <th className="border border-black px-2 py-1.5 text-center w-24">Tgl Datang</th>
                    <th className="border border-black px-2 py-1.5 text-center w-24">Kondisi</th>
                    <th className="border border-black px-2 py-1.5 text-left">Isi Paket / Keterangan</th>
                    <th className="border border-black px-2 py-1.5 text-center w-24">Paraf Cek</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedManifestRecords.map((r, idx) => (
                    <tr key={r.ReturID} className="border-b border-black">
                      <td className="border border-black px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black px-2 py-1.5 font-mono font-bold">{r.Resi}</td>
                      <td className="border border-black px-2 py-1.5 text-center font-mono">{r.TglDatang || r.TglTerima}</td>
                      <td className="border border-black px-2 py-1.5 text-center font-bold">{r.Kondisi}</td>
                      <td className="border border-black px-2 py-1.5">{r.IsiPaket || r.Catatan || "-"}</td>
                      <td className="border border-black px-2 py-1.5 text-center"></td>
                    </tr>
                  ))}

                  {/* Render Blank Rows if Fewer than 10 */}
                  {Array.from({ length: blankRowsCount }).map((_, bIdx) => {
                    const rowNum = selectedManifestRecords.length + bIdx + 1;
                    return (
                      <tr key={`blank-row-${bIdx}`} className="border-b border-black text-slate-400 print:text-slate-500">
                        <td className="border border-black px-2 py-2 text-center font-mono">{rowNum}</td>
                        <td className="border border-black px-2 py-2 font-mono">................................</td>
                        <td className="border border-black px-2 py-2 text-center font-mono">....-..-..</td>
                        <td className="border border-black px-2 py-2 text-center">........</td>
                        <td className="border border-black px-2 py-2">................................................</td>
                        <td className="border border-black px-2 py-2 text-center"></td>
                      </tr>
                    );
                  })}

                  {/* Summary Total Row */}
                  <tr className="bg-slate-50 print:bg-slate-100 font-bold border-t-2 border-black">
                    <td colSpan={4} className="border border-black px-3 py-2 text-right uppercase">
                      Total Paket Retur:
                    </td>
                    <td colSpan={2} className="border border-black px-3 py-2 text-left font-mono text-sm">
                      <strong>{selectedManifestRecords.length} Paket</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature Block (break-inside avoid) */}
            <div className="manifest-signature-block pt-6">
              <p className="text-[10px] text-slate-600 print:text-black italic mb-4">
                * Dengan menandatangani manifest ini, pihak seller menyatakan telah menerima paket retur di atas dalam kondisi sesuai catatan.
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-black uppercase">
                    Diserahkan Oleh (J&T Express)
                  </p>
                  <p className="text-[10px] text-slate-500 print:text-black">
                    Petugas Outlet
                  </p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="text-slate-300 text-[10px] italic print:hidden">(Tanda Tangan)</span>
                  </div>
                  <div className="border-b border-black w-48 mx-auto"></div>
                  <p className="text-xs font-bold text-black mt-1 font-mono">
                    ( {manifestPetugas || "......................."} )
                  </p>
                  <p className="text-[10px] text-slate-600 print:text-black">
                    Tgl: {new Date().toLocaleDateString("id-ID")}
                  </p>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-black uppercase">
                    Diterima Oleh (Seller / Toko)
                  </p>
                  <p className="text-[10px] text-slate-500 print:text-black">
                    Penerima / Pemilik Paket
                  </p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="text-slate-300 text-[10px] italic print:hidden">(Tanda Tangan & Cap)</span>
                  </div>
                  <div className="border-b border-black w-48 mx-auto"></div>
                  <p className="text-xs font-bold text-black mt-1 font-mono">
                    ( ..................................... )
                  </p>
                  <p className="text-[10px] text-slate-600 print:text-black">
                    Tgl: ..... / ..... / 202...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: DAFTAR RETUR (Dapat dilihat Admin/Operator & Owner)*/}
      {/* ======================================================== */}
      {(activeTab === "DAFTAR" || isReadOnly) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center">
                <ListFilter className="h-4 w-4 mr-2 text-red-600" />
                Daftar Paket Retur ({filteredReturs.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Histori lengkap paket retur yang tercatat di outlet.
              </p>
            </div>
            
            <button
              onClick={() => dbService.pullReturs()}
              className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              title="Tarik data terbaru dari Google Sheets"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Search Resi */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Cari resi / seller / sumber..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              />
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="DITERIMA">Status: DITERIMA (Di Outlet)</option>
                <option value="DISERAHKAN">Status: DISERAHKAN (Ke Seller)</option>
              </select>
            </div>

            {/* Filter Seller */}
            <div>
              <select
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              >
                <option value="ALL">Semua Seller</option>
                {sellers.map((s, idx) => (
                  <option key={`flt-sel-${idx}-${s.id || s.nama}`} value={s.id || s.nama}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner jika ada paket retur gagal sync / duplikat */}
          {returs.some(r => r.SyncStatus === "FAILED") && !isReadOnly && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>
                  Terdapat <strong>{returs.filter(r => r.SyncStatus === "FAILED").length}</strong> paket retur berstatus gagal (duplikat). Hapus data gagal agar resi dapat discan ulang.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Hapus semua data retur yang gagal sync dari perangkat lokal? Resi-resi tersebut akan dapat discan ulang.")) {
                    const count = await dbService.clearAllFailedReturs();
                    toast.success(`${count} data retur gagal dibersihkan.`);
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all self-start sm:self-auto shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus Semua Data Gagal</span>
              </button>
            </div>
          )}

          {/* List Items Card View */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
            {filteredReturs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                Tidak ada paket retur yang sesuai filter.
              </div>
            ) : (
              filteredReturs.map((r) => {
                const isDiserahkan = r.Status === RETUR_STATUS.DISERAHKAN;
                return (
                  <div
                    key={r.ReturID}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Thumbnail Photo with Click-to-preview */}
                      {r.FotoTerimaURL ? (
                        <div
                          onClick={() => setPreviewPhoto({ url: getDirectDriveImageUrl(r.FotoTerimaURL), title: `Foto Resi ${r.Resi}` })}
                          className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 cursor-pointer border border-slate-300 relative group"
                        >
                          <img
                            src={getDirectDriveImageUrl(r.FotoTerimaURL)}
                            alt="Foto Retur"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Package className="h-5 w-5" />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {r.Resi}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                              isDiserahkan
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {r.Status}
                          </span>
                          {r.SyncStatus === "PENDING" && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                              PENDING SYNC
                            </span>
                          )}
                          {r.SyncStatus === "FAILED" && (
                            <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-bold">
                              GAGAL (DUPLIKAT)
                            </span>
                          )}
                          {r.SyncStatus === "FAILED" && !isReadOnly && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Hapus data retur gagal untuk resi ${r.Resi}? Resi ini akan bisa discan ulang.`)) {
                                  await dbService.deleteFailedRetur(r.ReturID);
                                  toast.success(`Data gagal resi ${r.Resi} berhasil dibuang. Resi dapat discan ulang.`);
                                }
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[10px] font-bold transition-colors ml-1"
                              title="Hapus data gagal agar resi bisa discan ulang"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Hapus data gagal</span>
                            </button>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-700">
                          Seller: {r.Seller}
                        </div>

                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Sesi Kedatangan: <strong className="text-slate-700">{r.TglDatang || r.TglTerima}</strong></span>
                          <span>•</span>
                          <span>Sumber: {r.Sumber || "-"}</span>
                          <span>•</span>
                          <span>Kondisi: <strong className={r.Kondisi === RETUR_KONDISI.BAIK ? "text-emerald-600" : "text-red-600"}>{r.Kondisi}</strong></span>
                          <span>•</span>
                          <span>Outlet: {r.Outlet}</span>
                        </div>

                        {r.IsiPaket && (
                          <div className="text-[11px] text-slate-800 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded-md inline-block">
                            📦 Isi: {r.IsiPaket}
                          </div>
                        )}

                        {r.Catatan && (
                          <div className="text-[11px] text-slate-600 italic">
                            Catatan: "{r.Catatan}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline & Metadata */}
                    <div className="text-left sm:text-right text-[11px] text-slate-500 font-mono space-y-0.5 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <div>Terima: {r.TglTerima} {r.JamTerima}</div>
                      <div className="text-slate-400">Oleh: {r.AdminTerima}</div>
                      {isDiserahkan && r.HandoverID && (
                        <div className="text-blue-600 font-bold text-[10px]">
                          ID Serah: {r.HandoverID}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Full Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {previewPhoto.title}
              </h4>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={previewPhoto.url}
                alt="Preview"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
