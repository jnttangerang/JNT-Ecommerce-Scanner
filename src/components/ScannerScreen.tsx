/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  CameraOff,
  AlertTriangle, 
  CheckCircle, 
  XCircle,
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
  LogOut,
  X,
  Check,
  Target,
  Filter,
  Calendar,
  Search,
  SlidersHorizontal
} from "lucide-react";
import { ScanRecord, StatusType } from "../types";
import { dbService, createMockResiPhoto, getDirectDriveImageUrl, getTodayLocalDateString } from "../utils/db";
import { audioService } from "../utils/audio";
import { triggerHaptic } from "../utils/haptics";
import { estimateSharpness, BLUR_WARNING_THRESHOLD } from "../utils/blur";
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
  const [dailyTarget, setDailyTarget] = useState(() => dbService.getDailyTarget());

  // Filter & Search states for the Scanned History Panel
  const [filterSearchQuery, setFilterSearchQuery] = useState("");

  // Pagination for Operator Screen - History
  const [operatorPage, setOperatorPage] = useState(1);
  const [operatorPageSize, setOperatorPageSize] = useState(20);
  const [operatorJumpInput, setOperatorJumpInput] = useState("");

  // Live video feed
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningLocked = useRef(false);
  const consecutiveScansRef = useRef<{ barcode: string, count: number }>({ barcode: "", count: 0 });
  const lastScannedBarcodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  // Tracks codes that ARE read by the camera but don't match the expected resi format,
  // so we can warn the operator instead of ignoring them completely silently.
  const invalidFormatScanRef = useRef<{ code: string, count: number }>({ code: "", count: 0 });
  const lastInvalidFormatToastRef = useRef<number>(0);
  // Sharpness score (from the Laplacian-variance blur estimator) of the most recently
  // captured frame, read right after captureFrame() runs.
  const lastCaptureSharpnessRef = useRef<number>(Infinity);
  const prevRetakeCountRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState("");

  // Scanner status
  const [latestResi, setLatestResi] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [cancelledWarning, setCancelledWarning] = useState<string | null>(null);
  const [unclearResiAlert, setUnclearResiAlert] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Ref to bypass stale closure on camera callbacks
  const handleBarcodeScannedRef = useRef<((scannedResi: string) => void) | null>(null);
  
  // Track camera transitions to prevent 'Cannot Transition to a new state' error
  const cameraTransitionRef = useRef<Promise<void>>(Promise.resolve());

  // Keep callback ref updated with the latest states/props on every render
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [deletingResi, setDeletingResi] = useState<string | null>(null);
  
  // ORDER CANCELLED ALERT states
  const [pendingAlerts, setPendingAlerts] = useState<ScanRecord[]>([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);

  // Session scanned resis (starts empty on enter)
  const [sessionScannedResis, setSessionScannedResis] = useState<string[]>([]);
  // Active panel tab ("ACTIVE_SESSION" by default)
  const [activePanelTab, setActivePanelTab] = useState<"ACTIVE_SESSION" | "LAPORAN_SCAN" | "CANCEL_QUEUE">("ACTIVE_SESSION");

  // Cancel queue processing states
  const [activeCancelItem, setActiveCancelItem] = useState<ScanRecord | null>(null);
  const [cancelPhotoData, setCancelPhotoData] = useState<string>("");
  const [cancelRemark, setCancelRemark] = useState<string>("");

  // Manual input and live real-time validation states
  const [manualInput, setManualInput] = useState("");
  const [liveWarning, setLiveWarning] = useState<{
    type: "DUPLICATE" | "CANCELLED" | "RETAKE" | "OK";
    title: string;
    desc: string;
  } | null>(null);

  const handleLiveCheck = (val: string) => {
    const rawCode = val.trim().toUpperCase();
    if (!rawCode) {
      setLiveWarning(null);
      return;
    }

    const todayStr = getTodayLocalDateString();
    const records = dbService.getRecords();
    
    // Find if it exists in today's records
    const existing = records.find(r => r.Resi.toLowerCase() === rawCode.toLowerCase() && r.Tanggal === todayStr);
    
    if (existing) {
      if (existing.Status === "CANCELLED") {
        setLiveWarning({
          type: "CANCELLED",
          title: "RESI BATAL (CANCELLED)",
          desc: "Resi ini telah ditandai CANCELLED oleh Seller atau Owner. Jangan diproses!"
        });
      } else if (existing.RetakeStatus === "PENDING") {
        setLiveWarning({
          type: "RETAKE",
          title: "PERLU FOTO ULANG (RETAKE)",
          desc: "Owner meminta foto ulang (retake) untuk resi ini karena gambar sebelumnya tidak jelas."
        });
      } else {
        setLiveWarning({
          type: "DUPLICATE",
          title: "RESI DUPLIKAT",
          desc: "Resi ini sudah pernah diproses pada pickup hari ini. Harap periksa fisik paket."
        });
      }
    } else {
      // Is there any active retake request for this barcode on any day?
      const activeRetake = records.find(r => r.Resi.toLowerCase() === rawCode.toLowerCase() && r.RetakeStatus === "PENDING");
      if (activeRetake) {
        setLiveWarning({
          type: "RETAKE",
          title: "PERLU FOTO ULANG (RETAKE)",
          desc: "Owner meminta foto ulang (retake) untuk resi ini karena gambar sebelumnya tidak jelas."
        });
        return;
      }

      // It doesn't exist in today's records. Is it in historical records?
      const historical = records.find(r => r.Resi.toLowerCase() === rawCode.toLowerCase());
      if (historical) {
        setLiveWarning({
          type: "OK",
          title: "RESI DARI HARI LAIN",
          desc: `Resi ini pernah di-scan pada ${historical.Tanggal}. Dapat di-scan ulang hari ini sebagai transaksi baru.`
        });
      } else {
        setLiveWarning(null);
      }
    }
  };

  // Clarity confirmation modal ("Validasi Foto")
  const [pendingValidation, setPendingValidation] = useState<{
    resi: string;
    photoURL: string;
    isBlurry?: boolean;
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
    let active = true;
    loadRecords();
    
    // Auto start camera with slight delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (active) {
        startCamera();
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  // Mobile browsers often freeze/kill the camera stream when the tab or app goes to the
  // background (switching apps, locking the phone, an incoming call). If we don't release
  // it ourselves first, the camera can be left in a stuck "mid-transition" state that
  // later surfaces as "Cannot transition to a new state, already under transition" when
  // the operator comes back. Explicitly stop on hide and restart on show to avoid that.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      } else {
        startCamera();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Reload records whenever a background sync or pull completes
  useEffect(() => {
    if (!isSyncing && !isPulling) {
      loadRecords();
    }
  }, [isSyncing, isPulling]);

  const loadRecords = () => {
    setDailyTarget(dbService.getDailyTarget());
    const all = dbService.getRecords();
    
    // Filter records exclusively for the currently logged-in operator, seller, and outlet combination (current batch/session)
    const operatorRecords = all.filter(r => 
      r.Operator && r.Operator.trim().toLowerCase() === config.operator.trim().toLowerCase() &&
      r.Seller && r.Seller.trim().toLowerCase() === config.seller.trim().toLowerCase() &&
      r.Outlet && r.Outlet.trim().toLowerCase() === config.outlet.trim().toLowerCase()
    );
    
    // Filter down to today's records specifically for this operator
    const todayStr = getTodayLocalDateString();
    const filteredToday = operatorRecords.filter(r => r.Tanggal === todayStr);
    
    setScannedRecords(operatorRecords); // Store full list for robust, multi-day, on-demand filtering
    setTotalToday(filteredToday.length);

    // Get pending CANCELLED alerts for this outlet
    const alerts = all.filter(r => 
      r.Status === "CANCELLED" && 
      r.alertStatus === "PENDING" &&
      r.Outlet && r.Outlet.trim().toLowerCase() === config.outlet.trim().toLowerCase()
    );
    setPendingAlerts(alerts);
    if (alerts.length === 0) {
      setCurrentAlertIndex(0);
    } else {
      setCurrentAlertIndex(prev => Math.min(prev, alerts.length - 1));
    }

    // Get pending retake tasks specifically for this operator
    const pendingTasks = all.filter(r => 
      r.RetakeStatus === "PENDING" && 
      r.Operator && r.Operator.trim().toLowerCase() === config.operator.trim().toLowerCase()
    );

    if (prevRetakeCountRef.current !== null && pendingTasks.length > prevRetakeCountRef.current) {
      audioService.playRetake();
      toast.warning(`Owner meminta FOTO ULANG (RETAKE) untuk ${pendingTasks.length - prevRetakeCountRef.current} resi!`, {
        duration: 5000,
      });
    }
    prevRetakeCountRef.current = pendingTasks.length;
    setRetakeTasks(pendingTasks);
  };

  // Memoized filtered and displayed records calculation
  const filteredRecords = React.useMemo(() => {
    return scannedRecords.filter(r => {
      // 1. Search Query (matches Resi, case insensitive)
      if (filterSearchQuery.trim()) {
        const q = filterSearchQuery.trim().toLowerCase();
        const matchResi = r.Resi && r.Resi.toLowerCase().includes(q);
        if (!matchResi) return false;
      }

      return true;
    });
  }, [scannedRecords, filterSearchQuery]);

  // Filtered records for the current active scan session (matching sessionScannedResis)
  const filteredRecordsSession = React.useMemo(() => {
    return filteredRecords.filter(r => sessionScannedResis.includes(r.Resi));
  }, [filteredRecords, sessionScannedResis]);

  // Filtered records for Laporan Scan (all scanned today by this operator combination)
  const filteredRecordsLaporan = React.useMemo(() => {
    const todayStr = getTodayLocalDateString();
    return filteredRecords.filter(r => r.Tanggal === todayStr);
  }, [filteredRecords]);

  // Filtered records for Cancel Queue (CancelStatus === "CANCELLED" and AlertStatus === "PENDING" or "IN_PROGRESS")
  const filteredRecordsCancelQueue = React.useMemo(() => {
    return filteredRecords.filter(r => 
      r.CancelStatus === "CANCELLED" && 
      (r.AlertStatus === "PENDING" || r.AlertStatus === "IN_PROGRESS" || r.alertStatus === "PENDING" || r.alertStatus === "IN_PROGRESS")
    );
  }, [filteredRecords]);

  // Active records to display based on the selected tab
  const activeRecordsList = React.useMemo(() => {
    if (activePanelTab === "ACTIVE_SESSION") {
      return filteredRecordsSession;
    } else if (activePanelTab === "CANCEL_QUEUE") {
      return filteredRecordsCancelQueue;
    } else {
      return filteredRecordsLaporan;
    }
  }, [activePanelTab, filteredRecordsSession, filteredRecordsLaporan, filteredRecordsCancelQueue]);

  // Check if any filters are actively set (other than default)
  const isFilterActive = !!(filterSearchQuery.trim());

  // Operator pagination calculations
  const totalOperatorRecords = activeRecordsList.length;
  const totalOperatorPages = Math.ceil(totalOperatorRecords / operatorPageSize) || 1;
  const operatorStartIndex = (operatorPage - 1) * operatorPageSize;
  const operatorEndIndex = Math.min(operatorStartIndex + operatorPageSize, totalOperatorRecords);

  const displayedRecords = React.useMemo(() => {
    return activeRecordsList.slice(operatorStartIndex, operatorEndIndex);
  }, [activeRecordsList, operatorStartIndex, operatorEndIndex]);

  // Reset operator page to 1 on filter, query, tab, or count change
  useEffect(() => {
    setOperatorPage(1);
    setOperatorJumpInput("");
  }, [filterSearchQuery, activePanelTab, scannedRecords.length]);

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
    let resolveMutex: () => void;
    const previousMutex = cameraTransitionRef.current;
    cameraTransitionRef.current = new Promise<void>(r => { resolveMutex = () => r(); });
    await previousMutex;
    
    setCameraPermissionError("");
    setTorchSupported(false);
    setTorchActive(false);
    setZoomSupported(false);
    setFocusSupported(false);
    
    try {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2 || state === 3) { // SCANNING or PAUSED
             await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (_) {}
        html5QrCodeRef.current = null;
      }
      
      // Give the DOM a tiny bit of time to breathe
      await new Promise(r => setTimeout(r, 50));

      // Instantiate html5-qrcode on our container element ID
      let html5QrCode = new Html5Qrcode("html5-qr-code-element");
      html5QrCodeRef.current = html5QrCode;

      // Configurations for shipping resi labels, which may carry a Code 128 barcode,
      // a QR code, or occasionally other 1D formats depending on the ecommerce seller.
      const scanConfig = {
        fps: 20, // 20 is optimal for mid-range Android devices, 30 might drop frames
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Tighter scanning box so it targets a single resi instead of also catching a
          // neighboring package's barcode when packages are stacked close together.
          const width = Math.min(480, Math.floor(viewfinderWidth * 0.78));
          const height = Math.min(170, Math.floor(viewfinderHeight * 0.28));
          return { width, height };
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13
        ],
        aspectRatio: 1.0, // Force 1:1 Aspect ratio to conform to container properly
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Hardware acceleration if supported
        }
      };

      try {
        // Try starting with environment camera and optimal resolution
        await html5QrCode.start(
          { 
            facingMode: "environment",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          scanConfig,
          (decodedText) => {
            if (!isScanningLocked.current) {
              if (handleBarcodeScannedRef.current) {
                handleBarcodeScannedRef.current(decodedText);
              }
            }
          },
          () => {}
        );
      } catch (envError) {
        console.warn("Failed to start environment camera with constraints, trying without resolution constraints", envError);
        
        try { html5QrCode.clear(); } catch (_) {}
        let fallbackQrCode = new Html5Qrcode("html5-qr-code-element");
        html5QrCodeRef.current = fallbackQrCode;

        try {
          // First fallback: just facingMode without width/height constraints
          await fallbackQrCode.start(
            { facingMode: "environment" },
            scanConfig,
            (decodedText) => {
              if (!isScanningLocked.current && handleBarcodeScannedRef.current) {
                handleBarcodeScannedRef.current(decodedText);
              }
            },
            () => {}
          );
          html5QrCode = fallbackQrCode;
        } catch (envFallbackError) {
          console.warn("Failed to start environment camera without constraints, falling back to device enumeration", envFallbackError);
          
          try { fallbackQrCode.clear(); } catch (_) {}
          fallbackQrCode = new Html5Qrcode("html5-qr-code-element");
          html5QrCodeRef.current = fallbackQrCode;

          // Second fallback: try to pick the back/rear camera by label instead of blindly using
          // devices[0], which is the front camera on a number of Android/iPad devices.
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCamera = devices.find(d => {
              const label = d.label.toLowerCase();
              return (label.includes("back") || label.includes("rear") || label.includes("environment") || label.includes("1")) && !label.includes("front");
            });
            // devices[devices.length - 1] is often the back camera on Android if it's the last one enumerated, but we can also check for camera facing 0 (usually front).
            const chosenDevice = backCamera || devices.find(d => !d.label.toLowerCase().includes("front")) || devices[devices.length - 1] || devices[0];

            await fallbackQrCode.start(
              chosenDevice.id,
              scanConfig,
              (decodedText) => {
                if (!isScanningLocked.current && handleBarcodeScannedRef.current) {
                  handleBarcodeScannedRef.current(decodedText);
                }
              },
              () => {}
            );
            html5QrCode = fallbackQrCode; // update the local reference for track fetching below
          } else {
            throw new Error("No cameras found");
          }
        }
      }

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
      // Determine if error is NotAllowedError (permission denied) or NotFoundError (no device)
      if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
        setCameraPermissionError("Akses kamera ditolak. Izinkan browser menggunakan kamera.");
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('device neither found')) {
        setCameraPermissionError("Kamera perangkat tidak ditemukan.");
      } else {
        setCameraPermissionError(`Gagal memulai kamera: ${err?.message || err}`);
      }
      setCameraActive(false);
    } finally {
      resolveMutex!();
    }
  };

  const stopCamera = async () => {
    let resolveMutex: () => void;
    const previousMutex = cameraTransitionRef.current;
    cameraTransitionRef.current = new Promise<void>(r => { resolveMutex = () => r(); });
    await previousMutex;
    
    try {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2 || state === 3) { // SCANNING or PAUSED
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (_) {}
        html5QrCodeRef.current = null;
      }
    } finally {
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
      resolveMutex!();
    }
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
        if (!videoEl.videoWidth || !videoEl.videoHeight) {
          throw new Error("Video width/height is zero or unavailable");
        }
        const canvas = document.createElement("canvas");
        const maxDim = 640;
        let originalWidth = videoEl.videoWidth;
        let originalHeight = videoEl.videoHeight;
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

          // Estimate sharpness on the full-quality canvas BEFORE JPEG compression,
          // since compression artifacts can distort the edge-variance measurement.
          lastCaptureSharpnessRef.current = estimateSharpness(canvas);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7); // compress to JPG with 70% quality
          if (dataUrl === "data:,") throw new Error("Canvas returned empty dataURL");
          return dataUrl;
        }
      } catch (err) {
        console.error("Failed to capture stream frame", err);
        return ""; // Return empty string to indicate failure when camera is active
      }
    }
    // Fallback if camera is off or denied (generated high-fidelity J&T tracking ticket!)
    lastCaptureSharpnessRef.current = Infinity; // Not a real capture, so never flag it as blurry
    
    const validPrefixesStr = localStorage.getItem("jt_resi_prefixes") || "JX, JZ";
    const validPrefixes = validPrefixesStr.split(",").map(p => p.trim()).filter(Boolean);
    const defaultPrefix = validPrefixes.length > 0 ? validPrefixes[0] : "JX";
    
    const simulatedBarcode = scannedResi || `${defaultPrefix}${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    return createMockResiPhoto(simulatedBarcode, config.seller);
  };

  /**
   * Action when a barcode scanner successfully parses a tracking number
   */
  const handleBarcodeScanned = (scannedResi: string) => {
    if (isScanningLocked.current) return;

    const rawCode = scannedResi.trim().toUpperCase();
    if (!rawCode) return;

    // VALIDASI FORMAT BARCODE J&T
    const validPrefixesStr = localStorage.getItem("jt_resi_prefixes") || "JX, JZ";
    const validPrefixes = validPrefixesStr.split(",").map(p => p.trim()).filter(Boolean);
    const prefixRegexPart = validPrefixes.length > 0 ? `(${validPrefixes.join("|")})` : "(JX|JZ)";
    const regex = new RegExp(`^${prefixRegexPart}\\d{10,12}$`);
    const isValidFormat = regex.test(rawCode);

    if (!isValidFormat) {
      // Only surface a warning once the SAME unrecognized code has been read stably a
      // few times (avoids reacting to single-frame noise), and at most once every few
      // seconds (avoids spamming toasts while the camera keeps re-reading it).
      if (invalidFormatScanRef.current.code === rawCode) {
        invalidFormatScanRef.current.count += 1;
      } else {
        invalidFormatScanRef.current = { code: rawCode, count: 1 };
      }

      const now = Date.now();
      if (invalidFormatScanRef.current.count >= 5 && now - lastInvalidFormatToastRef.current > 4000) {
        lastInvalidFormatToastRef.current = now;
        toast.warning("FORMAT RESI TIDAK DIKENALI", {
          description: `Barcode terbaca (${rawCode}) tapi formatnya tidak sesuai pola resi J&T. Pastikan ini resi yang benar.`,
        });
      }
      return; // Ignore for saving purposes; scanner keeps looking for a valid resi
    }
    invalidFormatScanRef.current = { code: "", count: 0 };

    // MULTI-FRAME VERIFICATION
    // Mencegah false positive dengan mengharuskan scanner membaca barcode yang sama 3x berturut-turut
    if (consecutiveScansRef.current.barcode === rawCode) {
      consecutiveScansRef.current.count += 1;
    } else {
      consecutiveScansRef.current = { barcode: rawCode, count: 1 };
    }

    if (consecutiveScansRef.current.count < 3) {
      return; // Belum 3x berturut-turut, abaikan dan tunggu frame berikutnya
    }

    // DEBOUNCE: Mencegah callback ganda untuk barcode yang sama dalam 1.5 detik setelah sukses
    const now = Date.now();
    if (lastScannedBarcodeRef.current === rawCode && (now - lastScannedTimeRef.current) < 1500) {
      console.log(`[SCAN IGNORED] Debounced duplicate callback for ${rawCode}`);
      return;
    }

    console.log(`\n[SCAN START]`);
    console.log(`Barcode : ${rawCode}`);
    console.log(`Regex : PASS`);
    console.log(`Frames : ${consecutiveScansRef.current.count}`);

    lastScannedBarcodeRef.current = rawCode;
    lastScannedTimeRef.current = now;
    consecutiveScansRef.current = { barcode: "", count: 0 }; // Reset setelah lolos verifikasi

    // LOCK IMMEDIATELY to prevent high-frequency decode callbacks from piling up
    // during the synchronous canvas rendering / toDataURL compression of captureFrame
    isScanningLocked.current = true;

    // Wrap in async handler to prevent UI collision and decoupled execution
    (async () => {
      try {
        setDuplicateWarning(null);
        setCancelledWarning(null);

        const todayStr = getTodayLocalDateString();
        const records = dbService.getRecords();

        // Check if there is a pending retake first (can be from any day)
        const pendingRetake = records.find(r => r.Resi.toLowerCase() === rawCode.toLowerCase() && r.RetakeStatus === "PENDING");
        if (pendingRetake) {
          audioService.playRetake();
          triggerHaptic([100, 50, 100]); // Distinct double-pulse for retake
          toast.info(`Resi ${rawCode} terdeteksi memiliki instruksi FOTO ULANG (RETAKE) dari Owner!`, {
            duration: 5000,
          });
          handleOpenRetakeModal(pendingRetake.Resi);
          return;
        }

        // Check if it already exists in today's cache (duplicate or cancelled today)
        const existingToday = records.find(r => r.Resi.toLowerCase() === rawCode.toLowerCase() && r.Tanggal === todayStr);
        if (existingToday) {
          if (existingToday.Status === "CANCELLED") {
            console.log(`Duplicate : CANCELLED`);
            audioService.playCancelled();
            triggerHaptic([200, 100, 200, 100, 200]); // Long warning vibration sequence for cancel
            setCancelledWarning(rawCode);
            return;
          }

          // If it exists today and is not cancelled, it is a duplicate!
          console.log(`Duplicate : TRUE (Cache)`);
          audioService.playError();
          triggerHaptic([150, 100, 150]); // Short warning vibration sequence for duplicate alert
          setDuplicateWarning(rawCode);
          return;
        }

        // Double check with service
        if (dbService.isDuplicate(rawCode)) {
          console.log(`Duplicate : TRUE (DB)`);
          audioService.playError();
          triggerHaptic([150, 100, 150]); // Short warning vibration sequence for duplicate alert
          setDuplicateWarning(rawCode);
          return;
        }

        console.log(`Duplicate : NO`);

        // 2. Capture corresponding photo from webcam frame
        setIsCapturing(true);
        
        let photoData = "";
        const startCaptureTime = Date.now();
        for (let attempt = 1; attempt <= 2; attempt++) {
          photoData = captureFrame(rawCode);
          if (photoData) break; // Success
          console.log(`Capture Attempt ${attempt} Failed. Retrying...`);
          await new Promise(r => setTimeout(r, 50));
        }
        
        const captureTime = Date.now() - startCaptureTime;
        setIsCapturing(false);

        if (photoData) {
          console.log(`Capture : SUCCESS (${captureTime}ms)`);
        } else {
          console.log(`Capture : FAILED (${captureTime}ms)`);
          // If photo failed completely, unlock and abort
          audioService.playError();
          toast.error("Gagal mengambil foto. Coba lagi.");
          consecutiveScansRef.current = { barcode: "", count: 0 };
          isScanningLocked.current = false;
          return;
        }

        // 2b. Automatic blur check on the frame we just captured. This doesn't replace
        // the manual "Validasi Foto" step below - it just flags a likely-blurry photo
        // so the operator pays extra attention before confirming it as clear.
        const isBlurry = lastCaptureSharpnessRef.current < BLUR_WARNING_THRESHOLD;
        if (isBlurry) {
          console.log(`Sharpness : ${lastCaptureSharpnessRef.current.toFixed(1)} (BLUR WARNING, threshold ${BLUR_WARNING_THRESHOLD})`);
          audioService.playError();
          triggerHaptic([120, 60, 120]);
          toast.warning("FOTO KEMUNGKINAN BURAM", {
            description: "Sistem mendeteksi foto ini kurang tajam. Periksa dulu sebelum menyimpan.",
          });
        }

        // 3. Initiate visibility verification ("Validasi Foto")
        // Operator must confirm the picture looks clear before it is inserted
        setPendingValidation({
          resi: rawCode,
          photoURL: photoData,
          isBlurry
        });
      } catch (err) {
        console.error("Scan processing error:", err);
        isScanningLocked.current = false;
      }
    })();
  };

  // Accept verification and persist
  const handleConfirmValidation = async (isValid: boolean) => {
    if (!pendingValidation) return;

    if (!isValid) {
      // ❌ RESI TIDAK JELAS - Cancel scan & trigger full-screen warning modal/alert
      console.log(`Validation : REJECTED (Unclear)`);
      audioService.playError();
      triggerHaptic([200, 100, 200]); // Noticeable pulsed vibration for folded/blurry warning alert
      setUnclearResiAlert(pendingValidation.resi);
      setPendingValidation(null);
      // Keep isScanningLocked.current = true so scanning remains paused while warning is shown
      return;
    }

    const startSaveTime = Date.now();
    // Persist to database first, before playing success sounds!
    const result = await dbService.addRecord({
      resi: pendingValidation.resi,
      outlet: config.outlet,
      seller: config.seller,
      operator: config.operator,
      photoURL: pendingValidation.photoURL
    });

    const saveTime = Date.now() - startSaveTime;

    if (result.success && result.record) {
      console.log(`Save DB : SUCCESS (${saveTime}ms)`);
      console.log(`Sync Queue : SUCCESS`);
      console.log(`Scanner Unlock`);
      // Capture success sound "Teet" only if data is successfully saved
      audioService.playSuccess();
      toast.success(`Resi tersimpan: ${result.record.Resi}`);
      
      setLatestResi(result.record.Resi);
      setSessionScannedResis(prev => {
        if (result.record && !prev.includes(result.record.Resi)) {
          return [result.record.Resi, ...prev];
        }
        return prev;
      });
      loadRecords();
      if (onRecordAdded) {
        onRecordAdded();
      }
      setPendingValidation(null);
      isScanningLocked.current = false;
    } else {
      console.log(`Save DB : FAILED - ${result.error}`);
      // Show error, play error sound, unlock scanner so they can retry
      audioService.playError();
      toast.error("Gagal menyimpan data", { description: result.error || "Unknown error" });
      setPendingValidation(null);
      isScanningLocked.current = false;
    }
  };

  const handleOpenRetakeModal = (resi: string) => {
    setActiveRetakeResi(resi);
  };

  const handleCaptureRetake = () => {
    if (!activeRetakeResi) return;

    setIsCapturing(true);
    // Grab frame from webcam stream with timestamp overlay
    const photoData = captureFrame(activeRetakeResi);
    const isBlurry = lastCaptureSharpnessRef.current < BLUR_WARNING_THRESHOLD;
    
    // Save to DB
    const success = dbService.submitRetake(activeRetakeResi, photoData);
    setIsCapturing(false);

    if (success) {
      if (isBlurry) {
        audioService.playError();
        triggerHaptic([120, 60, 120]);
        toast.warning("FOTO ULANG KEMUNGKINAN MASIH BURAM", {
          description: `Foto ulang untuk resi ${activeRetakeResi} tersimpan, tapi sistem mendeteksi masih kurang tajam. Owner mungkin akan meminta foto ulang lagi.`
        });
      } else {
        audioService.playSuccess();
        toast.success("FOTO ULANG BERHASIL", {
          description: `Resi ${activeRetakeResi} telah diperbarui dengan foto yang jelas!`
        });
      }
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

  // Delete a specific scanned record
  const handleDeleteRecord = (resi: string) => {
    const success = dbService.deleteRecord(resi);
    if (success) {
      setSessionScannedResis(prev => prev.filter(r => r !== resi));
      loadRecords();
      setDeletingResi(null);
      if (onRecordAdded) {
        onRecordAdded(); // triggers update in parent counts/states
      }
      toast.success(`Data resi ${resi} berhasil dihapus dari local database.`);
    } else {
      toast.error(`Gagal menghapus data resi ${resi}.`);
    }
  };

  const handleConfirmAlert = async () => {
    if (pendingAlerts.length > 0) {
      const alert = pendingAlerts[currentAlertIndex];
      await dbService.confirmAlert(alert.Resi, config.operator);
      
      const newAlerts = [...pendingAlerts];
      newAlerts.splice(currentAlertIndex, 1);
      setPendingAlerts(newAlerts);
      
      if (currentAlertIndex >= newAlerts.length) {
        setCurrentAlertIndex(Math.max(0, newAlerts.length - 1));
      }
      
      if (!isOffline && triggerSync) {
        triggerSync();
      }
    }
  };

  const handleCloseAlert = () => {
    const newAlerts = [...pendingAlerts];
    newAlerts.splice(currentAlertIndex, 1);
    setPendingAlerts(newAlerts);
    
    if (currentAlertIndex >= newAlerts.length) {
      setCurrentAlertIndex(Math.max(0, newAlerts.length - 1));
    }
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
          className="bg-white border border-red-105 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden space-y-1.5"
        >
          <div className="absolute right-[-10px] bottom-[-20px] text-red-600/5 font-black text-7xl select-none font-mono z-0">
            SUM
          </div>
          
          <div className="flex items-start justify-between w-full z-10">
            <div>
              <span className="text-[10px] font-extrabold text-red-600 tracking-wider uppercase block">TOTAL SCAN</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black text-red-600 font-mono tracking-tight" id="total-scan-ticker">
                  {totalToday}
                </span>
                <span className="text-xs font-bold text-slate-400 font-mono">/ {dailyTarget}</span>
              </div>
            </div>
            <Target className="h-8 w-8 text-red-600/20 mt-1" />
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 z-10 overflow-hidden mt-1">
            <div 
              className="bg-red-500 h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${Math.min((totalToday / Math.max(dailyTarget, 1)) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center z-10 pt-0.5">
             <span className="text-[9px] text-slate-400 font-medium">Target Harian</span>
             <span className="text-[9px] font-bold text-slate-500 font-mono">{Math.round(Math.min((totalToday / Math.max(dailyTarget, 1)) * 100, 100))}%</span>
          </div>
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
                className="w-full min-h-[300px] max-h-[350px] sm:max-h-[450px] overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
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
                  <button 
                    onClick={startCamera}
                    className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition-colors"
                  >
                    COBA AKTIFKAN KAMERA
                  </button>
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
                  className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                  id="anti-duplicate-warning-modal"
                >
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-in zoom-in-95 duration-200">
                    <div className="bg-amber-500/10 text-amber-500 rounded-full h-14 w-14 flex items-center justify-center mx-auto border border-amber-500/20 shadow animate-bounce">
                      <AlertTriangle className="h-7 w-7 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-zinc-100 tracking-wider uppercase">RESI DUPLIKAT</h3>
                      <p className="text-amber-500 font-semibold font-mono text-xs bg-amber-500/10 px-3 py-1 rounded-full inline-block border border-amber-500/20">
                        {duplicateWarning}
                      </p>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Resi ini terdeteksi sudah pernah diproses pada pickup hari ini. Jumlah total scan tidak bertambah demi mencegah pencatatan ganda.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setDuplicateWarning(null);
                          isScanningLocked.current = false;
                        }}
                        className="w-full bg-red-650 hover:bg-red-600 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.25)] active:scale-95 cursor-pointer uppercase"
                      >
                        OK, Lanjutkan Scan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Unclear / Blurry/ Folded Warning alert dialog */}
              {unclearResiAlert && (
                <div 
                  className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                  id="unclear-resi-warning-modal"
                >
                  <div className="bg-slate-900 border border-red-500/20 rounded-3xl w-full max-w-md p-6 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-200">
                    <div className="bg-red-500/10 text-red-500 rounded-full h-14 w-14 flex items-center justify-center mx-auto border border-red-500/20 shadow animate-pulse">
                      <AlertTriangle className="h-7 w-7 text-red-500" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-zinc-100 tracking-wider uppercase">RESI BURAM / TERLIPAT</h3>
                      <p className="text-red-400 font-semibold font-mono text-xs bg-red-500/10 px-3 py-1 rounded-full inline-block border border-red-500/20">
                        {unclearResiAlert}
                      </p>
                    </div>
                    
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 text-left space-y-2.5">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> OPERATOR WAJIB MELAKUKAN INI:
                      </p>
                      <ul className="text-[11px] text-slate-400 space-y-1.5 pl-1 leading-relaxed">
                        <li className="flex items-start"><span className="text-red-500 mr-1.5">•</span> Luruskan atau rapikan fisik kertas resi paket yang terlipat/kusut agar terbaca sempurna.</li>
                        <li className="flex items-start"><span className="text-red-500 mr-1.5">•</span> Pastikan tulisan barcode dan nomor resi tegak lurus dan tidak terhalang lakban atau kerutan plastik.</li>
                        <li className="flex items-start"><span className="text-red-500 mr-1.5">•</span> Bersihkan lensa kamera smartphone Anda dari kotoran/debu bintik buram.</li>
                        <li className="flex items-start"><span className="text-red-500 mr-1.5">•</span> Pastikan pencahayaan cukup tinggi agar barcode kontras dan jelas terbaca.</li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setUnclearResiAlert(null);
                          isScanningLocked.current = false;
                        }}
                        className="w-full bg-green-650 hover:bg-green-600 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(22,163,74,0.3)] active:scale-95 cursor-pointer uppercase"
                      >
                        SAYA SUDAH MEMPERBAIKI KERTAS RESI
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Giant CANCELLED Warning Overlay */}
              {cancelledWarning && (
                <div 
                  className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                  id="cancelled-warning-modal"
                >
                  <div className="bg-slate-900 border-2 border-red-500 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-[0_0_60px_rgba(239,68,68,0.35)] animate-in zoom-in-95 duration-200">
                    <div className="bg-red-500/20 text-red-500 rounded-full h-16 w-16 flex items-center justify-center mx-auto border border-red-500/40 shadow animate-bounce">
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-red-500 tracking-wider uppercase">RESI BATAL / CANCELLED</h3>
                      <p className="text-red-400 font-bold font-mono text-xs bg-red-500/10 px-3 py-1 rounded-full inline-block border border-red-500/20">
                        {cancelledWarning}
                      </p>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Sistem mendeteksi resi ini telah berstatus <span className="text-red-400 font-extrabold uppercase">CANCELLED</span> (Batal). Jangan diproses atau ditempel ke karung pickup! Pisahkan paket ini sekarang juga!
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setCancelledWarning(null);
                          isScanningLocked.current = false;
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95 cursor-pointer uppercase"
                      >
                        SAYA MENGERTI, AMBIL PAKET BATAL INI
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clarity Verification modal ("Validasi Foto") */}
              {pendingValidation && (
                <div 
                  className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-between p-4 pb-8 z-50 safe-area-pt overflow-y-auto animate-in fade-in duration-200"
                  id="clarity-validation-overlay"
                >
                  <div className="w-full text-center py-4 border-b border-slate-900 sticky top-0 bg-slate-950/90 backdrop-blur-md z-10 shrink-0">
                    <span className="text-xs font-black text-red-500 uppercase tracking-widest block">VALIDASI KUALITAS FOTO</span>
                    <span className="text-sm text-slate-200 font-bold font-mono mt-1 block">RESI: {pendingValidation.resi}</span>
                  </div>

                  {/* Thumbnail display */}
                  <div className="my-4 w-full flex-1 relative flex items-center justify-center min-h-[50vh]">
                    <img
                      src={pendingValidation.photoURL}
                      alt="Captured parcel preview"
                      className="max-w-full max-h-full object-contain border border-slate-800 rounded-2xl bg-black shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-red-600/90 text-white px-3 py-1 rounded-full text-[9px] font-black border border-red-500/20 shadow-md uppercase tracking-wider">
                      Preview Foto
                    </div>
                  </div>

                  {pendingValidation.isBlurry && (
                    <div className="w-full max-w-2xl bg-amber-950/80 border border-amber-600/60 rounded-2xl p-3 flex items-center gap-2.5 shrink-0 mb-3 animate-in fade-in duration-200">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-200 leading-relaxed text-left">
                        <span className="font-extrabold uppercase">Sistem mendeteksi foto ini kemungkinan buram.</span> Periksa kembali dengan teliti sebelum memilih "Jelas & Simpan".
                      </p>
                    </div>
                  )}

                  <div className="w-full max-w-2xl bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 text-center text-xs text-slate-300 shrink-0 mt-auto">
                    <p className="font-extrabold text-white text-xs uppercase tracking-wider mb-1">Verifikasi Hasil Jepretan</p>
                    <p className="text-slate-400 leading-relaxed text-[11px]">Apakah barcode & nomor resi terlihat jelas, terang, dan tidak buram?</p>
                  </div>

                  {/* Dual options triggers */}
                  <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mt-4 shrink-0">
                    <button
                      onClick={() => handleConfirmValidation(false)}
                      className="bg-slate-900 hover:bg-slate-850 text-red-500 border border-slate-800/80 hover:border-red-500/30 py-4 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-1.5 shadow-lg active:scale-95"
                      id="validate-unclear-button"
                    >
                      <XCircle className="h-6 w-6 text-red-500" />
                      <span>BURAM / RETAKE</span>
                    </button>
                    <button
                      onClick={() => handleConfirmValidation(true)}
                      className="bg-green-650 hover:bg-green-600 border border-green-500 text-white py-4 px-3 rounded-2xl text-xs font-bold shadow-[0_0_20px_rgba(22,163,74,0.3)] transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-1.5 active:scale-95"
                      id="validate-clear-button"
                    >
                      <CheckCircle className="h-6 w-6 text-white" />
                      <span>JELAS & SIMPAN</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel Item Processing Modal overlay */}
              {activeCancelItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                  <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] bg-red-600 text-white font-black px-2 py-0.5 rounded uppercase tracking-wider block w-max mb-1">PROSES PEMBATALAN</span>
                        <h4 className="font-extrabold text-sm tracking-wide font-mono">{activeCancelItem.Resi}</h4>
                      </div>
                      <button 
                        onClick={() => setActiveCancelItem(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
                      {/* Meta Information Cards */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        <div>
                          <span className="text-slate-400 font-medium block text-[9px] uppercase">Seller</span>
                          <span className="font-bold text-slate-800">{activeCancelItem.Seller}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block text-[9px] uppercase">Outlet / Cabang</span>
                          <span className="font-bold text-slate-800">{activeCancelItem.Outlet}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block text-[9px] uppercase">Operator Scan</span>
                          <span className="font-bold text-slate-800">{activeCancelItem.Operator}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block text-[9px] uppercase">Waktu Scan</span>
                          <span className="font-mono text-slate-800 font-semibold">{activeCancelItem.Tanggal} {activeCancelItem.Jam}</span>
                        </div>
                      </div>

                      {/* Photo original if exists */}
                      {activeCancelItem.PhotoURL && (
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1.5">Foto Scan Awal</span>
                          <div className="relative h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img
                              src={getDirectDriveImageUrl(activeCancelItem.PhotoURL)}
                              alt="Scan awal"
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Camera Evidence Capture Stage */}
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase mb-1.5 flex items-center gap-1.5">
                          FOTO BUKTI PEMISAHAN PAKET <span className="text-red-500 font-black">*</span>
                        </span>

                        {cancelPhotoData ? (
                          <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                            <img 
                              src={cancelPhotoData} 
                              alt="Bukti pemisahan" 
                              className="w-full h-full object-cover" 
                            />
                            <button
                              onClick={() => setCancelPhotoData("")}
                              className="absolute bottom-3 right-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg flex items-center space-x-1 uppercase cursor-pointer"
                            >
                              <Camera className="h-3 w-3" />
                              <span>Foto Ulang</span>
                            </button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl p-6 bg-slate-50/50 text-center space-y-3 transition-colors">
                            <Camera className="h-8 w-8 text-slate-400 mx-auto animate-pulse" />
                            <div className="space-y-1">
                              <h6 className="font-extrabold text-slate-700 text-xs">Posisikan paket di depan kamera aktif di sebelah kiri</h6>
                              <p className="text-[10px] text-slate-500">Kamera harus dalam keadaan menyala agar dapat mengambil gambar secara langsung.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const captured = captureFrame(activeCancelItem.Resi);
                                if (captured) {
                                  setCancelPhotoData(captured);
                                } else {
                                  toast.error("Gagal mengambil foto. Pastikan kamera di sebelah kiri menyala!", {
                                    id: "cancel-photo-error"
                                  });
                                }
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shadow-md cursor-pointer inline-flex items-center space-x-1.5"
                            >
                              <Camera className="h-3.5 w-3.5" />
                              <span>AMBIL FOTO BUKTI</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Note / Remark Area */}
                      <div>
                        <label className="text-slate-500 font-bold block text-[10px] uppercase mb-1.5">
                          CATATAN OPERATOR (OPSIONAL)
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Paket sudah dipisahkan ke keranjang cancel"
                          value={cancelRemark}
                          onChange={(e) => setCancelRemark(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600 text-xs font-semibold text-slate-700 placeholder-slate-400"
                        />
                        {/* Quick tags */}
                        <div className="flex flex-wrap gap-1.5 mt-2 select-none">
                          {[
                            "Paket berhasil dipisahkan.",
                            "Menunggu pickup seller.",
                            "Barang sudah di rak khusus."
                          ].map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setCancelRemark(tag)}
                              className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200/50 transition cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveCancelItem(null)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={!cancelPhotoData}
                        onClick={async () => {
                          const res = await dbService.resolveCancelAlert(activeCancelItem.Resi, cancelPhotoData, config.operator, cancelRemark);
                          if (res) {
                            audioService.playSuccess();
                            toast.success(`Paket ${activeCancelItem.Resi} berhasil dipisahkan!`, {
                              id: "cancel-resolved-success"
                            });
                            // Force state update to refresh local lists
                            setScannedRecords(dbService.getRecords());
                            setActiveCancelItem(null);
                          } else {
                            toast.error("Gagal memperbarui status di database.", {
                              id: "cancel-resolved-error"
                            });
                          }
                        }}
                        className={`px-5 py-2.5 font-black rounded-xl text-xs uppercase tracking-wider flex items-center space-x-1.5 border-none cursor-pointer ${
                          cancelPhotoData
                            ? "bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/10"
                            : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        <span>PAKET SUDAH DIPISAHKAN</span>
                      </button>
                    </div>
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

        {/* Right Side: Scanned Receipt Records (Newest Top) */}
        <div className="lg:col-span-5 flex flex-col h-full font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col flex-grow shadow-sm">
            
            {/* Segmented Tab Controls */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-4 border border-slate-200/50 gap-1 select-none">
              <button
                type="button"
                onClick={() => setActivePanelTab("ACTIVE_SESSION")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1 ${
                  activePanelTab === "ACTIVE_SESSION"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/20"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Sesi</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activePanelTab === "ACTIVE_SESSION" ? "bg-red-50 text-red-650 font-bold" : "bg-slate-200 text-slate-600"
                }`}>
                  {sessionScannedResis.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActivePanelTab("LAPORAN_SCAN")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1 ${
                  activePanelTab === "LAPORAN_SCAN"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/20"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Laporan</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activePanelTab === "LAPORAN_SCAN" ? "bg-red-50 text-red-650 font-bold" : "bg-slate-200 text-slate-600"
                }`}>
                  {filteredRecordsLaporan.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActivePanelTab("CANCEL_QUEUE")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1 ${
                  activePanelTab === "CANCEL_QUEUE"
                    ? "bg-red-600 text-white shadow-sm font-bold"
                    : filteredRecordsCancelQueue.length > 0
                    ? "bg-red-100 text-red-700 animate-pulse font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Cancel</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activePanelTab === "CANCEL_QUEUE" ? "bg-red-700 text-white font-bold" : "bg-slate-200 text-slate-600"
                }`}>
                  {filteredRecordsCancelQueue.length}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  {isFilterActive 
                    ? `HASIL FILTER (${filteredRecords.length})` 
                    : activePanelTab === "ACTIVE_SESSION"
                    ? `DAFTAR RESI TERAKHIR (${sessionScannedResis.length})`
                    : activePanelTab === "CANCEL_QUEUE"
                    ? `DAFTAR PAKET CANCEL (${filteredRecordsCancelQueue.length})`
                    : `LAPORAN SCAN HARI INI (${filteredRecordsLaporan.length})`
                  }
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
                <p className="text-[10px] text-slate-500">
                  {isFilterActive 
                    ? "Menampilkan seluruh data yang cocok dengan kriteria filter" 
                    : activePanelTab === "ACTIVE_SESSION"
                    ? "Resi yang berhasil di scan pada sesi aktif ini"
                    : "Histori seluruh resi yang berhasil Anda scan hari ini"
                  }
                </p>
              </div>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterSearchQuery("");
                  }}
                  style={{ backgroundColor: "#585858" }}
                  className="hover:bg-slate-700 text-white px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                >
                  BATALKAN FILTER
                </button>
              )}
            </div>
 
             {/* Filter & Search Panel */}
             <div className="mb-4 bg-slate-50 border border-slate-150 rounded-2xl p-3.5 space-y-3">
               {/* Row 1: Search Input */}
               <div className="relative">
                 <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-450">
                   <Search className="h-3.5 w-3.5" />
                 </span>
                 <input
                   type="text"
                   placeholder="Cari No. Resi..."
                   value={filterSearchQuery}
                   onChange={(e) => setFilterSearchQuery(e.target.value)}
                   className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-450 focus:outline-none focus:border-red-550 focus:ring-1 focus:ring-red-550/20 font-mono transition-all"
                 />
                 {filterSearchQuery && (
                   <button
                     type="button"
                     onClick={() => setFilterSearchQuery("")}
                     className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                   >
                     <XCircle className="h-3.5 w-3.5" />
                   </button>
                 )}
               </div>
             </div>
 
             {/* Scanned Feed list box */}
             <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 flex-grow" id="recent-scans-feed">
               {activeRecordsList.length === 0 ? (
                 <div className="text-center py-16 text-slate-400 space-y-3">
                   <ListRestart className="h-10 w-10 mx-auto opacity-30 text-slate-400" />
                   <div>
                     {activePanelTab === "ACTIVE_SESSION" ? (
                       <>
                         <h5 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Sesi Scan Kosong</h5>
                         <p className="text-[11px] max-w-xs mx-auto text-slate-500 mt-1 leading-relaxed font-semibold">
                           Daftar resi terakhir kosong. Silakan mulai memindai barcode paket seller <strong className="text-red-650">{config.seller}</strong>!
                         </p>
                       </>
                     ) : activePanelTab === "CANCEL_QUEUE" ? (
                       <>
                         <h5 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Antrean Cancel Bersih</h5>
                         <p className="text-[11px] max-w-xs mx-auto text-slate-500 mt-1 leading-relaxed font-semibold text-emerald-600">
                           Tidak ada order cancel tertunda! Kerja bagus, semua paket aman.
                         </p>
                       </>
                     ) : (
                       <>
                         <h5 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Tidak Ada Laporan Hari Ini</h5>
                         <p className="text-[11px] max-w-xs mx-auto text-slate-500 mt-1 leading-relaxed font-semibold">
                           Belum ada data resi yang berhasil Anda kumpulkan untuk hari ini di outlet ini.
                         </p>
                       </>
                     )}
                   </div>
                 </div>
               ) : filteredRecords.length === 0 && isFilterActive ? (
                 <div className="text-center py-16 text-slate-400 space-y-3">
                   <Filter className="h-10 w-10 mx-auto opacity-30 text-slate-400 animate-pulse" />
                   <div>
                     <h5 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Hasil Filter Kosong</h5>
                     <p className="text-[11px] max-w-xs mx-auto text-slate-500 mt-1 leading-relaxed font-semibold">
                       Tidak ditemukan data resi yang cocok dengan kriteria pencarian Anda.
                     </p>
                   </div>
                 </div>
               ) : (
                displayedRecords.map((r, i) => (
                  <div
                    key={r.Resi + r.ScanTimestamp}
                    className={`p-3 bg-slate-50 border rounded-xl flex items-center justify-between transition-all hover:bg-slate-100/60 ${
                      i === 0 && !isFilterActive ? "border-red-200 shadow-sm" : "border-slate-100/70"
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
                          <span className="font-mono text-[9px] bg-slate-200/60 text-slate-600 px-1 rounded">{r.Tanggal}</span>
                          <span className="font-mono">{r.Jam}</span>
                          <span>•</span>
                          <span className="truncate max-w-[80px]">{r.Seller}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge, Sync status, and Delete Action */}
                    <div className="flex items-center space-x-3">
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

                      {/* Action Button: Delete or Cancel Handling */}
                      <div className="flex items-center">
                        {activePanelTab === "CANCEL_QUEUE" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCancelItem(r);
                              setCancelPhotoData("");
                              setCancelRemark("");
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg flex items-center space-x-1 uppercase cursor-pointer transition-colors"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Proses</span>
                          </button>
                        ) : deletingResi === r.Resi ? (
                          <div className="flex items-center bg-red-50 border border-red-200 rounded-lg p-1 space-x-1 animate-fadeIn">
                            <button
                              onClick={() => handleDeleteRecord(r.Resi)}
                              className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold px-2 py-1 rounded cursor-pointer transition"
                            >
                              HAPUS
                            </button>
                            <button
                              onClick={() => setDeletingResi(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold px-2 py-1 rounded cursor-pointer transition"
                            >
                              BATAL
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingResi(r.Resi)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors duration-150 cursor-pointer"
                            title="Hapus Data Resi"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Custom Pagination Panel */}
            {totalOperatorRecords > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-150 text-slate-600">
                {/* Total count */}
                <div className="text-xs font-semibold text-slate-550">
                  Total <span className="text-slate-850 font-extrabold font-mono">{totalOperatorRecords}</span> data
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Page Buttons block */}
                  <div className="flex items-center space-x-1">
                    {/* Previous Button */}
                    <button
                      type="button"
                      disabled={operatorPage === 1}
                      onClick={() => setOperatorPage(prev => Math.max(1, prev - 1))}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-all flex items-center justify-center font-bold h-7 ${
                        operatorPage === 1
                          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                      }`}
                    >
                      &lt;
                    </button>

                    {/* Number Buttons */}
                    {(() => {
                      const pages: (number | string)[] = [];
                      if (totalOperatorPages <= 7) {
                        for (let i = 1; i <= totalOperatorPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (operatorPage > 3) {
                          pages.push("...");
                        }
                        const start = Math.max(2, operatorPage - 1);
                        const end = Math.min(totalOperatorPages - 1, operatorPage + 1);
                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }
                        if (operatorPage < totalOperatorPages - 2) {
                          pages.push("...");
                        }
                        pages.push(totalOperatorPages);
                      }

                      return pages.map((p, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          disabled={p === "..."}
                          onClick={() => typeof p === "number" && setOperatorPage(p)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all min-w-[28px] h-7 flex items-center justify-center ${
                            p === operatorPage
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
                      disabled={operatorPage === totalOperatorPages}
                      onClick={() => setOperatorPage(prev => Math.min(totalOperatorPages, prev + 1))}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-all flex items-center justify-center font-bold h-7 ${
                        operatorPage === totalOperatorPages
                          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                      }`}
                    >
                      &gt;
                    </button>
                  </div>

                  {/* Items Per Page Selector */}
                  <select
                    value={operatorPageSize}
                    onChange={(e) => {
                      setOperatorPageSize(Number(e.target.value));
                      setOperatorPage(1);
                      setOperatorJumpInput("");
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-650 font-semibold focus:outline-none cursor-pointer h-7"
                  >
                    <option value={20}>20 / halaman</option>
                    <option value={50}>50 / halaman</option>
                    <option value={100}>100 / halaman</option>
                  </select>

                  {/* Jump to Page */}
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-slate-500 font-semibold">Lompat ke</span>
                    <input
                      type="text"
                      value={operatorJumpInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          setOperatorJumpInput(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const targetPage = parseInt(operatorJumpInput, 10);
                          if (targetPage >= 1 && targetPage <= totalOperatorPages) {
                            setOperatorPage(targetPage);
                          } else if (targetPage > totalOperatorPages) {
                            setOperatorPage(totalOperatorPages);
                            setOperatorJumpInput(String(totalOperatorPages));
                          } else if (targetPage < 1) {
                            setOperatorPage(1);
                            setOperatorJumpInput("1");
                          }
                        }
                      }}
                      className="w-12 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-center text-slate-700 focus:outline-none font-mono h-7"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Selesai Sesi Scan Button */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSummaryModal(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-sm transition-all active:scale-95 text-sm tracking-wide flex items-center justify-center space-x-2 border border-emerald-500 cursor-pointer"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Selesai Sesi Scan ({totalToday} Resi)</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Selesai Sesi Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowSummaryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="bg-emerald-100 text-emerald-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto shadow-sm">
              <Check className="h-8 w-8 text-emerald-500 stroke-[3]" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                Sesi Selesai!
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Ringkasan laporan pemindaian seller Anda hari ini
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-semibold text-slate-500">Nama Operator:</span>
                <span className="text-xs font-black text-slate-800">{config.operator}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-semibold text-slate-500">Outlet J&T:</span>
                <span className="text-xs font-black text-slate-800">{config.outlet}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-semibold text-slate-500">Seller Pengirim:</span>
                <span className="text-xs font-black text-slate-800">{config.seller}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-500">Total Scanned Batch:</span>
                <span className="text-sm font-black text-red-600 font-mono">{totalToday} Resi</span>
              </div>
            </div>

            {totalToday === 0 && (
              <p className="text-xs text-slate-400 font-medium">
                Tidak ada resi yang diproses pada batch ini.
              </p>
            )}

            <div className="space-y-4 pt-2">
              <div className="space-y-1 text-left">
                <button
                  onClick={() => {
                    setShowSummaryModal(false);
                    onBack(); // Go back to setup screen, which remembers operator
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>Scan Seller Lain</span>
                  <RefreshCw className="h-4 w-4" />
                </button>
                <p className="text-[10px] text-slate-500 font-medium text-center">
                  Tetap masuk sebagai operator <strong className="text-slate-700">{config.operator}</strong>, hanya mengganti Seller atau Outlet scan.
                </p>
              </div>
              
              <div className="space-y-1 text-left">
                <button
                  onClick={() => {
                    localStorage.removeItem("jt_saved_operator");
                    localStorage.setItem("jt_current_view", "WELCOME");
                    window.location.reload();
                  }}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
                >
                  <LogOut className="h-4 w-4 text-slate-500" />
                  <span>Logout Sesi Operator</span>
                </button>
                <p className="text-[10px] text-slate-500 font-medium text-center">
                  Keluar sepenuhnya dari sesi ini dan kembali ke halaman setup login Operator utama.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER CANCELLED ALERT Modal */}
      {pendingAlerts.length > 0 && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-red-500 rounded-3xl w-full max-w-md p-6 text-left space-y-6 shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600" />
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-4">
              <AlertTriangle className="h-7 w-7 animate-pulse" />
              <h2 className="font-black text-lg tracking-wider">ORDER CANCELLED</h2>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 space-y-2">
              <div className="flex justify-between items-center border-b border-red-100/50 pb-2">
                <span className="text-xs font-semibold text-slate-500">Resi</span>
                <span className="text-sm font-black text-slate-800 font-mono">{pendingAlerts[currentAlertIndex]?.Resi}</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-100/50 py-2">
                <span className="text-xs font-semibold text-slate-500">Seller</span>
                <span className="text-sm font-bold text-slate-700">{pendingAlerts[currentAlertIndex]?.Seller}</span>
              </div>
              <div className="flex justify-between items-center border-b border-red-100/50 py-2">
                <span className="text-xs font-semibold text-slate-500">Waktu Scan</span>
                <span className="text-xs font-bold text-slate-700 font-mono">{pendingAlerts[currentAlertIndex]?.Jam}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-semibold text-slate-500">Status Alert</span>
                <span className="inline-flex items-center text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200">
                  Belum Dikonfirmasi
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium text-center">
              Peringatan {currentAlertIndex + 1} dari {pendingAlerts.length}. Harap pisahkan paket ini.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={handleCloseAlert}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              >
                Tutup
              </button>
              <button 
                onClick={handleConfirmAlert}
                className="bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Konfirmasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
