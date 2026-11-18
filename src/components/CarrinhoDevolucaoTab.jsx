import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Layers, 
  RotateCcw, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Check, 
  QrCode,
  Tag,
  Hash,
  Filter,
  PackageCheck,
  AlertCircle,
  Trash2,
  Copy,
  ListOrdered,
  LayoutList,
  Grid,
  Share2,
  ScanLine,
  RefreshCw,
  Plus,
  SwitchCamera,
  Zap,
  Crosshair,
  ZoomIn,
  Pencil,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playSuccessSound, playBatchConfirmSound, triggerHapticAlert } from '../utils/audio';
import { getSectorColor, getEffectiveSector, getSectorBadgeStyles } from '../utils/sectorColors';
import { isNativeAndroidApp } from '../utils/nativeBarcodeScanner';
import { extractCleanSerialNumber } from '../utils/gs1Parser';

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

// Helpers para identificar lentes físicas do aparelho (Mesma regra da bipagem principal)
const isUltraWideLens = (label) => {
  const l = (label || '').toLowerCase();
  return l.includes('ultra') || l.includes('super') || l.includes('0.5') || l.includes('0,5') || l.includes('ultrawide') || l.includes('wide-angle');
};

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

// Algoritmo padronizado de seleção da Câmera Principal Traseira (Samsung, Motorola, Xiaomi, etc.)
const selectBestRearAutofocusCamera = (allCameras) => {
  if (!allCameras || allCameras.length === 0) return null;

  const normalized = allCameras.map((c, i) => ({
    id: c.deviceId || c.id || `cam-${i}`,
    deviceId: c.deviceId || c.id || `cam-${i}`,
    label: c.label || ''
  }));

  const rearCameras = normalized.filter(c => !isFrontCamera(c.label));

  if (rearCameras.length === 0) return normalized[0];
  if (rearCameras.length === 1) return rearCameras[0];

  // 1. Prioriza sensor explicitamente marcado como 'main', 'principal' ou 'primary'
  const labeledMain = rearCameras.find(c => isMainAutofocusLens(c.label));
  if (labeledMain) return labeledMain;

  // 2. Descarta lentes conhecidas como ultra-wide (0.5x que fica longe) ou telephoto
  const nonUltra = rearCameras.filter(c => !isUltraWideLens(c.label) && !isTelephotoLens(c.label));
  if (nonUltra.length > 0) return nonUltra[0];

  return rearCameras[0];
};

export default function CarrinhoDevolucaoTab({
  equipments = [],
  hospitalName = '',
  planTitle = '',
  planId = null,
  sectorColors = {},
  onOpenScanner = null,
  onReturnEquipment = null,
  onReturnMultipleEquipments = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' (Pendentes) | 'RETURNED' (Já Devolvidas) | 'ALL' (Todas) | 'PACKED' (No Carrinho)
  const [viewMode, setViewMode] = useState('compact_list'); // 'compact_list' (Lista Menor em Série) | 'sectors' (Agrupado por Setor)
  const [expandedSectors, setExpandedSectors] = useState({});
  const [flashFeedback, setFlashFeedback] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Camera scanner de devolução (Regra idêntica à de entrada com foco de perto)
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastScannedDest, setLastScannedDest] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.5); // Padrão 1.5x (Foco de perto / macro como na bipagem principal)
  const [zoomCaps, setZoomCaps] = useState(null);
  const [reticleType, setReticleType] = useState('1d'); // '1d' (Linha Laser) | '2d' (Caixa QR)
  const [focusFeedbackText, setFocusFeedbackText] = useState('');

  const quickSearchInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const lastScannedValRef = useRef('');
  const isStartingRef = useRef(false);
  const nativeDetectorActiveRef = useRef(false);
  const nativeDetectorRafRef = useRef(null);

  // Chaves de persistência no localStorage por plano
  const planKey = planId || 'default';
  const STORAGE_SERIES_KEY = `calibracheck_cart_series_${planKey}`;
  const STORAGE_PACKED_KEY = `calibracheck_cart_packed_${planKey}`;
  const STORAGE_RETURNED_KEY = `calibracheck_cart_returned_${planKey}`;

  // Fila de Bombas Bipadas para Devolução (Em Série)
  const [scannedSeries, setScannedSeries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Estado para alteração rápida individual do setor de uma bomba na fila
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [customSeriesSectorInput, setCustomSeriesSectorInput] = useState('');

  // Conjunto de IDs das bombas marcadas no carrinho
  const [cartPackedIds, setCartPackedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PACKED_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set();
  });

  // Conjunto de IDs das bombas marcadas como DEVOLVIDAS
  const [returnedIds, setReturnedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RETURNED_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    const initialSet = new Set();
    equipments.forEach(eq => {
      if (eq.devolvido) initialSet.add(eq.id);
    });
    return initialSet;
  });

  // Refs de estado sincronizado para evitar stale closure no loop da câmera / leitor
  const scannedSeriesRef = useRef(scannedSeries);
  const cartPackedIdsRef = useRef(cartPackedIds);
  const returnedIdsRef = useRef(returnedIds);
  const equipmentsRef = useRef(equipments);
  const handleQuickLookupRef = useRef(null);

  useEffect(() => {
    scannedSeriesRef.current = scannedSeries;
  }, [scannedSeries]);

  useEffect(() => {
    cartPackedIdsRef.current = cartPackedIds;
  }, [cartPackedIds]);

  useEffect(() => {
    returnedIdsRef.current = returnedIds;
  }, [returnedIds]);

  useEffect(() => {
    equipmentsRef.current = equipments;
  }, [equipments]);

  // Blindagem contra recarregamento acidental (pull-to-refresh) se houver bombas na fila em série
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (scannedSeries.length > 0) {
        e.preventDefault();
        e.returnValue = 'Você possui bombas na fila do carrinho de devolução. Deseja realmente sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scannedSeries.length]);

  // Sincroniza com localStorage quando planId ou states mudam
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      const parsedSeries = saved ? JSON.parse(saved) : [];
      setScannedSeries(parsedSeries);
      scannedSeriesRef.current = parsedSeries;
    } catch (e) {
      setScannedSeries([]);
      scannedSeriesRef.current = [];
    }

    try {
      const savedPacked = localStorage.getItem(STORAGE_PACKED_KEY);
      const parsedPacked = savedPacked ? new Set(JSON.parse(savedPacked)) : new Set();
      setCartPackedIds(parsedPacked);
      cartPackedIdsRef.current = parsedPacked;
    } catch (e) {
      setCartPackedIds(new Set());
      cartPackedIdsRef.current = new Set();
    }

    try {
      const savedReturned = localStorage.getItem(STORAGE_RETURNED_KEY);
      const parsedReturned = savedReturned ? new Set(JSON.parse(savedReturned)) : new Set();
      equipments.forEach(eq => {
        if (eq.devolvido) parsedReturned.add(eq.id);
      });
      setReturnedIds(parsedReturned);
      returnedIdsRef.current = parsedReturned;
    } catch (e) {
      setReturnedIds(new Set());
      returnedIdsRef.current = new Set();
    }
  }, [STORAGE_SERIES_KEY, STORAGE_PACKED_KEY, STORAGE_RETURNED_KEY, equipments]);

  const saveSeriesState = (newSeries) => {
    scannedSeriesRef.current = newSeries;
    setScannedSeries(newSeries);
    try {
      localStorage.setItem(STORAGE_SERIES_KEY, JSON.stringify(newSeries));
    } catch (e) {}
  };

  const savePackedState = (newSet) => {
    cartPackedIdsRef.current = newSet;
    setCartPackedIds(newSet);
    try {
      localStorage.setItem(STORAGE_PACKED_KEY, JSON.stringify(Array.from(newSet)));
    } catch (e) {}
  };

  const saveReturnedState = (newSet) => {
    returnedIdsRef.current = newSet;
    setReturnedIds(newSet);
    try {
      localStorage.setItem(STORAGE_RETURNED_KEY, JSON.stringify(Array.from(newSet)));
    } catch (e) {}
  };

  // Filtra apenas equipamentos calibrados/conferidos (prontos para devolução)
  const readyEquipments = useMemo(() => {
    return equipments.filter(e => 
      Boolean(e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa)
    );
  }, [equipments]);

  // Contagem de pendentes de devolução vs já devolvidos
  const pendingReturnEquipments = useMemo(() => {
    return readyEquipments.filter(e => !returnedIds.has(e.id) && !e.devolvido);
  }, [readyEquipments, returnedIds]);

  const alreadyReturnedEquipments = useMemo(() => {
    return readyEquipments.filter(e => returnedIds.has(e.id) || Boolean(e.devolvido));
  }, [readyEquipments, returnedIds]);

  // Total de pendentes
  const pendingCount = equipments.length - readyEquipments.length;

  // Agrupamento por setor de destino
  const sectorGroups = useMemo(() => {
    const groups = {};
    readyEquipments.forEach(item => {
      const targetSector = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
      if (!groups[targetSector]) {
        groups[targetSector] = [];
      }
      groups[targetSector].push(item);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return sortedKeys.map(secName => ({
      name: secName,
      items: groups[secName],
      count: groups[secName].length
    }));
  }, [readyEquipments]);

  // Setores disponíveis
  const availableSectors = useMemo(() => {
    return sectorGroups.map(g => g.name);
  }, [sectorGroups]);

  // Presets de Zoom para aproximação da câmera (como na calibração)
  const opticalPresets = useMemo(() => {
    const minZ = zoomCaps?.min ?? 1;
    const maxZ = zoomCaps?.max ?? 8;
    return [
      { label: '1.0x', fullName: '1.0x Nítida (50MP)', value: 1.0 },
      { label: '1.5x', fullName: '1.5x Foco Próximo (Macro)', value: Math.min(1.5, maxZ) },
      { label: '2.0x', fullName: '2.0x Telefoto', value: Math.min(2.0, maxZ) },
    ];
  }, [zoomCaps]);

  const rearCamerasList = useMemo(() => {
    return (cameras || []).filter(c => !isFrontCamera(c.label));
  }, [cameras]);

  const currentLensDisplay = useMemo(() => {
    if (rearCamerasList.length > 1) {
      const idx = rearCamerasList.findIndex(c => (c.id === selectedCamera || c.deviceId === selectedCamera));
      const pos = idx >= 0 ? idx + 1 : 1;
      return `🔄 Lente ${pos} de ${rearCamerasList.length}`;
    }
    return '🎯 50MP Principal';
  }, [rearCamerasList, selectedCamera]);

  // Bombas filtradas na visualização geral
  const filteredEquipments = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return readyEquipments.filter(item => {
      const isReturned = returnedIds.has(item.id) || Boolean(item.devolvido);
      const isPacked = cartPackedIds.has(item.id);

      if (statusFilter === 'PENDING' && isReturned) return false;
      if (statusFilter === 'RETURNED' && !isReturned) return false;
      if (statusFilter === 'PACKED' && !isPacked) return false;
      if (statusFilter === 'UNPACKED' && isPacked) return false;

      const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
      if (selectedSectorFilter !== 'ALL' && targetSec !== selectedSectorFilter) {
        return false;
      }

      if (!query) return true;
      const tag = (item.tag || '').toLowerCase();
      const serie = (item.serie || '').toLowerCase();
      const code = (item.codigoBarras || '').toLowerCase();
      const eqName = (item.equipamento || '').toLowerCase();
      const mod = (item.modelo || '').toLowerCase();

      return (
        tag.includes(query) ||
        serie.includes(query) ||
        code.includes(query) ||
        eqName.includes(query) ||
        mod.includes(query) ||
        targetSec.toLowerCase().includes(query)
      );
    });
  }, [readyEquipments, searchTerm, selectedSectorFilter, statusFilter, cartPackedIds]);

  // Grupos filtrados para o modo sanfona
  const filteredGroups = useMemo(() => {
    const map = {};
    filteredEquipments.forEach(item => {
      const sec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    });
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return keys.map(k => ({
      name: k,
      items: map[k],
      count: map[k].length
    }));
  }, [filteredEquipments]);

  // Contagem de setores atendidos na fila de bipadas
  const scannedSectorsCount = useMemo(() => {
    const s = new Set();
    scannedSeries.forEach(it => {
      if (it.targetSector) s.add(it.targetSector);
    });
    return s.size;
  }, [scannedSeries]);

  // Resumo de bombas no carrinho por setor
  const cartSummaryBySector = useMemo(() => {
    const counts = {};
    scannedSeries.forEach(it => {
      const sec = it.targetSector || 'Setor Não Definido';
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [scannedSeries]);

  // Alterna marcação no carrinho de um equipamento
  const togglePacked = (id) => {
    const next = new Set(cartPackedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    savePackedState(next);
  };

  // Alterna expansão de setor
  const toggleSectorExpand = (secName) => {
    setExpandedSectors(prev => ({
      ...prev,
      [secName]: !prev[secName]
    }));
  };

  // Bipagem de bomba (Leitor USB, digitação ou câmera)
  const handleQuickLookup = (rawVal) => {
    const raw = String(rawVal || '').trim();
    if (!raw) return;

    const val = raw.toLowerCase();
    const cleanSerial = extractCleanSerialNumber(raw).toLowerCase();

    const currentEquips = equipmentsRef.current || equipments;
    const currentSeries = scannedSeriesRef.current || [];
    const currentPacked = cartPackedIdsRef.current || new Set();
    const currentReturned = returnedIdsRef.current || new Set();

    // Procura o equipamento no inventário
    const found = currentEquips.find(e => {
      const idMatch = String(e.id || '').toLowerCase() === val;
      const barMatch = String(e.codigoBarras || '').toLowerCase() === val;
      const tagMatch = String(e.tag || '').toLowerCase() === val;
      const serieMatch = String(e.serie || '').toLowerCase() === val || (cleanSerial && String(e.serie || '').toLowerCase() === cleanSerial);
      return idMatch || barMatch || tagMatch || serieMatch;
    });

    if (found) {
      const targetSec = (found.setor_retirada || found.setor || 'Setor Não Informado').trim();
      const isReady = Boolean(found.checado || found.check_calibracao || found.check_preventiva || found.check_seguranca || found.check_externa);
      const isAlreadyReturned = currentReturned.has(found.id) || Boolean(found.devolvido);

      const newEntry = {
        equipment: found,
        targetSector: targetSec,
        isReady,
        isReturned: isAlreadyReturned,
        timestamp: Date.now(),
        scanId: `${found.id}-${Date.now()}`
      };

      // Adiciona na fila em série (o mais novo fica no topo)
      // Utiliza a referência síncrona atualizada para evitar reviver bombas antigas
      const filteredOld = currentSeries.filter(s => s.equipment.id !== found.id);
      const updatedSeries = [newEntry, ...filteredOld];
      saveSeriesState(updatedSeries);

      // Marca automaticamente no carrinho
      const updatedPacked = new Set(currentPacked);
      updatedPacked.add(found.id);
      savePackedState(updatedPacked);

      // Feedback sonoro e tátil
      playSuccessSound();
      triggerHapticAlert(50);

      // Feedback visual em tela
      setFlashFeedback({
        type: isAlreadyReturned ? 'warning' : 'success',
        equipment: found,
        targetSector: targetSec,
        isReady,
        message: isAlreadyReturned
          ? `⚠️ Esta bomba já consta como DEVOLVIDA ao setor: ${targetSec}!`
          : `Bomba bipada! Levar para devolução em: ${targetSec}`
      });

      setLastScannedDest({
        targetSector: targetSec,
        equipment: found
      });

      setSearchTerm('');
      if (quickSearchInputRef.current) {
        quickSearchInputRef.current.value = '';
        quickSearchInputRef.current.focus();
      }
    } else {
      setFlashFeedback({
        type: 'error',
        message: `Equipamento não localizado com o código: "${raw}"`
      });
      triggerHapticAlert(150);
    }
  };

  // Mantém a ref da função sempre apontando para a versão mais recente
  handleQuickLookupRef.current = handleQuickLookup;

  // Confirma a devolução de uma bomba ao setor (REMOVE DA FILA E MARCA DEVOLVIDA)
  const handleConfirmReturn = (equipmentId) => {
    // 1. Marca como devolvida
    const nextReturned = new Set(returnedIdsRef.current || returnedIds);
    nextReturned.add(equipmentId);
    saveReturnedState(nextReturned);

    // 2. Remove da fila de bipadas (sai da lista!)
    const nextSeries = (scannedSeriesRef.current || scannedSeries).filter(s => s.equipment.id !== equipmentId);
    saveSeriesState(nextSeries);

    // 3. Remove de cartPackedIds
    const nextPacked = new Set(cartPackedIdsRef.current || cartPackedIds);
    nextPacked.delete(equipmentId);
    savePackedState(nextPacked);

    // 4. Encontra equipamento para dados de feedback
    const eq = (equipmentsRef.current || equipments).find(e => e.id === equipmentId);
    const targetSec = eq ? (eq.setor_retirada || eq.setor || 'Setor').trim() : 'Setor';

    // 5. Notifica backend/App se callback fornecido
    if (onReturnEquipment) {
      onReturnEquipment(equipmentId, true);
    }

    // 6. Efeitos sonoros e táteis
    playSuccessSound();
    triggerHapticAlert(60);

    // 7. Feedback visual
    setFlashFeedback({
      type: 'success',
      equipment: eq,
      targetSector: targetSec,
      isReady: true,
      message: `✓ Bomba ${eq?.tag || eq?.serie || ''} devolvida com sucesso ao setor: ${targetSec}!`
    });
  };

  // Desfazer devolução (caso tenha marcado por engano)
  const handleUndoReturn = (equipmentId) => {
    const nextReturned = new Set(returnedIdsRef.current || returnedIds);
    nextReturned.delete(equipmentId);
    saveReturnedState(nextReturned);

    if (onReturnEquipment) {
      onReturnEquipment(equipmentId, false);
    }

    playSuccessSound();
    triggerHapticAlert(40);
  };

  // Alterar setor de destino de uma bomba específica na fila do carrinho
  const handleUpdateSeriesSector = (equipmentId, newSector) => {
    const cleanSector = String(newSector || '').trim();
    if (!cleanSector) return;
    const nextSeries = (scannedSeriesRef.current || scannedSeries).map(item => {
      if (item.equipment.id === equipmentId) {
        return {
          ...item,
          targetSector: cleanSector,
          equipment: {
            ...item.equipment,
            setor_retirada: cleanSector
          }
        };
      }
      return item;
    });
    saveSeriesState(nextSeries);
    setEditingSectorId(null);
  };

  // Devolver todas as bombas atualmente na fila do carrinho
  const handleReturnAllInSeries = () => {
    const current = scannedSeriesRef.current || scannedSeries;
    if (current.length === 0) return;

    if (window.confirm(`Deseja confirmar a devolução de TODAS as ${current.length} bombas aos seus respectivos setores e concluir esta viagem do carrinho?`)) {
      const ids = current.map(item => item.equipment.id);
      const nextReturned = new Set(returnedIdsRef.current || returnedIds);
      ids.forEach(id => nextReturned.add(id));
      saveReturnedState(nextReturned);

      // Limpa a fila do carrinho
      saveSeriesState([]);

      // Limpa packed
      const nextPacked = new Set(cartPackedIdsRef.current || cartPackedIds);
      ids.forEach(id => nextPacked.delete(id));
      savePackedState(nextPacked);

      if (onReturnMultipleEquipments) {
        onReturnMultipleEquipments(ids, true);
      } else if (onReturnEquipment) {
        ids.forEach(id => onReturnEquipment(id, true));
      }

      playSuccessSound();
      triggerHapticAlert(80);

      setFlashFeedback({
        type: 'success',
        message: `✓ ${ids.length} bombas devolvidas aos seus setores com sucesso! Fila do carrinho concluída.`
      });
      setLastScannedDest(null);
    }
  };

  // Devolver todas as bombas de um setor específico (usado na visualização agrupada por setor)
  const handleReturnAllInSector = (sectorName) => {
    const current = scannedSeriesRef.current || scannedSeries;
    // Identifica bombas deste setor presentes no carrinho
    const inSeriesFromSector = current.filter(item => (item.targetSector || item.equipment?.setor_retirada || item.equipment?.setor || 'Geral').trim() === sectorName.trim());
    
    // Se houver no carrinho, devolve as do carrinho; senão, pega todas as pendentes deste setor
    let targetEquipments = [];
    if (inSeriesFromSector.length > 0) {
      targetEquipments = inSeriesFromSector.map(s => s.equipment);
    } else {
      targetEquipments = readyEquipments.filter(e => {
        const sec = (e.setor_retirada || e.setor || 'Geral').trim();
        const isRet = (returnedIdsRef.current || returnedIds).has(e.id) || Boolean(e.devolvido);
        return sec === sectorName.trim() && !isRet;
      });
    }

    if (targetEquipments.length === 0) return;

    if (window.confirm(`Deseja confirmar a devolução de TODAS as ${targetEquipments.length} bombas para o setor "${sectorName}"?`)) {
      const ids = targetEquipments.map(e => e.id);
      
      // 1. Marca como devolvidas
      const nextReturned = new Set(returnedIdsRef.current || returnedIds);
      ids.forEach(id => nextReturned.add(id));
      saveReturnedState(nextReturned);

      // 2. Remove da fila do carrinho apenas as deste setor
      const nextSeries = current.filter(item => !ids.includes(item.equipment.id));
      saveSeriesState(nextSeries);

      // 3. Remove de cartPackedIds
      const nextPacked = new Set(cartPackedIdsRef.current || cartPackedIds);
      ids.forEach(id => nextPacked.delete(id));
      savePackedState(nextPacked);

      // 4. Callback
      if (onReturnMultipleEquipments) {
        onReturnMultipleEquipments(ids, true);
      } else if (onReturnEquipment) {
        ids.forEach(id => onReturnEquipment(id, true));
      }

      playSuccessSound();
      triggerHapticAlert(80);

      setFlashFeedback({
        type: 'success',
        message: `✓ ${ids.length} bombas devolvidas com sucesso no setor: ${sectorName}!`
      });
    }
  };

  // Remove um item da fila de bipadas
  const handleRemoveFromSeries = (equipmentId) => {
    const current = scannedSeriesRef.current || scannedSeries;
    const updated = current.filter(s => s.equipment.id !== equipmentId);
    saveSeriesState(updated);
  };

  // Limpa toda a fila de bipadas do carrinho (limpa de forma síncrona nos refs e no localStorage)
  const handleClearSeries = () => {
    const current = scannedSeriesRef.current || scannedSeries;
    if (current.length === 0) return;
    if (window.confirm(`Deseja limpar as ${current.length} bombas bipadas desta fila de devolução?`)) {
      saveSeriesState([]);
      setLastScannedDest(null);
    }
  };

  // Copia a relação de bombas por setor para envio ou relatório
  const handleCopySummary = async () => {
    const current = scannedSeriesRef.current || scannedSeries;
    if (current.length === 0) return;

    let text = `📦 RELAÇÃO DE DEVOLUÇÃO - ${hospitalName || 'HOSPITAL'}\n`;
    text += `Plano: ${planTitle || 'Geral'} | Total no Carrinho: ${current.length} bombas\n\n`;

    const bySector = {};
    current.forEach(item => {
      const sec = item.targetSector || 'Setor Não Definido';
      if (!bySector[sec]) bySector[sec] = [];
      bySector[sec].push(item.equipment);
    });

    Object.keys(bySector).sort().forEach(secName => {
      text += `📍 SETOR: ${secName} (${bySector[secName].length} bombas)\n`;
      bySector[secName].forEach((eq, idx) => {
        text += `  ${idx + 1}. Tag: ${eq.tag || 'S/Tag'} | S/N: ${eq.serie || '-'} | ${eq.equipamento || ''} ${eq.modelo || ''}\n`;
      });
      text += '\n';
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (e) {
      alert('Não foi possível copiar automaticamente.');
    }
  };

  // =========================================================================
  // SISTEMA DE CÂMERA IDÊNTICO À CALIBRAÇÃO (50MP PRINCIPAL + FOCO DE PERTO)
  // =========================================================================

  const stopScanner = async () => {
    nativeDetectorActiveRef.current = false;
    if (nativeDetectorRafRef.current) {
      cancelAnimationFrame(nativeDetectorRafRef.current);
      nativeDetectorRafRef.current = null;
    }

    try {
      const videoEl = document.querySelector('#carrinho-barcode-reader video');
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

  // Calibra foco contínuo e macro de perto (5-15cm)
  const setupTrackFocusAndQuality = async () => {
    try {
      const videoEl = document.querySelector('#carrinho-barcode-reader video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      if (!track) return;

      const caps = track.getCapabilities ? track.getCapabilities() : {};

      if (caps.zoom) {
        setZoomCaps(caps.zoom);
        setHasZoom(true);
      }
      if (caps.torch) {
        setHasTorch(true);
      }

      const advanced = [];
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }
      // Foco macro de perto (distância mínima)
      if (caps.focusDistance) {
        const macroDist = caps.focusDistance.min ?? 0.1;
        advanced.push({ focusDistance: macroDist });
      }

      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
        } catch (e) {}
      }

      // Aplica o enquadramento de mais perto padrão (1.5x)
      applyOpticalLensZoom(1.5, '1.5x Foco Próximo');
    } catch (err) {
      console.warn('[Carrinho Camera] Erro no setup de track:', err);
    }
  };

  // Aplicação de zoom óptico e ampliação HD de perto
  const applyOpticalLensZoom = async (zoomVal, labelOverride = '') => {
    try {
      const videoEl = document.querySelector('#carrinho-barcode-reader video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};

      let applied = false;
      let clampedZoom = zoomVal;

      if (caps.zoom) {
        const minZ = caps.zoom.min ?? 1;
        const maxZ = caps.zoom.max ?? 8;
        clampedZoom = Math.max(minZ, Math.min(maxZ, zoomVal));

        try {
          await track.applyConstraints({
            advanced: [{ zoom: clampedZoom }]
          });
          applied = true;
        } catch (e) {}
      }

      if (!applied && html5QrCodeRef.current?.applyVideoConstraints) {
        try {
          await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ zoom: clampedZoom }] });
          applied = true;
        } catch (e2) {}
      }

      setZoomLevel(clampedZoom);

      // Super zoom HD no elemento de vídeo para visualização de mais perto
      if (videoEl) {
        if (!applied && clampedZoom > 1.05) {
          videoEl.style.transform = `scale(${clampedZoom})`;
          videoEl.style.transformOrigin = 'center center';
          videoEl.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
        } else {
          videoEl.style.transform = 'none';
        }
      }

      if (labelOverride) {
        setFocusFeedbackText(`✓ ${labelOverride}`);
        setTimeout(() => setFocusFeedbackText(''), 1800);
      }
      return true;
    } catch (err) {
      console.warn('[Carrinho Camera] Erro ao aplicar zoom:', err);
      return false;
    }
  };

  // Alterna lanterna
  const toggleTorch = async (e) => {
    e?.stopPropagation();
    if (!html5QrCodeRef.current) return;
    try {
      const videoEl = document.querySelector('#carrinho-barcode-reader video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      if (track) {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
        return;
      }
      if (html5QrCodeRef.current.applyVideoConstraints) {
        const nextState = !torchOn;
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      }
    } catch (err) {
      console.warn('[Carrinho Camera] Erro ao alternar lanterna:', err);
    }
  };

  // Alternar rapidamente entre as lentes traseiras físicas do aparelho
  const handleToggleRearCamera = async () => {
    if (rearCamerasList.length <= 1 || isStartingRef.current) return;
    const currentIndex = rearCamerasList.findIndex(c => c.id === selectedCamera || c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % rearCamerasList.length;
    const nextCam = rearCamerasList[nextIndex];

    if (nextCam) {
      setFocusFeedbackText(`🔄 Ativando Lente ${nextIndex + 1}...`);
      await startScanner(nextCam.id);
    }
  };

  // Foco de hardware central
  const handleTriggerCenterFocus = async (e) => {
    e?.stopPropagation();
    try {
      const videoEl = document.querySelector('#carrinho-barcode-reader video');
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks()?.[0];
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.pointsOfInterest) {
          await track.applyConstraints({
            advanced: [{ pointsOfInterest: [{ x: 0.5, y: 0.5 }] }]
          });
        }
      }
      setFocusFeedbackText('✓ Foco Centralizado');
      setTimeout(() => setFocusFeedbackText(''), 1500);
    } catch (e) {}
  };

  // Início do scanner com a câmera selecionada
  const startScanner = async (cameraId, retryCount = 0) => {
    if (isStartingRef.current && retryCount === 0) return;
    isStartingRef.current = true;
    setIsCameraStarting(true);
    setCameraError('');

    await stopScanner();
    await new Promise(r => setTimeout(r, 120));

    for (let i = 0; i < 8; i++) {
      if (document.getElementById('carrinho-barcode-reader')) break;
      await new Promise(r => setTimeout(r, 50));
    }

    try {
      const html5QrCode = new Html5Qrcode('carrinho-barcode-reader', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        }
      });
      html5QrCodeRef.current = html5QrCode;

      // Resolução Full HD 1080p para máxima nitidez de números e barras de perto
      let videoConstraints;
      if (cameraId) {
        videoConstraints = {
          deviceId: { exact: cameraId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 60 }
        };
      } else {
        videoConstraints = {
          facingMode: "environment",
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 60 }
        };
      }

      const config = {
        fps: 30,
        videoConstraints: videoConstraints,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.floor(viewfinderWidth * 0.96);
          const height = Math.floor(Math.min(viewfinderHeight * 0.85, 360));
          return {
            width: Math.max(width, 280),
            height: Math.max(height, 150)
          };
        },
        disableFlip: true,
      };

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText) => {
          const now = Date.now();
          if (decodedText === lastScannedValRef.current && now - lastScannedTimeRef.current < 1200) {
            return;
          }
          lastScannedValRef.current = decodedText;
          lastScannedTimeRef.current = now;
          if (handleQuickLookupRef.current) {
            handleQuickLookupRef.current(decodedText);
          } else {
            handleQuickLookup(decodedText);
          }
        },
        () => {}
      );

      setScanning(true);
      setIsCameraStarting(false);
      setCameraError('');
      isStartingRef.current = false;

      if (cameraId) {
        setSelectedCamera(cameraId);
        try {
          localStorage.setItem('calibracheck_preferred_camera_v2', cameraId);
        } catch (e) {}
      }

      // Ativa foco contínuo e modo macro de perto
      setTimeout(() => {
        setupTrackFocusAndQuality();
      }, 350);

      // Google AI BarcodeDetector contínuo a 30fps para leitura ultra rápida
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const nativeDetector = new window.BarcodeDetector({
            formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'data_matrix', 'qr_code', 'itf', 'upc_a', 'upc_e']
          });

          nativeDetectorActiveRef.current = true;
          let isNativeDetecting = false;
          const runNativeLoop = async () => {
            if (!nativeDetectorActiveRef.current) return;
            if (!isNativeDetecting) {
              const videoEl = document.querySelector('#carrinho-barcode-reader video');
              if (videoEl && videoEl.readyState >= 2 && !videoEl.paused) {
                isNativeDetecting = true;
                try {
                  const barcodes = await nativeDetector.detect(videoEl);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    const code = barcodes[0].rawValue;
                    const now = Date.now();
                    if (code !== lastScannedValRef.current || now - lastScannedTimeRef.current >= 1200) {
                      lastScannedValRef.current = code;
                      lastScannedTimeRef.current = now;
                      if (handleQuickLookupRef.current) {
                        handleQuickLookupRef.current(code);
                      } else {
                        handleQuickLookup(code);
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
        } catch (e) {}
      }

    } catch (err) {
      console.warn(`[Carrinho Camera] Erro tentativa ${retryCount + 1}:`, err);
      if (retryCount < 2 && cameraId) {
        await new Promise(r => setTimeout(r, 200));
        return startScanner(null, retryCount + 1);
      }
      isStartingRef.current = false;
      setIsCameraStarting(false);
      setScanning(false);
      setCameraError('Não foi possível iniciar a câmera selecionada. Tente alternar a lente ou verificar permissões.');
    }
  };

  // Efeito de inicialização da câmera com a MESMA regra de entrada (calibracheck_preferred_camera_v2)
  useEffect(() => {
    if (!isCameraActive || viewMode !== 'compact_list') {
      stopScanner();
      return;
    }

    let isMounted = true;

    const initCameraWithCalibrationRules = async () => {
      try {
        // 1. Lê a câmera preferida salva na calibração
        let savedCam = null;
        try {
          savedCam = localStorage.getItem('calibracheck_preferred_camera_v2');
        } catch (e) {}

        // 2. Descobre câmeras disponíveis
        let detected = [];
        try {
          detected = await Html5Qrcode.getCameras();
        } catch (e) {
          if (navigator.mediaDevices?.enumerateDevices) {
            const raw = await navigator.mediaDevices.enumerateDevices();
            detected = raw.filter(d => d.kind === 'videoinput');
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

        // 3. Escolhe a Lente Principal de 50MP com Autofoco de Perto (descarta Ultra-Wide)
        let targetCam = null;
        if (savedCam) {
          targetCam = normalized.find(c => c.id === savedCam || c.deviceId === savedCam);
        }
        if (!targetCam) {
          targetCam = selectBestRearAutofocusCamera(normalized);
        }

        const targetId = targetCam ? targetCam.id : null;
        await startScanner(targetId);

      } catch (err) {
        console.warn('[Carrinho Camera] Falha no startup:', err);
        if (isMounted) await startScanner(null);
      }
    };

    initCameraWithCalibrationRules();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isCameraActive, viewMode]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-4 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* TOPO: CABEÇALHO COMPACTO + NAVEGAÇÃO DE MODOS + RESUMO                    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 p-3.5 sm:p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0 shadow-inner">
              <Truck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Carrinho & Devolução aos Setores
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden xs:inline">
                  Logística
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {hospitalName ? `${hospitalName} • ` : ''}Bipe em série para conferir o setor de destino antes da entrega
              </p>
            </div>
          </div>

          {/* Botões de Alternância de Modo & Ações Rápidas */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            {/* Modo 1: Bipagem & Fila em Série */}
            <button
              type="button"
              onClick={() => setViewMode('compact_list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                viewMode === 'compact_list'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Bipagem & Fila em Série</span>
              {scannedSeries.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-black">
                  {scannedSeries.length}
                </span>
              )}
            </button>

            {/* Modo 2: Relação por Setores */}
            <button
              type="button"
              onClick={() => setViewMode('sectors')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                viewMode === 'sectors'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-blue-400" />
              <span>📂 Ver Relação por Setores</span>
              {scannedSectorsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/30 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  {scannedSectorsCount} {scannedSectorsCount === 1 ? 'setor' : 'setores'}
                </span>
              )}
            </button>

            {/* Alternador de Câmera */}
            {viewMode === 'compact_list' && (
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 ${
                  isCameraActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={isCameraActive ? 'Pausar câmera' : 'Ativar câmera'}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isCameraActive ? 'Câmera Ativa' : 'Abrir Câmera'}</span>
              </button>
            )}

            {/* Ações Rápidas (Copiar / Limpar) */}
            {scannedSeries.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 flex items-center gap-1.5 active:scale-95"
                  title="Copiar relação de devolução por setores"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">{copySuccess ? 'Copiado! ✓' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSeries}
                  className="px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold transition border border-red-500/30 flex items-center gap-1 active:scale-95"
                  title="Limpar a lista de bombas bipadas neste carrinho"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Linha de Métricas Rápidas & Setores */}
        <div className="flex items-center gap-2 flex-wrap pt-3 mt-3 border-t border-slate-800 text-[11px]">
          <span className="text-slate-400 font-bold shrink-0">Resumo:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold flex items-center gap-1 shadow-xs">
            <Truck className="w-3 h-3 text-blue-400" />
            <span>{scannedSeries.length} no carrinho</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-xs">
            <Building2 className="w-3 h-3 text-emerald-400" />
            <span>{scannedSectorsCount} setores na carga</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold flex items-center gap-1 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-indigo-400" />
            <span>{readyEquipments.length} calibradas</span>
          </span>
          {pendingCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 shadow-xs">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>{pendingCount} na bancada</span>
            </span>
          )}
          {scannedSeries.length > 0 && (
            <span className="ml-auto text-[10px] text-emerald-400/90 font-medium hidden sm:inline-flex items-center gap-1">
              💾 Fila salva automaticamente em cache
            </span>
          )}
        </div>
      </div>

      {/* FLASH FEEDBACK DE BIPAGEM */}
      {flashFeedback && (
        <div 
          className={`p-3 rounded-2xl border transition animate-in zoom-in-95 duration-150 flex items-center justify-between gap-3 shadow-md ${
            flashFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : flashFeedback.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {flashFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : flashFeedback.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <div className="text-xs sm:text-sm font-bold truncate">
              {flashFeedback.message}
            </div>
          </div>
          <button
            onClick={() => setFlashFeedback(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RENDERIZAÇÃO CONFORME O MODO: BIPAGEM EM SÉRIE vs RELAÇÃO POR SETORES     */}
      {/* ========================================================================= */}
      {viewMode === 'compact_list' ? (
        /* MODO 1: BIPAGEM & FILA EM SÉRIE (LADO A LADO COMO NA TELA PRINCIPAL) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* COLUNA ESQUERDA (lg:col-span-6): CÂMERA NO TOPO + DESTINO + ENTRADA USB */}
          <div className="lg:col-span-6 space-y-3">
            
            {/* Viewfinder da Câmera (50MP Sensor + Foco de Perto Macro) */}
            {isCameraActive ? (
              <div className="rounded-2xl sm:rounded-3xl bg-slate-950 border-2 border-blue-500/80 p-3 sm:p-4 text-white shadow-xl relative animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-400" />
                    <h3 className="font-extrabold text-xs sm:text-sm">Scanner de Devolução Contínua</h3>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Leitor Ativo
                    </span>
                  </div>

                  <button
                    onClick={() => setIsCameraActive(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Fechar câmera"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Box de Vídeo da Câmera */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 h-[260px] sm:h-[300px] flex items-center justify-center shadow-inner">
                  <div 
                    id="carrinho-barcode-reader" 
                    className="w-full h-full flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                  ></div>

                  {/* BARRA SUPERIOR DISCRETA SOBRE O VÍDEO: APENAS TROCA DE LENTE E LANTERNA */}
                  {(rearCamerasList.length > 1 || hasTorch) && (
                    <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1 pointer-events-auto">
                      <div>
                        {rearCamerasList.length > 1 && (
                          <button
                            type="button"
                            onClick={handleToggleRearCamera}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/90 hover:bg-slate-800 text-blue-300 border border-blue-500/50 shadow-md backdrop-blur-xs transition active:scale-95"
                            title="Alternar lentes traseiras do aparelho"
                          >
                            <SwitchCamera className="w-3 h-3 text-blue-400" />
                            <span>{currentLensDisplay}</span>
                          </button>
                        )}
                      </div>

                      <div>
                        {hasTorch && (
                          <button
                            type="button"
                            onClick={toggleTorch}
                            className={`p-1.5 rounded-full flex items-center justify-center shadow-lg transition border ${
                              torchOn
                                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50'
                                : 'bg-slate-900/90 text-white hover:bg-slate-800 border-slate-700/80'
                            }`}
                            title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Feedback de foco flutuante */}
                  {focusFeedbackText && (
                    <div className="absolute top-11 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-slate-900/95 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/50 shadow-lg">
                      {focusFeedbackText}
                    </div>
                  )}

                  {/* BARRA INFERIOR SOBRE O VÍDEO: PRESETS DE ZOOM */}
                  <div className="absolute bottom-2 left-2 z-20 flex items-center pointer-events-auto">
                    <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-0.5 rounded-full border border-slate-700/80 shadow-lg">
                      {opticalPresets.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyOpticalLensZoom(p.value, p.fullName)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition active:scale-95 ${
                            Math.abs(zoomLevel - p.value) < 0.15
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loading da Câmera */}
                  {isCameraStarting && !scanning && !cameraError && (
                    <div className="absolute inset-0 z-15 flex flex-col items-center justify-center p-4 text-center bg-slate-950/90 space-y-2 animate-in fade-in">
                      <div className="w-7 h-7 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-white font-bold text-xs">Iniciando câmera Full HD com foco de perto...</p>
                    </div>
                  )}

                  {/* Erro de Câmera */}
                  {cameraError && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-slate-900/95 space-y-2">
                      <AlertCircle className="w-7 h-7 text-amber-500" />
                      <p className="text-white font-semibold text-xs">Câmera não iniciada</p>
                      <p className="text-slate-400 text-[11px] max-w-sm">{cameraError}</p>
                      <button
                        onClick={() => startScanner(selectedCamera)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* CARD DE ATIVAÇÃO DA CÂMERA CASO PAUSADA */
              <div className="p-4 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                  <Camera className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Câmera Pausada</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Ative a câmera para bipar as bombas continuamente com macro e foco de perto ou use o campo abaixo.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95 inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Ativar Câmera de Devolução</span>
                </button>
              </div>
            )}

            {/* CARD DESTAQUE: SETOR DE DESTINO DA ÚLTIMA BOMBA BIPADA */}
            {lastScannedDest ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 shadow-xl animate-in fade-in duration-150 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    ✓ Bomba Bipada com Sucesso
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{scannedSeries.length} na fila
                  </span>
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-white">
                    {lastScannedDest.equipment.equipamento}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                    <span className="font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
                      Tag: {lastScannedDest.equipment.tag || lastScannedDest.equipment.codigoBarras}
                    </span>
                    {lastScannedDest.equipment.serie && (
                      <span className="font-mono text-slate-400">
                        S/N: {lastScannedDest.equipment.serie}
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner do Setor de Destino em Destaque */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>LEVAR E DEVOLVER PARA O SETOR:</span>
                  </div>
                  {(() => {
                    const color = getSectorColor(lastScannedDest.targetSector, sectorColors);
                    return (
                      <div
                        style={getSectorBadgeStyles(color)}
                        className="px-3.5 py-2 rounded-xl text-sm sm:text-base font-black border flex items-center justify-between gap-2 shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                          <span>{lastScannedDest.targetSector}</span>
                        </div>
                        <span className="text-xs font-bold opacity-80">Devolução</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-1.5">
                <ScanLine className="w-6 h-6 mx-auto text-blue-400 opacity-60 animate-pulse" />
                <p className="text-xs font-bold text-slate-200">Aponte a mira para a etiqueta da bomba</p>
                <p className="text-[11px] text-slate-500">
                  O setor de destino onde a bomba deve ser entregue aparecerá aqui imediatamente em destaque com cores do setor.
                </p>
              </div>
            )}

            {/* CAMPO DE ENTRADA RÁPIDA USB / DIGITAÇÃO */}
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={quickSearchInputRef}
                  type="text"
                  placeholder="Bipar leitor USB ou digitar Tag/Série e Enter..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickLookup(searchTerm);
                    }
                  }}
                  className="w-full pl-9 pr-16 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleQuickLookup(searchTerm)}
                  className="absolute right-1 top-1 bottom-1 px-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg transition"
                >
                  Bipar
                </button>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA (lg:col-span-6): FILA DE BOMBAS BIPADAS PARA DEVOLUÇÃO */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm space-y-3">
              
              {/* Header da Fila */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Bombas no Carrinho</span>
                      <span className="px-2 py-0.2 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        {scannedSeries.length}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Ordem de bipagem (mais recentes no topo)
                    </p>
                  </div>
                </div>

                {/* Atalho para ver a lista completa por setores */}
                <button
                  type="button"
                  onClick={() => setViewMode('sectors')}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 active:scale-95"
                  title="Ver relação organizada por ordem dos setores"
                >
                  <span>Ver por Setores</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Resumo Rápido dos Setores na Carga */}
              {Object.keys(cartSummaryBySector).length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">Setores na carga:</span>
                  {Object.keys(cartSummaryBySector).map(sec => {
                    const secCol = getSectorColor(sec, sectorColors);
                    return (
                      <span
                        key={sec}
                        style={getSectorBadgeStyles(secCol)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1 shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: secCol.hex }} />
                        <span>{sec}</span>
                        <span className="font-mono font-black">({cartSummaryBySector[sec]})</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* LISTAGEM EM SÉRIE DAS BOMBAS BIPADAS */}
              {scannedSeries.length === 0 ? (
                <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5">
                  <Layers className="w-7 h-7 mx-auto opacity-40 text-blue-500" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nenhuma bomba bipada para o carrinho ainda
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Use a câmera ao lado ou digite a Tag para bipar em série. Cada bomba aparecerá na ordem com o setor de destino em destaque.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {scannedSeries.map((item, idx) => {
                    const eq = item.equipment;
                    const isTopNewest = idx === 0;
                    const secColor = getSectorColor(item.targetSector, sectorColors);

                    return (
                      <div
                        key={item.scanId || `${eq.id}-${idx}`}
                        className={`p-2.5 rounded-2xl transition flex flex-col gap-2 border ${
                          isTopNewest
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2.5 w-full">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Número na Série (#10, #9, #8... #1) */}
                            <div 
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                                isTopNewest
                                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {scannedSeries.length - idx}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                  {eq.equipamento}
                                </span>
                                {eq.modelo && (
                                  <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                                    ({eq.modelo})
                                  </span>
                                )}
                                {isTopNewest && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 animate-pulse">
                                    ⚡ Recém Bipada
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                  Tag: {eq.tag || eq.codigoBarras || 'S/Tag'}
                                </span>

                                {eq.serie && (
                                  <span className="font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600/60">
                                    S/N: {eq.serie}
                                  </span>
                                )}

                                {/* Setor de Destino em Destaque (1-Tap Editável) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingSectorId === eq.id) {
                                      setEditingSectorId(null);
                                    } else {
                                      setEditingSectorId(eq.id);
                                      setCustomSeriesSectorInput(item.targetSector || '');
                                    }
                                  }}
                                  style={getSectorBadgeStyles(secColor)}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-xs transition active:scale-95 hover:brightness-110"
                                  title="Clique para alterar o setor de destino desta bomba antes de devolver"
                                >
                                  <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: secColor.hex }} />
                                  <span>{item.targetSector}</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Ações: Devolver (Verde) e Remover */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleConfirmReturn(eq.id)}
                              className="px-2.5 py-1.5 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-sm flex items-center gap-1 border border-emerald-500"
                              title="Confirmar devolução desta bomba ao setor (ela sairá desta lista)"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Devolver</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveFromSeries(eq.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                              title="Remover desta fila sem marcar devolução"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Painel Rápido de Alteração do Setor de Destino */}
                        {editingSectorId === eq.id && (
                          <div className="p-2.5 rounded-xl bg-slate-950/95 border border-blue-500/50 shadow-xl space-y-2 animate-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black text-blue-300 uppercase tracking-wide flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-blue-400" />
                                <span>Alterar Setor de Devolução desta bomba:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingSectorId(null)}
                                className="p-1 text-slate-400 hover:text-white rounded"
                                title="Fechar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* 1-Tap Pills dos Setores */}
                            {availableSectors.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap max-h-24 overflow-y-auto pr-0.5">
                                {availableSectors.map(sec => {
                                  const isCurrent = item.targetSector === sec;
                                  return (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => handleUpdateSeriesSector(eq.id, sec)}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition active:scale-95 ${
                                        isCurrent
                                          ? 'bg-blue-600 text-white border-blue-500 font-black shadow-xs'
                                          : 'bg-slate-900 text-blue-200 border-blue-800/80 hover:bg-blue-950 hover:border-blue-400'
                                      }`}
                                    >
                                      {sec}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Campo para Digitar ou Customizar */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <input
                                type="text"
                                list="carrinho-item-sector-datalist"
                                value={customSeriesSectorInput}
                                onChange={(e) => setCustomSeriesSectorInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleUpdateSeriesSector(eq.id, customSeriesSectorInput);
                                  }
                                }}
                                placeholder="Ou digite o setor..."
                                className="bg-slate-900 border border-slate-700 focus:border-blue-400 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 flex-1 focus:outline-none"
                                autoFocus
                              />
                              <datalist id="carrinho-item-sector-datalist">
                                {availableSectors.map(s => (
                                  <option key={s} value={s} />
                                ))}
                              </datalist>

                              <button
                                type="button"
                                onClick={() => handleUpdateSeriesSector(eq.id, customSeriesSectorInput)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Salvar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ação em Lote: Devolver Todas do Carrinho */}
              {scannedSeries.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleClearSeries}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition px-2 py-1"
                    title="Limpar a lista sem marcar devolução"
                  >
                    Limpar Fila
                  </button>

                  <button
                    type="button"
                    onClick={handleReturnAllInSeries}
                    className="px-4 py-2 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 border border-emerald-500"
                    title="Confirmar devolução de todas as bombas do carrinho aos seus respectivos setores"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Devolver Todas do Carrinho ({scannedSeries.length})</span>
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        /* MODO 2: RELAÇÃO COMPLETA ORGANIZADA POR SETORES DE RETORNO */
        <div className="space-y-4">
          
          {/* Barra Superior da Visualização por Setor */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('compact_list')}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para Bipar mais Bombas</span>
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Relação de bombas agrupadas por setor de destino
                </span>
              </div>

              {/* Filtro / Busca */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar setor, tag ou série..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Filtros de Status */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                    statusFilter === 'PENDING'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Pendentes ({pendingReturnEquipments.length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('RETURNED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                    statusFilter === 'RETURNED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                  }`}
                >
                  Já Devolvidas ({alreadyReturnedEquipments.length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Todas ({readyEquipments.length})
                </button>
              </div>

              {/* Filtro Dropdown por Setor */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedSectorFilter}
                  onChange={e => setSelectedSectorFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Todos os Setores ({availableSectors.length})</option>
                  {availableSectors.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pastas de Setores Sanfonadas */}
          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <Truck className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Nenhuma bomba atende aos filtros atuais
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map(group => {
                const isExpanded = expandedSectors[group.name] ?? true;
                const secColor = getSectorColor(group.name, sectorColors);
                const inSeriesFromSector = scannedSeries.filter(item => (item.targetSector || item.equipment?.setor_retirada || item.equipment?.setor || 'Geral').trim() === group.name.trim()).length;

                return (
                  <div 
                    key={group.name}
                    className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition"
                  >
                    {/* Header do Setor */}
                    <div 
                      onClick={() => toggleSectorExpand(group.name)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs font-black text-sm"
                          style={{ backgroundColor: secColor.hex }}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                              {group.name}
                            </h2>
                            <span 
                              className="px-2 py-0.2 rounded-full text-xs font-black text-white shadow-xs"
                              style={{ backgroundColor: secColor.hex }}
                            >
                              {group.count} {group.count === 1 ? 'bomba' : 'bombas'}
                            </span>
                            {inSeriesFromSector > 0 && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                🛒 {inSeriesFromSector} no carrinho atual
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Prontas para entrega no setor
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botão de Entregar Todas no Setor */}
                        {group.count > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReturnAllInSector(group.name);
                            }}
                            className="px-3 py-1.5 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition active:scale-95 border border-emerald-500 shrink-0"
                            title={`Confirmar devolução de todas as bombas do setor ${group.name}`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Entregar Todas ({inSeriesFromSector > 0 ? inSeriesFromSector : group.count})</span>
                          </button>
                        )}

                        <span className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {/* Itens do Setor (Grade de Bombas) */}
                    {isExpanded && (
                      <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                        {group.items.map(item => {
                          const isReturned = returnedIds.has(item.id) || Boolean(item.devolvido);
                          const isPacked = cartPackedIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                                isReturned
                                  ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-75'
                                  : isPacked
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs'
                                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                              }`}
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                                    {item.equipamento}
                                  </span>
                                  {item.modelo && (
                                    <span className="text-[10px] text-slate-400 truncate">
                                      ({item.modelo})
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                                  <span className="font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400 font-mono">
                                    <Tag className="w-3 h-3" />
                                    {item.tag || item.serie || item.codigoBarras || item.id}
                                  </span>
                                  {item.serie && item.tag && (
                                    <span className="text-slate-400 font-mono text-[10px]">
                                      SN: {item.serie}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isReturned ? (
                                <button
                                  type="button"
                                  onClick={() => handleUndoReturn(item.id)}
                                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-amber-500 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 shrink-0"
                                  title="Bomba já devolvida. Clique para desfazer."
                                >
                                  <span>✓ Devolvida</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmReturn(item.id)}
                                  className="px-3 py-1.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-xs flex items-center gap-1 shrink-0 border border-emerald-500"
                                  title="Devolver ao setor (sairá da lista)"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Devolver</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Card Informativo com Dica Operacional */}
      <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong>Câmera com Foco de Perto (50MP Nativo):</strong> A câmera de devolução utiliza as mesmas diretrizes de lente da conferência de entrada. Ela inicia com enquadramento de perto (1.5x) para leitura instantânea de etiquetas pequenas sem distorção.
        </div>
      </div>

    </div>
  );
}
