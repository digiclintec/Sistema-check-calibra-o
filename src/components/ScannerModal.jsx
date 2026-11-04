import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Zap, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  Trash2,
  ListChecks,
  Sparkles,
  Maximize2,
  Minimize2,
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';
import { findBestEquipmentMatches } from '../utils/fuzzyMatch';

// Suporte a todos os formatos padrão industriais e hospitalares
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

export default function ScannerModal({ 
  isOpen, 
  onClose, 
  onScan, 
  onBatchCheck, 
  equipments = [], 
  soundEnabled = true 
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'full_camera' | 'full_list'
  
  // Modo de operação: 'batch' (Fila de conferência) ou 'instant' (Check 1 por 1)
  const [mode, setMode] = useState('batch'); 
  
  // Fila de equipamentos bipados aguardando confirmação
  const [stagedItems, setStagedItems] = useState([]);
  
  // Feedback do último item bipado
  const [lastScannedFeedback, setLastScannedFeedback] = useState(null);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  // Inicializa câmeras ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCameraError('');
    setLastScannedFeedback(null);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
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
          useBarCodeDetectorIfSupported: true, // Hardware scanner nativo no Android/iOS
        }
      });
      html5QrCodeRef.current = html5QrCode;

      // Configuração de alto desempenho para leitura instantânea e ampla
      const config = {
        fps: 30, // 30 quadros por segundo para máxima velocidade de captura
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Caixa ampla cobrindo 90% da largura útil da tela
          const width = Math.floor(viewfinderWidth * 0.90);
          const height = Math.floor(Math.min(viewfinderHeight * 0.65, 320));
          return {
            width: Math.max(width, 240),
            height: Math.max(height, 140)
          };
        },
      };

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
          // Quadros sem código, fluxo contínuo silencioso
        }
      );

      setScanning(true);
      setCameraError('');

      // Verifica capacidades de lanterna e zoom óptico/digital
      try {
        const track = html5QrCode.getRunningTrackCameraCapabilities();
        if (track) {
          if (track.torchFeature?.().isSupported()) setHasTorch(true);
          if (track.zoomFeature?.().isSupported()) setHasZoom(true);
        }
      } catch (e) {
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
        'Não foi possível abrir a câmera traseira diretamente. Verifique as permissões de câmera do navegador ou use o botão "Enviar Foto do Código".'
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

  const handleCameraChange = (camId) => {
    setSelectedCamera(camId);
    startScanner(camId);
  };

  // Processamento inteligente do código lido
  const handleDecoded = (decodedText) => {
    const cleanCode = String(decodedText || '').trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Cooldown inteligente de 1.2s apenas para o MESMO código repetido
    if (cleanCode === lastCodeRef.current && (now - lastTimeRef.current) < 1200) {
      return;
    }

    lastCodeRef.current = cleanCode;
    lastTimeRef.current = now;

    // Vibração tátil no celular (feedback imediato)
    if (navigator.vibrate) {
      navigator.vibrate([60]);
    }

    // Busca inteligente com o algoritmo de maior similaridade
    const matches = findBestEquipmentMatches(cleanCode, equipments);

    if (!matches || matches.length === 0) {
      // Nenhum candidato encontrado
      if (soundEnabled) playErrorSound();
      setLastScannedFeedback({
        status: 'not_found',
        code: cleanCode,
        message: `Nenhuma bomba ou equipamento encontrado para o código: "${cleanCode}"`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    // Pega o melhor match (maior quantidade de números e caracteres parecidos/próximos)
    const bestMatch = matches[0];
    const targetEq = bestMatch.equipment;

    if (soundEnabled) {
      playSuccessSound();
    }

    // Modo 1: Checagem Imediata (1 a 1)
    if (mode === 'instant') {
      if (onScan) {
        onScan(targetEq.id || cleanCode);
      }
      setLastScannedFeedback({
        status: 'found',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        message: `Check confirmado: ${targetEq.equipamento} (${targetEq.tag || targetEq.serie})`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    // Modo 2: Fila de Conferência em Lote (Requisito principal do usuário)
    setStagedItems((prev) => {
      // Verifica se o item já está na fila atual
      const existsIndex = prev.findIndex(item => item.equipment.id === targetEq.id);
      if (existsIndex !== -1) {
        // Já está na fila, avisa com som de alerta leve
        if (soundEnabled) playWarningSound();
        setLastScannedFeedback({
          status: 'already_staged',
          code: cleanCode,
          match: bestMatch,
          equipment: targetEq,
          message: `Esta bomba já está na lista abaixo (${targetEq.tag || targetEq.serie}).`,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
        return prev;
      }

      // Adiciona ao topo da fila de bipagem
      const newItem = {
        equipment: targetEq,
        match: bestMatch,
        scannedCode: cleanCode,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      };

      setLastScannedFeedback({
        status: 'staged',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        message: `Bomba adicionada à lista: ${targetEq.equipamento} (${targetEq.tag || targetEq.serie})`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      return [newItem, ...prev];
    });
  };

  // Remover item individual da fila
  const handleRemoveStagedItem = (idToRemove) => {
    setStagedItems(prev => prev.filter(item => item.equipment.id !== idToRemove));
  };

  // Limpar toda a fila atual
  const handleClearStaged = () => {
    setStagedItems([]);
    setLastScannedFeedback(null);
  };

  // Confirmar check em todos os itens da fila
  const handleConfirmBatchCheck = async () => {
    if (stagedItems.length === 0) return;

    const ids = stagedItems.map(item => item.equipment.id);
    
    if (onBatchCheck) {
      await onBatchCheck(ids);
    }

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });

    setStagedItems([]);
    setLastScannedFeedback(null);
  };

  // Leitura a partir de foto/galeria
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
      setLastScannedFeedback({
        status: 'not_found',
        code: 'Foto',
        message: 'Nenhum código nítido detectado na foto. Tente aproximar da etiqueta.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      if (soundEnabled) playErrorSound();
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150">
      
      {/* Input oculto para envio de foto */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handlePhotoScan}
        className="hidden"
      />

      <div className="bg-slate-900 border border-slate-800 w-full h-full sm:h-[94vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0 safe-area-top">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                  Leitor de Alta Precisão
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Fuzzy Match 1D/QR
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Puxa pelo número de série, tag ou dígitos mais próximos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode(prev => prev === 'full_camera' ? 'split' : 'full_camera')}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title={viewMode === 'full_camera' ? "Dividir tela com a lista" : "Expandir câmera completa"}
            >
              {viewMode === 'full_camera' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Fechar leitor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tab (Fila em Lote vs Check Imediato) */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMode('batch')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                mode === 'batch' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Fila em Lote ({stagedItems.length})</span>
            </button>
            <button
              onClick={() => setMode('instant')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                mode === 'instant' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Check 1 a 1</span>
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-semibold transition"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Tirar Foto</span>
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className={`relative bg-black flex flex-col items-center justify-center transition-all duration-200 overflow-hidden ${
          viewMode === 'full_camera' 
            ? 'flex-1 min-h-[60vh]' 
            : viewMode === 'full_list' 
            ? 'h-0 hidden' 
            : 'h-[40vh] sm:h-[45vh]'
        }`}>
          
          {/* Caixa do Html5Qrcode com preenchimento total */}
          <div 
            id="barcode-reader-box" 
            className="w-full h-full flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          ></div>

          {/* Mira a Laser Ampla e Nítida */}
          {scanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="relative w-full max-w-[340px] h-[180px] sm:h-[200px] border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.35)]">
                {/* Linha Laser Vermelha Animada */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-400 to-red-600 shadow-[0_0_12px_#ef4444] animate-[bounce_2s_infinite]"></div>
                
                {/* Marcadores de Canto */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/95 bg-slate-900/90 px-3 py-0.5 rounded-full border border-slate-700/80 shadow-md">
                  Aponte para o código de barras ou QR Code
                </div>
              </div>
            </div>
          )}

          {/* Botões Flutuantes da Câmera (Zoom e Lanterna) */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {hasZoom && (
              <button
                onClick={toggleZoom}
                className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-slate-700/80 shadow-lg transition"
                title="Alternar Zoom"
              >
                {zoomLevel}x
              </button>
            )}

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition border ${
                  torchOn 
                    ? 'bg-amber-400 text-slate-950 font-bold border-amber-300' 
                    : 'bg-slate-900/80 text-white hover:bg-slate-800 border-slate-700/80'
                }`}
                title="Ligar Lanterna"
              >
                <Zap className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mensagem de Erro de Câmera */}
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
                  <ImageIcon className="w-4 h-4" /> Tirar Foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Banner do Último Item Bipado com Indicador de Similaridade */}
        {lastScannedFeedback && (
          <div className={`px-4 py-2.5 border-t shrink-0 text-xs transition-all ${
            lastScannedFeedback.status === 'not_found'
              ? 'bg-red-500/15 border-red-500/30 text-red-200'
              : lastScannedFeedback.status === 'already_staged'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                {lastScannedFeedback.status === 'not_found' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                
                <div className="truncate">
                  <div className="flex items-center gap-1.5 font-bold truncate">
                    <span className="truncate">
                      {lastScannedFeedback.equipment ? lastScannedFeedback.equipment.equipamento : 'Código Lido'}
                    </span>
                    {lastScannedFeedback.match && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold shrink-0 ${
                        lastScannedFeedback.match.isExact 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {lastScannedFeedback.match.confidence}% Similar
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90 truncate">
                    {lastScannedFeedback.message}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono opacity-70 shrink-0">
                {lastScannedFeedback.timestamp}
              </span>
            </div>
          </div>
        )}

        {/* Seção da Fila de Equipamentos Bipados (Staged List) */}
        <div className="flex-1 overflow-y-auto bg-slate-950/40 p-3 sm:p-4 divide-y divide-slate-800/60">
          
          <div className="flex items-center justify-between pb-2 mb-2">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Fila de Conferência ({stagedItems.length} {stagedItems.length === 1 ? 'bomba' : 'bombas'})
              </h4>
            </div>

            {stagedItems.length > 0 && (
              <button
                onClick={handleClearStaged}
                className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition"
                title="Remover todos da lista"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Fila</span>
              </button>
            )}
          </div>

          {stagedItems.length === 0 ? (
            <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Layers className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
              <p className="text-xs font-semibold text-slate-400">Nenhum equipamento na fila ainda</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Aponte a câmera para as bombas. Todas que você bipar aparecerão aqui antes de confirmar o check.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {stagedItems.map((item, idx) => {
                const eq = item.equipment;
                const match = item.match;
                const isAlreadyChecked = eq.checado;

                return (
                  <div
                    key={`${eq.id}-${idx}`}
                    className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-2xl flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                        {stagedItems.length - idx}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs sm:text-sm truncate">
                            {eq.equipamento || 'Bomba de Infusão'}
                          </span>
                          
                          {/* Tag ou Identificação */}
                          {eq.tag && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 font-bold">
                              {eq.tag}
                            </span>
                          )}

                          {/* Badge de Similaridade / Coincidência de Dígitos */}
                          {match && (
                            <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                              match.isExact 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {match.isExact ? '100% Exato' : `${match.matchingDigits} dígitos iguais (${match.confidence}%)`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          {eq.serie && (
                            <span>Série: <span className="font-mono text-slate-300">{eq.serie}</span></span>
                          )}
                          {eq.setor && (
                            <span>• Setor: <span className="text-slate-300">{eq.setor}</span></span>
                          )}
                          {isAlreadyChecked && (
                            <span className="text-amber-400 font-bold">• Já checado antes</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botão de Remover da Fila */}
                    <button
                      onClick={() => handleRemoveStagedItem(eq.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition shrink-0"
                      title="Remover desta lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Bottom Actions Bar (Botão Principal de Confirmação em Lote) */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col gap-2 shrink-0 safe-area-bottom">
          
          {stagedItems.length > 0 ? (
            <button
              onClick={handleConfirmBatchCheck}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              <span>Confirmar Check em Todos da Lista ({stagedItems.length} {stagedItems.length === 1 ? 'bomba' : 'bombas'})</span>
            </button>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Bipe as bombas para montar a lista de conferência</span>
              <span className="font-mono">{equipments.length} no cadastro</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none"
              >
                <option value="">Lente Traseira Automática</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>{c.label || `Câmera ${c.id}`}</option>
                ))}
              </select>
            )}

            <button
              onClick={onClose}
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Fechar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
