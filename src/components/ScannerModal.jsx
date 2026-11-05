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
  SwitchCamera
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';
import { findBestEquipmentMatches } from '../utils/fuzzyMatch';
import { parseCompositeBarcode } from '../utils/gs1Parser';
import { processPhotoTextWithAgent } from '../utils/serialAgent';
import { MODALITIES, isEquipmentChecked, getCheckMeta } from '../utils/modalities';

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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'full_camera'
  const [reticleType, setReticleType] = useState('1d'); // '1d' (Linha Laser) | '2d' (Caixa QR)
  
  // Helper para identificar lente ultra-wide (0.5x)
  const isUltraWideLens = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('ultra') || l.includes('super') || l.includes('0.5') || l.includes('0,5') || l.includes('ultrawide');
  };

  const isTelephotoLens = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('tele') || l.includes('zoom') || l.includes('2x') || l.includes('3x') || l.includes('5x');
  };

  const isFrontCamera = (label) => {
    const l = (label || '').toLowerCase();
    return l.includes('front') || l.includes('user') || l.includes('frontal') || l.includes('selfie') || l.includes('facing front');
  };

  // Rótulos inteligentes e amigáveis para cada lente de hardware do aparelho
  const getFriendlyCameraLabel = (camera, index, total) => {
    if (!camera) return `Lente ${index + 1}`;
    const raw = (camera.label || '').toLowerCase();
    
    if (isFrontCamera(raw)) {
      return `🤳 Lente Frontal (${index + 1})`;
    }
    if (isUltraWideLens(raw)) {
      return `📐 Ultra-Wide 0.5x (${index + 1}) [Embaça de perto]`;
    }
    if (isTelephotoLens(raw)) {
      return `🔭 Telefoto Óptica (${index + 1})`;
    }
    if (raw.includes('macro') || raw.includes('depth')) {
      return `🔍 Macro (${index + 1})`;
    }
    if (index === 0) {
      return `📷 Câmera Principal 1x (${index + 1} - Nítida)`;
    }
    return `📷 Lente ${index + 1} (Traseira)`;
  };

  const getShortLensName = (camera, index) => {
    if (!camera) return `Lente ${index + 1}`;
    const raw = (camera.label || '').toLowerCase();
    if (isFrontCamera(raw)) return '🤳 Frontal';
    if (isUltraWideLens(raw)) return '📐 0.5x';
    if (isTelephotoLens(raw)) return '🔭 2x';
    if (raw.includes('macro')) return '🔍 Macro';
    if (index === 0) return '📷 1x Principal';
    return `📷 Lente ${index + 1}`;
  };

  const currentLensShortLabel = useMemo(() => {
    if (!cameras || cameras.length === 0) return 'Lente Traseira';
    const idx = cameras.findIndex(c => c.id === selectedCamera);
    if (idx < 0) return 'Lente 1 (1x)';
    return getShortLensName(cameras[idx], idx);
  }, [cameras, selectedCamera]);

  // Modalidades ativas selecionadas para bipar (ex: ['calibracao'], ['preventiva'], ou ['calibracao', 'preventiva'])
  const [selectedModalities, setSelectedModalities] = useState(() => {
    if (activeModality && activeModality !== 'geral') {
      return [activeModality];
    }
    return ['calibracao'];
  });

  // Sincroniza se a modalidade mudar pelo componente pai
  useEffect(() => {
    if (activeModality && activeModality !== 'geral') {
      setSelectedModalities([activeModality]);
    }
  }, [activeModality]);

  // Altura customizável e arrastável: Câmera vs Lista de Bombas
  // cameraHeightPercent: Porcentagem da altura central dedicada à Câmera (default 48% para visão ampla no celular)
  const [cameraHeightPercent, setCameraHeightPercent] = useState(48);
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

  // Inicializa câmera ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setCameraError('');
    setLastScannedFeedback(null);
    setFocusRing({ x: 0, y: 0, visible: false, status: 'idle' });
    setZoomLevel(1);

    // Descobre as câmeras disponíveis e prioriza a lente principal traseira (1x)
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);

          // 1. Verifica se há uma lente preferida salva pelo técnico anteriormente
          let preferredId = null;
          try {
            preferredId = localStorage.getItem('calibracheck_preferred_camera');
          } catch (e) {}

          if (preferredId && devices.some(d => d.id === preferredId)) {
            setSelectedCamera(preferredId);
            startScanner(preferredId);
            return;
          }

          // 2. Procura câmera traseira principal (evitando explicitamente ultrawide ou macro)
          const backCameras = devices.filter(d => {
            const label = (d.label || '').toLowerCase();
            return label.includes('back') || 
                   label.includes('traseira') ||
                   label.includes('rear') ||
                   label.includes('environment') ||
                   label.includes('0, facing back');
          });

          // Filtra preferencialmente a principal (sem ultra-wide 0.5x, macro ou depth)
          // OBS: A câmera 1x padrão chama-se 'wide-angle', NÃO deve ser excluída!
          const cleanBackCam = backCameras.find(d => {
            const label = (d.label || '').toLowerCase();
            return !isUltraWideLens(label) && !label.includes('macro') && !label.includes('depth');
          }) || backCameras[0] || devices[0];

          if (cleanBackCam) {
            setSelectedCamera(cleanBackCam.id);
            startScanner(cleanBackCam.id);
            return;
          }
        }
        startScanner(null);
      })
      .catch((err) => {
        console.warn('Erro ao listar câmeras, iniciando modo automático:', err);
        if (isMounted) {
          startScanner(null);
        }
      });

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

    // Pausa preventiva de 100ms para liberação completa do hardware da câmera no mobile
    await new Promise(r => setTimeout(r, 100));

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

      // Restrições de vídeo: Garantem troca física de lente (deviceId exato) sem restrições 'min' que causam erro no modo retrato
      let videoConstraints;
      if (cameraId) {
        if (retryCount === 0) {
          // Tier 0: Lente física EXATA com resolução Full HD 1080p ideal
          videoConstraints = {
            deviceId: { exact: cameraId },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          };
        } else if (retryCount === 1) {
          // Tier 1: Lente física EXATA com 720p ideal
          videoConstraints = {
            deviceId: { exact: cameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };
        } else if (retryCount === 2) {
          // Tier 2: Lente física EXATA pura sem restrição de dimensão
          videoConstraints = {
            deviceId: { exact: cameraId }
          };
        } else {
          // Tier 3: deviceId ideal
          videoConstraints = {
            deviceId: { ideal: cameraId }
          };
        }
      } else {
        if (retryCount === 0) {
          videoConstraints = {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          };
        } else if (retryCount === 1) {
          videoConstraints = {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };
        } else {
          videoConstraints = {
            facingMode: "environment"
          };
        }
      }

      const config = {
        fps: 30, // 30 FPS para leitura instantânea e sem lag
        videoConstraints: Object.keys(videoConstraints).length > 0 ? videoConstraints : undefined,
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

      // html5QrCode.start aceita cameraId como string simples OU objeto de constraints
      const cameraConfig = cameraId ? cameraId : { facingMode: "environment" };

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

      // Atualiza lista de câmeras conectadas caso ainda não carregadas
      if (navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices()
          .then((devices) => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            if (videoDevices.length > 0) {
              setCameras(videoDevices);
            }
          })
          .catch(() => {});
      }

      // Inicia loop ultra-rápido de detecção nativa por hardware (Android Chrome / Google ML Kit) com trava de concorrência
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
                  const barcodes = await nativeDetector.detect(videoEl);
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

      // Ativa foco contínuo e zoom 1.5x automático para foco perfeito em códigos de barras de bombas
      setTimeout(() => {
        setupTrackFocusAndQuality();
        applyHardwareFocus(0.5, 0.5);
        applySpecificZoom(1.5);
      }, 400);

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

      // Fallback em cascata inteligente mantendo a lente física selecionada
      if (retryCount < 3 && cameraId) {
        const delay = (retryCount + 1) * 180;
        console.log(`Tentando fallback tier ${retryCount + 2} para lente física ${cameraId}...`);
        await new Promise(r => setTimeout(r, delay));
        return startScanner(cameraId, retryCount + 1);
      } else if (retryCount < 4) {
        const delay = 250;
        console.log(`Tentando fallback geral tier ${retryCount + 2}...`);
        await new Promise(r => setTimeout(r, delay));
        return startScanner(null, 4);
      }

      isStartingRef.current = false;
      setIsCameraStarting(false);
      setScanning(false);
      setCameraError(
        'Não foi possível abrir a câmera selecionada. Tente alternar para outra lente ou usar o botão "Tirar Foto".'
      );
    }
  };

  // Calibração e ativação do Autofoco Contínuo e Exposição na trilha ativa
  const setupTrackFocusAndQuality = async () => {
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      if (!track) return;

      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const settings = track.getSettings ? track.getSettings() : {};
      console.log('[Camera] Resolução ativa:', settings.width, 'x', settings.height, 'Capabilities:', caps);

      const advanced = [];

      // 1. Autofoco contínuo no hardware
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

      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
          console.log('[Camera] Autofoco contínuo e exposição calibrados.');
        } catch (e) {
          console.warn('[Camera] Falha ao aplicar constraints avançadas no track:', e);
        }
      }

      // 4. Reaplica zoom se estiver ativo
      if (zoomLevel > 1) {
        applySpecificZoom(zoomLevel);
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

  // Função central para forçar o foco de hardware da câmera
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

        // 2. Dispara ciclo de foco no motor da lente
        if (caps.focusMode) {
          try {
            if (caps.focusMode.includes('single-shot')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
              setTimeout(async () => {
                try {
                  if (caps.focusMode.includes('continuous')) {
                    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
                  }
                } catch (e) {}
              }, 400);
            } else if (caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
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

  const applySpecificZoom = async (nextZoom) => {
    setZoomLevel(nextZoom);
    try {
      const videoEl = document.querySelector('#barcode-reader-box video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};
      
      let hardwareZoomApplied = false;
      if (track && caps.zoom) {
        try {
          const minZ = caps.zoom.min || 1;
          const maxZ = caps.zoom.max || 8;
          const clampedZoom = Math.min(Math.max(nextZoom, minZ), maxZ);
          await track.applyConstraints({ advanced: [{ zoom: clampedZoom }] });
          hardwareZoomApplied = true;
        } catch (e) {
          console.warn('Erro ao aplicar zoom no hardware track:', e);
        }
      }

      // Fallback para zoom digital CSS cristalino no vídeo Full HD (garante zoom em qualquer smartphone)
      if (videoEl) {
        if (!hardwareZoomApplied && nextZoom > 1) {
          videoEl.style.transform = `scale(${nextZoom})`;
          videoEl.style.transformOrigin = 'center center';
          videoEl.style.transition = 'transform 0.2s ease';
        } else {
          videoEl.style.transform = 'none';
        }
      }

      setFocusFeedbackText(`Zoom ${nextZoom}x`);
      setTimeout(() => setFocusFeedbackText(''), 1500);
    } catch (e) {
      console.warn('Erro ao aplicar zoom:', e);
    }
  };

  const cycleZoom = async (e) => {
    e?.stopPropagation();
    const nextZoom = zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : 1;
    await applySpecificZoom(nextZoom);
  };

  const handleCameraChange = async (camId) => {
    if (!camId || isStartingRef.current) return;
    setSelectedCamera(camId);
    if (camId) {
      try {
        localStorage.setItem('calibracheck_preferred_camera', camId);
      } catch (e) {}
    }
    const idx = cameras.findIndex(c => c.id === camId);
    const friendly = idx >= 0 ? getFriendlyCameraLabel(cameras[idx], idx, cameras.length) : 'Lente Selecionada';
    
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch (e) {}

    setFocusFeedbackText(`🔄 Trocando para: ${friendly}...`);

    // Para completamente a câmera anterior e libera a trilha de hardware
    await stopScanner(true);
    setZoomLevel(1);
    const videoEl = document.querySelector('#barcode-reader-box video');
    if (videoEl) {
      videoEl.style.transform = 'none';
    }

    // Intervalo de segurança (200ms) para o driver do Android/iOS liberar a lente anterior
    await new Promise(r => setTimeout(r, 200));

    // Inicia a nova câmera física escolhida
    await startScanner(camId);
    setFocusFeedbackText(`✓ ${friendly}`);
    setTimeout(() => setFocusFeedbackText(''), 2500);
  };

  const handleCycleCamera = () => {
    if (!cameras || cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    if (nextCam) {
      handleCameraChange(nextCam.id);
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

    // SEGURANÇA INTELIGENTE: Bloqueia se TODAS as modalidades selecionadas já estiverem concluídas!
    const effectiveMods = selectedModalities.length > 0 ? selectedModalities : ['calibracao'];
    const uncompletedMods = effectiveMods.filter(m => !isEquipmentChecked(targetEq, m, serviceConfig));
    const isAlreadyCheckedAll = uncompletedMods.length === 0;
    const modLabels = effectiveMods.map(m => MODALITIES[m]?.shortName || m).join(' + ');

    if (isAlreadyCheckedAll) {
      if (soundEnabled) {
        playWarningSound();
      }
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

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
    
    const effectiveMods = selectedModalities.length > 0 ? selectedModalities : ['calibracao'];

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

  // Leitura ultra-inteligente a partir de foto/galeria (Código de Barras + OCR Automático)
  const handlePhotoScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLastScannedFeedback({
      status: 'analyzing',
      code: 'Foto',
      message: 'Analisando imagem (tentando Código de Barras e leitura de Número de Série)...',
      timestamp: new Date().toLocaleTimeString('pt-BR')
    });

    try {
      // 1. Tenta decodificar código de barras 1D/2D
      let decodedBarcode = null;

      // 1a. Tenta leitor Html5Qrcode / ZXing
      try {
        const scanner = html5QrCodeRef.current || new Html5Qrcode('barcode-reader-box', {
          formatsToSupport: SUPPORTED_FORMATS
        });
        decodedBarcode = await scanner.scanFile(file, true);
      } catch (barcodeErr) {
        // 1b. Se falhar ZXing, tenta BarcodeDetector nativo no ImageBitmap
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const bmp = await createImageBitmap(file);
            const nativeDetector = new window.BarcodeDetector({
              formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'qr_code', 'data_matrix']
            });
            const detected = await nativeDetector.detect(bmp);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              decodedBarcode = detected[0].rawValue;
            }
          } catch (e) {}
        }
      }

      if (decodedBarcode) {
        handleDecoded(decodedBarcode);
        e.target.value = '';
        return;
      }

      // 2. Fallback Inteligente: Se as barrinhas estiverem com reflexo, executa o Agente OCR
      setLastScannedFeedback({
        status: 'analyzing',
        code: 'OCR',
        message: 'Decodificando texto impresso [SN] / [REF] / IDEC da etiqueta...',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      // Cria imagem otimizada em canvas com contraste aprimorado
      const optimizedDataUrl = await new Promise((resolve) => {
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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(url);
        img.src = url;
      });

      let ocrText = '';
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

      if (ocrText) {
        const agentResult = processPhotoTextWithAgent(ocrText, equipments);
        if (agentResult.matchedEquipments.length > 0) {
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
        code: 'Foto',
        message: 'Nenhum código de barras ou número de série legível foi identificado na foto. Tente tirar a foto mais próxima da etiqueta da bomba.',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

    } catch (err) {
      console.error('Erro ao ler foto:', err);
      if (soundEnabled) playErrorSound();
      setLastScannedFeedback({
        status: 'not_found',
        code: 'Foto',
        message: `Falha ao ler foto: ${err.message}`,
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
        className="bg-slate-900 border border-slate-800 w-full h-full sm:h-[94vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col select-none"
      >
        
        {/* Top Header */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0 safe-area-top">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-base font-bold text-white leading-tight">
                  Leitor de Alta Performance (1080p)
                </h3>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden xs:flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Ao Vivo 30fps
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Toque na tela para focar • Arraste o divisor para aumentar a lista
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <button
              onClick={() => {
                if (viewMode === 'full_camera') {
                  setViewMode('split');
                  setCameraHeightPercent(38);
                } else {
                  setViewMode('full_camera');
                  setCameraHeightPercent(70);
                }
              }}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title={viewMode === 'full_camera' ? "Dividir tela com a lista" : "Expandir câmera"}
            >
              {viewMode === 'full_camera' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Fechar leitor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================
            SELETOR EXATO DE TIPOS A BIPAR (Calibração, Preventiva, TSE ou Ambos)
        ============================================================ */}
        <div className="px-3 py-2 bg-slate-950 border-b border-slate-800/80 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between text-xs flex-wrap gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Bipar para:</span>
            </span>

            {/* Presets Rápidos */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => handleSetExactModalities(['calibracao'])}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                  selectedModalities.length === 1 && selectedModalities.includes('calibracao')
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Bipar exclusivamente Calibração Metrológica"
              >
                <span>🎯 Somente Calibração</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetExactModalities(['preventiva'])}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                  selectedModalities.length === 1 && selectedModalities.includes('preventiva')
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Bipar exclusivamente Manutenção Preventiva"
              >
                <span>🔧 Somente Preventiva</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetExactModalities(['calibracao', 'preventiva'])}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                  selectedModalities.length === 2 && selectedModalities.includes('calibracao') && selectedModalities.includes('preventiva')
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-sm ring-1 ring-teal-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Bipar Calibração + Preventiva juntas no mesmo bip"
              >
                <span>🎯+🔧 Calibração + Prev</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetExactModalities(['calibracao', 'preventiva', 'seguranca'])}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                  selectedModalities.length === 3 && !selectedModalities.includes('externa')
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="Bipar todos os 3 serviços de uma vez só"
              >
                <span>📋 Todos (3)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetExactModalities(['externa'])}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                  selectedModalities.length === 1 && selectedModalities.includes('externa')
                    ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                    : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-800/80'
                }`}
                title="Bipar como Manutenção Externa (calibração e conserto por equipe terceirizada)"
              >
                <span>📦 Manutenção Externa</span>
              </button>
            </div>
          </div>

          {/* Chips / Toggles Individuais */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => handleToggleModality('calibracao')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition border shrink-0 ${
                selectedModalities.includes('calibracao')
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-xs'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                selectedModalities.includes('calibracao') ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-700 bg-slate-950'
              }`}>
                {selectedModalities.includes('calibracao') ? '✓' : ''}
              </div>
              <span>🎯 Calibração</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleModality('preventiva')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition border shrink-0 ${
                selectedModalities.includes('preventiva')
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                selectedModalities.includes('preventiva') ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-slate-700 bg-slate-950'
              }`}>
                {selectedModalities.includes('preventiva') ? '✓' : ''}
              </div>
              <span>🔧 Preventiva</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleModality('seguranca')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition border shrink-0 ${
                selectedModalities.includes('seguranca')
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                selectedModalities.includes('seguranca') ? 'bg-amber-600 border-amber-400 text-white' : 'border-slate-700 bg-slate-950'
              }`}>
                {selectedModalities.includes('seguranca') ? '✓' : ''}
              </div>
              <span>⚡ Seg. Elétrica</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleModality('externa')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition border shrink-0 ${
                selectedModalities.includes('externa')
                  ? 'bg-purple-600/25 text-purple-300 border-purple-500/60 shadow-xs ring-1 ring-purple-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-purple-300'
              }`}
              title="Equipamento para envio à manutenção externa terceirizada"
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                selectedModalities.includes('externa') ? 'bg-purple-600 border-purple-400 text-white' : 'border-slate-700 bg-slate-950'
              }`}>
                {selectedModalities.includes('externa') ? '✓' : ''}
              </div>
              <span>📦 Manut. Externa</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tab (Fila em Lote vs Check Imediato) + Comparar */}
        <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 flex-wrap gap-1.5">
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setMode('batch')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-[11px] ${
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
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-[11px] ${
                mode === 'instant' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Check 1 a 1</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[10px]">
              <button
                onClick={() => setSearchTarget('all')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  searchTarget === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Lê todo o código composto (IDEC ou Série)"
              >
                🔍 Auto
              </button>
              <button
                onClick={() => setSearchTarget('idec')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  searchTarget === 'idec' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Compara somente IDEC / Tag"
              >
                🏷️ IDEC
              </button>
              <button
                onClick={() => setSearchTarget('serie')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  searchTarget === 'serie' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Compara somente Nº de Série"
              >
                🔢 Série
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800 text-[11px] flex items-center gap-1 font-semibold transition shrink-0"
              title="Ler código a partir de foto"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Foto</span>
            </button>
          </div>
        </div>

        {/* Camera Viewport Area com CLIQUE PARA FOCAR (Tap to Focus) */}
        <div 
          ref={viewfinderRef}
          onClick={handleViewfinderClick}
          style={{
            height: viewMode === 'full_camera' ? '70%' : `${cameraHeightPercent}%`,
            minHeight: '180px'
          }}
          className="relative bg-black flex flex-col items-center justify-center transition-[height] duration-150 overflow-hidden cursor-crosshair select-none shrink-0"
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

          {/* Barra Superior de Controles na Câmera: Alternador 1D/2D e Troca Rápida de Lente */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {/* Alternador 1D/2D */}
            <button
              type="button"
              onClick={() => setReticleType(r => r === '1d' ? '2d' : '1d')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border shadow-lg transition active:scale-95 ${
                reticleType === '1d'
                  ? 'bg-red-500/25 text-red-200 border-red-500/50 shadow-red-500/20'
                  : 'bg-blue-500/25 text-blue-200 border-blue-500/50 shadow-blue-500/20'
              }`}
              title="Alternar entre mira para Código de Barras (1D) e mira para QR Code (2D)"
            >
              <ScanLine className="w-3 h-3" />
              <span>{reticleType === '1d' ? '1D Laser' : '2D QR'}</span>
            </button>

            {/* Botão de Troca Rápida de Lente Física */}
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleCycleCamera}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg transition active:scale-95"
                title="Toque para alternar para a próxima lente física da câmera"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-blue-400" />
                <span className="max-w-[120px] truncate">{currentLensShortLabel}</span>
              </button>
            )}
          </div>

          {/* Botões Flutuantes Rápidos à Direita: Zoom, Focar e Lanterna */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {/* Seletor Rápido de Zoom */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-full border border-slate-700/80 shadow-lg">
              {[1, 1.5, 2].map((z) => (
                <button
                  key={z}
                  onClick={() => applySpecificZoom(z)}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                    zoomLevel === z
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Zoom ${z}x ${z === 1.5 ? '(Ideal para Bombas de Infusão)' : ''}`}
                >
                  {z}x
                </button>
              ))}
            </div>

            {/* Botão Dedicado de Focar (Dispara Autofoco de Hardware) */}
            <button
              onClick={handleTriggerCenterFocus}
              className="p-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1 border border-amber-500/40 shadow-lg transition active:scale-95"
              title="Focar câmera agora (Recalibrar foco de hardware)"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            </button>

            {/* Lanterna */}
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-1.5 rounded-full flex items-center justify-center shadow-lg transition border ${
                  torchOn 
                    ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 ring-2 ring-amber-400/50 shadow-amber-400/30' 
                    : 'bg-slate-900/85 text-white hover:bg-slate-800 border-slate-700/80'
                }`}
                title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dica de Foco Prático para o Técnico */}
          {scanning && !cameraError && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap">
              <div className="bg-slate-950/80 backdrop-blur-md text-slate-300 border border-slate-800 px-2.5 py-0.5 rounded-full text-[10px] font-medium shadow-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span>Afaste a 15-25cm da bomba para o foco agir • Toque na tela para focar</span>
              </div>
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

        {/* ============================================================
            DIVISOR ARRASTÁVEL E REDIMENSIONADOR (CÂMERA vs LISTA DE BOMBAS)
        ============================================================ */}
        <div
          onMouseDown={handleDividerMouseDown}
          onTouchStart={handleDividerTouchStart}
          className={`w-full py-2 px-3 bg-slate-950 border-y border-slate-800 cursor-row-resize flex items-center justify-between select-none touch-none shrink-0 transition-colors ${
            isDraggingDivider 
              ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30' 
              : 'hover:bg-slate-900'
          }`}
          title="Arraste para cima ou para baixo para aumentar/diminuir o tamanho da lista de bombas"
        >
          {/* Alça tátil de puxar */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center justify-center gap-0.5 cursor-row-resize">
              <div className="w-10 h-1 bg-slate-500 hover:bg-slate-300 rounded-full transition" />
              <div className="w-6 h-0.5 bg-slate-600 rounded-full" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <GripHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Arraste para redimensionar lista</span>
            </span>
          </div>

          {/* Atalhos Rápidos de Tamanho (1 Toque) */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setCameraHeightPercent(22)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                cameraHeightPercent <= 26 
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400' 
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Expandir lista para quase tela cheia (75% da altura)"
            >
              📋 Lista 75%
            </button>
            <button
              type="button"
              onClick={() => setCameraHeightPercent(38)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                cameraHeightPercent > 26 && cameraHeightPercent < 55 
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400' 
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Dividir meio a meio (50% câmera / 50% lista)"
            >
              ⚖️ 50/50
            </button>
            <button
              type="button"
              onClick={() => setCameraHeightPercent(60)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                cameraHeightPercent >= 55 
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400' 
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Câmera grande (60% câmera / 40% lista)"
            >
              📷 Câmera 60%
            </button>
          </div>
        </div>

        {/* Banner do Último Item Bipado com Indicador de Similaridade e Alerta de Já Conferido */}
        {lastScannedFeedback && (
          <div className={`px-3.5 py-2 border-b shrink-0 text-xs transition-all ${
            lastScannedFeedback.status === 'not_found'
              ? 'bg-red-500/15 border-red-500/30 text-red-200'
              : lastScannedFeedback.status === 'already_checked'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-100 ring-1 ring-amber-500/30'
              : lastScannedFeedback.status === 'already_staged'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                {lastScannedFeedback.status === 'not_found' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                ) : lastScannedFeedback.status === 'already_checked' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                
                <div className="truncate">
                  <div className="flex items-center gap-1.5 font-bold truncate">
                    <span className="truncate">
                      {lastScannedFeedback.equipment ? lastScannedFeedback.equipment.equipamento : 'Código Lido'}
                    </span>
                    {lastScannedFeedback.status === 'already_checked' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/30 text-amber-200 border border-amber-500/40 shrink-0">
                        JÁ CONFERIDA
                      </span>
                    ) : lastScannedFeedback.match ? (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold shrink-0 ${
                        lastScannedFeedback.match.isExact 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {lastScannedFeedback.match.confidence}% Similar
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] opacity-90 truncate">
                    {lastScannedFeedback.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {lastScannedFeedback.status === 'already_checked' && lastScannedFeedback.equipment && (
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
                      setLastScannedFeedback(prev => ({
                        ...prev,
                        status: 'staged',
                        message: `Forçada inclusão na fila: ${eq.equipamento} (${eq.tag || eq.serie})`
                      }));
                    }}
                    className="px-2 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 text-[10px] font-bold transition"
                    title="Forçar recalibração mesmo já conferida"
                  >
                    Forçar Inclusão
                  </button>
                )}

                <span className="text-[10px] font-mono opacity-70">
                  {lastScannedFeedback.timestamp}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            SEÇÃO DA FILA DE EQUIPAMENTOS BIPADOS (STAGED LIST)
            Altura flexível e garantida com scroll suave
        ============================================================ */}
        <div className="flex-1 overflow-y-auto bg-slate-950/50 p-3 sm:p-4 min-h-[140px] flex flex-col">
          
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Fila de Conferência ({stagedItems.length} {stagedItems.length === 1 ? 'bomba' : 'bombas'})
              </h4>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                {selectedModalities.map(m => MODALITIES[m]?.shortName || m).join(' + ')}
              </span>
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

          {/* Barra de Seleção / Alteração do Setor de Retirada do Lote */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 mb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 shadow-sm">
            <div className="flex items-center gap-1.5 shrink-0 text-slate-300 font-bold text-xs">
              <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Setor de Retirada do Lote:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <input
                type="text"
                list="scanner-sector-suggestions"
                value={batchSector}
                onChange={(e) => setBatchSector(e.target.value)}
                placeholder="Ex: UTIN, Centro Cirúrgico, UTI..."
                className="bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 flex-1 focus:outline-none"
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
                  className="px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-xl text-[11px] font-bold shrink-0 transition"
                  title="Aplicar este setor a todas as bombas que já foram bipadas na fila"
                >
                  Aplicar a todas
                </button>
              )}
            </div>
          </div>

          {stagedItems.length === 0 ? (
            <div className="flex-1 min-h-[140px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Layers className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
              <p className="text-xs font-semibold text-slate-400">Nenhum equipamento na fila ainda</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                Aponte a câmera para os códigos de barras das bombas. Cada bomba bipada aparecerá aqui nesta lista. Quando terminar o lote, basta clicar em <strong>Confirmar Check</strong> abaixo!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1 pb-2">
              {stagedItems.map((item, idx) => {
                const eq = item.equipment;
                const match = item.match;

                return (
                  <div
                    key={`${eq.id}-${idx}`}
                    className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded-2xl flex flex-col gap-2 transition shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
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

                            {/* Badge de Similaridade */}
                            {match && (
                              <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                                match.isExact 
                                  ? 'bg-emerald-500/20 text-emerald-300' 
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {match.isExact ? '100% Exato' : `${match.matchingDigits} dígitos (${match.confidence}%)`}
                              </span>
                            )}

                            {/* Badges de Serviços que serão aplicados */}
                            {selectedModalities.map(m => {
                              const isAlready = isEquipmentChecked(eq, m, serviceConfig);
                              return (
                                <span
                                  key={m}
                                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                                    isAlready 
                                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                      : m === 'calibracao'
                                      ? 'bg-blue-900/60 text-blue-300 border-blue-700'
                                      : m === 'preventiva'
                                      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                                      : m === 'externa'
                                      ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                                      : 'bg-amber-900/60 text-amber-300 border-amber-700'
                                  }`}
                                >
                                  {isAlready ? `✓ ${MODALITIES[m]?.shortName || m} OK` : `+ ${MODALITIES[m]?.shortName || m}`}
                                </span>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                            {eq.serie && (
                              <span>Série: <span className="font-mono text-slate-300">{eq.serie}</span></span>
                            )}
                            {eq.setor && (
                              <span>• Setor Original: <span className="text-slate-300">{eq.setor}</span></span>
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

                    {/* Setor de Retirada Individual desta Bomba dentro do Lote */}
                    <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between gap-2 text-xs flex-wrap">
                      <div className="flex items-center gap-1 text-[11px] text-teal-300 font-semibold shrink-0">
                        <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                        <span>Retirado de:</span>
                      </div>
                      <div className="flex-1 min-w-[170px] max-w-[260px]">
                        <input
                          type="text"
                          list="scanner-sector-suggestions"
                          value={item.setorRetirada || ''}
                          onChange={(e) => handleUpdateItemSector(eq.id, e.target.value)}
                          placeholder={eq.setor || "Informar setor..."}
                          className="w-full bg-slate-950/90 border border-teal-500/40 focus:border-teal-400 rounded-lg px-2 py-0.5 text-xs text-teal-200 font-bold focus:outline-none placeholder-slate-500"
                        />
                      </div>
                    </div>
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
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              <span>
                Confirmar [{selectedModalities.map(m => MODALITIES[m]?.shortName || m).join(' + ')}] em Todas ({stagedItems.length} {stagedItems.length === 1 ? 'bomba' : 'bombas'})
              </span>
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
                {cameras.map((c, idx) => (
                  <option key={c.id} value={c.id}>{getFriendlyCameraLabel(c, idx, cameras.length)}</option>
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
