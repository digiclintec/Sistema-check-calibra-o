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
  Pencil
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
  const [isCameraActive, setIsCameraActive] = useState(false);
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
    if (!isCameraActive) {
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
  }, [isCameraActive]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
      
      {/* BANNER PRINCIPAL: Logística de Carrinho e Devolução */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 border border-slate-800 p-5 sm:p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <Truck className="w-3.5 h-3.5" />
              <span>Logística Hospitalar • Relação de Retorno</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Carrinho & Devolução aos Setores</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Bipe as bombas em série antes de colocar no carrinho para identificar com precisão o setor de destino onde cada uma deve ser entregue.
              {hospitalName ? ` • ${hospitalName}` : ''} {planTitle ? `(${planTitle})` : ''}
            </p>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsCameraActive(true)}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2"
              title="Abrir câmera Full HD com foco de perto para bipar para devolução"
            >
              <Camera className="w-4 h-4" />
              <span>Bipar na Câmera (Foco de Perto)</span>
            </button>

            {scannedSeries.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95 flex items-center gap-1.5 border border-white/10"
                  title="Copiar lista de devolução organizada por setores"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>{copySuccess ? 'Copiado! ✓' : 'Copiar Relação'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSeries}
                  className="px-3 py-2.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs transition active:scale-95 flex items-center gap-1.5 border border-red-500/30"
                  title="Limpar a lista de bombas bipadas neste carrinho"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpar Fila</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Métricas e Estatísticas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Bipadas na Fila (Série)</div>
            <div className="text-xl sm:text-2xl font-black text-blue-400 flex items-center gap-1.5 mt-0.5">
              <span>{scannedSeries.length}</span>
              <span className="text-xs font-semibold text-slate-400">no carrinho</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Setores Atendidos</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span>{scannedSectorsCount}</span>
              <span className="text-xs font-semibold text-slate-400">setores</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Total Prontas no Plano</div>
            <div className="text-xl sm:text-2xl font-black text-indigo-400 flex items-center gap-1.5 mt-0.5">
              <span>{readyEquipments.length}</span>
              <span className="text-xs font-semibold text-slate-400">calibradas</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Ainda na Bancada</div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 flex items-center gap-1.5 mt-0.5">
              <span>{pendingCount}</span>
              <span className="text-xs font-semibold text-slate-400">pendentes</span>
            </div>
          </div>
        </div>

        {/* Resumo Rápido dos Setores com Bombas no Carrinho */}
        {Object.keys(cartSummaryBySector).length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold shrink-0">Setores na carga:</span>
            {Object.keys(cartSummaryBySector).map(sec => {
              const secCol = getSectorColor(sec, sectorColors);
              return (
                <span
                  key={sec}
                  style={getSectorBadgeStyles(secCol)}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secCol.hex }} />
                  <span>{sec}</span>
                  <span className="font-mono ml-0.5 font-black">({cartSummaryBySector[sec]})</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SCANNER DE CÂMERA PROFISSIONAL COM MESMA REGRA DA ENTRADA E FOCO DE PERTO */}
      {/* ========================================================================= */}
      {isCameraActive && (
        <div className="rounded-3xl bg-slate-950 border-2 border-blue-500 p-4 sm:p-5 text-white shadow-2xl relative animate-in zoom-in-95 duration-200">
          
          {/* Header do Scanner */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="w-5 h-5 text-blue-400" />
              <h3 className="font-extrabold text-sm sm:text-base">Scanner de Devolução Contínua</h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                🎯 Câmera Principal (Foco de Perto)
              </span>
            </div>

            <button
              onClick={() => setIsCameraActive(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar câmera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Viewfinder da Câmera (Col 7 no Desktop) */}
            <div className="lg:col-span-7 flex flex-col space-y-2">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 h-[280px] sm:h-[340px] flex items-center justify-center shadow-inner">
                
                {/* Elemento de Vídeo com Enquadramento Total */}
                <div 
                  id="carrinho-barcode-reader" 
                  className="w-full h-full flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                ></div>

                {/* Linha Laser Vermelha (1D) ou Mira QR (2D) */}
                {scanning && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
                    {reticleType === '1d' ? (
                      <div className="relative w-[96%] max-w-[480px] h-[100px] sm:h-[120px] border-2 border-dashed border-red-500/80 rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.35)] flex items-center justify-center">
                        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-300 to-red-600 shadow-[0_0_14px_#ef4444] animate-pulse"></div>
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-red-500 rounded-tl-lg"></div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-red-500 rounded-tr-lg"></div>
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-red-500 rounded-bl-lg"></div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-red-500 rounded-br-lg"></div>
                      </div>
                    ) : (
                      <div className="relative w-[200px] h-[200px] border-2 border-dashed border-blue-500/80 rounded-2xl shadow-[0_0_25px_rgba(59,130,246,0.35)] flex items-center justify-center">
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                      </div>
                    )}
                  </div>
                )}

                {/* BARRA SUPERIOR SOBRE O VÍDEO: LENTE + MIRA + LANTERNA */}
                <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1.5 pointer-events-auto">
                  
                  {/* Alternador 1D/2D */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReticleType(r => r === '1d' ? '2d' : '1d')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border shadow-lg transition active:scale-95 ${
                        reticleType === '1d'
                          ? 'bg-red-500/25 text-red-200 border-red-500/50 shadow-red-500/20'
                          : 'bg-blue-500/25 text-blue-200 border-blue-500/50 shadow-blue-500/20'
                      }`}
                    >
                      <ScanLine className="w-3 h-3" />
                      <span>{reticleType === '1d' ? '1D Laser' : '2D QR'}</span>
                    </button>

                    {/* Alternador de Lente Traseira Física */}
                    {rearCamerasList.length > 1 ? (
                      <button
                        type="button"
                        onClick={handleToggleRearCamera}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/90 hover:bg-slate-800 text-blue-300 border border-blue-500/50 shadow-md backdrop-blur-xs transition active:scale-95"
                        title="Alternar lentes traseiras do aparelho"
                      >
                        <SwitchCamera className="w-3 h-3 text-blue-400" />
                        <span>{currentLensDisplay}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/85 text-blue-300 border border-blue-500/40 shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        <span>🎯 50MP Principal</span>
                      </div>
                    )}
                  </div>

                  {/* Controles da Direita: Foco e Lanterna */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTriggerCenterFocus}
                      className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40 shadow-lg transition active:scale-95"
                      title="Refocar de perto agora (5-15cm)"
                    >
                      <Crosshair className="w-3 h-3 text-amber-400" />
                      <span className="hidden xs:inline">Focar Perto</span>
                    </button>

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

                {/* Feedback de foco flutuante */}
                {focusFeedbackText && (
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-slate-900/95 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/50 shadow-lg">
                    {focusFeedbackText}
                  </div>
                )}

                {/* BARRA INFERIOR SOBRE O VÍDEO: PRESETS DE ZOOM DE PERTO */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-auto gap-2">
                  <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-0.5 rounded-full border border-slate-700/80 shadow-lg">
                    {opticalPresets.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyOpticalLensZoom(p.value, p.fullName)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition active:scale-95 ${
                          Math.abs(zoomLevel - p.value) < 0.15
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-950/90 backdrop-blur-md text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                    <span>Macro 5-15cm Ativo</span>
                  </div>
                </div>

                {/* Loading da Câmera */}
                {isCameraStarting && !scanning && !cameraError && (
                  <div className="absolute inset-0 z-15 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 space-y-2 animate-in fade-in">
                    <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-white font-bold text-xs">Iniciando câmera Full HD com foco de perto...</p>
                    <p className="text-slate-400 text-[10px]">Sensor principal 50MP ativado</p>
                  </div>
                )}

                {/* Erro de Câmera */}
                {cameraError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-slate-900/95 space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <p className="text-white font-semibold text-xs">Câmera não iniciada</p>
                    <p className="text-slate-400 text-[11px] max-w-sm">{cameraError}</p>
                    <button
                      onClick={() => startScanner(selectedCamera)}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PAINEL LATERAL: ÚLTIMO SETOR BIPADO E FILA DE RETORNO (Col 5 no Desktop) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              
              {/* Card Destaque: Setor de Destino da Última Bomba Bipada */}
              {lastScannedDest ? (
                <div className="p-4 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/80 shadow-lg animate-in fade-in duration-150 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                      ✓ Bomba Bipada com Sucesso
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{scannedSeries.length} na fila
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-white">
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

                  {/* Banner Gigante do Setor de Destino */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>LEVAR E DEVOLVER PARA O SETOR:</span>
                    </div>
                    {(() => {
                      const color = getSectorColor(lastScannedDest.targetSector, sectorColors);
                      return (
                        <div
                          style={getSectorBadgeStyles(color)}
                          className="px-4 py-2.5 rounded-2xl text-base font-black border flex items-center justify-between gap-2 shadow-md"
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
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-2">
                  <ScanLine className="w-8 h-8 mx-auto text-blue-400 opacity-60 animate-pulse" />
                  <p className="text-xs font-bold text-slate-200">Aponte a mira para o código da bomba</p>
                  <p className="text-[11px] text-slate-500">
                    A câmera usa a Lente Principal com autofoco e aproximação macro de 5 a 15cm para leitura instantânea de barras e etiquetas.
                  </p>
                </div>
              )}

              {/* Mini Prévia da Fila no Carrinho */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                    <span>Carga no Carrinho ({scannedSeries.length} bombas)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(false)}
                    className="text-blue-400 hover:underline font-bold text-[11px]"
                  >
                    Ver Lista Completa
                  </button>
                </div>

                {scannedSeries.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    Nenhuma bomba bipada ainda. Bipando uma a uma, elas aparecerão listadas aqui em série.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {scannedSeries.slice(0, 4).map((item, idx) => (
                      <div 
                        key={item.scanId || idx}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="truncate font-semibold text-slate-200">
                          <span className="font-mono text-blue-400 font-bold mr-1.5">
                            #{scannedSeries.length - idx}
                          </span>
                          {item.equipment.equipamento} ({item.equipment.tag || item.equipment.serie})
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                          {item.targetSector}
                        </span>
                      </div>
                    ))}
                    {scannedSeries.length > 4 && (
                      <div className="text-center text-[10px] text-slate-400 pt-1">
                        + {scannedSeries.length - 4} outras bombas na fila do carrinho
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FLASH FEEDBACK DE BIPAGEM */}
      {flashFeedback && (
        <div 
          className={`p-3.5 rounded-2xl border transition animate-in zoom-in-95 duration-150 flex items-center justify-between gap-3 ${
            flashFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {flashFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
      {/* SEÇÃO 1: FILA DE BOMBAS BIPADAS PARA DEVOLUÇÃO EM SÉRIE (ESTRUTURA DO CARRINHO) */}
      {/* ========================================================================= */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Bombas Bipadas para Devolução (Fila em Série)</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  {scannedSeries.length} no carrinho
                </span>
                {scannedSectorsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                    {scannedSectorsCount} {scannedSectorsCount === 1 ? 'setor' : 'setores'} de destino
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Aparecem na ordem exata de bipagem para conferência antes de levar ao setor
              </p>
            </div>
          </div>

          {scannedSeries.length > 0 && (
            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                title="Copiar lista de devolução organizada por setores"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-500" />
                <span>{copySuccess ? 'Copiado! ✓' : 'Copiar Relação'}</span>
              </button>

              <button
                type="button"
                onClick={handleReturnAllInSeries}
                className="px-3.5 py-1.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition active:scale-95 border border-emerald-500"
                title="Confirmar devolução de todas as bombas bipadas aos seus respectivos setores e concluir a fila"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Devolver Todas ({scannedSeries.length})</span>
              </button>

              <button
                type="button"
                onClick={handleClearSeries}
                className="text-[11px] font-bold text-slate-400 hover:text-red-500 hover:underline flex items-center gap-1 px-1.5 py-1"
                title="Limpar o carrinho sem marcar devolução"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Fila</span>
              </button>
            </div>
          )}
        </div>

        {/* Resumo visual dos setores carregados no carrinho */}
        {Object.keys(cartSummaryBySector).length > 0 && (
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide shrink-0 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              <span>Carga no Carrinho:</span>
            </span>
            {Object.keys(cartSummaryBySector).map(sec => {
              const secCol = getSectorColor(sec, sectorColors);
              return (
                <span
                  key={sec}
                  style={getSectorBadgeStyles(secCol)}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secCol.hex }} />
                  <span>{sec}</span>
                  <span className="font-mono ml-0.5 font-black">({cartSummaryBySector[sec]})</span>
                </span>
              );
            })}
          </div>
        )}

        {/* LISTAGEM EM SÉRIE DAS BOMBAS BIPADAS */}
        {scannedSeries.length === 0 ? (
          <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nenhuma bomba bipada para o carrinho ainda
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-0.5">
              Digite a Tag/Série no campo abaixo ou use a câmera/leitor USB para bipar em série.
              Cada bomba aparecerá aqui na ordem com o setor de destino em destaque!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {scannedSeries.map((item, idx) => {
              const eq = item.equipment;
              const isTopNewest = idx === 0;
              const secColor = getSectorColor(item.targetSector, sectorColors);
              const isPacked = cartPackedIds.has(eq.id);

              return (
                <div
                  key={item.scanId || `${eq.id}-${idx}`}
                  className={`p-2.5 sm:p-3 rounded-2xl transition flex flex-col gap-2 border ${
                    isTopNewest
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Número na Série (#1, #2, #3...) */}
                      <div 
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                          isTopNewest
                            ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {scannedSeries.length - idx}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {eq.equipamento}
                          </span>
                          {eq.modelo && (
                            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                              ({eq.modelo})
                            </span>
                          )}
                          {isTopNewest && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 animate-pulse">
                              ⚡ Recém Bipada
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {eq.tag || eq.codigoBarras || 'S/Tag'}
                          </span>

                          {eq.serie && (
                            <span className="font-mono text-slate-600 dark:text-slate-300 text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600/60">
                              S/N: {eq.serie}
                            </span>
                          )}

                          {/* Setor de Destino em Destaque (Interativo / Editável) */}
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
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 shadow-xs transition active:scale-95 hover:brightness-110"
                            title="Clique para alterar o setor de destino desta bomba antes de devolver"
                          >
                            <MapPin className="w-3 h-3 shrink-0" style={{ color: secColor.hex }} />
                            <span>{item.targetSector}</span>
                            <Pencil className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                          </button>

                          {item.isReady ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Calibrada</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações: Devolver (Verde) e Remover */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmReturn(eq.id)}
                        className="px-3 py-1.5 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 border border-emerald-500"
                        title="Confirmar devolução desta bomba ao setor (ela sairá desta lista)"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Devolver</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromSeries(eq.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                        title="Remover desta fila sem marcar devolução"
                      >
                        <Trash2 className="w-4 h-4" />
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
                          className="bg-slate-900 border border-slate-700 focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 flex-1 focus:outline-none"
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
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: BARRA DE FERRAMENTAS E ALTERNÂNCIA DE MODO DE VISUALIZAÇÃO      */}
      {/* Permite alternar entre "Lista Menor em Série" e "Agrupado por Setor"     */}
      {/* ========================================================================= */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Campo de Bipagem Rápida USB / Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={quickSearchInputRef}
              type="text"
              placeholder="Bipar leitor USB ou buscar Tag, Série, Equipamento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickLookup(searchTerm);
                }
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium"
            />
          </div>

          {/* Toggle de Modo de Visualização: Lista Menor em Série vs Agrupado */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto shrink-0 border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setViewMode('compact_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'compact_list'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Exibir em lista menor compacta em série (como na calibração)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Lista Menor em Série</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('sectors')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'sectors'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Exibir agrupado por pastas de setores"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Agrupado por Setor</span>
            </button>
          </div>
        </div>

        {/* Filtros de Setor e Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
          
          {/* Filtros de Status de Devolução */}
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

      {/* ========================================================================= */}
      {/* SEÇÃO 3: RENDERIZAÇÃO CONFORME O MODO ESCOLHIDO                           */}
      {/* ========================================================================= */}

      {filteredEquipments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
            Nenhuma bomba pronta para devolução atende aos filtros atuais
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm 
              ? `Nenhum resultado para a busca "${searchTerm}".` 
              : 'Verifique se há bombas calibradas na aba de Conferência ou ajuste os filtros acima.'}
          </p>
        </div>
      ) : viewMode === 'compact_list' ? (
        /* ======================================================================= */
        /* MODO 1: LISTA MENOR EM SÉRIE (ALTA DENSIDADE / ESTILO CALIBRAÇÃO)       */
        /* ======================================================================= */
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {/* DESKTOP / TABLET: TABELA DE ALTA DENSIDADE */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">Nº</th>
                  <th className="py-3 px-3 w-28 text-center">Devolução</th>
                  <th className="py-3 px-3">Tag / Código</th>
                  <th className="py-3 px-3">Nº Série</th>
                  <th className="py-3 px-3">Equipamento / Aparelho</th>
                  <th className="py-3 px-3">📍 Setor de Destino</th>
                  <th className="py-3 px-3 text-center">Situação</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEquipments.map((item, idx) => {
                  const isReturned = returnedIds.has(item.id) || Boolean(item.devolvido);
                  const isPacked = cartPackedIds.has(item.id);
                  const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
                  const secColor = getSectorColor(targetSec, sectorColors);

                  return (
                    <tr
                      key={item.id}
                      style={{ borderLeft: `4px solid ${secColor.hex}` }}
                      className={`transition-colors duration-150 ${
                        isReturned
                          ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-75'
                          : isPacked
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Nº Sequencial */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Botão Devolver */}
                      <td className="py-2.5 px-3 text-center">
                        {isReturned ? (
                          <button
                            type="button"
                            onClick={() => handleUndoReturn(item.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-amber-500 border border-slate-200 dark:border-slate-700 transition"
                            title="Bomba já devolvida. Clique para desfazer."
                          >
                            ✓ Devolvida
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmReturn(item.id)}
                            className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition flex items-center gap-1 mx-auto shadow-xs border border-emerald-500"
                            title="Confirmar devolução desta bomba ao setor (ela sairá da lista de pendentes)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Devolver</span>
                          </button>
                        )}
                      </td>

                      {/* Tag / Código */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          {item.tag || item.codigoBarras || item.id}
                        </span>
                      </td>

                      {/* Nº Série */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {item.serie || '-'}
                      </td>

                      {/* Equipamento */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        <span>{item.equipamento}</span>
                        {item.modelo && (
                          <span className="text-slate-400 font-normal ml-1">({item.modelo})</span>
                        )}
                      </td>

                      {/* Setor de Destino */}
                      <td className="py-2.5 px-3">
                        <span
                          style={getSectorBadgeStyles(secColor)}
                          className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secColor.hex }} />
                          <span>{targetSec}</span>
                        </span>
                      </td>

                      {/* Situação */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Pronta</span>
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleQuickLookup(item.tag || item.serie || item.codigoBarras || item.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition inline-flex items-center gap-1"
                          title="Bipar na fila em série"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Bipar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE: CARDS COMPACTOS EM LINHA (LISTA MENOR) */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredEquipments.map((item, idx) => {
              const isReturned = returnedIds.has(item.id) || Boolean(item.devolvido);
              const isPacked = cartPackedIds.has(item.id);
              const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
              const secColor = getSectorColor(targetSec, sectorColors);

              return (
                <div
                  key={item.id}
                  style={{ borderLeft: `4px solid ${secColor.hex}` }}
                  className={`p-3 flex items-center justify-between gap-2.5 transition ${
                    isReturned
                      ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-75'
                      : isPacked
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                      : ''
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                        {item.tag || item.codigoBarras}
                      </span>
                      {item.serie && (
                        <span className="font-mono text-[10px] text-slate-500">
                          SN: {item.serie}
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {item.equipamento}
                    </div>

                    <div>
                      <span
                        style={getSectorBadgeStyles(secColor)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1"
                      >
                        <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: secColor.hex }} />
                        <span>{targetSec}</span>
                      </span>
                    </div>
                  </div>

                  {/* Botão Devolver Mobile */}
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
                      title="Confirmar devolução (sairá da lista)"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Devolver</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* ======================================================================= */
        /* MODO 2: AGRUPADO POR SETOR DE RETORNO (PASTAS SANFONADAS)               */
        /* ======================================================================= */
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const isExpanded = expandedSectors[group.name] ?? true;
            const secColor = getSectorColor(group.name, sectorColors);
            const packedInThisGroup = group.items.filter(it => cartPackedIds.has(it.id)).length;

            return (
              <div 
                key={group.name}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition"
              >
                {/* Header do Setor */}
                <div 
                  onClick={() => toggleSectorExpand(group.name)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs font-black text-sm"
                      style={{ backgroundColor: secColor.hex }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          {group.name}
                        </h2>
                        <span 
                          className="px-2.5 py-0.5 rounded-full text-xs font-black text-white shadow-xs"
                          style={{ backgroundColor: secColor.hex }}
                        >
                          {group.count} {group.count === 1 ? 'bomba' : 'bombas'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {packedInThisGroup > 0 
                          ? `${packedInThisGroup} de ${group.count} separadas no carrinho` 
                          : 'Prontas para embarcar no carrinho de devolução'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                                {item.equipamento}
                              </span>
                              {item.modelo && (
                                <span className="text-[10px] text-slate-400 truncate">
                                  {item.modelo}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                              <span className="font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Tag className="w-3 h-3" />
                                {item.tag || item.serie || item.codigoBarras || item.id}
                              </span>
                              {item.serie && item.tag && (
                                <span className="text-slate-400">
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

      {/* Card Informativo com Dica Operacional */}
      <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong>Câmera com Foco de Perto (50MP Nativo):</strong> A câmera de devolução utiliza as mesmas diretrizes de lente da conferência de entrada. Ela inicia com enquadramento de perto (1.5x) para leitura instantânea de etiquetas pequenas sem distorção.
        </div>
      </div>

    </div>
  );
}
