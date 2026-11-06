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
  Plus
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playSuccessSound, playBatchConfirmSound, triggerHapticAlert } from '../utils/audio';
import { getSectorColor, getEffectiveSector, getSectorBadgeStyles } from '../utils/sectorColors';
import { isNativeAndroidApp, scanWithNativeGoogleScanner } from '../utils/nativeBarcodeScanner';
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

export default function CarrinhoDevolucaoTab({
  equipments = [],
  hospitalName = '',
  planTitle = '',
  planId = null,
  sectorColors = {},
  onOpenScanner = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PACKED' | 'UNPACKED'
  const [viewMode, setViewMode] = useState('compact_list'); // 'compact_list' (Lista Menor em Série) | 'sectors' (Agrupado por Setor)
  const [expandedSectors, setExpandedSectors] = useState({});
  const [flashFeedback, setFlashFeedback] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Camera scanner de devolução
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastScannedDest, setLastScannedDest] = useState(null);
  
  const quickSearchInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const lastScannedValRef = useRef('');

  // Chaves de persistência no localStorage por plano
  const planKey = planId || 'default';
  const STORAGE_SERIES_KEY = `calibracheck_cart_series_${planKey}`;
  const STORAGE_PACKED_KEY = `calibracheck_cart_packed_${planKey}`;

  // Fila de Bombas Bipadas para Devolução (Em Série)
  const [scannedSeries, setScannedSeries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Conjunto de IDs das bombas marcadas no carrinho
  const [cartPackedIds, setCartPackedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PACKED_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set();
  });

  // Sincroniza com localStorage quando planId ou states mudam
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      setScannedSeries(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setScannedSeries([]);
    }

    try {
      const savedPacked = localStorage.getItem(STORAGE_PACKED_KEY);
      setCartPackedIds(savedPacked ? new Set(JSON.parse(savedPacked)) : new Set());
    } catch (e) {
      setCartPackedIds(new Set());
    }
  }, [STORAGE_SERIES_KEY, STORAGE_PACKED_KEY]);

  const saveSeriesState = (newSeries) => {
    setScannedSeries(newSeries);
    try {
      localStorage.setItem(STORAGE_SERIES_KEY, JSON.stringify(newSeries));
    } catch (e) {}
  };

  const savePackedState = (newSet) => {
    setCartPackedIds(newSet);
    try {
      localStorage.setItem(STORAGE_PACKED_KEY, JSON.stringify(Array.from(newSet)));
    } catch (e) {}
  };

  // Filtra apenas equipamentos calibrados/conferidos (prontos para devolução)
  const readyEquipments = useMemo(() => {
    return equipments.filter(e => 
      Boolean(e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa)
    );
  }, [equipments]);

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

  // Bombas filtradas na visualização geral
  const filteredEquipments = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return readyEquipments.filter(item => {
      // Filtro de status no carrinho
      const isPacked = cartPackedIds.has(item.id);
      if (statusFilter === 'PACKED' && !isPacked) return false;
      if (statusFilter === 'UNPACKED' && isPacked) return false;

      // Filtro de setor
      const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
      if (selectedSectorFilter !== 'ALL' && targetSec !== selectedSectorFilter) {
        return false;
      }

      // Busca textual
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

    // Procura o equipamento no inventário
    const found = equipments.find(e => {
      const idMatch = String(e.id || '').toLowerCase() === val;
      const barMatch = String(e.codigoBarras || '').toLowerCase() === val;
      const tagMatch = String(e.tag || '').toLowerCase() === val;
      const serieMatch = String(e.serie || '').toLowerCase() === val || (cleanSerial && String(e.serie || '').toLowerCase() === cleanSerial);
      return idMatch || barMatch || tagMatch || serieMatch;
    });

    if (found) {
      const targetSec = (found.setor_retirada || found.setor || 'Setor Não Informado').trim();
      const isReady = Boolean(found.checado || found.check_calibracao || found.check_preventiva || found.check_seguranca || found.check_externa);
      
      const newEntry = {
        equipment: found,
        targetSector: targetSec,
        isReady,
        timestamp: Date.now(),
        scanId: `${found.id}-${Date.now()}`
      };

      // Adiciona na fila em série (o mais novo fica no topo)
      // Se já estava na lista, move para o topo
      const filteredOld = scannedSeries.filter(s => s.equipment.id !== found.id);
      const updatedSeries = [newEntry, ...filteredOld];
      saveSeriesState(updatedSeries);

      // Marca automaticamente no carrinho
      const updatedPacked = new Set(cartPackedIds);
      updatedPacked.add(found.id);
      savePackedState(updatedPacked);

      // Feedback sonoro e tátil
      playSuccessSound();
      triggerHapticAlert(50);

      // Feedback visual em tela
      setFlashFeedback({
        type: 'success',
        equipment: found,
        targetSector: targetSec,
        isReady,
        message: `Bomba bipada! Levar para: ${targetSec}`
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

  // Remove um item da fila de bipadas
  const handleRemoveFromSeries = (equipmentId) => {
    const updated = scannedSeries.filter(s => s.equipment.id !== equipmentId);
    saveSeriesState(updated);
  };

  // Limpa toda a fila de bipadas do carrinho
  const handleClearSeries = () => {
    if (scannedSeries.length === 0) return;
    if (window.confirm(`Deseja limpar as ${scannedSeries.length} bombas bipadas desta fila de devolução?`)) {
      saveSeriesState([]);
      setLastScannedDest(null);
    }
  };

  // Copia a relação de bombas por setor para envio ou relatório
  const handleCopySummary = async () => {
    if (scannedSeries.length === 0) return;

    let text = `📦 RELAÇÃO DE DEVOLUÇÃO - ${hospitalName || 'HOSPITAL'}\n`;
    text += `Plano: ${planTitle || 'Geral'} | Total no Carrinho: ${scannedSeries.length} bombas\n\n`;

    // Agrupa por setor
    const bySector = {};
    scannedSeries.forEach(item => {
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
      alert('Não foi possível copiar automaticamente. Selecione e copie o texto.');
    }
  };

  // Disparo de Câmera (Google Code Scanner nativo ou câmera web)
  const handleTriggerScanner = async () => {
    if (isNativeAndroidApp()) {
      const res = await scanWithNativeGoogleScanner();
      if (res.success && res.code) {
        handleQuickLookup(res.code);
      }
    } else {
      setIsCameraActive(true);
    }
  };

  // Inicialização do Scanner de Câmera HTML5 embutido
  useEffect(() => {
    if (!isCameraActive) {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current?.clear();
          }).catch(() => {});
        } catch (e) {}
      }
      return;
    }

    setCameraError('');
    let isMounted = true;

    const startCamera = async () => {
      try {
        await new Promise(r => setTimeout(r, 100));
        if (!document.getElementById('carrinho-barcode-reader')) return;

        const scanner = new Html5Qrcode('carrinho-barcode-reader', {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false
        });
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.777
          },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastScannedValRef.current && now - lastScannedTimeRef.current < 1200) {
              return; // Anti-repique rápido
            }
            lastScannedValRef.current = decodedText;
            lastScannedTimeRef.current = now;
            handleQuickLookup(decodedText);
          },
          () => {}
        );
      } catch (err) {
        if (isMounted) {
          setCameraError('Não foi possível iniciar a câmera. Verifique as permissões do navegador.');
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current?.clear();
          }).catch(() => {});
        } catch (e) {}
      }
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
              onClick={handleTriggerScanner}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2"
              title="Abrir câmera para bipar bombas para devolução"
            >
              <Camera className="w-4 h-4" />
              <span>Bipar na Câmera</span>
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

      {/* SCANNER DE CÂMERA INTEGRADO PARA DEVOLUÇÃO */}
      {isCameraActive && (
        <div className="rounded-3xl bg-slate-900 border-2 border-blue-500 p-4 sm:p-5 text-white shadow-2xl relative animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              <h3 className="font-extrabold text-sm sm:text-base">Scanner de Devolução Contínua</h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Ao Vivo
              </span>
            </div>
            <button
              onClick={() => setIsCameraActive(false)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar câmera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Viewfinder da Câmera */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 min-h-[220px] max-h-[300px] flex items-center justify-center">
              <div id="carrinho-barcode-reader" className="w-full h-full"></div>
              {cameraError && (
                <div className="p-4 text-center text-red-400 text-xs">
                  <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                  {cameraError}
                </div>
              )}
            </div>

            {/* Painel do Último Setor Bipado */}
            <div className="space-y-3">
              {lastScannedDest ? (
                <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Última Bomba Bipada:
                  </div>
                  <div className="text-base font-black text-white flex items-center gap-2">
                    {lastScannedDest.equipment.equipamento}
                  </div>
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

                  <div className="mt-3 pt-3 border-t border-slate-700/80">
                    <div className="text-xs text-slate-400 font-semibold mb-1">
                      📍 Levar e Entregar no Setor:
                    </div>
                    {(() => {
                      const color = getSectorColor(lastScannedDest.targetSector, sectorColors);
                      return (
                        <div
                          style={getSectorBadgeStyles(color)}
                          className="px-3.5 py-2 rounded-xl text-sm font-black border flex items-center gap-2 shadow-md"
                        >
                          <MapPin className="w-4 h-4 shrink-0" style={{ color: color.hex }} />
                          <span className="text-base">{lastScannedDest.targetSector}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                  <ScanLine className="w-8 h-8 mx-auto mb-2 opacity-50 text-blue-400" />
                  <p className="text-xs font-semibold text-slate-300">Aponte para o código da bomba</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Conforme for bipando, o setor de destino aparecerá aqui e a bomba entrará direto na lista em série.
                  </p>
                </div>
              )}
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
      {/* SEÇÃO 1: FILA DE BOMBAS BIPADAS PARA DEVOLUÇÃO EM SÉRIE                   */}
      {/* (Exatamente "como é feito na calibração", mostrando cada uma na ordem)     */}
      {/* ========================================================================= */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bombas Bipadas para Devolução (Fila em Série)</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  {scannedSeries.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Aparecem na ordem exata de bipagem para conferência antes de levar ao setor
              </p>
            </div>
          </div>

          {scannedSeries.length > 0 && (
            <button
              type="button"
              onClick={handleClearSeries}
              className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 self-end sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Fila do Carrinho</span>
            </button>
          )}
        </div>

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
                  className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-between gap-3 border ${
                    isTopNewest
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
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

                        {/* Setor de Destino em Destaque */}
                        <span
                          style={getSectorBadgeStyles(secColor)}
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 shadow-xs"
                          title="Setor onde a bomba deve ser devolvida"
                        >
                          <MapPin className="w-3 h-3 shrink-0" style={{ color: secColor.hex }} />
                          <span>{item.targetSector}</span>
                        </span>

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

                  {/* Ações: Status no Carrinho e Remover */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePacked(eq.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                        isPacked
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                      title={isPacked ? 'No carrinho (clique para desmarcar)' : 'Marcar como colocada no carrinho'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span className="hidden sm:inline">{isPacked ? 'No Carrinho ✓' : 'Marcar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromSeries(eq.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                      title="Remover desta fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
          
          {/* Filtros de Status no Carrinho */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
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

            <button
              type="button"
              onClick={() => setStatusFilter('PACKED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                statusFilter === 'PACKED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              No Carrinho ({cartPackedIds.size})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('UNPACKED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                statusFilter === 'UNPACKED'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600'
              }`}
            >
              Fora do Carrinho ({Math.max(0, readyEquipments.length - cartPackedIds.size)})
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
                  <th className="py-3 px-3 w-28 text-center">No Carrinho</th>
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
                  const isPacked = cartPackedIds.has(item.id);
                  const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
                  const secColor = getSectorColor(targetSec, sectorColors);

                  return (
                    <tr
                      key={item.id}
                      style={{ borderLeft: `4px solid ${secColor.hex}` }}
                      className={`transition-colors duration-150 ${
                        isPacked
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Nº Sequencial */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Checkbox No Carrinho */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => togglePacked(item.id)}
                          className={`w-6 h-6 mx-auto rounded-lg flex items-center justify-center transition ${
                            isPacked
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'border-2 border-slate-300 dark:border-slate-700 text-transparent hover:border-emerald-500'
                          }`}
                          title={isPacked ? 'No carrinho (clique para desmarcar)' : 'Marcar no carrinho'}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
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
              const isPacked = cartPackedIds.has(item.id);
              const targetSec = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
              const secColor = getSectorColor(targetSec, sectorColors);

              return (
                <div
                  key={item.id}
                  style={{ borderLeft: `4px solid ${secColor.hex}` }}
                  className={`p-3 flex items-center justify-between gap-2.5 transition ${
                    isPacked ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''
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

                  {/* Botão Checkbox Mobile */}
                  <button
                    type="button"
                    onClick={() => togglePacked(item.id)}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition ${
                      isPacked
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-emerald-500'
                    }`}
                    title={isPacked ? 'No carrinho' : 'Marcar no carrinho'}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
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
                      const isPacked = cartPackedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                            isPacked
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

                          <button
                            type="button"
                            onClick={() => togglePacked(item.id)}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center border shrink-0 transition ${
                              isPacked
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-500'
                            }`}
                            title={isPacked ? 'Separada no carrinho' : 'Marcar como colocada no carrinho'}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
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
          <strong>Dica de Produtividade Hospitalar:</strong> A lista menor em série permite conferir dezenas de bombas de uma vez só na tela. Bipando uma a uma com a câmera ou leitor de código de barras, a lista é construída sequencialmente em série com o setor de destino em destaque para rápida distribuição.
        </div>
      </div>

    </div>
  );
}
