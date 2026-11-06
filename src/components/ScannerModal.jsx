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
  ShieldCheck,
  Crosshair,
  Target,
  ScanLine,
  MapPin,
  GripHorizontal,
  SlidersHorizontal,
  ChevronDown,
  SwitchCamera,
  Columns2,
  Rows2,
  Lock,
  Package,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  playSuccessSound, 
  playWarningSound, 
  playErrorSound,
  playAlreadyCheckedSound,
  playMaintenanceAlertSound,
  triggerHapticAlert
} from '../utils/audio';
import { findBestEquipmentMatches } from '../utils/fuzzyMatch';
import { parseCompositeBarcode } from '../utils/gs1Parser';
import { processPhotoTextWithAgent } from '../utils/serialAgent';
import { MODALITIES, isEquipmentChecked, getCheckMeta } from '../utils/modalities';
import { isNativeAndroidApp, scanWithNativeGoogleScanner } from '../utils/nativeBarcodeScanner';

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
  soundEnabled = true,
  activeModality = 'calibracao',
  onChangeModality,
  serviceConfig = null
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [showLensPicker, setShowLensPicker] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0); // Padrão 1.0x (Nativo sem distorção digital)
  const [zoomCaps, setZoomCaps] = useState(null); // Capacidades de zoom óptico { min, max, step }
  const [activeLensLabel, setActiveLensLabel] = useState('🎯 50MP Principal');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'full_camera'
  const [reticleType, setReticleType] = useState('1d'); // '1d' (Linha Laser) | '2d' (Caixa QR)
  
  // Helper para identificar lente ultra-wide (0.5x / grande angular afastada)
  const isUltraWideLens = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('ultra') || l.includes('super') || l.includes('0.5') || l.includes('0,5') || l.includes('ultrawide') || l.includes('wide-angle');
  };

  // Helper para identificar lente Principal
  const isMainAutofocusLens = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('main') || l.includes('principal') || l.includes('primary');
  };

  const isTelephotoLens = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('tele') || l.includes('zoom') || l.includes('3x') || l.includes('5x');
  };

  const isFrontCamera = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('front') || l.includes('user') || l.includes('frontal') || l.includes('selfie') || l.includes('facing front') || l.includes('camera2 1');
  };

  // Algoritmo padronizado de seleção da Câmera Principal Traseira (Samsung S20, A55 5G, Motorola, Xiaomi, etc.)
  const selectBestRearAutofocusCamera = (allCameras) => {
    if (!allCameras || allCameras.length === 0) return null;

    const normalized = allCameras.map((c, i) => ({
      id: c.deviceId || c.id || `cam-${i}`,
      deviceId: c.deviceId || c.id || `cam-${i}`,
      label: c.label || ''
    }));

    const rearCameras = normalized.filter(c => !isFrontCamera(c.label));

    if (rearCameras.length === 0) {
      return normalized[0];
    }
    if (rearCameras.length === 1) {
      return rearCameras[0];
    }

    // 1. Prioriza sensor explicitamente marcado como 'main', 'principal' ou 'primary'
    const labeledMain = rearCameras.find(c => isMainAutofocusLens(c.label));
    if (labeledMain) {
      return labeledMain;
    }

    // 2. Descarta lentes conhecidas como ultra-wide (0.5x) ou telephoto
    const nonUltra = rearCameras.filter(c => !isUltraWideLens(c.label) && !isTelephotoLens(c.label));
    if (nonUltra.length > 0) {
      // Padrão Android HAL: a primeira câmera traseira (Camera 0) é a câmera principal do aparelho
      return nonUltra[0];
    }

    return rearCameras[0];
  };

  // Rótulos inteligentes e amigáveis para cada lente de hardware do aparelho
  const getFriendlyCameraLabel = (camera, index, total) => {
    if (!camera) return `Lente ${index + 1}`;
    const raw = (camera.label || '').toLowerCase();
    
    if (isFrontCamera(raw)) {
      return `🤳 Lente Frontal (${index + 1})`;
    }

    const rearList = (cameras || []).filter(c => !isFrontCamera(c.label));

    if (isMainAutofocusLens(raw, index, rearList)) {
      return `🎯 50MP Principal (Foco Próximo)`;
    }
    if (isUltraWideLens(raw, index, rearList)) {
      return `📐 Ultra-Wide 0.5x [Visão Ampla / Sem Foco de Perto]`;
    }
    if (isTelephotoLens(raw)) {
      return `🔭 Telefoto Óptica (${index + 1})`;
    }
    if (raw.includes('macro') || raw.includes('depth')) {
      return `🔍 Macro (${index + 1})`;
    }

    const backIndex = rearList.findIndex(c => (c.id === camera.id || c.deviceId === camera.deviceId));
    if (backIndex === 0 && rearList.length > 1) {
      return `📐 Ultra-Wide 0.5x (${index + 1})`;
    } else if (backIndex === 1) {
      return `🎯 50MP Principal (${index + 1})`;
    }
    return `📷 Lente ${index + 1} (${camera.label || 'Traseira'})`;
  };

  const getShortLensName = (camera, index) => {
    if (!camera) return `Lente ${index + 1}`;
    const raw = (camera.label || '').toLowerCase();
    if (isFrontCamera(raw)) return '🤳 Frontal';

    const rearList = (cameras || []).filter(c => !isFrontCamera(c.label));

    if (isMainAutofocusLens(raw, index, rearList)) {
      return '🎯 50MP Principal';
    }
    if (isUltraWideLens(raw, index, rearList)) {
      return '📐 0.5x Wide';
    }
    if (isTelephotoLens(raw)) {
      return '🔭 Telefoto';
    }
    if (raw.includes('macro')) {
      return '🔍 Macro';
    }

    const backIndex = rearList.findIndex(c => (c.id === camera.id || c.deviceId === camera.deviceId));
    if (backIndex === 0 && rearList.length > 1) {
      return '📐 0.5x Wide';
    }
    if (backIndex === 1) {
      return '🎯 50MP Principal';
    }
    return `📷 Lente ${index + 1}`;
  };

  // Presets de lentes ópticas do smartphone (padrão 1.0x nativo sem distorção digital)
  const opticalPresets = useMemo(() => {
    const minZ = zoomCaps?.min ?? 1;
    const maxZ = zoomCaps?.max ?? 8;

    return [
      { label: '1.0x', fullName: '1.0x Nítida (50MP Nativo)', value: 1.0, icon: '🎯' },
      { label: '1.5x', fullName: '1.5x Foco Próximo', value: Math.min(1.5, maxZ), icon: '🔍' },
      { label: '2.0x', fullName: '2.0x Telefoto', value: Math.min(2.0, maxZ), icon: '🔭' },
    ];
  }, [zoomCaps]);

  const rearCamerasList = useMemo(() => {
    return (cameras || []).filter(c => !isFrontCamera(c.label));
  }, [cameras]);

  // Rótulo da lente ativa exibido no botão flutuante principal
  const currentLensDisplay = useMemo(() => {
    if (rearCamerasList.length > 1) {
      const idx = rearCamerasList.findIndex(c => (c.id === selectedCamera || c.deviceId === selectedCamera));
      const pos = idx >= 0 ? idx + 1 : 1;
      return `🔄 Lente ${pos} de ${rearCamerasList.length}`;
    }
    return '🎯 50MP Principal';
  }, [rearCamerasList, selectedCamera]);

  // Alternar rapidamente entre as lentes traseiras físicas do aparelho
  const handleToggleRearCamera = async () => {
    if (rearCamerasList.length <= 1 || isStartingRef.current) return;
    const currentIndex = rearCamerasList.findIndex(c => c.id === selectedCamera || c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % rearCamerasList.length;
    const nextCam = rearCamerasList[nextIndex];

    if (nextCam) {
      setFocusFeedbackText(`🔄 Ativando Lente ${nextIndex + 1}...`);
      await handleCameraChange(nextCam.id);
    }
  };

  // Modalidades padrão completas configuradas para o hospital (Calibração + Preventiva + Segurança Elétrica)
  // Conforme solicitação do usuário: Fixado em Calibração Completa (todas as etapas juntas)
  const configuredStandardModalities = useMemo(() => {
    const mods = [];
    if (!serviceConfig || serviceConfig.enableCalibracao !== false) mods.push('calibracao');
    if (!serviceConfig || serviceConfig.enablePreventiva !== false) mods.push('preventiva');
    if (!serviceConfig || serviceConfig.enableSeguranca !== false) mods.push('seguranca');
    return mods.length > 0 ? mods : ['calibracao', 'preventiva', 'seguranca'];
  }, [serviceConfig]);

  // Modalidades ativas para bipar: Inicia em Manutenção Externa se activeModality for externa, senão no pacote completo
  const [selectedModalities, setSelectedModalities] = useState(() => {
    if (activeModality === 'externa' || activeModality === 'manutencao_externa') {
      return ['externa'];
    }
    return configuredStandardModalities;
  });

  // Sincroniza se a modalidade mudar pelo componente pai
  useEffect(() => {
    if (activeModality === 'externa' || activeModality === 'manutencao_externa') {
      setSelectedModalities(['externa']);
    } else {
      setSelectedModalities(configuredStandardModalities);
    }
  }, [activeModality, configuredStandardModalities]);

  const isExternalMode = selectedModalities.length === 1 && (selectedModalities[0] === 'externa' || selectedModalities[0] === 'manutencao_externa');

  const handleSelectStandardComplete = () => {
    setSelectedModalities(configuredStandardModalities);
    if (onChangeModality) onChangeModality('geral');
  };

  const handleSelectExternalMaintenance = () => {
    setSelectedModalities(['externa']);
    if (onChangeModality) onChangeModality('externa');
  };

  // Altura customizável e arrastável: Câmera vs Lista de Bombas
  // cameraHeightPercent: Padrão mobile 30% para priorizar a visualização imediata da lista de bombas bipadas
  const [cameraHeightPercent, setCameraHeightPercent] = useState(30);
  // Layout no Tablet (Tela dividida Lado a Lado ou Empilhada)
  const [isTabletSplit, setIsTabletSplit] = useState(true);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const containerRef = useRef(null);
  const dragStartYRef = useRef(0);
  const dragStartPercentRef = useRef(48);

  // Manipulador de arraste via mouse no divisor
  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    dragStartYRef.current = e.clientY;
    dragStartPercentRef.current = cameraHeightPercent;

    const onMouseMove = (moveEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const deltaPercent = (deltaY / rect.height) * 100;
      let newPercent = dragStartPercentRef.current + deltaPercent;
      newPercent = Math.max(18, Math.min(75, newPercent));
      setCameraHeightPercent(newPercent);
    };

    const onMouseUp = () => {
      setIsDraggingDivider(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Manipulador de arraste via toque (touchscreen / celular) no divisor
  const handleDividerTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDraggingDivider(true);
    dragStartYRef.current = e.touches[0].clientY;
    dragStartPercentRef.current = cameraHeightPercent;

    const onTouchMove = (moveEvent) => {
      if (!containerRef.current || moveEvent.touches.length !== 1) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaY = moveEvent.touches[0].clientY - dragStartYRef.current;
      const deltaPercent = (deltaY / rect.height) * 100;
      let newPercent = dragStartPercentRef.current + deltaPercent;
      newPercent = Math.max(18, Math.min(75, newPercent));
      setCameraHeightPercent(newPercent);
    };

    const onTouchEnd = () => {
      setIsDraggingDivider(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  };

  // Funções de alternar / definir exatamente os tipos a bipar
  const handleToggleModality = (modKey) => {
    setSelectedModalities(prev => {
      let next;
      if (prev.includes(modKey)) {
        if (prev.length === 1) return prev; // Mantém ao menos uma modalidade ativa
        next = prev.filter(m => m !== modKey);
      } else {
        next = [...prev, modKey];
      }
      if (next.length === 1 && onChangeModality) {
        onChangeModality(next[0]);
      }
      return next;
    });
  };

  const handleSetExactModalities = (mods) => {
    setSelectedModalities(mods);
    if (mods.length === 1 && onChangeModality) {
      onChangeModality(mods[0]);
    }
  };

  // Feedback visual do toque para focar (Tap to Focus)
  const [focusRing, setFocusRing] = useState({ x: 0, y: 0, visible: false, status: 'idle' });
  const [focusFeedbackText, setFocusFeedbackText] = useState('');

  // Modo de operação: 'batch' (Fila de conferência) ou 'instant' (Check 1 por 1)
  const [mode, setMode] = useState('batch'); 

  // Alvo de busca no código de barras: 'all' (automático) | 'idec' (somente IDEC / Tag) | 'serie' (somente Série)
  const [searchTarget, setSearchTarget] = useState('all');
  
  // Fila de equipamentos bipados aguardando confirmação
  const [stagedItems, setStagedItems] = useState([]);
  
  // Feedback do último item bipado
  const [lastScannedFeedback, setLastScannedFeedback] = useState(null);

  // Setor de retirada padrão do lote (Ex: 'UTIN', 'Centro Cirúrgico', etc.)
  const [batchSector, setBatchSector] = useState('');

  // Setores disponíveis sugeridos a partir da planilha
  const availableSectors = useMemo(() => {
    const set = new Set();
    equipments.forEach(e => {
      if (e.setor && e.setor !== 'Geral') set.add(e.setor);
      if (e.setor_retirada && e.setor_retirada !== 'Geral') set.add(e.setor_retirada);
    });
    return Array.from(set).sort();
  }, [equipments]);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const viewfinderRef = useRef(null);
  const focusTimeoutRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  // Detector nativo de código de barras (Google Play Services / Android ML Kit)
  const nativeDetectorActiveRef = useRef(false);
  const nativeDetectorRafRef = useRef(null);
  const isStartingRef = useRef(false);

  // Inicializa câmera ao abrir o modal com descoberta inteligente de hardware
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setCameraError('');
    setLastScannedFeedback(null);
    setFocusRing({ x: 0, y: 0, visible: false, status: 'idle' });
    setZoomLevel(1.0);

    const initCamerasAndStart = async () => {
      try {
        let savedCam = null;
        try {
          savedCam = localStorage.getItem('calibracheck_preferred_camera_v2');
        } catch (e) {}

        // 1. Enumera e descobre todas as lentes físicas do smartphone
        let detected = [];
        try {
          detected = await Html5Qrcode.getCameras();
        } catch (e) {
          if (navigator.mediaDevices?.enumerateDevices) {
            const rawDevs = await navigator.mediaDevices.enumerateDevices();
            detected = rawDevs.filter(d => d.kind === 'videoinput');
          }
        }

        if (!isMounted) return;

        const normalized = (detected || []).map((c, i) => ({
          id: c.id || c.deviceId || `cam-${i}`,
          deviceId: c.id || c.deviceId || `cam-${i}`,
          label: c.label || ''
        }));

        if (normalized.length > 0) {
          setCameras(normalized);
        }

        // 2. Seleciona inteligentemente a Lente Principal 50MP com Autofoco de Perto (ignora a Ultra-Wide fixa)
        let targetCam = null;
        if (savedCam) {
          targetCam = normalized.find(c => c.id === savedCam || c.deviceId === savedCam);
        }
        if (!targetCam) {
          targetCam = selectBestRearAutofocusCamera(normalized);
        }

        const targetId = targetCam ? targetCam.id : null;

        if (targetId) {
          setSelectedCamera(targetId);
          await startScanner(targetId);
        } else {
          await startScanner(null);
        }
      } catch (err) {
        console.warn('Erro ao inicializar câmeras no startup:', err);
        if (isMounted) {
          await startScanner(null);
        }
      }
    };

    initCamerasAndStart();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId, retryCount = 0) => {
    if (isStartingRef.current && retryCount === 0) return;
    isStartingRef.current = true;
    setIsCameraStarting(true);
    setCameraError('');

    await stopScanner(true);

    // Pausa preventiva de 120ms para liberação completa do hardware da câmera no mobile
    await new Promise(r => setTimeout(r, 120));

    // Garante que o elemento DOM do visualizador já está presente
    for (let i = 0; i < 8; i++) {
      if (document.getElementById('barcode-reader-box')) break;
      await new Promise(r => setTimeout(r, 50));
    }

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader-box', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Hardware scanner nativo no Android/iOS
        }
      });
      html5QrCodeRef.current = html5QrCode;

      // Restrições de vídeo com TROCA FÍSICA GARANTIDA no Android Camera2 (Samsung, Motorola, Xiaomi):
      // Full HD 1080p nativo no sensor de 50MP para máxima nitidez de números e barras de perto
      let videoConstraints;
      if (cameraId) {
        if (retryCount === 0) {
          videoConstraints = {
            deviceId: { exact: cameraId },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, max: 60 }
          };
        } else if (retryCount === 1) {
          videoConstraints = {
            deviceId: { exact: cameraId }
          };
        } else {
          videoConstraints = {
            deviceId: cameraId,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          };
        }
      } else {
        videoConstraints = {
          facingMode: "environment",
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 60 }
        };
      }

      const config = {
        fps: 30, // 30 FPS para leitura instantânea e sem lag
        videoConstraints: videoConstraints,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Ampla área horizontal cobrindo 96% da largura útil sem cortar códigos 1D longos
          const width = Math.floor(viewfinderWidth * 0.96);
          const height = Math.floor(Math.min(viewfinderHeight * 0.85, 360));
          return {
            width: Math.max(width, 280),
            height: Math.max(height, 150)
          };
        },
        disableFlip: true,
      };

      // Configuração exata para o Html5Qrcode respeitar a lente física solicitada
      const cameraConfig = cameraId 
        ? { deviceId: { exact: cameraId } } 
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
      setIsCameraStarting(false);
      setCameraError('');
      isStartingRef.current = false;

      // Atualiza e normaliza lista de câmeras conectadas
      try {
        let devs = [];
        try {
          devs = await Html5Qrcode.getCameras();
        } catch (e) {
          if (navigator.mediaDevices?.enumerateDevices) {
            const r = await navigator.mediaDevices.enumerateDevices();
            devs = r.filter(d => d.kind === 'videoinput');
          }
        }
        if (devs && devs.length > 0) {
          const normalized = devs.map((c, i) => ({
            id: c.id || c.deviceId || `cam-${i}`,
            deviceId: c.id || c.deviceId || `cam-${i}`,
            label: c.label || ''
          }));
          setCameras(normalized);
          if (cameraId) {
            setSelectedCamera(cameraId);
          } else {
            const best = selectBestRearAutofocusCamera(normalized);
            if (best) setSelectedCamera(best.id);
          }
        }
      } catch (e) {}

      // ESTRUTURA GOOGLE ML KIT (Android Chrome / Google Play Services Engine):
      // Leitura automática contínua em tempo real (como no tablet)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const nativeDetector = new window.BarcodeDetector({
            formats: [
              'code_128',
              'code_39',
              'code_93',
              'ean_13',
              'ean_8',
              'data_matrix',
              'qr_code',
              'itf',
              'upc_a',
              'upc_e'
            ]
          });

          nativeDetectorActiveRef.current = true;
          let isNativeDetecting = false;
          const runNativeLoop = async () => {
            if (!nativeDetectorActiveRef.current) return;
            if (!isNativeDetecting) {
              const videoEl = document.querySelector('#barcode-reader-box video');
              if (videoEl && videoEl.readyState >= 2 && !videoEl.paused) {
                isNativeDetecting = true;
                try {
                  // 1. Detecção nativa ultra-rápida no quadro completo (como no tablet)
                  let barcodes = await nativeDetector.detect(videoEl);

                  // 2. Se não detectou no quadro todo (ex: código pequeno ou com pouca luz), tenta recorte central ampliado
                  const vw = videoEl.videoWidth;
                  const vh = videoEl.videoHeight;
                  if ((!barcodes || barcodes.length === 0) && vw > 400 && vh > 300) {
                    try {
                      const cropW = Math.round(vw * 0.80);
                      const cropH = Math.round(vh * 0.50);
                      const cropX = Math.round((vw - cropW) / 2);
                      const cropY = Math.round((vh - cropH) / 2);
                      const roiBitmap = await createImageBitmap(videoEl, cropX, cropY, cropW, cropH);
                      barcodes = await nativeDetector.detect(roiBitmap);
                      roiBitmap.close();
                    } catch (cropErr) {}
                  }

                  if (barcodes && barcodes.length > 0) {
                    for (const b of barcodes) {
                      if (b.rawValue) {
                        handleDecoded(b.rawValue);
                        break;
                      }
                    }
                  }
                } catch (e) {
                } finally {
                  isNativeDetecting = false;
                }
              }
            }
            if (nativeDetectorActiveRef.current) {
              nativeDetectorRafRef.current = requestAnimationFrame(runNativeLoop);
            }
          };

          nativeDetectorRafRef.current = requestAnimationFrame(runNativeLoop);
        } catch (e) {
          console.warn('BarcodeDetector nativo não pôde ser ativado:', e);
        }
      }

      // Ativa foco contínuo e calibração de lente óptica
      setTimeout(() => {
        setupTrackFocusAndQuality();
        applyHardwareFocus(0.5, 0.5);
      }, 350);

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
      console.warn(`Tentativa ${retryCount + 1} ao iniciar câmera:`, err);

      // Fallback em cascata inteligente mantendo estritamente a lente física selecionada
      if (retryCount < 2 && cameraId) {
        const delay = (retryCount + 1) * 150;
        console.log(`Tentando fallback tier ${retryCount + 2} para câmera ${cameraId}...`);
        await new Promise(r => setTimeout(r, delay));
        return startScanner(cameraId, retryCount + 1);
      } else if (retryCount < 2) {
        const delay = 200;
        await new Promise(r => setTimeout(r, delay));
        return startScanner(null, retryCount + 1);
      }

      isStartingRef.current = false;
      setIsCameraStarting(false);
      setScanning(false);
      setCameraError(
        'Não foi possível ativar a lente física selecionada. O sensor pode estar em uso ou não ser suportado. Tente outra lente física da lista.'
      );
    }
  };

  // Calibração e ativação do Autofoco Contínuo e Foco de Perto (50MP Nativo)
  const setupTrackFocusAndQuality = async () => {
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      if (!track) return;

      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const settings = track.getSettings ? track.getSettings() : {};
      console.log('[Camera] Resolução ativa:', settings.width, 'x', settings.height, 'Capabilities:', caps);

      // Armazena capacidades de zoom do hardware
      if (caps.zoom) {
        setZoomCaps(caps.zoom);
        setHasZoom(true);
      }
      if (caps.torch) {
        setHasTorch(true);
      }

      // GARANTE IMAGEM NATIVA 1.0x SEM QUALQUER ZOOM DIGITAL ARTIFICIAL
      if (videoEl) {
        videoEl.style.transform = 'none';
      }
      setZoomLevel(1.0);

      const advanced = [];

      // 1. Verificação inteligente de autofoco: se a lente aberta for fixa/ultra-wide sem autofoco
      // e houver outra câmera traseira disponível, alterna automaticamente para a lente com autofoco!
      const hasAF = caps.focusMode && (caps.focusMode.includes('continuous') || caps.focusMode.includes('single-shot'));
      const rearCams = (cameras || []).filter(c => !isFrontCamera(c.label));
      if (!hasAF && caps.focusMode && caps.focusMode.length > 0 && rearCams.length > 1) {
        const altCam = rearCams.find(c => c.id !== selectedCamera && c.deviceId !== selectedCamera);
        if (altCam) {
          console.log('[Camera] Lente sem motor de autofoco detectada. Alternando para a lente principal:', altCam.label);
          handleCameraChange(altCam.id);
          return;
        }
      }

      // 2. Autofoco contínuo no hardware da lente principal
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }

      // 2. Exposição contínua
      if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }

      // 3. Balanço de branco contínuo
      if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }

      // 4. MODO MACRO / FOCO DE PERTO (5-15cm): se o driver suportar distância mínima de foco
      if (caps.focusDistance) {
        const macroDist = caps.focusDistance.min ?? 0.1;
        advanced.push({ focusDistance: macroDist });
      }

      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
          console.log('[Camera] Autofoco contínuo e modo macro de perto calibrados.');
        } catch (e) {
          console.warn('[Camera] Falha ao aplicar constraints avançadas no track:', e);
        }
      }
    } catch (err) {
      console.warn('[Camera] Erro na calibração inicial do track:', err);
    }
  };

  const stopScanner = async (keepStartingState = false) => {
    nativeDetectorActiveRef.current = false;
    if (nativeDetectorRafRef.current) {
      cancelAnimationFrame(nativeDetectorRafRef.current);
      nativeDetectorRafRef.current = null;
    }

    // Para explicitamente todas as tracks do elemento de vídeo para liberar hardware
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
        videoEl.srcObject = null;
      }
    } catch (e) {}

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
    if (!keepStartingState) {
      setIsCameraStarting(false);
    }
    setTorchOn(false);
  };

  // Função central para forçar o foco de hardware da câmera (Macro / Close-up)
  const applyHardwareFocus = async (relX, relY) => {
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];

      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        
        // 1. Ponto de interesse do foco (onde o técnico tocou na tela)
        if (relX !== undefined && relY !== undefined && caps.pointsOfInterest) {
          try {
            await track.applyConstraints({
              advanced: [{ pointsOfInterest: [{ x: relX, y: relY }] }]
            });
          } catch (e) {}
        }

        // 2. Dispara ciclo de foco no motor da lente com prioridade para foco de perto (macro)
        if (caps.focusMode) {
          try {
            if (caps.focusMode.includes('single-shot')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
              setTimeout(async () => {
                try {
                  if (caps.focusMode.includes('continuous')) {
                    const adv = [{ focusMode: 'continuous' }];
                    if (caps.focusDistance) {
                      adv[0].focusDistance = caps.focusDistance.min ?? 0.1;
                    }
                    await track.applyConstraints({ advanced: adv });
                  }
                } catch (e) {}
              }, 300);
            } else if (caps.focusMode.includes('continuous')) {
              const adv = [{ focusMode: 'continuous' }];
              if (caps.focusDistance) {
                adv[0].focusDistance = caps.focusDistance.min ?? 0.1;
              }
              await track.applyConstraints({ advanced: adv });
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Erro ao aplicar foco de hardware:', err);
    }
  };

  // Clique/Toque na tela para focar (Tap to Focus)
  const handleViewfinderClick = (e) => {
    if (!viewfinderRef.current) return;

    const rect = viewfinderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const relX = Math.max(0, Math.min(1, x / rect.width));
    const relY = Math.max(0, Math.min(1, y / rect.height));

    // Feedback tátil imediato
    if (navigator.vibrate) {
      navigator.vibrate([40]);
    }

    // Exibe mira visual no ponto tocado
    setFocusRing({ x, y, visible: true, status: 'focusing' });
    setFocusFeedbackText('Focando na área tocada...');

    // Dispara foco de hardware
    applyHardwareFocus(relX, relY);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Após 350ms, marca como focado com cor verde
    setTimeout(() => {
      setFocusRing(prev => ({ ...prev, status: 'focused' }));
      setFocusFeedbackText('✓ Foco Ajustado');
    }, 350);

    // Some suavemente após 1.4s
    focusTimeoutRef.current = setTimeout(() => {
      setFocusRing(prev => ({ ...prev, visible: false }));
      setFocusFeedbackText('');
    }, 1400);
  };

  // Botão dedicado de forçar foco central
  const handleTriggerCenterFocus = (e) => {
    e?.stopPropagation();
    if (!viewfinderRef.current) return;
    const rect = viewfinderRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    if (navigator.vibrate) navigator.vibrate([40]);

    setFocusRing({ x: centerX, y: centerY, visible: true, status: 'focusing' });
    setFocusFeedbackText('Re-calibrando foco...');

    applyHardwareFocus(0.5, 0.5);

    setTimeout(() => {
      setFocusRing(prev => ({ ...prev, status: 'focused' }));
      setFocusFeedbackText('✓ Foco Centralizado');
    }, 350);

    setTimeout(() => {
      setFocusRing(prev => ({ ...prev, visible: false }));
      setFocusFeedbackText('');
    }, 1400);
  };

  const toggleTorch = async (e) => {
    e?.stopPropagation();
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

  // Aplica zoom óptico real de hardware (forçando troca física de sensor no Android Camera2 HAL)
  const applyOpticalLensZoom = async (targetZoom, labelOverride = null) => {
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};

      const minZ = caps.zoom?.min ?? zoomCaps?.min ?? 1;
      const maxZ = caps.zoom?.max ?? zoomCaps?.max ?? 8;
      const clampedZoom = Math.min(Math.max(targetZoom, minZ), maxZ);

      let applied = false;

      // 1. Aplica na trilha de hardware ativa (ativação real do sensor físico no Android Camera2)
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: clampedZoom }] });
          applied = true;
        } catch (e1) {
          // Hardware pode não suportar constraint zoom direta
        }
      }

      // 2. Se falhar, tenta via API nativa do Html5Qrcode
      if (!applied && html5QrCodeRef.current?.applyVideoConstraints) {
        try {
          await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ zoom: clampedZoom }] });
          applied = true;
        } catch (e2) {}
      }

      setZoomLevel(clampedZoom);

      // 3. SUPER ZOOM DIGITAL HD:
      // Se o hardware não puder fazer zoom nativo (comum em WebRTC Android),
      // aplicamos a ampliação HD no elemento de vídeo para o enquadramento perfeito!
      if (videoEl) {
        if (!applied && clampedZoom > 1.05) {
          videoEl.style.transform = `scale(${clampedZoom})`;
          videoEl.style.transformOrigin = 'center center';
          videoEl.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
        } else {
          videoEl.style.transform = 'none';
        }
      }

      const matched = opticalPresets.find(p => Math.abs(p.value - clampedZoom) < 0.15);
      const name = (labelOverride && labelOverride !== 'silent') ? labelOverride : (matched?.fullName || `${clampedZoom.toFixed(1)}x`);
      setActiveLensLabel(name);

      if (labelOverride !== 'silent') {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(35);
        }
        setFocusFeedbackText(`✓ ${name} ${applied ? '(Óptico)' : '(HD Sensor)'}`);
        setTimeout(() => setFocusFeedbackText(''), 1800);
      }
      return true;
    } catch (err) {
      console.warn('[Camera] Erro ao aplicar zoom:', err);
      return false;
    }
  };

  const handleCameraChange = async (camId) => {
    if (!camId || isStartingRef.current) return;
    setSelectedCamera(camId);
    try {
      localStorage.setItem('calibracheck_preferred_camera_v2', camId);
    } catch (e) {}

    const idx = cameras.findIndex(c => (c.id === camId || c.deviceId === camId));
    const targetCam = idx >= 0 ? cameras[idx] : { id: camId, label: '' };
    const friendly = getFriendlyCameraLabel(targetCam, idx >= 0 ? idx : 0, cameras.length);
    
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch (e) {}

    setFocusFeedbackText(`🔄 Ativando: ${friendly}...`);

    // Para completamente a câmera anterior e libera a trilha de hardware
    await stopScanner(true);
    setZoomLevel(1.0);
    const videoEl = document.querySelector('#barcode-reader-box video');
    if (videoEl) {
      videoEl.style.transform = 'none';
      if (videoEl.srcObject) {
        try {
          videoEl.srcObject.getTracks().forEach(t => t.stop());
        } catch (e) {}
        videoEl.srcObject = null;
      }
    }

    // Intervalo de segurança (300ms) para o driver do Android Camera2 liberar fisicamente o sensor
    await new Promise(r => setTimeout(r, 300));

    // Inicia a nova câmera física escolhida com deviceId exato
    await startScanner(camId);
    setFocusFeedbackText(`✓ ${friendly}`);
    setTimeout(() => setFocusFeedbackText(''), 2500);
  };

  // Troca de câmera real: alterna entre todos os sensores físicos disponíveis (50MP Principal <-> Ultra-Wide <-> Frontal)
  const handleCycleLensOrCamera = async () => {
    if (isStartingRef.current || !cameras || cameras.length === 0) return;

    // Se temos mais de 1 câmera física detectada (múltiplas traseiras ou traseira + frontal):
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => (c.id === selectedCamera || c.deviceId === selectedCamera));
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCam = cameras[nextIndex];
      const targetId = nextCam ? (nextCam.id || nextCam.deviceId) : null;
      if (targetId) {
        await handleCameraChange(targetId);
        return;
      }
    }

    // Se o aparelho expõe apenas 1 sensor, cicla os níveis de zoom
    const currentIndex = opticalPresets.findIndex(p => Math.abs(p.value - zoomLevel) < 0.15);
    const nextIndex = (currentIndex + 1) % opticalPresets.length;
    const nextPreset = opticalPresets[nextIndex];
    if (nextPreset) {
      await applyOpticalLensZoom(nextPreset.value, nextPreset.fullName);
    }
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

    // Busca inteligente com decomposição de código composto (procura IDEC ou Série)
    const matches = findBestEquipmentMatches(cleanCode, equipments, searchTarget);

    if (!matches || matches.length === 0) {
      // Nenhum candidato encontrado
      if (soundEnabled) playErrorSound();
      const targetHint = searchTarget === 'idec' ? ' pelo IDEC / Tag' : searchTarget === 'serie' ? ' pelo Nº de Série' : '';
      setLastScannedFeedback({
        status: 'not_found',
        code: cleanCode,
        message: `Nenhuma bomba localizada${targetHint} para o código lido (${cleanCode.length > 25 ? cleanCode.substring(0, 25) + '...' : cleanCode}).`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    // Pega o melhor match (maior quantidade de números e caracteres parecidos/próximos)
    const bestMatch = matches[0];
    const targetEq = bestMatch.equipment;

    // SEGURANÇA INTELIGENTE: Bloqueia se a bomba estiver em Manutenção Externa ou com modalidades concluídas!
    const effectiveMods = selectedModalities.length > 0 ? selectedModalities : configuredStandardModalities;

    // 1. PRIORIDADE MÁXIMA: Equipamento em MANUTENÇÃO EXTERNA (Terceirizada)
    if (Boolean(targetEq.check_externa) && !effectiveMods.includes('externa')) {
      if (soundEnabled) {
        playMaintenanceAlertSound();
      }
      triggerHapticAlert('maintenance');

      const meta = getCheckMeta(targetEq, 'externa');
      const whoSent = meta.user ? `por ${meta.user}` : '';
      const whenSent = meta.date ? ` em ${new Date(meta.date).toLocaleDateString('pt-BR')}` : '';

      setLastScannedFeedback({
        status: 'in_maintenance',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        meta,
        modalities: ['externa'],
        message: `📦 ATENÇÃO: Esta bomba já foi recolhida e está em MANUTENÇÃO EXTERNA ${whoSent}${whenSent}! Bip bloqueado para não misturar com as bombas calibradas.`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    // 2. SEGURANÇA: Bloqueia se TODAS as modalidades selecionadas já estiverem concluídas!
    const uncompletedMods = effectiveMods.filter(m => !isEquipmentChecked(targetEq, m, serviceConfig));
    const isAlreadyCheckedAll = uncompletedMods.length === 0;
    const modLabels = effectiveMods.map(m => MODALITIES[m]?.shortName || m).join(' + ');

    if (isAlreadyCheckedAll) {
      if (soundEnabled) {
        playAlreadyCheckedSound();
      }
      triggerHapticAlert('already_checked');

      const meta = getCheckMeta(targetEq, effectiveMods[0]);
      const whoChecked = meta.user ? `por ${meta.user}` : '';
      const whenChecked = meta.date ? ` em ${new Date(meta.date).toLocaleDateString('pt-BR')}` : '';

      setLastScannedFeedback({
        status: 'already_checked',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        meta,
        modalities: effectiveMods,
        message: `⚠️ ATENÇÃO: Esta bomba já possui [${modLabels}] concluída anteriormente ${whoChecked}${whenChecked}! Bip bloqueado para evitar duplicação.`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    if (soundEnabled) {
      playSuccessSound();
    }

    // Modo 1: Checagem Imediata (1 a 1)
    const gs1Info = parseCompositeBarcode(cleanCode);
    const baseIdentification = gs1Info.serialNumber && gs1Info.serialNumber !== cleanCode
      ? `Série ${gs1Info.serialNumber} isolado do GS1`
      : `${bestMatch.reason}`;

    const alreadyCompleted = effectiveMods.filter(m => isEquipmentChecked(targetEq, m, serviceConfig));
    let detailMsg;
    if (alreadyCompleted.length > 0) {
      const doneLabels = alreadyCompleted.map(m => MODALITIES[m]?.shortName || m).join(', ');
      const pendingLabels = uncompletedMods.map(m => MODALITIES[m]?.shortName || m).join(', ');
      detailMsg = `✓ [${doneLabels}] já OK • Bipando para [${pendingLabels}]: ${targetEq.equipamento} (${targetEq.tag || targetEq.serie})`;
    } else {
      detailMsg = `${baseIdentification} • [${modLabels}]: ${targetEq.equipamento} (IDEC: ${targetEq.tag || 'N/A'} | Série: ${targetEq.serie || 'N/A'})`;
    }

    if (mode === 'instant') {
      if (onBatchCheck) {
        onBatchCheck([{
          id: targetEq.id,
          equipment: targetEq,
          setorRetirada: batchSector || targetEq.setor_retirada || targetEq.setor || ''
        }], effectiveMods);
      } else if (onScan) {
        onScan(targetEq.id || cleanCode, effectiveMods);
      }
      setLastScannedFeedback({
        status: 'found',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        message: detailMsg,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      return;
    }

    // Modo 2: Fila de Conferência em Lote (Requisito principal do usuário)
    setStagedItems((prev) => {
      // Verifica se o item já está na fila atual
      const existsIndex = prev.findIndex(item => item.equipment.id === targetEq.id);
      if (existsIndex !== -1) {
        if (soundEnabled) playWarningSound();
        setLastScannedFeedback({
          status: 'already_staged',
          code: cleanCode,
          match: bestMatch,
          equipment: targetEq,
          message: `Esta bomba já está na fila abaixo (IDEC: ${targetEq.tag || 'N/A'} | Série: ${targetEq.serie || 'N/A'}).`,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
        return prev;
      }

      // Adiciona ao topo da fila de bipagem com setor de retirada configurado
      const newItem = {
        equipment: targetEq,
        match: bestMatch,
        scannedCode: cleanCode,
        targetModalities: effectiveMods,
        setorRetirada: batchSector || targetEq.setor_retirada || targetEq.setor || '',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      };

      setLastScannedFeedback({
        status: 'staged',
        code: cleanCode,
        match: bestMatch,
        equipment: targetEq,
        message: detailMsg,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      return [newItem, ...prev];
    });
  };

  // Atualizar setor de retirada de uma bomba específica dentro da fila
  const handleUpdateItemSector = (id, newSector) => {
    setStagedItems(prev => prev.map(item => {
      if (item.equipment.id === id) {
        return { ...item, setorRetirada: newSector };
      }
      return item;
    }));
  };

  // Aplicar setor de retirada a todas as bombas já bipadas na fila atual
  const handleApplySectorToAllStaged = (sectorToApply) => {
    if (!sectorToApply) return;
    setStagedItems(prev => prev.map(item => ({ ...item, setorRetirada: sectorToApply })));
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

  // Confirmar check em todos os itens da fila com seus setores de retirada
  const handleConfirmBatchCheck = async () => {
    if (stagedItems.length === 0) return;

    // Envia lista detalhada com id e setor de retirada individual de cada bomba
    const itemsPayload = stagedItems.map(item => ({
      id: item.equipment.id,
      equipment: item.equipment,
      setorRetirada: item.setorRetirada || batchSector || item.equipment.setor || 'Geral'
    }));
    
    const effectiveMods = selectedModalities.length > 0 ? selectedModalities : configuredStandardModalities;

    if (onBatchCheck) {
      await onBatchCheck(itemsPayload, effectiveMods);
    }

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });

    setStagedItems([]);
    setLastScannedFeedback(null);
  };

  // Dispara o Scanner Nativo do Android (Google Code Scanner no APK ou Câmera Oficial no Browser)
  const handleTriggerNativeScanner = async () => {
    if (isNativeAndroidApp()) {
      setFocusFeedbackText('🚀 Abrindo Google Code Scanner...');
      const res = await scanWithNativeGoogleScanner();
      if (res.success && res.code) {
        setFocusFeedbackText(`✓ Lido: ${res.code}`);
        handleDecoded(res.code);
      } else if (res.error && res.error !== 'Nenhum código lido' && res.error !== 'User canceled') {
        // Fallback suave para Câmera fotográfica
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  // Leitura ultra-inteligente a partir de foto/câmera nativa (Código de Barras + OCR Automático)
  const handlePhotoScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLastScannedFeedback({
      status: 'analyzing',
      code: '📸 Câmera Nativa',
      message: 'Processando foto em alta resolução do sensor nativo...',
      timestamp: new Date().toLocaleTimeString('pt-BR')
    });

    try {
      let decodedBarcode = null;

      // PASSO 1: Detecção ultra-rápida por hardware nativo no Android (Google Play Services BarcodeDetector)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const bmp = await createImageBitmap(file);
          const nativeDetector = new window.BarcodeDetector({
            formats: [
              'code_128', 
              'code_39', 
              'code_93', 
              'ean_13', 
              'ean_8', 
              'itf', 
              'qr_code', 
              'data_matrix', 
              'upc_a', 
              'upc_e'
            ]
          });
          const detected = await nativeDetector.detect(bmp);
          if (detected && detected.length > 0) {
            for (const item of detected) {
              if (item.rawValue) {
                decodedBarcode = item.rawValue;
                console.log('[Camera Nativa] BarcodeDetector detectou com sucesso:', decodedBarcode);
                break;
              }
            }
          }
        } catch (detectorErr) {
          console.warn('[Camera Nativa] BarcodeDetector direto:', detectorErr);
        }
      }

      // PASSO 2: Se não detectou no bitmap bruto, gera versão otimizada em Canvas (1600px max, contraste aprimorado)
      let optimizedDataUrl = null;
      let optimizedBlob = null;
      if (!decodedBarcode) {
        try {
          const processed = await new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              URL.revokeObjectURL(url);
              const maxDim = 1600;
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              
              canvas.toBlob((blob) => {
                resolve({
                  dataUrl: canvas.toDataURL('image/jpeg', 0.90),
                  blob: blob ? new File([blob], 'optimized.jpg', { type: 'image/jpeg' }) : null
                });
              }, 'image/jpeg', 0.90);
            };
            img.onerror = () => resolve({ dataUrl: null, blob: null });
            img.src = url;
          });

          optimizedDataUrl = processed.dataUrl;
          optimizedBlob = processed.blob;
        } catch (optErr) {
          console.warn('[Camera Nativa] Falha na otimização de imagem:', optErr);
        }
      }

      // PASSO 3: Tenta BarcodeDetector e Html5Qrcode na imagem otimizada
      if (!decodedBarcode && optimizedBlob) {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const bmpOpt = await createImageBitmap(optimizedBlob);
            const nativeDetector = new window.BarcodeDetector({
              formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'qr_code', 'data_matrix']
            });
            const detectedOpt = await nativeDetector.detect(bmpOpt);
            if (detectedOpt && detectedOpt.length > 0 && detectedOpt[0].rawValue) {
              decodedBarcode = detectedOpt[0].rawValue;
            }
          } catch (e) {}
        }

        if (!decodedBarcode) {
          try {
            const scanner = html5QrCodeRef.current || new Html5Qrcode('barcode-reader-box', {
              formatsToSupport: SUPPORTED_FORMATS
            });
            decodedBarcode = await scanner.scanFile(optimizedBlob, true);
          } catch (scannerErr) {}
        }
      }

      // Se encontrou código de barras pela Câmera Nativa, bipe imediato!
      if (decodedBarcode) {
        setFocusFeedbackText('✓ Código Lido pela Câmera Nativa!');
        handleDecoded(decodedBarcode);
        e.target.value = '';
        return;
      }

      // PASSO 4: Fallback Inteligente OCR (Se a etiqueta tiver texto com NS/IDEC ou código sem barras)
      setLastScannedFeedback({
        status: 'analyzing',
        code: 'OCR',
        message: 'Decodificando texto impresso [SN] / [REF] / IDEC da etiqueta...',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      let ocrText = '';
      if (optimizedDataUrl) {
        try {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('por+eng', 1);
          const ret = await worker.recognize(optimizedDataUrl);
          ocrText = ret.data.text || '';
          await worker.terminate();
        } catch (clientErr) {
          const res = await fetch('/api/ocr-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: optimizedDataUrl })
          });
          const d = await res.json();
          ocrText = d.text || '';
        }
      }

      if (ocrText) {
        const agentResult = processPhotoTextWithAgent(ocrText, equipments);
        if (agentResult.matchedEquipments.length > 0) {
          setFocusFeedbackText('✓ Identificado pelo Agente OCR!');
          for (const match of agentResult.matchedEquipments) {
            handleDecoded(match.matchedToken || match.equipment.serie || match.equipment.tag);
          }
          e.target.value = '';
          return;
        }
      }

      // Se nenhum método localizou
      if (soundEnabled) playErrorSound();
      setLastScannedFeedback({
        status: 'not_found',
        code: '📸 Câmera Nativa',
        message: 'Nenhum código de barras ou número de série legível foi identificado na foto. Enquadre a etiqueta de mais perto com boa iluminação.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

    } catch (err) {
      console.error('Erro ao ler foto da câmera nativa:', err);
      if (soundEnabled) playErrorSound();
      setLastScannedFeedback({
        status: 'not_found',
        code: '📸 Câmera Nativa',
        message: `Falha ao processar foto: ${err.message}`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
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

      <div 
        ref={containerRef}
        className="bg-slate-900 border border-slate-800 w-full h-full sm:h-[94vh] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl md:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col select-none"
      >
        
        {/* Top Header Compacto */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0 safe-area-top">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Camera className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">
                  Leitor 50MP Principal
                </h3>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Ao Vivo
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tablet Layout Mode Switcher */}
            <button
              onClick={() => setIsTabletSplit(!isTabletSplit)}
              className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition"
              title={isTabletSplit ? "Mudar para empilhado" : "Mudar para lado a lado"}
            >
              {isTabletSplit ? <Columns2 className="w-3.5 h-3.5 text-blue-400" /> : <Rows2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isTabletSplit ? "Lado a Lado" : "Empilhado"}</span>
            </button>

            {/* View Mode Toggle */}
            <button
              onClick={() => {
                if (viewMode === 'full_camera') {
                  setViewMode('split');
                  setCameraHeightPercent(28);
                } else {
                  setViewMode('full_camera');
                  setCameraHeightPercent(60);
                }
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title={viewMode === 'full_camera' ? "Dividir tela com lista" : "Expandir câmera"}
            >
              {viewMode === 'full_camera' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Fechar leitor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================
            BARRA DE CONTROLE COMPACTA: MODALIDADE + ALVO + FILA
        ============================================================ */}
        <div className="px-2.5 py-1.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
          {/* Seletor de Modalidade a Bipar: Calibração Completa Fixada vs Manutenção Externa */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Opção 1: Calibração Completa Fixa (Bloqueada para prevenir erros) */}
            <button
              type="button"
              onClick={handleSelectStandardComplete}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm ${
                !isExternalMode
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white shadow-blue-500/30 ring-1 ring-blue-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Calibração Completa Fixada: Valida Calibração + Preventiva + Segurança Elétrica juntas"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>⚡ Calibração Completa</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-extrabold hidden xs:inline">
                {configuredStandardModalities.length} em 1
              </span>
            </button>

            {/* Opção 2: Manutenção Externa (Única alternativa alterável) */}
            <button
              type="button"
              onClick={handleSelectExternalMaintenance}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm ${
                isExternalMode
                  ? 'bg-purple-600 text-white shadow-purple-500/30 ring-1 ring-purple-300'
                  : 'bg-slate-900 text-purple-300 hover:text-white border border-slate-800'
              }`}
              title="Equipamento enviado para calibração/conserto por equipe externa terceirizada"
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>📦 Manut. Externa</span>
            </button>
          </div>

          {/* Alvo e Modo */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
              <button
                onClick={() => setSearchTarget(t => t === 'all' ? 'idec' : t === 'idec' ? 'serie' : 'all')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  searchTarget === 'all' ? 'text-blue-400' : searchTarget === 'idec' ? 'text-amber-400' : 'text-purple-400'
                }`}
                title="Alternar alvo de busca: Auto / IDEC / Série"
              >
                <span>🔍 {searchTarget === 'all' ? 'Auto' : searchTarget === 'idec' ? 'IDEC' : 'Série'}</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
              <button
                onClick={() => setMode('batch')}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                  mode === 'batch' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Fila contínua de conferência em lote"
              >
                <ListChecks className="w-3 h-3" />
                <span>Fila ({stagedItems.length})</span>
              </button>
              <button
                onClick={() => setMode('instant')}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                  mode === 'instant' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Check instantâneo 1 a 1"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden xs:inline">1a1</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            CORPO DO LEITOR: LAYOUT OTIMIZADO PARA MOBILE & TABLET
            Mobile (< 768px): Câmera em cima (~28% altura) + Fila de bombas embaixo (~72% altura)
            Tablet / Desktop (>= 768px): Modo Lado a Lado (40% câmera / 60% fila)
        ============================================================ */}
        <div className={`flex-1 flex min-h-0 overflow-hidden ${isTabletSplit ? 'flex-col md:flex-row' : 'flex-col'}`}>
          
          {/* PAINEL DA ESQUERDA: CÂMERA 50MP */}
          <div 
            style={{
              height: `${cameraHeightPercent}%`,
              minHeight: '130px',
              maxHeight: '44%'
            }}
            className="w-full shrink-0 flex flex-col bg-black min-h-0 overflow-hidden transition-[height] duration-150 md:!h-full md:!max-h-full md:w-5/12 lg:w-5/12 md:border-r border-slate-800"
          >
            {/* Camera Viewport Area com CLIQUE PARA FOCAR (Tap to Focus) */}
            <div 
              ref={viewfinderRef}
              onClick={handleViewfinderClick}
              className="relative flex-1 bg-black flex flex-col items-center justify-center overflow-hidden cursor-crosshair select-none min-h-0 w-full"
              title="Toque em qualquer ponto da imagem para focar"
            >
          
          {/* Caixa do Html5Qrcode com preenchimento total e sem barras pretas */}
          <div 
            id="barcode-reader-box" 
            className="w-full h-full flex items-center justify-center pointer-events-none [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          ></div>

          {/* Mira Laser Ampla de Enquadramento */}
          {scanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
              {reticleType === '1d' ? (
                // Mira 1D: Ampla e horizontal ideal para bombas de infusão (Code 128 / GS1)
                <div className="relative w-[96%] max-w-[480px] h-[100px] sm:h-[130px] border-2 border-dashed border-red-500/80 rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.35)] flex items-center justify-center">
                  {/* Linha Laser Vermelha Horizontal Contínua e Brilhante */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-300 to-red-600 shadow-[0_0_14px_#ef4444] animate-pulse"></div>
                  
                  {/* Marcadores de Canto Vermelhos */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-red-500 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-red-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-red-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-red-500 rounded-br-lg"></div>

                  {/* Dica da Linha Laser no rodapé da mira */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white/95 bg-slate-900/95 px-2.5 py-0.5 rounded-full border border-red-500/40 shadow-md flex items-center gap-1.5">
                    <ScanLine className="w-3 h-3 text-red-400" />
                    <span>Laser vermelho sobre o código</span>
                  </div>
                </div>
              ) : (
                // Mira 2D: Caixa quadrada para QR Code / DataMatrix
                <div className="relative w-full max-w-[260px] h-[220px] border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.35)]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-500 shadow-[0_0_12px_#3b82f6] animate-[bounce_2s_infinite]"></div>
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white/95 bg-slate-900/90 px-2.5 py-0.5 rounded-full border border-slate-700/80 shadow-md flex items-center gap-1.5">
                    <Crosshair className="w-3 h-3 text-amber-400 animate-spin" />
                    <span>Enquadre o código QR</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mira Visual Animada de Toque no Ponto Tocado (Tap Reticle) */}
          {focusRing.visible && (
            <div 
              className={`absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 z-30 ${
                focusRing.status === 'focused' ? 'scale-95 text-emerald-400' : 'scale-110 text-amber-400 animate-pulse'
              }`}
              style={{ left: focusRing.x, top: focusRing.y, width: 64, height: 64 }}
            >
              <div className="w-full h-full border-2 border-dashed border-current rounded-2xl relative shadow-[0_0_15px_currentColor]">
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-current"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-current"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-current"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-current"></div>
                <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-current"></div>
              </div>
            </div>
          )}

          {/* Toast Pill de Confirmação de Foco */}
          {focusFeedbackText && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="bg-slate-950/90 text-white border border-slate-700/80 px-3 py-1 rounded-full text-[11px] font-bold shadow-xl flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>{focusFeedbackText}</span>
              </div>
            </div>
          )}

          {/* Barra Superior Unificada do Viewfinder: NÃO SOBREPÕE */}
          <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
            {/* Controles da Esquerda: Alternador 1D/2D e Seletor/Indicador da Câmera Principal */}
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setReticleType(r => r === '1d' ? '2d' : '1d')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border shadow-lg transition active:scale-95 shrink-0 ${
                  reticleType === '1d'
                    ? 'bg-red-500/25 text-red-200 border-red-500/50 shadow-red-500/20'
                    : 'bg-blue-500/25 text-blue-200 border-blue-500/50 shadow-blue-500/20'
                }`}
                title="Alternar entre mira para Código de Barras (1D) e mira para QR Code (2D)"
              >
                <ScanLine className="w-3 h-3" />
                <span>{reticleType === '1d' ? '1D Laser' : '2D QR'}</span>
              </button>

              {/* Botão Dinâmico de Alternar Lente Traseira (se houver mais de 1 câmera) ou Indicador Fixo */}
              {rearCamerasList.length > 1 ? (
                <button
                  type="button"
                  onClick={handleToggleRearCamera}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-900/90 hover:bg-slate-800 text-blue-300 border border-blue-500/50 shadow-md backdrop-blur-xs transition active:scale-95 shrink-0"
                  title="Toque para alternar entre as lentes traseiras do celular"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-blue-400" />
                  <span>{currentLensDisplay}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-950/85 text-blue-300 border border-blue-500/40 shadow-md backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>🎯 50MP Principal</span>
                </div>
              )}
            </div>

            {/* Controles da Direita: Foco de Perto (Macro) e Lanterna */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleTriggerCenterFocus}
                className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 border border-amber-500/40 shadow-lg transition active:scale-95"
                title="Focar de perto agora (Calibrar motor da lente para 5-15cm)"
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] hidden xs:inline">Focar Perto</span>
              </button>

              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-1.5 rounded-full flex items-center justify-center shadow-lg transition border ${
                    torchOn 
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 ring-2 ring-amber-400/50 shadow-amber-400/30' 
                      : 'bg-slate-900/90 text-white hover:bg-slate-800 border-slate-700/80'
                  }`}
                  title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* HUD FLOATING ALERT BANNER DIRETO SOBRE A CÂMERA (IMPOSSÍVEL DE NÃO VER PELO OPERADOR) */}
          {lastScannedFeedback && (lastScannedFeedback.status === 'already_checked' || lastScannedFeedback.status === 'in_maintenance') && (
            <div className="absolute top-14 left-2.5 right-2.5 z-30 animate-in zoom-in-95 duration-200">
              <div className={`p-3 rounded-2xl border-2 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5 ${
                lastScannedFeedback.status === 'in_maintenance'
                  ? 'bg-purple-950/95 border-purple-400 text-purple-100 shadow-purple-950/70'
                  : 'bg-amber-950/95 border-amber-400 text-amber-100 shadow-amber-950/70'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                    lastScannedFeedback.status === 'in_maintenance'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                  }`}>
                    {lastScannedFeedback.status === 'in_maintenance' ? (
                      <Package className="w-5 h-5 text-purple-300 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        lastScannedFeedback.status === 'in_maintenance'
                          ? 'bg-purple-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}>
                        {lastScannedFeedback.status === 'in_maintenance'
                          ? '📦 EM MANUTENÇÃO EXTERNA'
                          : '⚠️ BOMBA JÁ CHECADA'}
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">
                        {lastScannedFeedback.timestamp}
                      </span>
                    </div>
                    <div className="text-xs font-black text-white truncate mt-0.5">
                      {lastScannedFeedback.equipment?.equipamento || 'Bomba de Infusão'}
                    </div>
                    <div className="text-[10px] opacity-90 truncate font-mono">
                      🏷️ IDEC: <strong>{lastScannedFeedback.equipment?.tag || 'S/N'}</strong> • S/N: {lastScannedFeedback.equipment?.serie || 'N/A'} • {
                        lastScannedFeedback.status === 'in_maintenance'
                          ? (lastScannedFeedback.equipment?.motivo_externa || 'Terceirizada')
                          : `Por: ${lastScannedFeedback.meta?.user || 'Técnico'}`
                      }
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastScannedFeedback(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition shadow-md active:scale-95 ${
                    lastScannedFeedback.status === 'in_maintenance'
                      ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/40'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/40'
                  }`}
                >
                  Entendido
                </button>
              </div>
            </div>
          )}

          {/* Barra Inferior do Viewfinder: Foco de Perto + Indicador Google AI */}
          {scanning && !cameraError && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none gap-1.5">
              <div className="bg-slate-950/85 backdrop-blur-md text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-[10px] font-semibold shadow-lg flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="truncate">🎯 Foco de Perto (5-15cm) • 50MP Principal</span>
              </div>
              {typeof window !== 'undefined' && 'BarcodeDetector' in window && (
                <div className="bg-blue-950/85 backdrop-blur-md text-blue-200 border border-blue-500/60 px-2.5 py-1 rounded-full text-[9px] font-bold shadow-lg flex items-center gap-1 shrink-0" title="Motor Google ML Kit acelerado por hardware">
                  <span className="text-[10px]">⚡</span>
                  <span>Google AI</span>
                </div>
              )}
            </div>
          )}

          {/* Indicador de Inicialização Suave da Câmera */}
          {isCameraStarting && !scanning && !cameraError && (
            <div className="absolute inset-0 z-15 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 space-y-3 animate-in fade-in duration-150">
              <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-white font-bold text-xs">Iniciando câmera Full HD 1080p...</p>
              <p className="text-slate-400 text-[10px]">Autofoco e sensor principal ativo</p>
            </div>
          )}

          {/* Mensagem de Erro de Câmera */}
          {cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-slate-900/95 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-white font-semibold text-xs">Câmera não iniciada</p>
              <p className="text-slate-400 text-[11px] max-w-sm">{cameraError}</p>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  onClick={() => startScanner(selectedCamera)}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Tirar Foto
                </button>
              </div>
            </div>
          )}
        </div>

      </div> {/* Fim do PAINEL DA ESQUERDA (CÂMERA) */}

          {/* ============================================================
              PAINEL DA DIREITA: FILA DE BOMBAS BIPADAS (TOTALMENTE VISÍVEL E COM SCROLL)
          ============================================================ */}
          <div className="flex-1 flex flex-col bg-slate-950/60 min-h-0 overflow-hidden w-full md:w-7/12 lg:w-7/12 md:h-full">

            {/* Banner do Último Item Bipado ou Card Completo de Já Calibrada / Em Manutenção */}
            {lastScannedFeedback && (
              lastScannedFeedback.status === 'in_maintenance' ? (
                /* CARD COMPLETO E 100% LEGÍVEL PARA EQUIPAMENTO EM MANUTENÇÃO EXTERNA */
                <div className="p-3 sm:p-3.5 bg-gradient-to-r from-purple-950/95 via-slate-900 to-purple-950/85 border-b border-purple-500/50 text-purple-100 shadow-xl shrink-0 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5 shadow-inner">
                        <Package className="w-5 h-5 text-purple-400 animate-pulse" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500 text-white uppercase tracking-wide shadow-xs">
                            📦 BOMBA EM MANUTENÇÃO EXTERNA
                          </span>
                          <span className="text-[11px] font-mono text-purple-200/90 font-bold">
                            Lido: {lastScannedFeedback.code}
                          </span>
                          <span className="text-[10px] text-purple-300/70 font-mono ml-auto">
                            {lastScannedFeedback.timestamp}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                            {lastScannedFeedback.equipment?.equipamento || 'Bomba de Infusão'}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {lastScannedFeedback.equipment?.fabricante} {lastScannedFeedback.equipment?.modelo}
                          </p>
                        </div>

                        {/* Dados Completos de Identificação: IDEC, Série, Setor */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                          {lastScannedFeedback.equipment?.tag && (
                            <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              🏷️ IDEC: {lastScannedFeedback.equipment.tag}
                            </span>
                          )}
                          {lastScannedFeedback.equipment?.serie && (
                            <span className="font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                              🔢 S/N: {lastScannedFeedback.equipment.serie}
                            </span>
                          )}
                          {(lastScannedFeedback.equipment?.setor_retirada || lastScannedFeedback.equipment?.setor) && (
                            <span className="px-2 py-0.5 rounded-lg bg-teal-950/60 text-teal-300 border border-teal-800/80 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                              <span>{lastScannedFeedback.equipment.setor_retirada || lastScannedFeedback.equipment.setor}</span>
                            </span>
                          )}
                        </div>

                        {/* Detalhes de Auditoria da Manutenção */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-purple-500/30 text-xs text-purple-100/90 space-y-1 mt-1">
                          <div className="flex items-center gap-1.5 font-bold text-purple-300">
                            <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>Registro de Saída para Manutenção Terceirizada:</span>
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-200 break-words">
                            👤 <strong>Responsável:</strong> {
                              lastScannedFeedback.meta?.user || 
                              lastScannedFeedback.equipment?.usuario_externa || 
                              'Equipe Externa'
                            }
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-300 break-words">
                            📅 <strong>Data de Envio:</strong> {
                              (lastScannedFeedback.meta?.date || lastScannedFeedback.equipment?.data_externa)
                                ? new Date(lastScannedFeedback.meta?.date || lastScannedFeedback.equipment?.data_externa).toLocaleString('pt-BR')
                                : 'Registrado no plano ativo'
                            }
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-300 break-words">
                            📝 <strong>Motivo:</strong> {
                              lastScannedFeedback.equipment?.motivo_externa || 'Calibração e conserto por equipe externa terceirizada'
                            }
                          </div>
                          <div className="text-[10px] text-amber-300/90 pt-1 font-semibold">
                            ⚠️ Esta bomba deve ser mantida separada das bombas liberadas para uso hospitalar.
                          </div>
                        </div>

                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setLastScannedFeedback(null)}
                        className="p-1.5 text-purple-300/70 hover:text-white rounded-lg hover:bg-white/10 transition"
                        title="Fechar aviso"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setLastScannedFeedback(null)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Entendido</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : lastScannedFeedback.status === 'already_checked' ? (
                /* CARD COMPLETO E 100% LEGÍVEL PARA EQUIPAMENTO JÁ CALIBRADO */
                <div className="p-3 sm:p-3.5 bg-gradient-to-r from-amber-950/95 via-slate-900 to-amber-950/85 border-b border-amber-500/50 text-amber-100 shadow-xl shrink-0 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-inner">
                        <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wide shadow-xs">
                            ⚠️ BOMBA JÁ CALIBRADA
                          </span>
                          <span className="text-[11px] font-mono text-amber-200/90 font-bold">
                            Lido: {lastScannedFeedback.code}
                          </span>
                          <span className="text-[10px] text-amber-300/70 font-mono ml-auto">
                            {lastScannedFeedback.timestamp}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                            {lastScannedFeedback.equipment?.equipamento || 'Bomba de Infusão'}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {lastScannedFeedback.equipment?.fabricante} {lastScannedFeedback.equipment?.modelo}
                          </p>
                        </div>

                        {/* Dados Completos de Identificação: IDEC, Série, Setor */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                          {lastScannedFeedback.equipment?.tag && (
                            <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              🏷️ IDEC: {lastScannedFeedback.equipment.tag}
                            </span>
                          )}
                          {lastScannedFeedback.equipment?.serie && (
                            <span className="font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                              🔢 S/N: {lastScannedFeedback.equipment.serie}
                            </span>
                          )}
                          {(lastScannedFeedback.equipment?.setor_retirada || lastScannedFeedback.equipment?.setor) && (
                            <span className="px-2 py-0.5 rounded-lg bg-teal-950/60 text-teal-300 border border-teal-800/80 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                              <span>{lastScannedFeedback.equipment.setor_retirada || lastScannedFeedback.equipment.setor}</span>
                            </span>
                          )}
                        </div>

                        {/* DESTAQUE PRINCIPAL: SETOR DE RETIRADA / DESTINO PARA DEVOLUÇÃO */}
                        <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/50 shadow-md flex items-center justify-between gap-3 mt-1.5">
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-bounce shrink-0" />
                              <span>{lastScannedFeedback.equipment?.setor_retirada ? 'Retirada no Setor:' : 'Destino de Devolução:'}</span>
                            </span>
                            <div className="text-sm font-black text-emerald-200 truncate mt-0.5">
                              📍 {lastScannedFeedback.equipment?.setor_retirada || lastScannedFeedback.equipment?.setor || 'Setor Geral / Não Informado'}
                            </div>
                            {lastScannedFeedback.equipment?.setor_retirada && lastScannedFeedback.equipment?.setor && lastScannedFeedback.equipment.setor_retirada.trim().toLowerCase() !== lastScannedFeedback.equipment.setor.trim().toLowerCase() && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                🏢 Cadastro Original: <strong>{lastScannedFeedback.equipment.setor}</strong>
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 uppercase shadow-sm block">
                              Devolver Aqui ➔
                            </span>
                          </div>
                        </div>

                        {/* Detalhes de Auditoria: Quem calibrou, Quando e Horário (100% legível, sem cortes) */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-amber-100/90 space-y-1 mt-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Histórico de Calibração Registrado:</span>
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-200 break-words">
                            👤 <strong>Responsável:</strong> {
                              lastScannedFeedback.meta?.user || 
                              lastScannedFeedback.equipment?.usuario_calibracao || 
                              lastScannedFeedback.equipment?.usuario_preventiva || 
                              lastScannedFeedback.equipment?.conferidoPor || 
                              'Operador Autorizado'
                            }
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-300 break-words">
                            📅 <strong>Data / Horário:</strong> {
                              (lastScannedFeedback.meta?.date || lastScannedFeedback.equipment?.data_calibracao || lastScannedFeedback.equipment?.dataCheck)
                                ? new Date(lastScannedFeedback.meta?.date || lastScannedFeedback.equipment?.data_calibracao || lastScannedFeedback.equipment?.dataCheck).toLocaleString('pt-BR')
                                : 'Concluído no plano ativo'
                            }
                          </div>

                          {/* Badges de Serviços Concluídos */}
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {lastScannedFeedback.equipment?.check_calibracao && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                ✓ Calibração Metrológica
                              </span>
                            )}
                            {lastScannedFeedback.equipment?.check_preventiva && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                ✓ Manutenção Preventiva
                              </span>
                            )}
                            {lastScannedFeedback.equipment?.check_seguranca && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                ✓ Segurança Elétrica (TSE)
                              </span>
                            )}
                            {lastScannedFeedback.equipment?.check_externa && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                📦 Manutenção Externa
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Ações Rápidas: Fechar ou Forçar Recalibração */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setLastScannedFeedback(null)}
                        className="p-1.5 text-amber-300/70 hover:text-white rounded-lg hover:bg-white/10 transition"
                        title="Fechar aviso"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const eq = lastScannedFeedback.equipment;
                          setStagedItems(prev => [
                            {
                              equipment: eq,
                              match: lastScannedFeedback.match,
                              scannedCode: lastScannedFeedback.code,
                              targetModalities: selectedModalities,
                              setorRetirada: batchSector || eq.setor_retirada || eq.setor || '',
                              isForced: true,
                              timestamp: new Date().toLocaleTimeString('pt-BR')
                            },
                            ...prev.filter(item => item.equipment.id !== eq.id)
                          ]);
                          setLastScannedFeedback({
                            status: 'staged',
                            code: lastScannedFeedback.code,
                            equipment: eq,
                            message: `✓ Inclusão forçada na lista: ${eq.equipamento} (${eq.tag || eq.serie})`,
                            timestamp: new Date().toLocaleTimeString('pt-BR')
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1 shrink-0"
                        title="Recalibrar mesmo já estando concluída"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Recalibrar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* BANNER NORMAL PARA NOVAS BIPAGENS E ALERTA DE NÃO ENCONTRADO */
                <div className={`px-3.5 py-2 border-b shrink-0 text-xs transition-all ${
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

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono opacity-70">
                        {lastScannedFeedback.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}

        {/* ============================================================
            SEÇÃO DA FILA DE EQUIPAMENTOS BIPADOS (STAGED LIST)
            Altura flexível e garantida com scroll suave
        ============================================================ */}
        <div className="flex-1 overflow-y-auto bg-slate-950/50 p-2.5 sm:p-3 min-h-0 flex flex-col">
          
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Fila Bipada ({stagedItems.length} {stagedItems.length === 1 ? 'bomba' : 'bombas'})
              </h4>
              <span className="text-[10px] font-bold text-blue-300 bg-blue-900/50 border border-blue-700/60 px-2 py-0.5 rounded-full">
                {selectedModalities.map(m => MODALITIES[m]?.shortName || m).join(' + ')}
              </span>
            </div>

            {stagedItems.length > 0 && (
              <button
                onClick={handleClearStaged}
                className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition px-2 py-0.5 rounded-lg hover:bg-red-500/10"
                title="Remover todos da lista"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Fila</span>
              </button>
            )}
          </div>

          {/* Barra de Seleção / Alteração do Setor de Retirada do Lote (Compacta) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 mb-2 flex items-center justify-between gap-2 shrink-0 shadow-xs">
            <div className="flex items-center gap-1 shrink-0 text-slate-300 font-bold text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Setor do Lote:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <input
                type="text"
                list="scanner-sector-suggestions"
                value={batchSector}
                onChange={(e) => setBatchSector(e.target.value)}
                placeholder="Ex: UTIN, Centro Cirúrgico, UTI..."
                className="bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-lg px-2 py-0.5 text-xs text-white placeholder-slate-500 flex-1 focus:outline-none"
              />
              <datalist id="scanner-sector-suggestions">
                {availableSectors.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              {stagedItems.length > 0 && batchSector && (
                <button
                  type="button"
                  onClick={() => handleApplySectorToAllStaged(batchSector)}
                  className="px-2 py-0.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-lg text-[10px] font-bold shrink-0 transition"
                  title="Aplicar este setor a todas as bombas da fila"
                >
                  Aplicar a todas
                </button>
              )}
            </div>
          </div>

          {/* Lista Vazia ou Cards das Bombas */}
          {stagedItems.length === 0 ? (
            <div className="flex-1 min-h-[90px] flex flex-col items-center justify-center text-center p-4 text-slate-500 border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/20 my-auto">
              <Layers className="w-6 h-6 mb-1 opacity-40 text-blue-400" />
              <p className="text-xs font-semibold text-slate-300">Nenhuma bomba na fila ainda</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">
                Aponte o laser vermelho da câmera para o código da bomba. Cada bomba bipada aparecerá aqui nesta lista instantaneamente!
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {stagedItems.map((item, idx) => {
                const eq = item.equipment;
                const match = item.match;
                const isTopNewest = idx === 0;

                return (
                  <div
                    key={`${eq.id}-${idx}`}
                    className={`p-2.5 rounded-2xl flex flex-col gap-1.5 transition shadow-sm ${
                      isTopNewest 
                        ? 'bg-slate-800/95 border-2 border-emerald-500/70 ring-2 ring-emerald-500/20 shadow-emerald-950/50' 
                        : 'bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Número da bomba na fila */}
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 border ${
                          isTopNewest 
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                            : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                        }`}>
                          {stagedItems.length - idx}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                              {eq.equipamento || 'Bomba de Infusão'}
                            </span>

                            {isTopNewest && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                ⚡ Recém Bipada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botão de Remover */}
                      <button
                        onClick={() => handleRemoveStagedItem(eq.id)}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                        title="Remover desta lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Informações detalhadas da bomba: Tag, Série, Setor e Modalidades */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300 flex-wrap">
                      {eq.tag && (
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px]">
                          🏷️ {eq.tag}
                        </span>
                      )}
                      {eq.serie && (
                        <span className="font-mono text-slate-300 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60">
                          S/N: {eq.serie}
                        </span>
                      )}
                      {(item.setorRetirada || eq.setor) && (
                        <span className="text-[10px] text-teal-300 bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-800/60 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-teal-400" />
                          <span>{item.setorRetirada || eq.setor}</span>
                        </span>
                      )}

                      {/* Modalidades que serão aplicadas */}
                      {selectedModalities.map(m => {
                        const isAlready = isEquipmentChecked(eq, m, serviceConfig);
                        const isCal = m === 'calibracao';
                        const isPrev = m === 'preventiva';
                        const isSeg = m === 'seguranca';
                        const isExt = m === 'externa' || m === 'manutencao_externa';

                        const colorClasses = isAlready 
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          : isCal
                          ? 'bg-blue-900/60 text-blue-300 border-blue-700'
                          : isPrev
                          ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                          : isSeg
                          ? 'bg-amber-900/60 text-amber-300 border-amber-700'
                          : 'bg-purple-900/60 text-purple-300 border-purple-700';

                        return (
                          <span
                            key={m}
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${colorClasses}`}
                          >
                            {isAlready ? `✓ ${MODALITIES[m]?.shortName || m} OK` : `+ ${MODALITIES[m]?.shortName || m}`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Bottom Actions Bar (Linha Única Compacta e Eficiente) */}
        <div className="p-2.5 sm:p-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2 shrink-0 safe-area-bottom">
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700/80 active:scale-95 shrink-0"
          >
            Fechar
          </button>

          {stagedItems.length > 0 ? (
            <button
              onClick={handleConfirmBatchCheck}
              className={`flex-1 py-2.5 px-3 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 truncate ${
                isExternalMode
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-400 shadow-purple-600/30'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-600/30'
              }`}
            >
              <CheckCircle className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span className="truncate">
                {isExternalMode
                  ? `Confirmar Manut. Externa (${stagedItems.length} ${stagedItems.length === 1 ? 'bomba' : 'bombas'})`
                  : `Confirmar Calibração Completa (${stagedItems.length} ${stagedItems.length === 1 ? 'bomba' : 'bombas'})`
                }
              </span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 font-medium truncate text-right pr-1">
              {equipments.length} cadastradas • Bipe para listar
            </div>
          )}
        </div>

          </div> {/* Fim do PAINEL DA DIREITA */}

        </div> {/* Fim do CORPO DO LEITOR (flex-col md:flex-row) */}

      </div>
    </div>
  );
}
