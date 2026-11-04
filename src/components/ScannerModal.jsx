import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, Zap, Volume2, VolumeX, CheckCircle, AlertTriangle } from 'lucide-react';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';

export default function ScannerModal({ isOpen, onClose, onScan, soundEnabled = true }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanning, setScanning] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Initialize and discover cameras when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCameraError('');
    setLastScannedResult(null);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCamera(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError('Nenhuma câmera encontrada no dispositivo.');
        }
      })
      .catch((err) => {
        console.error('Erro ao listar câmeras:', err);
        setCameraError('Permissão de câmera negada ou não disponível. Verifique as permissões do seu navegador.');
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  // Start scanner when camera is selected
  useEffect(() => {
    if (isOpen && selectedCamera) {
      startScanner(selectedCamera);
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCamera]);

  const startScanner = async (cameraId) => {
    stopScanner();

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader-box');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.777778,
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText, decodedResult) => {
          handleDecoded(decodedText);
        },
        (errorMessage) => {
          // Normal frame parse misses, do nothing
        }
      );

      setScanning(true);
      setCameraError('');

      // Check if torch/flash is supported
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err) {
      console.error('Falha ao iniciar scanner:', err);
      setScanning(false);
      setCameraError('Não foi possível iniciar o leitor com esta câmera. Tente selecionar outra câmera abaixo.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        // cleanup silent
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
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

  // Throttle scans to avoid duplicate rapid firing
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  const handleDecoded = (decodedText) => {
    const cleanCode = decodedText.trim();
    const now = Date.now();

    // Prevent re-triggering the exact same barcode within 1.8 seconds
    if (cleanCode === lastCodeRef.current && (now - lastTimeRef.current) < 1800) {
      return;
    }

    lastCodeRef.current = cleanCode;
    lastTimeRef.current = now;

    // Trigger haptic vibration if supported
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    // Call parent scan handler
    const result = onScan(cleanCode);

    setLastScannedResult({
      code: cleanCode,
      status: result?.status || 'found', // 'found', 'already_checked', 'not_found'
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Leitor de Código de Barras</h3>
              <p className="text-xs text-slate-400">Aponte a câmera para o código do equipamento</p>
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
          <div id="barcode-reader-box" className="w-full h-full min-h-[300px]"></div>

          {/* Custom Reticle Overlay */}
          {scanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-44 sm:w-72 sm:h-48 border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                {/* Red Laser Scanning Line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-[bounce_2s_infinite]"></div>
                
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
              </div>
            </div>
          )}

          {/* Flash / Torch Button */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`absolute top-4 right-4 z-20 p-2.5 rounded-full transition shadow-lg ${
                torchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800/80 text-white hover:bg-slate-700'
              }`}
              title="Ligar/Desligar Flash"
            >
              <Zap className="w-5 h-5" />
            </button>
          )}

          {/* Error Message if Camera fails */}
          {cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
              <p className="text-white font-semibold text-sm mb-1">Problema com a Câmera</p>
              <p className="text-slate-400 text-xs max-w-sm mb-4">{cameraError}</p>
              <p className="text-blue-400 text-xs font-mono">Dica: Você também pode usar um leitor de código de barras USB ou digitar manualmente no campo de busca!</p>
            </div>
          )}
        </div>

        {/* Scan Feedback Banner */}
        {lastScannedResult && (
          <div className={`p-3.5 border-t transition-all ${
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
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col gap-3">
          
          <div className="flex items-center justify-between text-xs text-slate-300">
            {/* Continuous scan toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span>Modo contínuo (bipar vários itens seguidos)</span>
            </label>

            {/* Audio indicator */}
            <div className="flex items-center gap-1.5 text-slate-400">
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">Beep ativo</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px]">Mudo</span>
                </>
              )}
            </div>
          </div>

          {/* Camera Selector (if multiple) */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">Câmera:</span>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
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
            Concluir / Fechar Leitor
          </button>
        </div>

      </div>
    </div>
  );
}

