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
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";

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
  const imageCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
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

  // Background interval and Canvas Reference for high-contrast auto-binarized decoding
  const scanIntervalRef = useRef<any>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showDebugFeed, setShowDebugFeed] = useState(false);

  // Camera Stability HUD indicators (Stabilitas HP)
  const [stabilityScore, setStabilityScore] = useState<number>(98);
  const [stabilityStatus, setStabilityStatus] = useState<"STABIL" | "SEDANG" | "GOYANG">("STABIL");

  // Track physical or simulated motion to gauge camera stability
  useEffect(() => {
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;

    // Simulates continuous micro-sway from human grasp and guides drift back to stability
    const interval = setInterval(() => {
      setStabilityScore(oldScore => {
        const naturalFluctuation = (Math.random() - 0.5) * 3.5;
        let nextScore = oldScore + naturalFluctuation;
        
        // Help score recover quickly to 95%+ once shaking has stopped
        if (oldScore < 90) {
          nextScore = oldScore + 6.5;
        }

        return Math.max(15, Math.min(100, Math.round(nextScore)));
      });
    }, 380);

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acc = event.acceleration || event.accelerationIncludingGravity;
      if (!acc) return;

      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;

      if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);
        const combinedForce = deltaX + deltaY + deltaZ;

        // If delta motion spikes, decrease stability score dramatically
        if (combinedForce > 1.2) {
          setStabilityScore(oldScore => {
            const shockPenalty = Math.min(48, Math.floor(combinedForce * 11));
            return Math.max(10, oldScore - shockPenalty);
          });
        }
      }

      lastX = x;
      lastY = y;
      lastZ = z;
    };

    window.addEventListener("devicemotion", handleDeviceMotion);
    return () => {
      clearInterval(interval);
      window.removeEventListener("devicemotion", handleDeviceMotion);
    };
  }, []);

  // Update categorical status from actual score
  useEffect(() => {
    if (stabilityScore >= 80) {
      setStabilityStatus("STABIL");
    } else if (stabilityScore >= 45) {
      setStabilityStatus("SEDANG");
    } else {
      setStabilityStatus("GOYANG");
    }
  }, [stabilityScore]);

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
    
    // Filter records exclusively for the currently logged-in operator
    const operatorRecords = all.filter(r => r.Operator === config.operator);
    
    // Filter down to today's records specifically for this operator
    const todayStr = new Date().toISOString().split("T")[0];
    const filteredToday = operatorRecords.filter(r => r.Tanggal === todayStr);
    
    setScannedRecords(operatorRecords.slice(0, 20)); // Limit display to 20 for this operator
    setTotalToday(filteredToday.length);

    // Get pending retake tasks specifically for this operator
    const pendingTasks = all.filter(r => r.RetakeStatus === "PENDING" && r.Operator === config.operator);
    setRetakeTasks(pendingTasks);
  };

  // Start advanced background scanner utilizing horizontal crop-bounding and dynamic contrast binarization
  const startAdvancedScanLoop = (reader: BrowserMultiFormatReader) => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    // Single offscreen canvas to avoid garbage collection spikes and keep processing instant
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = 600;
    scanCanvas.height = 300;
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });

    // Single offscreen image to pass standard type-safe HTMLImageElement to ZXing
    const scanImg = new Image();
    let isDecoding = false;

    // Listen for image load which triggers binarized frame decoding
    scanImg.onload = async () => {
      try {
        const result = await reader.decodeFromImageElement(scanImg);
        if (result && !isScanningLocked.current) {
          const resiText = result.getText().trim();
          if (resiText) {
            if (handleBarcodeScannedRef.current) {
              handleBarcodeScannedRef.current(resiText);
            }
          }
        }
      } catch (decodeErr) {
        // No barcode matched in this frame - perfectly typical and silent
      } finally {
        isDecoding = false;
      }
    };

    scanImg.onerror = () => {
      isDecoding = false;
    };

    let isProcessing = false;

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || isScanningLocked.current || isProcessing || isDecoding) return;
      if (videoRef.current.readyState < 2) return; // HAVE_CURRENT_DATA or higher is required

      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      if (videoWidth <= 0 || videoHeight <= 0) return;

      isProcessing = true;

      try {
        // Target specifically the J&T barcode area guided inside the red brackets
        const cropX = Math.round(videoWidth * 0.15); // slightly wider for long J&T barcodes
        const cropY = Math.round(videoHeight * 0.25);
        const cropWidth = Math.round(videoWidth * 0.70);
        const cropHeight = Math.round(videoHeight * 0.50);

        if (scanCtx) {
          // Draw the horizontal crop region
          scanCtx.drawImage(
            videoRef.current,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, 600, 300
          );

          // Get image pixel data to boost contrast
          const imgData = scanCtx.getImageData(0, 0, 600, 300);
          const data = imgData.data;

          let minVal = 255;
          let maxVal = 0;

          // Quick subsampling of pixel blocks to determine low/high dynamic range bounds
          for (let i = 0; i < data.length; i += 48) {
            const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (gray < minVal) minVal = gray;
            if (gray > maxVal) maxVal = gray;
          }

          const dynamicRange = maxVal - minVal;
          if (dynamicRange > 18) {
            // Apply binarization. Standard 45% midpoint is mathematically selected to avoid merging close barcode lines 
            // under poor environment conditions
            const thresholdValue = minVal + (dynamicRange * 0.45);

            for (let i = 0; i < data.length; i += 4) {
              const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
              const binarizedVal = gray < thresholdValue ? 0 : 255;
              data[i] = binarizedVal;
              data[i + 1] = binarizedVal;
              data[i + 2] = binarizedVal;
            }
            scanCtx.putImageData(imgData, 0, 0);
          }

          // Render live feedback frame to visible debugger monitor if active
          if (debugCanvasRef.current) {
            const dCanvas = debugCanvasRef.current;
            if (dCanvas.width !== 600) dCanvas.width = 600;
            if (dCanvas.height !== 300) dCanvas.height = 300;
            const dCtx = dCanvas.getContext("2d");
            if (dCtx) {
              dCtx.drawImage(scanCanvas, 0, 0);
            }
          }

          // Trigger image load & decoding chain
          isDecoding = true;
          scanImg.src = scanCanvas.toDataURL("image/jpeg", 0.85);
        }
      } catch (loopErr) {
        console.warn("Advanced scan loop iteration warning:", loopErr);
        isDecoding = false;
      } finally {
        isProcessing = false;
      }
    }, 150); // 150ms ensures extreme reactivity of ~7 frames processed per second
  };

  // Apply a unified constraints block to prevent hardware features from overriding each other
  const applyCameraConstraints = async (overrides: { torch?: boolean; zoom?: number; focusMode?: string } = {}) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
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

  // Camera stream activation with high-definition settings and performance tuning
  const startCamera = async () => {
    setCameraPermissionError("");
    setTorchSupported(false);
    setTorchActive(false);
    setZoomSupported(false);
    setFocusSupported(false);
    
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Request deep-focus high-definition (720p/1080p ideal) stream layout so barcode lines are thin and crisp
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment", 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            aspectRatio: { ideal: 1.7777777778 },
            frameRate: { ideal: 30, min: 20 }
          },
          audio: false
        });
        
        streamRef.current = stream;
        
        // Check for device camera capabilities (Flash/Torch, Digital Zoom, and Autofocus mode)
        const track = stream.getVideoTracks()[0];
        let initialFocus = "auto";
        if (track) {
          try {
            const capabilities = track.getCapabilities() as any;
            if (capabilities) {
              if (capabilities.torch) {
                setTorchSupported(true);
              }
              if (capabilities.zoom) {
                setZoomSupported(true);
                setZoomRange({
                  min: capabilities.zoom.min || 1,
                  max: Math.min(capabilities.zoom.max || 5, 4) // restrict to 4x to prevent low-res crop grain
                });
                setZoomValue((track.getSettings() as any).zoom || 1);
              }

              // Detect focus capabilities
              if (capabilities.focusMode) {
                setFocusSupported(true);
                const modes = capabilities.focusMode as string[];
                if (modes.includes("continuous")) {
                  initialFocus = "continuous";
                  setFocusModeValue("continuous");
                } else if (modes.includes("auto")) {
                  initialFocus = "auto";
                  setFocusModeValue("auto");
                }
              }
            }
          } catch (e) {
            console.warn("Could not query device track capabilities:", e);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          // Initialize local ZXing Browser Reader equipped with TRY_HARDER and optimized formats targeting shipping barcodes
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          const formats = [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.ITF,
            BarcodeFormat.EAN_13
          ];
          hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
          
          // Instantiate separate reader for elements and images to prevent state collisions/locks on WebView
          const mainReader = new BrowserMultiFormatReader(hints);
          codeReaderRef.current = mainReader;
          
          const imageReader = new BrowserMultiFormatReader(hints);
          imageCodeReaderRef.current = imageReader;
          
          // Apply initial parameters safely using our unified function
          setTimeout(async () => {
            await applyCameraConstraints({ focusMode: initialFocus, zoom: 1, torch: false });
          }, 300);

          // Trigger the high contrast horizontal crop process alongside using the isolated imageReader
          startAdvancedScanLoop(imageReader);
          
          mainReader.decodeFromStream(stream, videoRef.current, (result, err) => {
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
      setCameraPermissionError("Akses kamera ditolak atau tidak tersedia.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (imageCodeReaderRef.current) {
      imageCodeReaderRef.current.reset();
      imageCodeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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

  // Toggle mobile/device camera flashlight (torch)
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const nextState = !torchActive;
    setTorchActive(nextState);
    await applyCameraConstraints({ torch: nextState });
  };

  // Trigger manual lens/refocus cycle when tap-to-focus triggers
  const triggerManualFocus = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.focusMode) {
          const modes = capabilities.focusMode as string[];
          if (modes.includes("single-shot")) {
            setFocusModeValue("single-shot");
            await applyCameraConstraints({ focusMode: "single-shot" });
            
            // Revert back block to keep continuous autofocus active
            setTimeout(async () => {
              if (streamRef.current) {
                if (modes.includes("continuous")) {
                  setFocusModeValue("continuous");
                  await applyCameraConstraints({ focusMode: "continuous" });
                } else if (modes.includes("auto")) {
                  setFocusModeValue("auto");
                  await applyCameraConstraints({ focusMode: "auto" });
                }
              }
            }, 1100);
          } else if (modes.includes("continuous")) {
            setFocusModeValue("continuous");
            await applyCameraConstraints({ focusMode: "continuous" });
          } else if (modes.includes("auto")) {
            setFocusModeValue("auto");
            await applyCameraConstraints({ focusMode: "auto" });
          }
        }
      } catch (err) {
        console.warn("Failed to set manual focus constraint adjustment:", err);
      }
    }
  };

  // Process tap position on video feed container and trigger focusing logic
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraActive) return;

    // Reject click if clicking on the bottom-right binarization sensor overlay
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

  // Handle active digital zoom adjustment via slider
  const handleZoomChange = async (val: number) => {
    setZoomValue(val);
    await applyCameraConstraints({ zoom: val });
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
      alert(`✅ FOTO ULANG BERHASIL\n\nResi ${activeRetakeResi} telah diperbarui dengan foto yang jelas!`);
      setActiveRetakeResi(null);
      loadRecords();
      if (onRecordAdded) {
        onRecordAdded(); // triggers update in parent counts
      }
    } else {
      alert("Gagal memperbarui foto ulang.");
    }
  };

  const handleCancelRetake = () => {
    setActiveRetakeResi(null);
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
              className="relative bg-black h-[350px] sm:h-[450px] w-full flex flex-col items-center justify-center overflow-hidden border-b border-slate-850 cursor-crosshair select-none"
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

              {/* Real-time Stability Indicator Gauge Overlay */}
              {cameraActive && (
                <div className="absolute top-4 left-4 z-20 bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-slate-800/80 w-[180px] pointer-events-none select-none flex flex-col space-y-1.5 shadow-xl animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center justify-between text-[10px] font-extrabold tracking-wider text-slate-400">
                    <span>STABILITAS HP</span>
                    <span className={`font-mono text-xs ${
                      stabilityStatus === "STABIL" ? "text-emerald-400 font-black" :
                      stabilityStatus === "SEDANG" ? "text-amber-400 font-bold" :
                      "text-red-500 font-black animate-pulse"
                    }`}>
                      {stabilityScore}%
                    </span>
                  </div>
                  
                  {/* Progress bar visual */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-[1px] border border-slate-800/60">
                    <div 
                      className={`h-full rounded-full transition-all duration-305 ${
                        stabilityStatus === "STABIL" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                        stabilityStatus === "SEDANG" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                        "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                      }`}
                      style={{ width: `${stabilityScore}%` }}
                    />
                  </div>

                  {/* Verbal indicator & helpful icon */}
                  <div className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-wide">
                    {stabilityStatus === "STABIL" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-emerald-400">✓ HP Stabil (Siap Foto)</span>
                      </>
                    ) : stabilityStatus === "SEDANG" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span className="text-amber-400">⚠️ Agak Goyang</span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                        <span className="text-red-500 animate-pulse">❌ Goyang! Pegang Diam</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Shaking Alert Banner */}
              {cameraActive && stabilityStatus === "GOYANG" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-25 bg-red-650/95 border border-red-500 text-white font-extrabold px-4 py-2.5 rounded-2xl text-center text-[10px] uppercase tracking-wider shadow-[0_10px_25px_-5px_rgba(239,68,68,0.4)] backdrop-blur-sm animate-bounce flex items-center space-x-2 pointer-events-none">
                  <AlertTriangle className="h-4 w-4 text-white animate-pulse" />
                  <span>JANGAN GOYANG! HP Tidak Stabil</span>
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

              {/* Real camera video tag */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover select-none ${cameraActive ? "block" : "hidden"}`}
              />

              {/* High Contrast Scanner real-time binary monitor */}
              {cameraActive && (
                <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end space-y-1.5 pointer-events-auto">
                  {showDebugFeed && (
                    <div className="bg-slate-950/95 border border-emerald-500 p-2.5 rounded-2xl text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[8px] text-emerald-400 font-extrabold block mb-1 tracking-wider uppercase">
                        🔍 SENSOR KONTRAS TINGGI J-T
                      </span>
                      <canvas 
                        ref={debugCanvasRef} 
                        className="w-32 h-16 rounded border border-slate-800 bg-black" 
                      />
                      <span className="text-[7px] text-slate-400 block mt-1 leading-normal font-mono">
                        Hasil binarisasi sensor barcode
                      </span>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDebugFeed(!showDebugFeed);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md border cursor-pointer select-none transition-all ${
                      showDebugFeed 
                        ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-emerald-600" 
                        : "bg-slate-950/90 hover:bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>{showDebugFeed ? "TUTUP SENSOR" : "BUKA SENSOR KONTRAS"}</span>
                  </button>
                </div>
              )}

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

                {/* Simulated Shake testing triggers */}
                <button
                  type="button"
                  onClick={() => setStabilityScore(15)}
                  className="px-3.5 py-2 rounded-xl text-[10px] font-extrabold uppercase bg-slate-950 hover:bg-slate-900 border border-red-500/35 text-red-500 hover:border-red-500/70 transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 shrink-0"
                  title="Simulasikan guncangan perangkat untuk menguji indikator stabilitas"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                  <span>Simulasikan HP Goyang</span>
                </button>

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

            {/* Helpful Scan Troubleshooting Tips */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-950 text-slate-305 text-[10px] flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="leading-relaxed space-y-0.5">
                <span className="font-extrabold text-slate-205 tracking-wide block text-[10px]">TIPS MEMPERCEPAT SCAN DETEKSI:</span>
                <p>1. Dekatkan kamera ke barcode (~10-15 cm) lalu jauhkan perlahan sampai fokus otomatis mengunci.</p>
                <p>2. Jika ruangan redup, klik tombol <span className="text-amber-400 font-semibold uppercase">"Nyalakan Lampu Flash"</span> di atas.</p>
                <p>3. Posisikan barcode searah garis horizontal merah agar kamera lebih mudah mendeteksi garis.</p>
                <p>4. Jika fokus lepas atau buram, <span className="text-yellow-405 font-bold uppercase">ketuk/tap layar kamera</span> di atas untuk memicu pemfokusan ulang instan.</p>
              </div>
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
