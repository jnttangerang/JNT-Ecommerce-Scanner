/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  Sparkles,
  ChevronDown,
  ChevronUp
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
import { dbService, getDirectDriveImageUrl, getTodayLocalDateString, ReturSesi, getReturSesi, setReturSesi } from "../utils/db";
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
  // Delete Retur Confirmation Modal
  const [confirmDeleteRetur, setConfirmDeleteRetur] = useState<ReturRecord | null>(null);
  const [isDeletingRetur, setIsDeletingRetur] = useState(false);

  // ==========================================
  // TAB 1: FORM TERIMA (SESI PER BAGGING + AUTOFILL)
  // ==========================================
  const [sesi, setSesi] = useState<ReturSesi>(() => {
    const saved = getReturSesi();
    return {
      kodeBagging: saved?.kodeBagging || "",
      tglDatang: saved?.tglDatang && /^\d{4}-\d{2}-\d{2}$/.test(saved.tglDatang)
        ? saved.tglDatang
        : getTodayLocalDateString(),
      jumlahManifest: saved?.jumlahManifest || 0,
      status: saved?.status === "OPEN" ? "OPEN" : "CLOSED",
      ...(saved?.startedAt ? { startedAt: saved.startedAt } : {}),
      ...(saved?.endedAt ? { endedAt: saved.endedAt } : {}),
    };
  });
  const [remoteBaggingResis, setRemoteBaggingResis] = useState<string[]>([]);
  const isSessionOpen = sesi.status === "OPEN";
  const canStartSession = Boolean(sesi.kodeBagging.trim() && sesi.jumlahManifest > 0);

  const updateSesi = (patch: Partial<ReturSesi>) => {
    setSesi((prev) => {
      const next: ReturSesi = { ...prev, ...patch };
      setReturSesi(next);
      return next;
    });
  };

  // Master operator list for Terima Retur
  const operatorsList = React.useMemo(() => {
    try {
      const ops = dbService.getOperators();
      const names = ops.map(o => o.NamaOperator).filter(Boolean);
      const cleanCurrent = currentOperator && currentOperator !== "Admin Outlet" ? currentOperator : "";
      if (cleanCurrent && !names.includes(cleanCurrent)) {
        names.unshift(cleanCurrent);
      }
      return names;
    } catch (_) {
      return [];
    }
  }, [currentOperator]);

  const [terimaOperator, setTerimaOperator] = useState<string>(() => {
    return currentOperator && currentOperator !== "Admin Outlet" ? currentOperator : "";
  });

  const [terimaResi, setTerimaResi] = useState("");
  const [terimaSellerId, setTerimaSellerId] = useState("");
  const [terimaSellerName, setTerimaSellerName] = useState("");
  const [terimaKondisi, setTerimaKondisi] = useState<ReturKondisi>(RETUR_KONDISI.BAIK);
  const [terimaIsiPaket, setTerimaIsiPaket] = useState("");
  const [terimaCatatan, setTerimaCatatan] = useState("");
  const [terimaPhoto, setTerimaPhoto] = useState<string>("");
  const [scannerTarget, setScannerTarget] = useState<"RESI" | "BAGGING" | null>(null);
  const [isSubmittingTerima, setIsSubmittingTerima] = useState(false);

  // Autofill & Manual Seller Input State
  const [autofillBadge, setAutofillBadge] = useState<{ found: boolean; tanggal?: string; seller?: string } | null>(null);
  const [isSellerAutoFilled, setIsSellerAutoFilled] = useState(false);
  const [pickupNotFoundHint, setPickupNotFoundHint] = useState(false);
  const [isManualSeller, setIsManualSeller] = useState(false);
  const [manualSellerText, setManualSellerText] = useState("");
  const [showTerimaSellerDropdown, setShowTerimaSellerDropdown] = useState(false);
  const [terimaSellerSearchQuery, setTerimaSellerSearchQuery] = useState("");

  // ==========================================
  // TAB 2: FORM SERAHKAN
  // ==========================================
  const [serahSellerId, setSerahSellerId] = useState("");
  const [serahSellerName, setSerahSellerName] = useState("");
  const [serahDateFrom, setSerahDateFrom] = useState("");
  const [serahDateTo, setSerahDateTo] = useState("");
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
  const [manifestSellerName, setManifestSellerName] = useState("");
  const [manifestDateFrom, setManifestDateFrom] = useState("");
  const [manifestDateTo, setManifestDateTo] = useState("");
  const [manifestSelectedResis, setManifestSelectedResis] = useState<string[]>([]);
  const [manifestTglPenyerahan, setManifestTglPenyerahan] = useState<string>(() => getTodayLocalDateString());
  const [manifestOutlet, setManifestOutlet] = useState<string>(currentOutlet || "Pasir Jaha Balaraja");
  const [manifestPicJnt, setManifestPicJnt] = useState<string>(() => {
    return currentOperator ? `${currentOperator} - Admin MDP` : "Admin - Admin MDP";
  });

  // ==========================================
  // TAB 4: DAFTAR FILTERS & GROUPING
  // ==========================================
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "DITERIMA" | "DISERAHKAN">("ALL");
  const [filterSeller, setFilterSeller] = useState("ALL");
  const [filterBagging, setFilterBagging] = useState("ALL");
  const [groupBy, setGroupBy] = useState<"NONE" | "BAGGING" | "TGL_DATANG" | "SELLER">("NONE");

  // Camera scanner & file input refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const terimaPhotoInputRef = useRef<HTMLInputElement | null>(null);

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
  // ponytail: autofill hanya jadi default saat seller belum dipilih manual (multi-seller bagging aman di-override)
  const lookupSellerForResi = async (cleanResi: string, hasManualSelection = false) => {
    const clean = cleanResi.trim().toUpperCase();
    if (!clean) {
      setAutofillBadge(null);
      setPickupNotFoundHint(false);
      return;
    }
    const res = await dbService.findPickupRecordByResi(clean);
    if (res.found && res.record && res.record.Seller) {
      if (hasManualSelection) return;
      const sName = res.record.Seller.trim();
      setAutofillBadge({ found: true, tanggal: res.record.Tanggal, seller: sName });
      setIsSellerAutoFilled(true);
      setPickupNotFoundHint(false);
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
    } else if (!hasManualSelection) {
      setAutofillBadge(null);
      setPickupNotFoundHint(true);
      setTerimaSellerId("");
      setTerimaSellerName("");
      setIsManualSeller(false);
      setManualSellerText("");
      setIsSellerAutoFilled(false);
    }
  };

  // A.1: Setiap nilai resi berubah (ketik/scan baru): reset seller yang terisi OTOMATIS; seller manual tetap dipertahankan
  const handleResiChange = (rawVal: string) => {
    const clean = rawVal.trim().toUpperCase();
    setTerimaResi(clean);

    const hasManualSelection = Boolean(!isSellerAutoFilled && terimaSellerId);
    if (isSellerAutoFilled) {
      setTerimaSellerId("");
      setTerimaSellerName("");
      setIsManualSeller(false);
      setManualSellerText("");
      setAutofillBadge(null);
      setIsSellerAutoFilled(false);
    }
    setPickupNotFoundHint(false);

    if (clean) {
      lookupSellerForResi(clean, hasManualSelection);
    } else {
      setAutofillBadge(null);
      setPickupNotFoundHint(false);
    }
  };

  // Handle starting/stopping barcode scanner & releasing lingering MediaStream tracks
  const stopActiveScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (_) {}
      scannerRef.current = null;
    }
    if (typeof document !== "undefined") {
      document.querySelectorAll<HTMLVideoElement>("#retur-camera-reader video, #retur-bagging-camera-reader video").forEach((video) => {
        const stream = video.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        }
      });
    }
    setScannerTarget(null);
  };

  const toggleScanner = async (target: "RESI" | "BAGGING") => {
    if (scannerTarget === target) {
      await stopActiveScanner();
      return;
    }
    if (target === "BAGGING" && sesi.status === "OPEN") {
      toast.error("Tutup sesi terlebih dahulu untuk mengubah Kode Bagging.");
      return;
    }
    if (target === "RESI" && sesi.status !== "OPEN") {
      toast.error("Mulai sesi karung terlebih dahulu sebelum scan resi!");
      return;
    }
    await stopActiveScanner();
    setScannerTarget(target);
    setTimeout(async () => {
      try {
        const readerId = target === "BAGGING" ? "retur-bagging-camera-reader" : "retur-camera-reader";
        const qr = new Html5Qrcode(readerId);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 260, height: 160 }
          },
          (decodedText) => {
            const cleaned = decodedText.trim().toUpperCase();
            if (target === "BAGGING") {
              updateSesi({ kodeBagging: cleaned });
              toast.success("Kode Bagging terdeteksi: " + cleaned);
            } else {
              handleResiChange(cleaned);
              toast.success("Resi terdeteksi: " + cleaned);
            }
            try {
              qr.stop().then(() => qr.clear()).catch(() => {});
            } catch (_) {}
            scannerRef.current = null;
            setScannerTarget(null);
          },
          () => {}
        );
      } catch (err: any) {
        console.warn("Camera start failed:", err);
        toast.error("Gagal membuka kamera: " + (err?.message || "Izin ditolak"));
        setScannerTarget(null);
      }
    }, 150);
  };

  // Compress image helper (max 640px, JPEG 70%)
  // ponytail: pakai ObjectURL (bukan FileReader Base64 mentah 5-15MB) + nolkan canvas agar HP tidak OOM crash setelah 5-10 foto.
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
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
          canvas.width = 0;
          canvas.height = 0;
          resolve(compressed);
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Gagal membaca gambar"));
      };
      img.src = objectUrl;
    });
  };

  // Handle Photo input for Terima
  const handleTerimaPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    try {
      const compressed = await processImageFile(file);
      setTerimaPhoto(compressed);
      toast.success("Foto kondisi paket berhasil diambil!");
    } catch (err: any) {
      toast.error("Gagal memproses foto: " + err.message);
    } finally {
      inputEl.value = "";
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

  const handleStartSession = async () => {
    const cleanBagging = sesi.kodeBagging.trim().toUpperCase();
    if (!cleanBagging || sesi.jumlahManifest <= 0) {
      toast.error("Lengkapi Sesi Karung", {
        description: "Isi Kode Bagging dan Jml Manifest (> 0) sebelum mulai sesi."
      });
      return;
    }
    if (scannerTarget === "BAGGING") {
      await stopActiveScanner();
    }
    const next: ReturSesi = {
      kodeBagging: cleanBagging,
      tglDatang: sesi.tglDatang || getTodayLocalDateString(),
      jumlahManifest: sesi.jumlahManifest,
      status: "OPEN",
      startedAt: new Date().toISOString(),
    };
    setSesi(next);
    setReturSesi(next);
    toast.success(`Sesi Bagging ${cleanBagging} DIBUKA.`);
  };

  const handleCloseSession = async () => {
    await stopActiveScanner();
    const next: ReturSesi = {
      ...sesi,
      status: "CLOSED",
      endedAt: new Date().toISOString(),
    };
    setSesi(next);
    setReturSesi(next);
    setRemoteBaggingResis([]);
    toast.info(`Sesi Bagging ${next.kodeBagging || "-"} DITUTUP. Menyinkronkan data...`);
    if (typeof navigator === "undefined" || navigator.onLine) {
      try {
        const res = await dbService.syncPendingReturs();
        if (res.errors.length > 0) {
          toast.error("Sinkronisasi Parsial", { description: res.errors.join("; ") });
        } else if (res.syncedReturs > 0) {
          toast.success(`Sinkron selesai: ${res.syncedReturs} retur terupload.`);
        }
        loadData();
      } catch (_) {}
    }
  };

  // Submit Alur A: Terima Retur
  const handleSubmitTerima = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTerima) return;

    if (sesi.status !== "OPEN") {
      toast.error("Sesi Belum Dibuka", { description: "Klik 'Mulai Sesi' terlebih dahulu sebelum scan resi." });
      return;
    }
    if (!terimaResi.trim()) {
      toast.error("Validasi Gagal", { description: "Nomor resi retur wajib diisi!" });
      return;
    }
    if (!terimaSellerId || !terimaSellerName) {
      toast.error("Validasi Gagal", { description: "Pilih seller tujuan retur terlebih dahulu!" });
      return;
    }
    if (!terimaOperator.trim()) {
      toast.error("Validasi Gagal", { description: "Pilih nama petugas/admin penerima terlebih dahulu!" });
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
        sumber: "",
        tglDatang: sesi.tglDatang,
        kodeBagging: sesi.kodeBagging,
        jumlahManifest: sesi.jumlahManifest,
        kondisi: terimaKondisi,
        isiPaket: terimaIsiPaket,
        fotoTerima: terimaPhoto,
        catatan: terimaCatatan,
        adminTerima: terimaOperator
      });

      if (result.success) {
        // ponytail: bersihkan state foto, input file, dan track kamera aktif seketika setelah IDB commit untuk mencegah memory bloat.
        setTerimaPhoto("");
        if (terimaPhotoInputRef.current) {
          terimaPhotoInputRef.current.value = "";
        }
        await stopActiveScanner();

        toast.success("Paket Retur Berhasil Diterima!", {
          description: `Resi ${terimaResi.toUpperCase()} dicatat di karung ${sesi.kodeBagging || "-"} (DITERIMA).`
        });
        // Reset per-resi fields (sesi bagging tetap aktif, tetap di tab TERIMA)
        setTerimaResi("");
        setTerimaIsiPaket("");
        setTerimaCatatan("");
        setAutofillBadge(null);
        setPickupNotFoundHint(false);
        setTerimaKondisi(RETUR_KONDISI.BAIK);

        // A.1: Setelah simpan berhasil: reset seller yang terisi OTOMATIS.
        // Seller yang dipilih admin secara manual TIDAK dihapus selama resi belum berubah.
        if (isSellerAutoFilled) {
          setTerimaSellerId("");
          setTerimaSellerName("");
          setIsManualSeller(false);
          setManualSellerText("");
          setIsSellerAutoFilled(false);
        }
        loadData();
      } else {
        toast.error("Gagal Menyimpan Retur", {
          description: result.error || "Terjadi kesalahan saat menyimpan data."
        });
      }
    } catch (err: any) {
      // ponytail: tetap bertahan di layar Retur saat error agar operator bisa retry tanpa kehilangan input/sesi.
      toast.error("Gagal Menyimpan Retur", {
        description: err?.message || "Terjadi kesalahan tak terduga saat menyimpan."
      });
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

  // Delete Retur Record (Hanya status DITERIMA, lokal + tandai DeletedAt di Spreadsheet)
  const handleConfirmDeleteRetur = async () => {
    if (!confirmDeleteRetur || isDeletingRetur) return;
    setIsDeletingRetur(true);
    try {
      const res = await dbService.deleteReturRecord(
        confirmDeleteRetur.ReturID,
        terimaOperator || currentOperator || "Admin Outlet"
      );
      if (res.success) {
        if (res.cloudSynced) {
          toast.success(`Resi ${confirmDeleteRetur.Resi} dihapus dan ditandai DeletedAt di Spreadsheet.`);
        } else {
          toast.info(`Resi ${confirmDeleteRetur.Resi} dihapus di lokal (antre sync Spreadsheet).`);
        }
        setConfirmDeleteRetur(null);
        loadData();
      } else {
        toast.error("Gagal Menghapus Retur", { description: res.error || "Terjadi kesalahan." });
      }
    } finally {
      setIsDeletingRetur(false);
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

  // Available returs for selected seller in Serah Terima (multi KodeBagging, opsional filter rentang tanggal)
  const availableRetursForSeller = React.useMemo(() => {
    return returs.filter((r) => {
      if (r.SellerID !== serahSellerId || r.Status !== RETUR_STATUS.DITERIMA || r.DeletedAt) return false;
      const tgl = r.TglDatang || r.TglTerima;
      if (serahDateFrom && tgl < serahDateFrom) return false;
      if (serahDateTo && tgl > serahDateTo) return false;
      return true;
    });
  }, [returs, serahSellerId, serahDateFrom, serahDateTo]);

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
    return returs.filter((r) => {
      if (r.SellerID !== manifestSellerId || r.Status !== RETUR_STATUS.DITERIMA || r.DeletedAt) return false;
      const tgl = r.TglDatang || r.TglTerima;
      if (manifestDateFrom && tgl < manifestDateFrom) return false;
      if (manifestDateTo && tgl > manifestDateTo) return false;
      return true;
    });
  }, [manifestSellerId, manifestDateFrom, manifestDateTo, returs]);

  useEffect(() => {
    if (!manifestSellerId && sellersWithDiterima.length > 0) {
      setManifestSellerId(sellersWithDiterima[0].id);
    }
  }, [sellersWithDiterima, manifestSellerId]);

  useEffect(() => {
    if (manifestSellerId) {
      const currentSellerObj = sellersWithDiterima.find(s => s.id === manifestSellerId);
      const sName = currentSellerObj?.name || manifestSellerId;
      setManifestSellerName(sName);
      setManifestSelectedResis(manifestAvailableReturs.map(r => r.Resi));
    } else {
      setManifestSellerName("");
      setManifestSelectedResis([]);
    }
  }, [manifestSellerId, manifestAvailableReturs, sellersWithDiterima]);

  const formatIndoDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      }
    } catch (_) {}
    return dateStr;
  };

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
    const sName = manifestSellerName || (selectedManifestRecords[0]?.Seller) || manifestSellerId;
    setSerahSellerId(manifestSellerId);
    setSerahSellerName(sName);
    setSerahSelectedResis([...manifestSelectedResis]);
    setActiveTab("SERAHKAN");
    toast.success(`${manifestSelectedResis.length} resi dialihkan ke tab Serah Terima`);
  };

  // Live cross-device reconciliation for active bagging session (Set union by Resi)
  const activeBaggingCode = sesi.kodeBagging.trim().toUpperCase();

  // ponytail: union by Resi (1 paket fisik = 1 AWB); scan offline muncul di perangkat lain setelah sync selesai.
  useEffect(() => {
    if (sesi.status !== "OPEN" || !activeBaggingCode) {
      setRemoteBaggingResis([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const resis = await dbService.fetchBaggingRemoteIds(activeBaggingCode);
      if (!cancelled) setRemoteBaggingResis(resis);
    };
    poll();
    const timer = window.setInterval(poll, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sesi.status, activeBaggingCode]);

  const localBaggingResis = React.useMemo(() => {
    if (!activeBaggingCode) return new Set<string>();
    return new Set(
      returs
        .filter((r) => !r.DeletedAt && (r.KodeBagging || "").trim().toUpperCase() === activeBaggingCode)
        .map((r) => (r.Resi || "").trim().toUpperCase())
        .filter(Boolean)
    );
  }, [returs, activeBaggingCode]);

  const remoteOnlyCount = React.useMemo(() => {
    const seen = new Set<string>();
    for (const resi of remoteBaggingResis) {
      if (resi && !localBaggingResis.has(resi)) seen.add(resi);
    }
    return seen.size;
  }, [remoteBaggingResis, localBaggingResis]);

  const totalScannedBagging = React.useMemo(() => {
    return new Set<string>([...localBaggingResis, ...remoteBaggingResis]).size;
  }, [localBaggingResis, remoteBaggingResis]);

  const selisihBagging = totalScannedBagging - (sesi.jumlahManifest || 0);

  // Distinct bagging codes for Daftar filter
  const distinctBaggings = React.useMemo(() => {
    const set = new Set<string>();
    returs.forEach((r) => {
      if (!r.DeletedAt && r.KodeBagging) {
        set.add(r.KodeBagging.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [returs]);

  // Filtered returs for Tab 4 (Daftar)
  const filteredReturs = returs.filter(r => {
    if (r.DeletedAt) return false;
    if (filterStatus !== "ALL" && r.Status !== filterStatus) return false;
    if (filterSeller !== "ALL" && r.SellerID !== filterSeller && r.Seller !== filterSeller) return false;
    if (filterBagging !== "ALL") {
      const kb = (r.KodeBagging || "").trim().toUpperCase();
      if (filterBagging === "__EMPTY__" ? kb !== "" : kb !== filterBagging) return false;
    }
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toUpperCase();
      const matchResi = r.Resi.toUpperCase().includes(q);
      const matchSeller = r.Seller.toUpperCase().includes(q);
      const matchAdmin = (r.AdminTerima || "").toUpperCase().includes(q);
      const matchHandover = (r.HandoverID || "").toUpperCase().includes(q);
      const matchBagging = (r.KodeBagging || "").toUpperCase().includes(q);
      if (!matchResi && !matchSeller && !matchAdmin && !matchHandover && !matchBagging) return false;
    }
    return true;
  });

  // Grouped returs by KodeBagging / TglDatang / Seller
  const groupedReturs = React.useMemo(() => {
    if (groupBy === "NONE") return null;
    const map = new Map<string, ReturRecord[]>();
    filteredReturs.forEach((r) => {
      const key =
        groupBy === "BAGGING"
          ? (r.KodeBagging || "").trim().toUpperCase() || "TANPA KODE BAGGING"
          : groupBy === "TGL_DATANG"
          ? r.TglDatang || r.TglTerima || "-"
          : r.Seller || r.SellerID || "-";
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filteredReturs, groupBy]);

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
              Pencatatan siklus paket retur masuk ke outlet hingga serah terima seller.
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

          {/* Panel Sesi Bagging (Karung LY) & Petugas Penerima */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                    isSessionOpen
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-slate-200 text-slate-700 border-slate-300"
                  }`}
                >
                  Sesi: {sesi.status}
                </span>
                {isSessionOpen && sesi.startedAt && (
                  <span className="text-[10px] text-amber-900 font-mono">
                    Mulai: {new Date(sesi.startedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {isSessionOpen ? (
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Tutup Sesi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={!canStartSession}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    canStartSession
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  }`}
                >
                  Mulai Sesi
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Kode Bagging (LY) + Tombol Scan */}
              <div className="lg:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Kode Bagging / Karung <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    disabled={isSessionOpen}
                    value={sesi.kodeBagging}
                    onChange={(e) => updateSesi({ kodeBagging: e.target.value.toUpperCase() })}
                    placeholder="Contoh: LY000042553913"
                    className={`flex-1 border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold uppercase focus:outline-none focus:border-red-600 ${
                      isSessionOpen ? "bg-amber-100/60 text-slate-600 cursor-not-allowed" : "bg-white text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    disabled={isSessionOpen}
                    onClick={() => toggleScanner("BAGGING")}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center text-xs font-bold transition-all ${
                      isSessionOpen
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : scannerTarget === "BAGGING"
                        ? "bg-red-600 text-white border-red-700"
                        : "bg-white hover:bg-amber-100 text-amber-900 border-amber-300"
                    }`}
                    title="Scan barcode Kode Bagging (LY)"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" />
                    <span>{scannerTarget === "BAGGING" ? "Tutup" : "Scan"}</span>
                  </button>
                </div>
              </div>

              {/* Tgl Datang */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-amber-700" /> Tgl Datang
                </label>
                <input
                  type="date"
                  disabled={isSessionOpen}
                  value={sesi.tglDatang}
                  onChange={(e) => updateSesi({ tglDatang: e.target.value })}
                  className={`w-full border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-red-600 ${
                    isSessionOpen ? "bg-amber-100/60 text-slate-600 cursor-not-allowed" : "bg-white text-slate-800"
                  }`}
                />
              </div>

              {/* Jumlah Manifest */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Jml Manifest <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={isSessionOpen}
                  value={sesi.jumlahManifest}
                  onChange={(e) => updateSesi({ jumlahManifest: Math.max(0, Number(e.target.value) || 0) })}
                  className={`w-full border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-red-600 ${
                    isSessionOpen ? "bg-amber-100/60 text-slate-600 cursor-not-allowed" : "bg-white text-slate-800"
                  }`}
                />
              </div>
            </div>

            {scannerTarget === "BAGGING" && !isSessionOpen && (
              <div className="border-2 border-red-400 rounded-2xl p-2 bg-black overflow-hidden">
                <div id="retur-bagging-camera-reader" className="w-full h-48 rounded-xl overflow-hidden bg-black" />
                <p className="text-center text-[10px] text-zinc-300 mt-1 font-medium">
                  Arahkan kamera ke barcode Kode Bagging (awalan LY).
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/70">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-900 flex items-center">
                  <User className="h-4 w-4 mr-1 text-amber-700" /> Petugas Penerima:
                </span>
                <select
                  value={terimaOperator}
                  onChange={(e) => setTerimaOperator(e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-red-600"
                >
                  <option value="" disabled>
                    -- Pilih Nama Admin --
                  </option>
                  {operatorsList.map((opName) => (
                    <option key={opName} value={opName}>
                      {opName}
                    </option>
                  ))}
                  {!operatorsList.includes(terimaOperator) && terimaOperator && (
                    <option value={terimaOperator}>{terimaOperator}</option>
                  )}
                </select>
              </div>

              {/* Live Badge Rekonsiliasi Karung vs Manifest (Lokal + Perangkat Lain) */}
              {activeBaggingCode ? (
                <div
                  className={`inline-flex flex-wrap items-center gap-x-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${
                    selisihBagging > 0
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : selisihBagging < 0
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  <span className="font-mono">
                    {totalScannedBagging}/{sesi.jumlahManifest} discan
                  </span>
                  <span>•</span>
                  <span>
                    {selisihBagging > 0
                      ? `+${selisihBagging} di luar manifest`
                      : selisihBagging < 0
                      ? `${selisihBagging} belum discan`
                      : "sesuai"}
                  </span>
                  <span className="text-[11px] font-normal">
                    (lokal {localBaggingResis.size} + perangkat lain {remoteOnlyCount})
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-amber-800/80 italic">
                  * Isi Kode Bagging & Jml Manifest (&gt;0), lalu klik Mulai Sesi.
                </span>
              )}
            </div>
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
                  disabled={!isSessionOpen}
                  value={terimaResi}
                  onChange={(e) => handleResiChange(e.target.value)}
                  onBlur={() => {
                    if (isSessionOpen && terimaResi && !terimaSellerId) lookupSellerForResi(terimaResi, false);
                  }}
                  placeholder={isSessionOpen ? "Scan atau ketik nomor resi..." : "Klik 'Mulai Sesi' dulu untuk scan resi..."}
                  className={`flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold focus:outline-none ${
                    isSessionOpen
                      ? "bg-slate-50 text-slate-800 focus:border-red-600 focus:bg-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-70"
                  }`}
                />
                <button
                  type="button"
                  disabled={!isSessionOpen}
                  onClick={() => toggleScanner("RESI")}
                  className={`px-3 py-2.5 rounded-xl border flex items-center justify-center text-xs font-bold transition-all ${
                    !isSessionOpen
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70"
                      : scannerTarget === "RESI"
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                  title={isSessionOpen ? "Scan pakai kamera" : "Mulai sesi terlebih dahulu"}
                >
                  <Camera className="h-4 w-4 mr-1" />
                  <span>{scannerTarget === "RESI" ? "Tutup" : "Scan"}</span>
                </button>
              </div>
              {!isSessionOpen && (
                <p className="text-[11px] text-amber-700 font-semibold">
                  Input &amp; kamera resi terkunci sampai tombol &quot;Mulai Sesi&quot; diklik.
                </p>
              )}

              {/* In-page Camera Reader Container */}
              {scannerTarget === "RESI" && isSessionOpen && (
                <div className="mt-2 border-2 border-red-400 rounded-2xl p-2 bg-black overflow-hidden relative">
                  <div id="retur-camera-reader" className="w-full h-56 rounded-xl overflow-hidden bg-black" />
                  <p className="text-center text-[10px] text-zinc-400 mt-1 font-medium">
                    Arahkan kamera ke barcode resi paket retur.
                  </p>
                </div>
              )}
            </div>

            {/* Seller Selection with Autofill Badge, Hint & Manual Override */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Seller Tujuan <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsSellerAutoFilled(false);
                    setAutofillBadge(null);
                    setPickupNotFoundHint(false);
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

              {/* A.2: Hint resi tidak ditemukan di data pickup */}
              {pickupNotFoundHint && !terimaSellerId && (
                <div className="flex items-center text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-600 shrink-0" />
                  <span>Resi tidak ditemukan di data pickup, pilih seller manual</span>
                </div>
              )}

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
                      setIsSellerAutoFilled(false);
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
                      setIsSellerAutoFilled(false);
                      setAutofillBadge(null);
                      setPickupNotFoundHint(false);
                      setManualSellerText(val);
                      setTerimaSellerName(val);
                      setTerimaSellerId(val.trim() ? "MANUAL:" + val.toUpperCase().trim() : "");
                    }}
                    placeholder="Ketik nama toko/seller manual sesuai resi..."
                    className="w-full bg-slate-50 border border-blue-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  <p className="text-[10px] text-blue-600 italic">
                    Mode input manual (untuk toko online berbeda atau belum ada di master seller).
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTerimaSellerDropdown((prev) => !prev)}
                    className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-sm font-medium flex justify-between items-center transition-all ${
                      !terimaSellerId
                        ? "border-slate-300 text-slate-500"
                        : "border-slate-200 text-slate-800 focus:border-red-600"
                    } hover:bg-slate-100/70`}
                  >
                    <span className="truncate">
                      {terimaSellerName || "-- Pilih Seller --"}
                    </span>
                    {showTerimaSellerDropdown ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                    )}
                  </button>

                  {showTerimaSellerDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setShowTerimaSellerDropdown(false);
                          setTerimaSellerSearchQuery("");
                        }}
                      />
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-[320px] flex flex-col">
                        {/* Search Input Box */}
                        <div className="p-2 border-b border-slate-100 flex items-center bg-slate-50 rounded-t-xl">
                          <Search className="h-4 w-4 text-slate-400 ml-1.5 mr-2 shrink-0" />
                          <input
                            type="text"
                            className="w-full text-xs text-slate-800 placeholder:text-slate-400 outline-none bg-transparent py-1 font-medium"
                            placeholder="Cari nama seller..."
                            value={terimaSellerSearchQuery}
                            onChange={(e) => setTerimaSellerSearchQuery(e.target.value)}
                            autoFocus
                          />
                          {terimaSellerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setTerimaSellerSearchQuery("")}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Nilai default -- Pilih Seller -- (tidak bisa dipilih) */}
                        <div className="px-3.5 py-2 text-xs font-semibold text-slate-400 bg-slate-50/50 border-b border-slate-100 cursor-not-allowed select-none">
                          -- Pilih Seller --
                        </div>

                        {/* Filtered list of sellers */}
                        <div className="overflow-y-auto overflow-x-hidden flex-grow divide-y divide-slate-50">
                          {(() => {
                            const q = terimaSellerSearchQuery.trim().toLowerCase();
                            const filtered = sellers.filter((s) => {
                              if (!q) return true;
                              return (s?.nama || "").toLowerCase().includes(q);
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="px-4 py-3 text-xs text-slate-500 text-center">
                                  Seller "{terimaSellerSearchQuery}" tidak ditemukan
                                </div>
                              );
                            }

                            return filtered.map((s, idx) => {
                              const selVal = s.id || s.nama;
                              const isSelected = terimaSellerId === selVal || terimaSellerName === s.nama;
                              return (
                                <div
                                  key={`terima-sel-${idx}-${selVal}`}
                                  className={`px-3.5 py-2 text-xs cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-red-50 text-red-700 font-bold"
                                      : "text-slate-700 hover:bg-slate-100"
                                  }`}
                                  onClick={() => {
                                    setIsSellerAutoFilled(false);
                                    setAutofillBadge(null);
                                    setPickupNotFoundHint(false);
                                    setTerimaSellerId(selVal);
                                    setTerimaSellerName(s.nama);
                                    setShowTerimaSellerDropdown(false);
                                    setTerimaSellerSearchQuery("");
                                  }}
                                >
                                  {s.nama}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Opsi Ketik Manual */}
                        <div
                          className="p-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer text-center hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setIsManualSeller(true);
                            setManualSellerText("");
                            setTerimaSellerId("");
                            setTerimaSellerName("");
                            setShowTerimaSellerDropdown(false);
                            setTerimaSellerSearchQuery("");
                          }}
                        >
                          + Ketik Nama Toko / Seller Manual...
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
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
                  ref={terimaPhotoInputRef}
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
              disabled={!isSessionOpen || isSubmittingTerima || !terimaSellerId || !terimaSellerName || !terimaResi.trim()}
              className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all text-sm ${
                !isSessionOpen || isSubmittingTerima || !terimaSellerId || !terimaSellerName || !terimaResi.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {isSubmittingTerima ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyimpan Retur...</span>
                </>
              ) : !terimaSellerId || !terimaSellerName ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                  <span>Pilih Seller Terlebih Dahulu</span>
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
                  {s.nama}
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

              {/* Filter Rentang Tanggal Kedatangan */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Dari Tgl Datang</label>
                  <input
                    type="date"
                    value={serahDateFrom}
                    onChange={(e) => setSerahDateFrom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sampai Tgl Datang</label>
                  <input
                    type="date"
                    value={serahDateTo}
                    onChange={(e) => setSerahDateTo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                {(serahDateFrom || serahDateTo) && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => { setSerahDateFrom(""); setSerahDateTo(""); }}
                      className="text-xs font-bold text-red-600 hover:underline py-1.5"
                    >
                      Reset Tanggal
                    </button>
                  </div>
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
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-mono font-bold text-xs">{r.Resi}</span>
                              {r.KodeBagging && (
                                <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">
                                  {r.KodeBagging}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                              <span>Kondisi: {r.Kondisi}</span>
                              {r.IsiPaket && (
                                <>
                                  <span>•</span>
                                  <span>Isi: {r.IsiPaket}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          <div>{r.TglDatang || r.TglTerima}</div>
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
          {/* Controls & Editable Fields (no-print) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 no-print">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center">
                  <Printer className="h-4 w-4 mr-2 text-red-600" />
                  Manifest Hand Over Returan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Formulir resmi penyerahan paket retur ke seller dengan tanda tangan PIC.
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

            {/* B.3: Field editable di luar area cetak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tanggal penyerahan (default hari ini) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Penyerahan
                </label>
                <input
                  type="date"
                  value={manifestTglPenyerahan}
                  onChange={(e) => setManifestTglPenyerahan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>

              {/* Mini Drop Point J&T (default Outlet sesi) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mini Drop Point J&T
                </label>
                <input
                  type="text"
                  value={manifestOutlet}
                  onChange={(e) => setManifestOutlet(e.target.value)}
                  placeholder="Contoh: Pasir Jaha Balaraja"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>

              {/* Nama Seller (pilih seller & editable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Seller <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1">
                  <select
                    value={manifestSellerId}
                    onChange={(e) => setManifestSellerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
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
                  <input
                    type="text"
                    value={manifestSellerName}
                    onChange={(e) => setManifestSellerName(e.target.value)}
                    placeholder="Nama Seller di lembar cetak"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Nama - Posisi PIC J&T (default nama admin + ' - Admin MDP') */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PIC J&T (Nama - Posisi)
                </label>
                <input
                  type="text"
                  value={manifestPicJnt}
                  onChange={(e) => setManifestPicJnt(e.target.value)}
                  placeholder="Contoh: Budi - Admin MDP"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Filter Rentang Tanggal untuk Manifest Multi-Bagging */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dari Tgl Datang</label>
                <input
                  type="date"
                  value={manifestDateFrom}
                  onChange={(e) => setManifestDateFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sampai Tgl Datang</label>
                <input
                  type="date"
                  value={manifestDateTo}
                  onChange={(e) => setManifestDateTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>
              {(manifestDateFrom || manifestDateTo) && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => { setManifestDateFrom(""); setManifestDateTo(""); }}
                    className="text-xs font-bold text-red-600 hover:underline py-1.5"
                  >
                    Reset Filter Tanggal
                  </button>
                </div>
              )}
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
                        {r.KodeBagging && (
                          <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {r.KodeBagging}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* On-screen Preview of the Manifest Sheet (no-print) */}
          <div className="bg-white border border-slate-300 rounded-2xl p-6 sm:p-8 shadow-sm text-black no-print overflow-x-auto">
            {/* Judul tengah tebal: MANIFEST HAND OVER RETURAN */}
            <div className="text-center mb-4">
              <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-black">
                MANIFEST HAND OVER RETURAN
              </h2>
            </div>

            {/* Tiga baris: Tanggal penyerahan, Mini Drop Point J&T, Nama Seller (titik dua sejajar) */}
            <div className="mb-4 text-xs font-semibold text-black space-y-1">
              <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                <span>Tanggal penyerahan</span>
                <span>:</span>
                <span>{formatIndoDate(manifestTglPenyerahan)}</span>
              </div>
              <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                <span>Mini Drop Point J&T</span>
                <span>:</span>
                <span>{manifestOutlet || "-"}</span>
              </div>
              <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                <span>Nama Seller</span>
                <span>:</span>
                <span>{manifestSellerName || "-"}</span>
              </div>
            </div>

            {/* Tabel 5 kolom: No. | Resi | KodeBagging | Isi Paket | Ceklist */}
            <table className="manifest-table w-full border-collapse border border-black text-xs text-black">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-black">
                  <th className="border border-black px-2 py-1.5 text-center w-10 font-bold">No.</th>
                  <th className="border border-black px-2 py-1.5 text-left w-40 font-bold">Resi</th>
                  <th className="border border-black px-2 py-1.5 text-left w-36 font-bold">KodeBagging</th>
                  <th className="border border-black px-2 py-1.5 text-left font-bold">Isi Paket</th>
                  <th className="border border-black px-2 py-1.5 text-center w-16 font-bold">Ceklist</th>
                </tr>
              </thead>
              <tbody>
                {selectedManifestRecords.map((r, idx) => (
                  <tr key={r.ReturID} className="border-b border-black">
                    <td className="border border-black px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-black px-2 py-1.5 font-mono font-bold">{r.Resi}</td>
                    <td className="border border-black px-2 py-1.5 font-mono text-[11px]">{r.KodeBagging || "-"}</td>
                    <td className="border border-black px-2 py-1.5">{r.IsiPaket || ""}</td>
                    <td className="border border-black px-2 py-1.5 text-center">
                      <span className="inline-block w-3.5 h-3.5 border border-black"></span>
                    </td>
                  </tr>
                ))}

                {/* Minimal 10 baris: baris kosong = sel kosong bergaris (tanpa titik-titik) */}
                {Array.from({ length: blankRowsCount }).map((_, bIdx) => {
                  const rowNum = selectedManifestRecords.length + bIdx + 1;
                  return (
                    <tr key={`preview-blank-row-${bIdx}`} className="border-b border-black">
                      <td className="border border-black px-2 py-1.5 text-center font-mono">{rowNum}</td>
                      <td className="border border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border border-black px-2 py-1.5 text-center">
                        <span className="inline-block w-3.5 h-3.5 border border-black"></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Di bawah tabel: "Total paket: N" */}
            <div className="text-xs font-bold my-3 text-black">
              Total paket: {selectedManifestRecords.length}
            </div>

            {/* Di bawah: "Tangerang, <tanggal penyerahan format d MMMM yyyy>" */}
            <div className="text-xs font-semibold mt-4 mb-2 text-black">
              Tangerang, {formatIndoDate(manifestTglPenyerahan)}
            </div>

            {/* Dua kolom tanda tangan */}
            <div className="manifest-signature-block mt-4 text-black">
              <div className="grid grid-cols-2 gap-8 text-xs">
                {/* Kolom Kiri: Yang menyerahkan */}
                <div className="space-y-1">
                  <p className="font-semibold">Yang menyerahkan,</p>
                  <p className="font-semibold">PIC J&T Express</p>
                  <div className="min-h-[25mm] h-[28mm]"></div>
                  <p className="font-bold">{manifestPicJnt || "Admin - Admin MDP"}</p>
                </div>

                {/* Kolom Kanan: Diterima */}
                <div className="space-y-1">
                  <p className="font-semibold">Diterima,</p>
                  <p className="font-semibold">PIC Seller</p>
                  <div className="min-h-[25mm] h-[28mm]"></div>
                  <div className="border-b border-black w-48 sm:w-56 mb-1"></div>
                  <p className="text-[11px] text-slate-800">Nama - Posisi</p>
                </div>
              </div>
            </div>
          </div>

          {/* B.4: React Portal rendered directly in document.body (.manifest-print-root) */}
          {typeof document !== "undefined" && createPortal(
            <div className="manifest-print-root">
              {/* Judul tengah tebal: MANIFEST HAND OVER RETURAN */}
              <div className="text-center mb-4">
                <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-black">
                  MANIFEST HAND OVER RETURAN
                </h2>
              </div>

              {/* Tiga baris: Tanggal penyerahan, Mini Drop Point J&T, Nama Seller (titik dua sejajar) */}
              <div className="mb-4 text-xs font-semibold text-black space-y-1">
                <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                  <span>Tanggal penyerahan</span>
                  <span>:</span>
                  <span>{formatIndoDate(manifestTglPenyerahan)}</span>
                </div>
                <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                  <span>Mini Drop Point J&T</span>
                  <span>:</span>
                  <span>{manifestOutlet || "-"}</span>
                </div>
                <div className="grid grid-cols-[160px_10px_1fr] items-baseline">
                  <span>Nama Seller</span>
                  <span>:</span>
                  <span>{manifestSellerName || "-"}</span>
                </div>
              </div>

              {/* Tabel 5 kolom: No. | Resi | KodeBagging | Isi Paket | Ceklist */}
              <table className="manifest-table w-full border-collapse border border-black text-xs text-black">
                <thead>
                  <tr className="bg-transparent font-bold border-b border-black">
                    <th className="border border-black px-2 py-1.5 text-center w-10 font-bold">No.</th>
                    <th className="border border-black px-2 py-1.5 text-left w-40 font-bold">Resi</th>
                    <th className="border border-black px-2 py-1.5 text-left w-36 font-bold">KodeBagging</th>
                    <th className="border border-black px-2 py-1.5 text-left font-bold">Isi Paket</th>
                    <th className="border border-black px-2 py-1.5 text-center w-16 font-bold">Ceklist</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedManifestRecords.map((r, idx) => (
                    <tr key={r.ReturID} className="border-b border-black">
                      <td className="border border-black px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black px-2 py-1.5 font-mono font-bold">{r.Resi}</td>
                      <td className="border border-black px-2 py-1.5 font-mono text-[11px]">{r.KodeBagging || "-"}</td>
                      <td className="border border-black px-2 py-1.5">{r.IsiPaket || ""}</td>
                      <td className="border border-black px-2 py-1.5 text-center">
                        <span className="inline-block w-3.5 h-3.5 border border-black"></span>
                      </td>
                    </tr>
                  ))}

                  {/* Minimal 10 baris: baris kosong = sel kosong bergaris (tanpa titik-titik) */}
                  {Array.from({ length: blankRowsCount }).map((_, bIdx) => {
                    const rowNum = selectedManifestRecords.length + bIdx + 1;
                    return (
                      <tr key={`print-blank-row-${bIdx}`} className="border-b border-black">
                        <td className="border border-black px-2 py-1.5 text-center font-mono">{rowNum}</td>
                        <td className="border border-black px-2 py-1.5">&nbsp;</td>
                        <td className="border border-black px-2 py-1.5">&nbsp;</td>
                        <td className="border border-black px-2 py-1.5">&nbsp;</td>
                        <td className="border border-black px-2 py-1.5 text-center">
                          <span className="inline-block w-3.5 h-3.5 border border-black"></span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Di bawah tabel: "Total paket: N" */}
              <div className="text-xs font-bold my-3 text-black">
                Total paket: {selectedManifestRecords.length}
              </div>

              {/* Di bawah: "Tangerang, <tanggal penyerahan format d MMMM yyyy>" */}
              <div className="text-xs font-semibold mt-4 mb-2 text-black">
                Tangerang, {formatIndoDate(manifestTglPenyerahan)}
              </div>

              {/* Dua kolom tanda tangan */}
              <div className="manifest-signature-block mt-4 text-black">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  {/* Kolom Kiri */}
                  <div className="space-y-1">
                    <p className="font-semibold">Yang menyerahkan,</p>
                    <p className="font-semibold">PIC J&T Express</p>
                    <div className="min-h-[25mm] h-[28mm]"></div>
                    <p className="font-bold">{manifestPicJnt || "Admin - Admin MDP"}</p>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-1">
                    <p className="font-semibold">Diterima,</p>
                    <p className="font-semibold">PIC Seller</p>
                    <div className="min-h-[25mm] h-[28mm]"></div>
                    <div className="border-b border-black w-48 sm:w-56 mb-1"></div>
                    <p className="text-[11px] text-slate-800">Nama - Posisi</p>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* B.4: Scoped print CSS: hide body > *:not(.manifest-print-root), keep manifest static */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 12mm 12mm 12mm;
              }
              body > *:not(.manifest-print-root) {
                display: none !important;
              }
              .manifest-print-root {
                display: block !important;
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border: none !important;
              }
              .manifest-print-root * {
                color: #000000 !important;
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
                border: 1px solid #000000 !important;
                padding: 4px 6px !important;
                color: #000000 !important;
              }
              .manifest-signature-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-top: 18px !important;
              }
            }
            @media screen {
              .manifest-print-root {
                display: none !important;
              }
            }
          `}</style>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Search Resi / Bagging */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Cari resi / seller / LY bagging..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              />
            </div>

            {/* Filter Kode Bagging */}
            <div>
              <select
                value={filterBagging}
                onChange={(e) => setFilterBagging(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-600 focus:bg-white"
              >
                <option value="ALL">Semua Bagging</option>
                {distinctBaggings.map((kb) => (
                  <option key={`flt-bag-${kb}`} value={kb}>
                    {kb}
                  </option>
                ))}
                <option value="__EMPTY__">Tanpa Kode Bagging</option>
              </select>
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

          {/* Grouping Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-bold text-slate-500 mr-1">Kelompokkan:</span>
            {[
              { id: "NONE", label: "Semua" },
              { id: "BAGGING", label: "Per KodeBagging" },
              { id: "TGL_DATANG", label: "Per TglDatang" },
              { id: "SELLER", label: "Per Seller" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGroupBy(opt.id as any)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  groupBy === opt.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
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

          {/* List Items Card View (Flat or Grouped) */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredReturs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                Tidak ada paket retur yang sesuai filter.
              </div>
            ) : (() => {
              const renderReturCard = (r: ReturRecord) => {
                const isDiserahkan = r.Status === RETUR_STATUS.DISERAHKAN;
                return (
                  <div
                    key={r.ReturID}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start space-x-3">
                      {r.FotoTerimaURL ? (
                        <div
                          onClick={() => setPreviewPhoto({ url: getDirectDriveImageUrl(r.FotoTerimaURL), title: `Foto Resi ${r.Resi}` })}
                          className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 cursor-pointer border border-slate-300 relative group"
                        >
                          <img
                            src={getDirectDriveImageUrl(r.FotoTerimaURL)}
                            alt="Foto Retur"
                            loading="lazy"
                            decoding="async"
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
                          {r.KodeBagging && (
                            <span className="text-[9px] font-mono font-bold bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded">
                              {r.KodeBagging}
                            </span>
                          )}
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
                          <span>Tgl Datang: <strong className="text-slate-700">{r.TglDatang || r.TglTerima}</strong></span>
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

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 text-left sm:text-right text-[11px] text-slate-500 font-mono flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <div className="space-y-0.5">
                        <div>Terima: {r.TglTerima} {r.JamTerima}</div>
                        <div className="text-slate-600 font-medium">Petugas: {r.AdminTerima || "-"}</div>
                        {isDiserahkan && r.HandoverID && (
                          <div className="text-blue-600 font-bold text-[10px]">
                            ID Serah: {r.HandoverID}
                          </div>
                        )}
                      </div>
                      {!isReadOnly && r.Status === RETUR_STATUS.DITERIMA && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRetur(r)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-[11px] font-sans font-bold transition-colors"
                          title={`Hapus resi retur ${r.Resi}`}
                          aria-label={`Hapus resi ${r.Resi}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              if (!groupedReturs) {
                return filteredReturs.map(renderReturCard);
              }

              return groupedReturs.map((grp) => {
                const manifestCount = Math.max(...grp.items.map((x) => Number(x.JumlahManifest) || 0), 0);
                const diff = grp.items.length - manifestCount;
                return (
                  <div key={`grp-${grp.key}`} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="bg-slate-100/90 px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono font-extrabold text-slate-900">{grp.key}</span>
                        <span className="text-[11px] font-bold text-slate-600">
                          ({grp.items.length} paket)
                        </span>
                      </div>
                      {groupBy === "BAGGING" && grp.key !== "TANPA KODE BAGGING" && manifestCount > 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            diff > 0
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : diff < 0
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          Manifest {manifestCount} •{" "}
                          {diff > 0 ? `+${diff} di luar manifest` : diff < 0 ? `${diff} belum discan` : "sesuai"}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 space-y-2">{grp.items.map(renderReturCard)}</div>
                  </div>
                );
              });
            })()}
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

      {/* In-App Delete Confirmation Modal */}
      {confirmDeleteRetur && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Hapus Paket Retur?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Resi <strong className="font-mono text-slate-900">{confirmDeleteRetur.Resi}</strong> milik{" "}
                  <strong className="text-slate-900">{confirmDeleteRetur.Seller}</strong> akan dihapus dari daftar aktif dan ditandai <code className="bg-slate-100 px-1 rounded">DeletedAt</code> di Spreadsheet.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingRetur}
                onClick={() => setConfirmDeleteRetur(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingRetur}
                onClick={handleConfirmDeleteRetur}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                {isDeletingRetur ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
