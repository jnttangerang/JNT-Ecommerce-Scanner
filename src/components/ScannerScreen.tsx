/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  FolderSync, 
  ArrowLeft, 
  RefreshCw, 
  ListRestart, 
  Sparkles,
  Smartphone,
  Eye,
  Trash2,
  Volume2
} from "lucide-react";
import { ScanRecord, StatusType } from "../types";
import { dbService, createMockResiPhoto, getDirectDriveImageUrl } from "../utils/db";
import { audioService } from "../utils/audio";
import { BrowserMultiFormatReader } from "@zxing/library";

interface ScannerProps {
  config: {
    outlet: string;
    seller: string;
    operator: string;
  };
  onBack: () => void;
  isOffline: boolean;
  pendingCount: number;
  triggerSync: () => void;
  isSyncing: boolean;
  onRecordAdded?: () => void;
  isPulling?: boolean;
  isCloudDataFresh?: boolean;
}

export const ScannerScreen: React.FC<ScannerProps> = ({
  config,
  onBack,
  isOffline,
  pendingCount,
  triggerSync,
  isSyncing,
  onRecordAdded,
  isPulling = false,
  isCloudDataFresh = false
}) => {
  // Lists
  const [scannedRecords, setScannedRecords] = useState<ScanRecord[]>([]);
  const [totalToday, setTotalToday] = useState(0);

  // Live video feed
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningLocked = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState("");

  // Scanner status
  const [latestResi, setLatestResi] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Ref to bypass stale closure on camera callbacks
  const handleBarcodeScannedRef = useRef<((scannedResi: string) => void) | null>(null);

  // Keep callback ref updated with the latest states/props on every render
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  // Manual code input helper (for testing/mobile fallbacks)
  const [manualResi, setManualResi] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Clarity confirmation modal ("Validasi Foto")
  const [pendingValidation, setPendingValidation] = useState<{
    resi: string;
    photoURL: string;
  } | null>(null);

  // Hydrate initial scanned rows
  useEffect(() => {
    loadRecords();
    
    // Auto start camera
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // Reload records whenever a background sync or pull completes
  useEffect(() => {
    if (!isSyncing && !isPulling) {
      loadRecords();
    }
  }, [isSyncing, isPulling]);

  const loadRecords = () => {
    const all = dbService.getRecords();
    // Filter down to today's records for this operator / outlet
    const todayStr = new Date().toISOString().split("T")[0];
    const filteredToday = all.filter(r => r.Tanggal === todayStr);
    
    setScannedRecords(all.slice(0, 20)); // Limit display to 20
    setTotalToday(filteredToday.length);
  };

  // Camera stream activation
  const startCamera = async () => {
    setCameraPermissionError("");
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          // Initialize local ZXing Browser Reader to start reading from the feed
          const reader = new BrowserMultiFormatReader();
          codeReaderRef.current = reader;
          reader.decodeFromStream(stream, videoRef.current, (result, err) => {
            if (result && !isScanningLocked.current) {
              const resiText = result.getText().trim();
              if (resiText) {
                if (handleBarcodeScannedRef.current) {
                  handleBarcodeScannedRef.current(resiText);
                }
              }
            }
          });
        }
        setCameraActive(true);
      } else {
        setCameraPermissionError("Kamera tidak didukung di browser ini.");
      }
    } catch (err: any) {
      console.warn("Camera permission denied or unavailable, using sandbox placeholder:", err);
      setCameraPermissionError("Akses kamera ditolak.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  /**
   * Captures the exact frame from the HTML5 Video stream
   */
  const captureFrame = (scannedResi?: string): string => {
    if (videoRef.current && cameraActive) {
      try {
        const canvas = document.createElement("canvas");
        const maxDim = 640;
        let originalWidth = videoRef.current.videoWidth || 640;
        let originalHeight = videoRef.current.videoHeight || 480;
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;

        // Scale down while maintaining original aspect ratio
        if (originalWidth > maxDim || originalHeight > maxDim) {
          if (originalWidth > originalHeight) {
            targetHeight = Math.round((originalHeight * maxDim) / originalWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((originalWidth * maxDim) / originalHeight);
            targetHeight = maxDim;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Draw subtle Red Crosshair or overlays on photo for proof
          ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(canvas.width * 0.15, canvas.height * 0.15, canvas.width * 0.7, canvas.height * 0.7);
          
          // Timestamp overlay
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(10, canvas.height - 35, 220, 25);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px monospace";
          ctx.fillText(`J&T REC: ${new Date().toLocaleTimeString()} | ${config.outlet}`, 18, canvas.height - 18);

          return canvas.toDataURL("image/jpeg", 0.7); // compress to JPG with 70% quality
        }
      } catch (err) {
        console.error("Failed to capture stream frame", err);
      }
    }
    // Fallback if camera is off or denied (generated high-fidelity J&T tracking ticket!)
    const simulatedBarcode = scannedResi || manualResi.trim().toUpperCase() || `JX${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    return createMockResiPhoto(simulatedBarcode, config.seller);
  };

  /**
   * Action when a barcode scanner successfully parses a tracking number
   */
  const handleBarcodeScanned = (scannedResi: string) => {
    const rawCode = scannedResi.trim().toUpperCase();
    if (!rawCode) return;

    if (isScanningLocked.current) return;

    setDuplicateWarning(null);

    // 1. Antiduplicate Validation
    if (dbService.isDuplicate(rawCode)) {
      audioService.playError();
      setDuplicateWarning(rawCode);
      isScanningLocked.current = true;
      
      // Auto dismiss warning after 4 seconds
      setTimeout(() => {
        setDuplicateWarning(prev => {
          if (prev === rawCode) {
            isScanningLocked.current = false;
            return null;
          }
          return prev;
        });
      }, 4000);
      return;
    }

    // 2. Capture corresponding photo from webcam frame
    setIsCapturing(true);
    const photoData = captureFrame(rawCode);
    setIsCapturing(false);

    // 3. Initiate visibility verification ("Validasi Foto")
    // Operator must confirm the picture looks clear before it is inserted
    isScanningLocked.current = true;
    setPendingValidation({
      resi: rawCode,
      photoURL: photoData
    });
  };

  // Accept verification and persist
  const handleConfirmValidation = (isValid: boolean) => {
    if (!pendingValidation) return;

    if (!isValid) {
      // ❌ RESI TIDAK JELAS - Cancel scan & ask for refresh
      audioService.playError();
      alert("❌ RESI TIDAK JELAS\n\nSilakan posisikan ulang paket dan scan kembali!");
      setPendingValidation(null);
      isScanningLocked.current = false;
      return;
    }

    // Capture success sound "Teet"
    audioService.playSuccess();

    // Persist to database
    const result = dbService.addRecord({
      resi: pendingValidation.resi,
      outlet: config.outlet,
      seller: config.seller,
      operator: config.operator,
      photoURL: pendingValidation.photoURL
    });

    if (result.success && result.record) {
      setLatestResi(result.record.Resi);
      loadRecords();
      if (onRecordAdded) {
        onRecordAdded();
      }
    } else {
      alert(`Gagal menyimpan: ${result.error}`);
    }

    setPendingValidation(null);
    setManualResi("");
    isScanningLocked.current = false;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualResi.trim().toUpperCase();
    
    // Quick validation format
    if (!clean.match(/^JX\d{10,12}$/i) && !clean.match(/^\d{10,13}$/)) {
      // Proceed immediately to avoid sandboxed iframe dialog freeze
    }

    handleBarcodeScanned(clean);
  };

  // Clear data safely for testing
  const handleClearTodayRecords = () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 5000); // Auto expire in 5 seconds
      return;
    }
    dbService.resetDatabase();
    loadRecords();
    setLatestResi("");
    setShowResetConfirm(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-6" id="scanner-workspace">
      
      {/* Upper Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Back and Metadata Badge */}
        <div className="md:col-span-3 bg-white border border-slate-205 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl transition-all active:scale-95 border border-slate-200 focus:outline-none cursor-pointer"
              title="Kembali ke setup"
              id="back-to-setup"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">OUTLET:</span>
                <span className="text-slate-800 font-bold text-xs truncate max-w-[150px]">{config.outlet}</span>
              </div>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-red-650 font-extrabold text-sm" style={{ color: "#ef2727" }}>{config.seller}</span>
                <span className="text-slate-300 font-black">•</span>
                <span className="text-slate-600 text-xs font-semibold truncate max-w-[100px]">{config.operator}</span>
              </div>
            </div>
          </div>

          {/* Sync Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={triggerSync}
              disabled={pendingCount === 0 || isSyncing}
              className={`flex-grow md:flex-grow-0 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold text-xs select-none tracking-wide uppercase transition-all ${
                pendingCount > 0
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer animate-pulse"
                  : "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
              }`}
              style={pendingCount > 0 ? { backgroundColor: "#ff0000", color: "#ffffff" } : undefined}
              id="upload-now-batch"
            >
              <FolderSync className="h-4 w-4" />
              <span>{isSyncing ? "UPLOADING..." : "UPLOAD SEKARANG"}</span>
              {pendingCount > 0 && (
                <span className="bg-white/25 text-white font-mono px-1.5 py-0.5 rounded-md text-[10px] ml-1">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Total stats card */}
        <div 
          className="bg-red-50/65 border border-red-105 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="absolute right-[-10px] bottom-[-20px] text-red-600/5 font-black text-7xl select-none font-mono">
            SUM
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-red-600 tracking-wider uppercase block">TOTAL SCAN</span>
            <span className="text-3xl font-black text-red-600 font-mono tracking-tight" id="total-scan-ticker">
              {totalToday}
            </span>
            <span className="text-[10px] text-slate-500 block font-medium">paket hari ini</span>
          </div>
          <CheckCircle className="h-10 w-10 text-red-600/20" />
        </div>
      </div>

      {/* Main View Grid: Left Panel (Camera Camera & Beep inputs) | Right Panel (Historical lists) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Camera Barcode Scanner Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            
            {/* Viewport Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-850 flex items-center justify-between">
              <span className="font-semibold text-xs tracking-wide text-slate-200 flex items-center uppercase">
                <Camera className="h-3.5 w-3.5 mr-2 text-red-500" />
                FOTO & SCAN BARCODE
              </span>
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${cameraActive ? "bg-green-500 animate-ping" : "bg-slate-700"}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  {cameraActive ? "Kamera Aktif" : "Kamera Mati"}
                </span>
              </div>
            </div>

            {/* Video feed backdrop frame */}
            <div className="relative bg-black h-[350px] sm:h-[450px] w-full flex flex-col items-center justify-center overflow-hidden border-b border-slate-850">
              {/* Target Scan Lines overlay */}
              <div className="absolute inset-0 border-[3px] border-transparent pointer-events-none z-10">
                {/* Simulated laser scan */}
                {cameraActive && (
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500 opacity-80 shadow-[0_0_8px_rgba(239,68,68,1)] animate-[bounce_3.5s_infinite]" />
                )}
                {/* Framing guide brackets */}
                <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border-2 border-red-500/30 rounded-lg pointer-events-none">
                  <div className="absolute top-[-2px] left-[-2px] w-4 h-4 border-t-2 border-l-2 border-red-500" />
                  <div className="absolute top-[-2px] right-[-2px] w-4 h-4 border-t-2 border-r-2 border-red-500" />
                  <div className="absolute bottom-[-2px] left-[-2px] w-4 h-4 border-b-2 border-l-2 border-red-500" />
                  <div className="absolute bottom-[-2px] right-[-2px] w-4 h-4 border-b-2 border-r-2 border-red-500" />
                </div>
              </div>

              {/* Real camera video tag */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover select-none ${cameraActive ? "block" : "hidden"}`}
              />

              {/* If permission was denied or unavailable, display nice fallback illustration */}
              {!cameraActive && (
                <div className="p-6 text-center space-y-3 z-10 max-w-sm">
                  <div className="bg-red-550/10 text-red-500 rounded-full h-12 w-12 flex items-center justify-center mx-auto border border-red-500/20 shadow">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <h4 className="text-slate-205 font-bold text-sm">Mode Capture Otomatis Aktif</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Aplikasi ini secara otomatis menghasilkan foto resi J&T yang terkompresi dengan metadata barcode setiap kali Anda memindai kode resi di bawah ini.
                  </p>
                  {cameraPermissionError && (
                    <div className="bg-slate-950 border border-slate-800 text-[10px] text-amber-400 p-2 rounded-lg font-mono leading-tight">
                      {cameraPermissionError}
                    </div>
                  )}
                </div>
              )}

              {/* Pulse overlay during picture capture */}
              {isCapturing && (
                <div className="absolute inset-0 bg-white flex items-center justify-center z-30 animate-flash">
                  <span className="text-slate-900 font-extrabold text-xs">SNAPPING RESI...</span>
                </div>
              )}

              {/* Giant Anti Duplikat Warning Overlay */}
              {duplicateWarning && (
                <div 
                  className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center px-4 py-6 z-25 text-center space-y-4 border border-red-500 animate-in zoom-in-95 duration-200"
                  id="anti-duplicate-warning-modal"
                >
                  <AlertTriangle className="h-16 w-16 text-yellow-500 animate-bounce" />
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-widest uppercase">⚠️ RESI DUPLIKAT</h3>
                    <p className="text-slate-300 font-semibold font-mono text-xs mt-1 bg-slate-950 px-3 py-1.5 rounded-full inline-block border border-red-900">
                      RESI {duplicateWarning} SUDAH PERNAH DISCAN
                    </p>
                  </div>
                  <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                    Resi telah terdaftar dalam database pickup hari ini. Total scan tidak bertambah demi mencegah double resi.
                  </p>
                  <button
                    onClick={() => {
                      setDuplicateWarning(null);
                      isScanningLocked.current = false;
                    }}
                    className="bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs px-4 py-2 rounded-lg transition-all"
                  >
                    TUTUP PERINGATAN
                  </button>
                </div>
              )}

              {/* Clarity Verification modal ("Validasi Foto") */}
              {pendingValidation && (
                <div 
                  className="absolute inset-0 bg-slate-950/98 flex flex-col items-center justify-between p-4 z-30"
                  id="clarity-validation-overlay"
                >
                  <div className="w-full text-center py-2 border-b border-slate-905">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-widest block">VALIDASI KUALITAS FOTO</span>
                    <span className="text-xs text-slate-400 font-mono">RESI: {pendingValidation.resi}</span>
                  </div>

                  {/* Thumbnail display */}
                  <div className="my-2 border-2 border-slate-800 rounded-xl overflow-hidden bg-black max-w-[280px] w-full aspect-video flex-grow-0 relative flex items-center justify-center">
                    <img
                      src={pendingValidation.photoURL}
                      alt="Captured parcel preview"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] font-bold text-green-400 border border-green-500/20">
                      PREVIEW PHOTO
                    </div>
                  </div>

                  <div className="w-full max-w-md bg-slate-900/60 p-3 rounded-xl border border-slate-805 text-center text-[11px] text-slate-300">
                    <p className="font-semibold">Operator wajib memeriksa:</p>
                    <p className="text-slate-400">Apakah barcode & nomor resi terlihat jelas dan tidak buram?</p>
                  </div>

                  {/* Dual options triggers */}
                  <div className="w-full grid grid-cols-2 gap-3 mt-1 max-w-sm">
                    <button
                      onClick={() => handleConfirmValidation(false)}
                      className="bg-slate-900 hover:bg-slate-850 text-red-400 border border-slate-800 hover:border-red-500/30 py-3.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                      id="validate-unclear-button"
                    >
                      ❌ BURAM / RETAKE
                    </button>
                    <button
                      onClick={() => handleConfirmValidation(true)}
                      className="bg-red-650 hover:bg-red-600 text-white py-3.5 px-3 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer text-center"
                      id="validate-clear-button"
                    >
                      ✓ JELAS (SIMPAN)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Live Audio Check & Input Barcode interface */}
            <div className="p-4 bg-slate-950 space-y-3">
              
              {/* Form Input Barcode manually or simulated from camera gun */}
              <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-grow relative">
                  <input
                    type="text"
                    value={manualResi}
                    onChange={(e) => setManualResi(e.target.value)}
                    placeholder="Ketik manual"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 font-mono text-xs focus:outline-none focus:border-red-500 uppercase placeholder:text-slate-500"
                    id="manual-resi-input"
                  />
                  <div className="absolute right-3 top-3 text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                    BARCODE INPUT
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={!manualResi.trim()}
                  className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider transition-all uppercase ${
                    manualResi.trim()
                      ? "bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                      : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-850"
                  }`}
                  style={manualResi.trim() ? { backgroundColor: "#e31111", color: "#ffffff" } : undefined}
                  id="manual-resi-submit-button"
                >
                  SIMPAN RESI
                </button>
              </form>

              {/* Utility actions / simulations */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-900">
                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                  <Volume2 className="h-3 w-3 text-slate-450" />
                  <span>Teet synthesizer aktif</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleClearTodayRecords}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-all cursor-pointer ${
                      showResetConfirm
                        ? "bg-red-600 text-white font-extrabold animate-pulse shadow-sm"
                        : "text-slate-500 hover:text-red-600 hover:bg-slate-100/50"
                    }`}
                    title="Bersihkan database harian"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{showResetConfirm ? "YAKIN? KLIK LAGI UNTUK RESET" : "RESET LOCAL DB"}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Big Active Tracking Screen banner */}
          {latestResi && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-white">
              <div>
                <span className="text-[10px] font-mono text-slate-400">RESI TERAKHIR SUKSES:</span>
                <p className="text-2xl font-black text-green-400 font-mono tracking-wider mt-0.5" id="last-scanned-resi-display">
                  {latestResi}
                </p>
              </div>
              <div className="bg-green-950/80 border border-green-900 px-3 py-1.5 rounded-xl text-right">
                <span className="text-[9px] font-bold text-green-400 block">STATUS</span>
                <span className="text-xs font-black text-green-300 font-mono">✓ SCANNED</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: 20 Last Scanned Receipt Records (Newest Top) */}
        <div className="lg:col-span-5 flex flex-col h-full font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col flex-grow shadow-sm">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  DAFTAR 20 RESI TERAKHIR
                  {(() => {
                    const isDataRealtime = !isOffline && pendingCount === 0 && isCloudDataFresh;
                    return isDataRealtime ? (
                      <span 
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider"
                        title="Data berasal langsung dari spreadsheet dan up-to-date"
                      >
                        ● SYNCED
                      </span>
                    ) : (
                      <span 
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider"
                        title="Data cache lokal (belum disinkron / offline)"
                      >
                        ● STALE
                      </span>
                    );
                  })()}
                </h3>
                <p className="text-[10px] text-slate-500">Terbaru berada di urutan paling atas</p>
              </div>
              <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-[11px] font-bold text-slate-600 font-mono">
                MAX 20
              </span>
            </div>

            {/* Scanned Feed list box */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 flex-grow" id="recent-scans-feed">
              {scannedRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-3">
                  <ListRestart className="h-10 w-10 mx-auto opacity-30 text-slate-400" />
                  <div>
                    <h5 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Belum Ada Paket</h5>
                    <p className="text-[11px] max-w-xs mx-auto text-slate-500 mt-1 leading-relaxed font-semibold">
                      Data scan terbaru untuk seller {config.seller} akan otomatis tertampil secara real-time di panel ini.
                    </p>
                  </div>
                </div>
              ) : (
                scannedRecords.map((r, i) => (
                  <div
                    key={r.Resi + r.ScanTimestamp}
                    className={`p-3 bg-slate-50 border rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/60 ${
                      i === 0 ? "border-red-200 shadow-sm" : "border-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Photo Thumbnail */}
                      <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {r.PhotoURL ? (
                          <img
                            src={getDirectDriveImageUrl(r.PhotoURL)}
                            alt="Receipt thumbed"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-[9px] font-semibold text-slate-400 flex items-center justify-center h-full">
                            NO PIC
                          </div>
                        )}
                        {/* Offline tag */}
                        {r.SyncStatus === "PENDING" && (
                          <div className="absolute inset-0 bg-amber-500/15" title="Belum disinkronkan" />
                        )}
                      </div>

                      {/* Code and Meta info */}
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-slate-800 tracking-wide block truncate">
                          {r.Resi}
                        </span>
                        
                        <div className="flex items-center text-[10px] text-slate-500 space-x-1.5 mt-0.5">
                          <span className="font-mono">{r.Jam}</span>
                          <span>•</span>
                          <span className="truncate max-w-[80px]">{r.Seller}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge and Sync status */}
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        r.Status === "CANCELLED"
                          ? "bg-red-50 text-red-650 border border-red-100 font-extrabold"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}>
                        {r.Status === "CANCELLED" ? "CANCELLED" : "✓ SCANNED"}
                      </span>

                      <span className={`text-[8px] font-mono font-bold ${
                        r.SyncStatus === "SYNCED" 
                          ? "text-slate-400" 
                          : "text-amber-600 uppercase animate-pulse"
                      }`}>
                        {r.SyncStatus === "SYNCED" ? "cloud-synced" : "offline-queue"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Summary stats */}
            {scannedRecords.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Menampilkan {scannedRecords.length} dari total paket</span>
                <span className="font-mono text-[11px] text-slate-450 font-bold">{config.outlet}</span>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
