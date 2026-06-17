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
  Volume2,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  Info,
  HelpCircle,
  Target
} from "lucide-react";
import { ScanRecord, StatusType } from "../types";
import { dbService, createMockResiPhoto, getDirectDriveImageUrl } from "../utils/db";
import { audioService } from "../utils/audio";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";

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
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
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

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Clarity confirmation modal ("Validasi Foto")
  const [pendingValidation, setPendingValidation] = useState<{
    resi: string;
    photoURL: string;
  } | null>(null);

  // Retake photo states
  const [activeRetakeResi, setActiveRetakeResi] = useState<string | null>(null);
  const [retakeTasks, setRetakeTasks] = useState<ScanRecord[]>([]);

  // Flashlight and Zoom states for hardware optimization on mobile devices
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomValue, setZoomValue] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 3 });

  // Continuous auto-focus & manual Tap-to-Focus states
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusModeValue, setFocusModeValue] = useState<string>("auto");
  const [tapFocusPos, setTapFocusPos] = useState<{ x: number; y: number } | null>(null);
  const [isRefocusing, setIsRefocusing] = useState(false);
  const focusTimeoutRef = useRef<any>(null);

  const scanIntervalRef = useRef<any>(null);

  // Lock barcode scanning when in retake mode to prevent auto-decodes of other barcodes
  useEffect(() => {
    if (activeRetakeResi) {
      isScanningLocked.current = true;
    } else {
      isScanningLocked.current = false;
    }
  }, [activeRetakeResi]);

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
    
    // Filter records exclusively for the currently logged-in operator (robust trimmed, case-insensitive match)
    const operatorRecords = all.filter(r => 
      r.Operator && r.Operator.trim().toLowerCase() === config.operator.trim().toLowerCase()
    );
    
    // Filter down to today's records specifically for this operator
    const todayStr = new Date().toISOString().split("T")[0];
    const filteredToday = operatorRecords.filter(r => r.Tanggal === todayStr);
    
    setScannedRecords(operatorRecords.slice(0, 20)); // Limit display to 20 for this operator
    setTotalToday(filteredToday.length);

    // Get pending retake tasks specifically for this operator
    const pendingTasks = all.filter(r => 
      r.RetakeStatus === "PENDING" && 
      r.Operator && r.Operator.trim().toLowerCase() === config.operator.trim().toLowerCase()
    );
    setRetakeTasks(pendingTasks);
  };

  // Apply a unified constraints block to prevent hardware features from overriding each other
  const applyCameraConstraints = async (overrides: { torch?: boolean; zoom?: number; focusMode?: string } = {}) => {
    if (!html5QrCodeRef.current) return;
    try {
      const track = (html5QrCodeRef.current as any).getRunningTrack();
      if (!track) return;

      const capabilities = track.getCapabilities() as any;
      if (!capabilities) return;

      const targetTorch = overrides.hasOwnProperty("torch") ? overrides.torch : torchActive;
      const targetZoom = overrides.hasOwnProperty("zoom") ? overrides.zoom : zoomValue;
      const targetFocusMode = overrides.hasOwnProperty("focusMode") ? overrides.focusMode : focusModeValue;

      const advancedConstraint: any = {};

      if (capabilities.torch && targetTorch !== undefined) {
        advancedConstraint.torch = targetTorch;
      }

      if (capabilities.zoom && targetZoom !== undefined) {
        const minZ = capabilities.zoom.min || 1;
        const maxZ = Math.min(capabilities.zoom.max || 5, 4);
        advancedConstraint.zoom = Math.max(minZ, Math.min(maxZ, targetZoom));
      }

      if (capabilities.focusMode && targetFocusMode !== undefined) {
        const modes = capabilities.focusMode as string[];
        if (modes.includes(targetFocusMode)) {
          advancedConstraint.focusMode = targetFocusMode;
        }
      }

      // Apply safe unified constraint update
      if (Object.keys(advancedConstraint).length > 0) {
        await track.applyConstraints({
          advanced: [advancedConstraint]
        } as any);
        console.log("Applied constraints successfully:", advancedConstraint);
      }
    } catch (err) {
      console.warn("Failed to apply camera constraints block:", err);
    }
  };

  // Camera stream activation under html5-qrcode
  const startCamera = async () => {
    setCameraPermissionError("");
    setTorchSupported(false);
    setTorchActive(false);
    setZoomSupported(false);
    setFocusSupported(false);
    
    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (_) {}
        html5QrCodeRef.current = null;
      }

      // Instantiate html5-qrcode on our container element ID
      const html5QrCode = new Html5Qrcode("html5-qr-code-element");
      html5QrCodeRef.current = html5QrCode;

      // Configurations fully optimized for Code 128 shipping resi (horizontal scan area, fps 20-30, environment camera)
      const scanConfig = {
        fps: 20, // stable frames per second
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Precise horizontal scanning box layout centered on the middle segment
          const width = Math.min(650, Math.floor(viewfinderWidth * 0.85));
          const height = Math.min(220, Math.floor(viewfinderHeight * 0.35));
          return { width, height };
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.EAN_13
        ],
        aspectRatio: 1.0 // Force 1:1 Aspect ratio to conform to container properly
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        scanConfig,
        (decodedText) => {
          if (!isScanningLocked.current) {
            if (handleBarcodeScannedRef.current) {
              handleBarcodeScannedRef.current(decodedText);
            }
          }
        },
        () => {
          // Silent callback during scan intervals to prevent console cluttering
        }
      );

      // Fetch running track to configure capabilities
      try {
        const track = (html5QrCode as any).getRunningTrack();
        if (track) {
          const capabilities = track.getCapabilities() as any;
          if (capabilities) {
            if (capabilities.torch) {
              setTorchSupported(true);
            }
            if (capabilities.zoom) {
              setZoomSupported(true);
              setZoomRange({
                min: capabilities.zoom.min || 1,
                max: Math.min(capabilities.zoom.max || 5, 4)
              });
              setZoomValue((track.getSettings() as any).zoom || 1);
            }
            if (capabilities.focusMode) {
              setFocusSupported(true);
              const modes = capabilities.focusMode as string[];
              if (modes.includes("continuous")) {
                setFocusModeValue("continuous");
                try {
                  await track.applyConstraints({
                    advanced: [{ focusMode: "continuous" }]
                  } as any);
                } catch (_) {}
              } else if (modes.includes("auto")) {
                setFocusModeValue("auto");
                try {
                  await track.applyConstraints({
                    advanced: [{ focusMode: "auto" }]
                  } as any);
                } catch (_) {}
              }
            }
          }
        }
      } catch (capError) {
        console.warn("Could not retrieve camera track capabilities:", capError);
      }

      setCameraActive(true);
    } catch (err: any) {
      console.warn("Camera failed to start under html5-qrcode:", err);
      setCameraPermissionError("Akses kamera ditolak atau tidak tersedia.");
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (_) {}
      html5QrCodeRef.current = null;
    }
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
    setTapFocusPos(null);
    setIsRefocusing(false);
    setFocusSupported(false);
    setCameraActive(false);
    setTorchActive(false);
    setTorchSupported(false);
    setZoomSupported(false);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const track = (html5QrCodeRef.current as any).getRunningTrack();
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.torch) {
          const nextState = !torchActive;
          await track.applyConstraints({
            advanced: [{ torch: nextState }]
          } as any);
          setTorchActive(nextState);
        }
      }
    } catch (err) {
      console.warn("Failed to toggle flashlight/torch constraint:", err);
    }
  };

  const triggerManualFocus = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const track = (html5QrCodeRef.current as any).getRunningTrack();
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.focusMode) {
          const modes = capabilities.focusMode as string[];
          if (modes.includes("single-shot")) {
            setFocusModeValue("single-shot");
            await track.applyConstraints({
              advanced: [{ focusMode: "single-shot" }]
            } as any);
            
            setTimeout(async () => {
              if (html5QrCodeRef.current) {
                const refreshedTrack = (html5QrCodeRef.current as any).getRunningTrack();
                if (refreshedTrack) {
                  if (modes.includes("continuous")) {
                    setFocusModeValue("continuous");
                    await refreshedTrack.applyConstraints({
                      advanced: [{ focusMode: "continuous" }]
                    } as any);
                  } else if (modes.includes("auto")) {
                    setFocusModeValue("auto");
                    await refreshedTrack.applyConstraints({
                      advanced: [{ focusMode: "auto" }]
                    } as any);
                  }
                }
              }
            }, 1100);
          } else if (modes.includes("continuous")) {
            setFocusModeValue("continuous");
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" }]
            } as any);
          } else if (modes.includes("auto")) {
            setFocusModeValue("auto");
            await track.applyConstraints({
              advanced: [{ focusMode: "auto" }]
            } as any);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to set manual focus constraint adjustment:", err);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraActive) return;

    // Reject click if clicking on UI overlay controls
    const targetElement = e.target as HTMLElement;
    if (targetElement.closest(".pointer-events-auto") || targetElement.closest("button")) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    setTapFocusPos({ x, y });
    setIsRefocusing(true);

    triggerManualFocus();

    focusTimeoutRef.current = setTimeout(() => {
      setTapFocusPos(null);
      setIsRefocusing(false);
    }, 1500);
  };

  const handleZoomChange = async (val: number) => {
    setZoomValue(val);
    if (!html5QrCodeRef.current) return;
    try {
      const track = (html5QrCodeRef.current as any).getRunningTrack();
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = Math.min(capabilities.zoom.max || 5, 4);
          const clampedVal = Math.max(minZ, Math.min(maxZ, val));
          await track.applyConstraints({
            advanced: [{ zoom: clampedVal }]
          } as any);
        }
      }
    } catch (err) {
      console.warn("Failed to set camera zoom constraint:", err);
    }
  };

  /**
   * Captures the exact frame from the HTML5 Video stream
   */
  const captureFrame = (scannedResi?: string): string => {
    const videoEl = document.querySelector("#html5-qr-code-element video") as HTMLVideoElement | null;
    if (videoEl && cameraActive) {
      try {
        const canvas = document.createElement("canvas");
        const maxDim = 640;
        let originalWidth = videoEl.videoWidth || 640;
        let originalHeight = videoEl.videoHeight || 480;
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
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          
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
    const simulatedBarcode = scannedResi || `JX${Math.floor(1000000000 + Math.random() * 9000000000)}`;
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
      toast.error("RESI TIDAK JELAS", { 
        description: "Silakan posisikan ulang paket dan scan kembali!" 
      });
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
      toast.error("Gagal menyimpan data", { description: result.error });
    }

    setPendingValidation(null);
    isScanningLocked.current = false;
  };

  const handleOpenRetakeModal = (resi: string) => {
    setActiveRetakeResi(resi);
  };

  const handleCaptureRetake = () => {
    if (!activeRetakeResi) return;

    setIsCapturing(true);
    // Grab frame from webcam stream with timestamp overlay
    const photoData = captureFrame(activeRetakeResi);
    
    // Save to DB
    const success = dbService.submitRetake(activeRetakeResi, photoData);
    setIsCapturing(false);

    if (success) {
      audioService.playSuccess();
      toast.success("FOTO ULANG BERHASIL", {
        description: `Resi ${activeRetakeResi} telah diperbarui dengan foto yang jelas!`
      });
      setActiveRetakeResi(null);
      loadRecords();
      if (onRecordAdded) {
        onRecordAdded(); // triggers update in parent counts
      }
    } else {
      toast.error("Gagal memperbarui foto ulang.");
    }
  };

  const handleCancelRetake = () => {
    setActiveRetakeResi(null);
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
            <span className="text-[10px] text-slate-500 block font-medium">paket Anda hari ini</span>
          </div>
          <CheckCircle className="h-10 w-10 text-red-600/20" />
        </div>
      </div>

      {/* Main View Grid: Left Panel (Camera Camera & Beep inputs) | Right Panel (Historical lists) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Camera Barcode Scanner Viewport */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Real-time Retake Task Notification */}
          {retakeTasks.length > 0 && (
            <div className="bg-amber-950/80 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-md animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs tracking-wider uppercase">
                  <AlertTriangle className="h-4 w-4 animate-bounce text-amber-500" />
                  <span>⚠️ PERMINTAAN FOTO ULANG ({retakeTasks.length})</span>
                </div>
                <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                  PENTING
                </span>
              </div>
              <p className="text-[11px] text-amber-250 leading-relaxed">
                Lakukan foto ulang karena foto lama dinyatakan buram atau tidak terbaca oleh Owner. Silakan klik "Foto Ulang" di bawah untuk memotret ulang resi tersebut.
              </p>
              
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {retakeTasks.map(task => (
                  <div key={task.Resi} className="bg-slate-950/60 border border-amber-500/10 rounded-xl p-3 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="font-mono font-bold text-slate-100 block">{task.Resi}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Seller: {task.Seller} • {task.Jam}</span>
                    </div>
                    
                    <button
                      onClick={() => handleOpenRetakeModal(task.Resi)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] px-3       py-1.5 rounded-lg flex items-center space-x-1 uppercase transition-all active:scale-95 cursor-pointer border-none"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Foto Ulang</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            
            {/* Viewport Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-850 flex items-center justify-between">
              <span className="font-semibold text-xs tracking-wide text-slate-200 flex items-center uppercase">
                <Camera className="h-3.5 w-3.5 mr-2 text-red-500" />
                FOTO & SCAN BARCODE
              </span>
              <div className="flex items-center space-x-2.5">
                {cameraActive && focusSupported && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center space-x-1 select-none">
                    <Target className="h-2.5 w-2.5 animate-[spin_4s_linear_infinite]" />
                    <span>Auto-Focus Aktif</span>
                  </span>
                )}
                <div className="flex items-center space-x-1.5">
                  <span className={`h-2 w-2 rounded-full ${cameraActive ? "bg-green-500 animate-ping" : "bg-slate-700"}`} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    {cameraActive ? "Kamera Aktif" : "Kamera Mati"}
                  </span>
                </div>
              </div>
            </div>

            {/* Video feed backdrop frame */}
            <div 
              onClick={handleContainerClick}
              className="relative bg-slate-900 h-[350px] sm:h-[450px] w-full flex flex-col items-center justify-center overflow-hidden border-b border-slate-850 cursor-crosshair select-none"
            >
              {/* Dynamic Lens Focus Target Sight (Tap-to-Focus Indicator) */}
              {cameraActive && tapFocusPos && (
                <div 
                  className="absolute pointer-events-none z-30"
                  style={{ 
                    left: tapFocusPos.x - 28, 
                    top: tapFocusPos.y - 28,
                    width: 56,
                    height: 56
                  }}
                >
                  {/* Outer animated bracket ring */}
                  <div className="absolute inset-0 border-2 border-yellow-400 rounded-lg animate-[ping_1.2s_ease-out_infinite]" />
                  <div className="absolute inset-0 border border-yellow-400 rounded-lg animate-[pulse_0.4s_infinite]" />
                  {/* Crosshairs */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-yellow-400" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-yellow-400" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-1.5 bg-yellow-400" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-1.5 bg-yellow-400" />
                  
                  {/* Focusing Sub-label popup */}
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-yellow-400 tracking-widest uppercase bg-slate-950/80 px-1 py-0.5 rounded shadow whitespace-nowrap">
                    {isRefocusing ? "MENFOKUS..." : "OK"}
                  </span>
                </div>
              )}

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

              {/* Real camera html5-qrcode element */}
              <div
                id="html5-qr-code-element"
                className={`w-full max-h-[350px] sm:max-h-[450px] overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover ${cameraActive ? "block" : "hidden"}`}
              />

              {/* If permission was denied or unavailable, display nice fallback illustration */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 bg-slate-900">
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
                  className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-between p-4 pb-8 z-50 safe-area-pt overflow-y-auto"
                  id="clarity-validation-overlay"
                >
                  <div className="w-full text-center py-4 border-b border-slate-900 sticky top-0 bg-slate-950 z-10 shrink-0">
                    <span className="text-sm font-bold text-red-500 uppercase tracking-widest block">VALIDASI KUALITAS FOTO</span>
                    <span className="text-sm text-slate-400 font-mono mt-1 block">RESI: {pendingValidation.resi}</span>
                  </div>

                  {/* Thumbnail display */}
                  <div className="my-4 border-2 border-slate-800 rounded-xl overflow-hidden bg-black flex-1 w-full max-w-2xl relative flex items-center justify-center min-h-[300px]">
                    <img
                      src={pendingValidation.photoURL}
                      alt="Captured parcel preview"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 px-3 py-1 rounded text-[10px] font-bold text-green-400 border border-green-500/20 shadow-md">
                      PREVIEW PHOTO
                    </div>
                  </div>

                  <div className="w-full max-w-2xl bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-300 shrink-0 mt-auto">
                    <p className="font-semibold text-white text-sm mb-1">Operator wajib memeriksa:</p>
                    <p className="text-slate-400 leading-relaxed">Apakah barcode & nomor resi terlihat jelas dan tidak buram?</p>
                  </div>

                  {/* Dual options triggers */}
                  <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mt-4 shrink-0">
                    <button
                      onClick={() => handleConfirmValidation(false)}
                      className="bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-800 hover:border-red-500/30 py-4 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-1 shadow-lg"
                      id="validate-unclear-button"
                    >
                      <span className="text-xl">❌</span>
                      <span>BURAM / RETAKE</span>
                    </button>
                    <button
                      onClick={() => handleConfirmValidation(true)}
                      className="bg-green-650 hover:bg-green-600 border border-green-500 text-white py-4 px-3 rounded-2xl text-xs sm:text-sm font-extrabold shadow-[0_0_20px_rgba(22,163,74,0.4)] transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-1"
                      id="validate-clear-button"
                    >
                      <span className="text-xl">✓</span>
                      <span>JELAS (SIMPAN)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Special Retake Overlay */}
              {activeRetakeResi && (
                <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1.5px] flex flex-col justify-between p-4 z-30 border-4 border-amber-500 animate-in fade-in duration-200">
                  <div className="bg-amber-950 border border-amber-600/50 p-3 rounded-xl text-center shadow-lg text-slate-100">
                    <span className="text-[9px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-wider inline-block mb-1 pt-[2px]">
                      MODE FOTO ULANG AKTIF
                    </span>
                    <h5 className="font-bold text-xs">Posisikan ulang paket resi:</h5>
                    <p className="font-mono text-amber-400 font-extrabold text-sm mb-1">{activeRetakeResi}</p>
                    <p className="text-[9px] text-slate-350 font-medium">Bujurkan resi di kotak bidik tengah agar terang dan tajam!</p>
                  </div>

                  {/* Highlighting retake brackets */}
                  <div className="border-4 border-dashed border-amber-500/80 rounded-2xl w-4/5 aspect-video mx-auto flex items-center justify-center bg-transparent pointer-events-none">
                    <div className="bg-amber-950/80 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">
                      Target Area Foto Baru
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleCaptureRetake}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 text-xs uppercase tracking-wider shadow-xl transition-all active:scale-95 cursor-pointer border-none"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Selesaikan & Foto Baru</span>
                    </button>
                    
                    <button
                      onClick={handleCancelRetake}
                      className="w-full bg-slate-950/90 hover:bg-zinc-900 border border-slate-800 text-slate-300 font-bold py-2.5 px-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-center outline-none"
                    >
                      Batal (Kembali)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Zoom & Light Tuners */}
            {cameraActive && (
              <div className="bg-slate-900 px-4 py-3 border-b-2 border-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-200">
                {/* Flashlight button */}
                {torchSupported ? (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer border ${
                      torchActive 
                        ? "bg-amber-500 text-slate-950 border-amber-600 shadow-md animate-pulse" 
                        : "bg-slate-950 text-amber-500 border-amber-500/20 hover:border-amber-500/50"
                    }`}
                  >
                    {torchActive ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    <span>{torchActive ? "Matikan Lampu Flash" : "Nyalakan Lampu Flash"}</span>
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1.5 py-1.5">
                      <ZapOff className="h-3.5 w-3.5 text-slate-600" />
                      <span>Lampu Kilat tidak didukung pada browser ini</span>
                    </div>
                  </div>
                )}

                {/* Zoom control slider if supported by hardware */}
                {zoomSupported && (
                  <div className="flex items-center space-x-3 flex-1 md:max-w-xs bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center shrink-0">
                      Zoom: {zoomValue.toFixed(1)}x
                    </span>
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step="0.1"
                      value={zoomValue}
                      onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Simulated Live Audio Check & Input Barcode interface */}
            <div className="p-4 bg-slate-950 space-y-3">
              
              {/* Form Input Barcode manually or simulated from camera gun */}
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
                      Data scan terbaru oleh Anda ({config.operator}) untuk seller {config.seller} akan otomatis tertampil secara real-time di panel ini.
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
