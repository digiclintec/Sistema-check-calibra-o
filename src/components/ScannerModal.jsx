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
  MapPin
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';
import { findBestEquipmentMatches } from '../utils/fuzzyMatch';
import { parseCompositeBarcode } from '../utils/gs1Parser';
import { processPhotoTextWithAgent } from '../utils/serialAgent';
import { MODALITIES, isEquipmentChecked } from '../utils/modalities';

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
  activeModality = 'calibracao'
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanning, setScanning] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.5); // Inicia em 1.5x para evitar borrão de macro
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'full_camera'
  const [reticleType, setReticleType] = useState('1d'); // '1d' (Linha Laser) | '2d' (Caixa QR)
  
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

    // Pequeno intervalo de 150ms para o container DOM estar 100% montado e evitar conflito de hardware
    const timer = setTimeout(() => {
      if (isMounted) {
        startScanner(selectedCamera || null);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId, retryCount = 0) => {
    if (isStartingRef.current && retryCount === 0) return;
    isStartingRef.current = true;
    setIsCameraStarting(true);
    setCameraError('');

    await stopScanner();

    // Pausa preventiva de 120ms para liberação completa do hardware da câmera no mobile
    await new Promise(r => setTimeout(r, 120));

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader-box', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Hardware scanner nativo no Android/iOS
        }
      });
      html5QrCodeRef.current = html5QrCode;

      // Tier 1 (retry 0): HD ideal com aspect ratio flexível (evita OverconstrainedError em modo retrato)
      // Tier 2 (retry 1): facingMode simples sem dimensões rígidas
      // Tier 3 (retry 2): fallback permissivo
      let cameraConfig;
      let videoConstraints;

      if (cameraId) {
        cameraConfig = { deviceId: { exact: cameraId } };
        videoConstraints = { deviceId: { exact: cameraId } };
      } else if (retryCount === 0) {
        cameraConfig = { facingMode: "environment" };
        videoConstraints = {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          aspectRatio: { ideal: 1.7777777778 }
        };
      } else if (retryCount === 1) {
        cameraConfig = { facingMode: "environment" };
        videoConstraints = { facingMode: "environment" };
      } else {
        cameraConfig = { facingMode: "environment" };
        videoConstraints = {};
      }

      const config = {
        fps: 25,
        videoConstraints: Object.keys(videoConstraints).length > 0 ? videoConstraints : undefined,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Ampla área horizontal cobrindo 98% da largura útil sem cortar códigos 1D longos
          const width = Math.floor(viewfinderWidth * 0.98);
          const height = Math.floor(Math.min(viewfinderHeight * 0.75, 340));
          return {
            width: Math.max(width, 260),
            height: Math.max(height, 130)
          };
        },
        disableFlip: true,
      };

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

      // Com o scanner já aberto e permissão concedida, lista os dispositivos de forma segura sem conflito
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

      // Inicia loop ultra-rápido de detecção nativa por hardware (Android Chrome / Google ML Kit)
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
          const runNativeLoop = async () => {
            if (!nativeDetectorActiveRef.current) return;
            const videoEl = document.querySelector('#barcode-reader-box video');
            if (videoEl && videoEl.readyState >= 2 && !videoEl.paused) {
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
              } catch (e) {}
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

      // Ativa foco contínuo e zoom 1.5x por padrão para afastar do limite macro
      setTimeout(() => {
        applyHardwareFocus();
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

      // Fallback em cascata suave antes de exibir mensagem de erro
      if (retryCount < 2) {
        console.log(`Tentando fallback de câmera tier ${retryCount + 2} em 250ms...`);
        await new Promise(r => setTimeout(r, 250));
        return startScanner(null, retryCount + 1);
      }

      isStartingRef.current = false;
      setIsCameraStarting(false);
      setScanning(false);
      setCameraError(
        'Não foi possível abrir a câmera traseira diretamente. Verifique as permissões de câmera do navegador ou use o botão "Tirar Foto".'
      );
    }
  };

  const stopScanner = async () => {
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
    setIsCameraStarting(false);
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
        
        // 1. Recalibra o motor de foco automático da lente
        if (caps.focusMode) {
          try {
            // Se aceitar single-shot, alterna para disparar o motor
            if (caps.focusMode.includes('single-shot')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
            }
            if (caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            }
          } catch (e) {}
        }

        // 2. Se o celular aceitar ponto de interesse (ponto tocado na tela)
        if (relX !== undefined && relY !== undefined && caps.pointsOfInterest) {
          try {
            await track.applyConstraints({
              advanced: [{ pointsOfInterest: [{ x: relX, y: relY }] }]
            });
          } catch (e) {}
        }
      }

      // 3. Fallback via Html5Qrcode API
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
        } catch (e) {}
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
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ zoom: nextZoom }]
        });
      }
      const videoEl = document.querySelector('#barcode-reader-box video');
      const track = videoEl?.srcObject?.getVideoTracks()?.[0];
      if (track) {
        await track.applyConstraints({ advanced: [{ zoom: nextZoom }] });
      }
      setZoomLevel(nextZoom);
    } catch (e) {
      console.warn('Erro ao aplicar zoom:', e);
    }
  };

  const cycleZoom = async (e) => {
    e?.stopPropagation();
    const nextZoom = zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : 1;
    await applySpecificZoom(nextZoom);
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

    if (soundEnabled) {
      playSuccessSound();
    }

    // Modo 1: Checagem Imediata (1 a 1)
    const gs1Info = parseCompositeBarcode(cleanCode);
    const detailMsg = gs1Info.serialNumber && gs1Info.serialNumber !== cleanCode
      ? `Série ${gs1Info.serialNumber} isolado do código GS1 • ${targetEq.equipamento} (${targetEq.tag || targetEq.serie})`
      : `${bestMatch.reason} • ${targetEq.equipamento} (IDEC: ${targetEq.tag || 'N/A'} | Série: ${targetEq.serie || 'N/A'})`;

    if (mode === 'instant') {
      if (onScan) {
        onScan(targetEq.id || cleanCode);
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
    
    if (onBatchCheck) {
      await onBatchCheck(itemsPayload, activeModality);
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
                  Leitor com Toque para Focar
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Tap-to-Focus
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Toque na tela para focar em etiquetas embaçadas
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

        {/* Seletor de Comparação no Código (Código Completo / Apenas IDEC / Apenas Série) */}
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-1.5 text-xs shrink-0 overflow-x-auto">
          <span className="text-[10px] sm:text-xs text-slate-400 font-semibold shrink-0">Comparar:</span>
          <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setSearchTarget('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                searchTarget === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Lê todo o código composto e localiza tanto o IDEC quanto a Série"
            >
              <span>🔍 Código Completo</span>
            </button>
            <button
              onClick={() => setSearchTarget('idec')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                searchTarget === 'idec'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compara exclusivamente com o IDEC / Identificação do Equipamento (ex: CCHL-0075)"
            >
              <span>🏷️ Somente IDEC</span>
            </button>
            <button
              onClick={() => setSearchTarget('serie')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                searchTarget === 'serie'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compara exclusivamente com o Número de Série (ex: 2104010003)"
            >
              <span>🔢 Somente Série</span>
            </button>
          </div>
        </div>

        {/* Camera Viewport Area com CLIQUE PARA FOCAR (Tap to Focus) */}
        <div 
          ref={viewfinderRef}
          onClick={handleViewfinderClick}
          className={`relative bg-black flex flex-col items-center justify-center transition-all duration-200 overflow-hidden cursor-crosshair select-none ${
            viewMode === 'full_camera' 
              ? 'flex-1 min-h-[60vh]' 
              : 'h-[42vh] sm:h-[48vh]'
          }`}
          title="Toque em qualquer ponto da imagem para focar"
        >
          
          {/* Caixa do Html5Qrcode com preenchimento total */}
          <div 
            id="barcode-reader-box" 
            className="w-full h-full flex items-center justify-center pointer-events-none [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          ></div>

          {/* Mira Laser Ampla de Enquadramento */}
          {scanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
              {reticleType === '1d' ? (
                // Mira 1D: Ampla e horizontal ideal para bombas de infusão (Code 128 / GS1)
                <div className="relative w-[96%] max-w-[480px] h-[120px] sm:h-[140px] border-2 border-dashed border-red-500/80 rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.35)] flex items-center justify-center">
                  {/* Linha Laser Vermelha Horizontal Contínua e Brilhante */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-300 to-red-600 shadow-[0_0_14px_#ef4444] animate-pulse"></div>
                  
                  {/* Marcadores de Canto Vermelhos */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg"></div>

                  {/* Dica da Linha Laser no rodapé da mira */}
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/95 bg-slate-900/95 px-3 py-0.5 rounded-full border border-red-500/40 shadow-md flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-red-400" />
                    <span>Alinhe o laser vermelho sobre todo o código de barras</span>
                  </div>
                </div>
              ) : (
                // Mira 2D: Caixa quadrada para QR Code / DataMatrix
                <div className="relative w-full max-w-[280px] h-[260px] border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.35)]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-500 shadow-[0_0_12px_#3b82f6] animate-[bounce_2s_infinite]"></div>
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/95 bg-slate-900/90 px-3 py-0.5 rounded-full border border-slate-700/80 shadow-md flex items-center gap-1.5">
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
              style={{ left: focusRing.x, top: focusRing.y, width: 72, height: 72 }}
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="bg-slate-950/90 text-white border border-slate-700/80 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>{focusFeedbackText}</span>
              </div>
            </div>
          )}

          {/* Barra Superior de Controles na Câmera: Alternador 1D/2D à Esquerda */}
          <div className="absolute top-3 left-3 z-20" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setReticleType(r => r === '1d' ? '2d' : '1d')}
              className={`px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-lg transition active:scale-95 ${
                reticleType === '1d'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}
              title="Alternar entre mira para Código de Barras e mira para QR Code"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>{reticleType === '1d' ? '1D Barras (Laser)' : '2D QR Code'}</span>
            </button>
          </div>

          {/* Botões Flutuantes Rápidos à Direita (Focar, Seletor de Zoom 1x/1.5x/2x e Lanterna) */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            
            {/* Seletor Rápido de Zoom (Evita borrão macro) */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-full border border-slate-700/80 shadow-lg">
              {[1, 1.5, 2].map((z) => (
                <button
                  key={z}
                  onClick={() => applySpecificZoom(z)}
                  className={`px-2 py-1 rounded-full text-[11px] font-bold transition ${
                    zoomLevel === z
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Zoom ${z}x`}
                >
                  {z}x
                </button>
              ))}
            </div>

            {/* Botão Dedicado de Focar */}
            <button
              onClick={handleTriggerCenterFocus}
              className="p-2 rounded-full bg-slate-900/85 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1 border border-amber-500/40 shadow-lg transition active:scale-95"
              title="Focar câmera agora"
            >
              <Crosshair className="w-4 h-4 text-amber-400" />
            </button>

            {/* Lanterna */}
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition border ${
                  torchOn 
                    ? 'bg-amber-400 text-slate-950 font-bold border-amber-300' 
                    : 'bg-slate-900/85 text-white hover:bg-slate-800 border-slate-700/80'
                }`}
                title="Ligar Lanterna"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dica de Foco no rodapé da câmera */}
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none text-center">
            <span className="text-[10px] text-white/70 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
              💡 Imagem embaçada? Toque na tela ou use o botão <strong>1.5x/2x</strong> afastando o celular a 20cm
            </span>
          </div>

          {/* Indicador de Inicialização Suave da Câmera */}
          {isCameraStarting && !scanning && !cameraError && (
            <div className="absolute inset-0 z-15 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 space-y-3 animate-in fade-in duration-150">
              <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-white font-bold text-sm">Iniciando câmera traseira...</p>
              <p className="text-slate-400 text-xs">Calibrando lente e foco automático</p>
            </div>
          )}

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

          {/* Barra de Seleção / Alteração do Setor de Retirada do Lote */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 mb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
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
            <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Layers className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
              <p className="text-xs font-semibold text-slate-400">Nenhum equipamento na fila ainda</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Defina o setor acima (ex: <strong>UTIN</strong>) e aponte a câmera para as bombas. Se alguma for de outro setor, você pode alterar diretamente no card dela!
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {stagedItems.map((item, idx) => {
                const eq = item.equipment;
                const match = item.match;
                const isAlreadyChecked = isEquipmentChecked(eq, activeModality);
                const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;

                return (
                  <div
                    key={`${eq.id}-${idx}`}
                    className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-2xl flex flex-col gap-2 transition"
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

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                            {eq.serie && (
                              <span>Série: <span className="font-mono text-slate-300">{eq.serie}</span></span>
                            )}
                            {eq.setor && (
                              <span>• Setor Cadastrado: <span className="text-slate-300">{eq.setor}</span></span>
                            )}
                            {isAlreadyChecked && (
                              <span className="text-amber-400 font-bold">• Já possui {currentMod.shortName} conferida</span>
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
