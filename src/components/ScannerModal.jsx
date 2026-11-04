import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Zap, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';

// All standard industrial & asset barcode formats
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export default function ScannerModal({ isOpen, onClose, onScan, soundEnabled = true }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanning, setScanning] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  // Initialize and discover cameras when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCameraError('');
    setLastScannedResult(null);

    // List available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera by label
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('0, facing back')
          );
          if (backCam) {
            setSelectedCamera(backCam.id);
          }
        }
      })
      .catch((err) => {
        console.warn('Erro ao listar câmeras:', err);
      });

    // Start scanner using environment camera by default
    startScanner(selectedCamera || null);

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId) => {
    await stopScanner();

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader-box', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native Android / iOS Hardware Barcode Detector
        }
      });
      html5QrCodeRef.current = html5QrCode;

      // Responsive scanning box optimized for 1D equipment barcodes and QR codes
      const config = {
        fps: 25, // Fast scanning rate
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.floor(viewfinderWidth * 0.88);
          const height = Math.floor(Math.min(viewfinderHeight * 0.55, 230));
          return {
            width: Math.max(width, 220),
            height: Math.max(height, 130)
          };
        },
      };

      // Use specific cameraId if selected, else default to native back camera
      const cameraConfig = cameraId 
        ? cameraId 
        : { facingMode: "environment" };

      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {
          // Normal frame misses, silent
        }
      );

      setScanning(true);
      setCameraError('');

      // Check for torch / zoom capabilities
      try {
        const track = html5QrCode.getRunningTrackCameraCapabilities();
        if (track) {
          if (track.torchFeature().isSupported()) {
            setHasTorch(true);
          }
          if (track.zoomFeature().isSupported()) {
            setHasZoom(true);
          }
        }
      } catch (e) {
        // Fallback check
        try {
          const cap = html5QrCode.getRunningTrackCapabilities();
          if (cap && 'torch' in cap) setHasTorch(true);
          if (cap && 'zoom' in cap) setHasZoom(true);
        } catch (err) {}
      }

    } catch (err) {
      console.error('Falha ao iniciar scanner:', err);
      setScanning(false);
      setCameraError(
        'Não foi possível abrir a câmera traseira diretamente. Permita o acesso à câmera nas configurações do navegador ou use o botão "Enviar Foto do Código" abaixo.'
      );
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const newStatus = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: newStatus }]
      });
      setTorchOn(newStatus);
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  };

  const toggleZoom = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const nextZoom = zoomLevel === 1 ? 2 : 1;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ zoom: nextZoom }]
      });
      setZoomLevel(nextZoom);
    } catch (e) {
      console.warn('Zoom não suportado:', e);
    }
  };

  // Switch camera when user picks another from dropdown
  const handleCameraChange = (camId) => {
    setSelectedCamera(camId);
    startScanner(camId);
  };

  // Handle barcode scanned
  const handleDecoded = (decodedText) => {
    const cleanCode = String(decodedText || '').trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Throttle exact same code within 1.6s
    if (cleanCode === lastCodeRef.current && (now - lastTimeRef.current) < 1600) {
      return;
    }

    lastCodeRef.current = cleanCode;
    lastTimeRef.current = now;

    // Haptic vibration on mobile
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    const result = onScan(cleanCode);

    setLastScannedResult({
      code: cleanCode,
      status: result?.status || 'found',
      equipment: result?.equipment || null,
      message: result?.message || `Código lido: ${cleanCode}`,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    });

    if (soundEnabled) {
      if (result?.status === 'not_found') {
        playErrorSound();
      } else if (result?.status === 'already_checked') {
        playWarningSound();
      } else {
        playSuccessSound();
      }
    }

    if (!continuousMode) {
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  // Handle Photo Scan from file or camera capture
  const handlePhotoScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const scanner = html5QrCodeRef.current || new Html5Qrcode('barcode-reader-box', {
        formatsToSupport: SUPPORTED_FORMATS
      });
      const decoded = await scanner.scanFile(file, true);
      if (decoded) {
        handleDecoded(decoded);
      }
    } catch (err) {
      console.warn('Foto não reconhecida:', err);
      setLastScannedResult({
        code: 'N/A',
        status: 'not_found',
        equipment: null,
        message: 'Nenhum código nítido detectado na imagem. Tente aproximar mais.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      if (soundEnabled) playErrorSound();
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Hidden photo file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handlePhotoScan}
        className="hidden"
      />

      <div className="bg-slate-900 border border-slate-800 sm:rounded-3xl shadow-2xl max-w-lg w-full h-full sm:h-auto overflow-hidden flex flex-col sm:max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Leitor de Código de Barras</h3>
              <p className="text-xs text-slate-400">Code 128, Code 39, EAN, QR Code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          
          {/* Internal Scanner Box container */}
          <div 
            id="barcode-reader-box" 
            className="w-full h-full min-h-[300px] flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          ></div>

          {/* Custom Targeting Laser Line & Reticle Overlay */}
          {scanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="relative w-full max-w-[310px] h-[180px] border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_25px_rgba(59,130,246,0.35)]">
                {/* Red Laser Scanning Beam */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-400 to-red-600 shadow-[0_0_12px_#ef4444] animate-[bounce_2.2s_infinite]"></div>
                
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/90 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                  Enquadre o código de barras aqui
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Floating Controls (Flash & Zoom) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {hasZoom && (
              <button
                onClick={toggleZoom}
                className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg transition"
                title="Alternar Zoom 1x / 2x"
              >
                <span className="text-xs font-bold">{zoomLevel}x</span>
              </button>
            )}

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-full transition shadow-lg ${
                  torchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800/80 text-white hover:bg-slate-700'
                }`}
                title="Ligar/Desligar Lanterna"
              >
                <Zap className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Error Message if Camera fails */}
          {cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 space-y-3">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-1" />
              <p className="text-white font-semibold text-sm">Câmera não iniciada</p>
              <p className="text-slate-400 text-xs max-w-sm">{cameraError}</p>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  onClick={() => startScanner(selectedCamera)}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> Tentar Novamente
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-4 h-4" /> Tirar Foto do Código
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scan Feedback Banner */}
        {lastScannedResult && (
          <div className={`p-3.5 border-t transition-all shrink-0 ${
            lastScannedResult.status === 'not_found'
              ? 'bg-red-500/15 border-red-500/30 text-red-200'
              : lastScannedResult.status === 'already_checked'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {lastScannedResult.status === 'not_found' ? (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span>{lastScannedResult.equipment ? lastScannedResult.equipment.equipamento : 'Código Lido'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-mono">
                      {lastScannedResult.code}
                    </span>
                  </div>
                  <p className="text-xs opacity-90">{lastScannedResult.message}</p>
                </div>
              </div>
              <span className="text-[10px] opacity-75 font-mono">{lastScannedResult.timestamp}</span>
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col gap-3 shrink-0 safe-area-bottom">
          
          <div className="flex items-center justify-between text-xs text-slate-300">
            {/* Continuous scan toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span>Modo contínuo (bipar vários)</span>
            </label>

            {/* Photo fallback trigger */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-semibold"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Tirar Foto
            </button>
          </div>

          {/* Camera Switcher (if device has multiple back/front cameras) */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">Lente:</span>
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Câmera Principal Traseira (Automática)</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Câmera ${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            Fechar Leitor
          </button>
        </div>

      </div>
    </div>
  );
}
