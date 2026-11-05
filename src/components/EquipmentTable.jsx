import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Check, 
  X, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Tag, 
  Hash, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  Barcode, 
  CheckCircle2, 
  Filter, 
  ArrowUpDown,
  Building2,
  Cpu,
  Camera,
  Sparkles,
  Lock,
  Unlock,
  RotateCcw,
  CheckCheck,
  Target,
  Wrench,
  Zap,
  LayoutGrid,
  Settings,
  Palette
} from 'lucide-react';
import { extractCleanSerialNumber, parseCompositeBarcode } from '../utils/gs1Parser';
import { MODALITIES, isEquipmentChecked, getCheckMeta } from '../utils/modalities';
import { getSectorColor, getEffectiveSector, getSectorBadgeStyles } from '../utils/sectorColors';

export default function EquipmentTable({ 
  equipments, 
  onToggleCheck, 
  activeFilter, 
  setActiveFilter, 
  onQuickScanCode,
  lastScannedId,
  onOpenSerialScan,
  onTriggerMassAction,
  activeModality = 'calibracao',
  onChangeModality,
  serviceConfig = null,
  onOpenServiceConfig = null,
  sectorColors = {},
  onOpenSectorColors = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [sortField, setSortField] = useState('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;

  const sectors = useMemo(() => {
    const list = new Set();
    equipments.forEach(e => {
      if (e.setor_retirada && e.setor_retirada.trim()) list.add(e.setor_retirada.trim());
      if (e.setor && e.setor.trim()) list.add(e.setor.trim());
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [equipments]);

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (!quickCodeInput.trim()) return;
    const clean = extractCleanSerialNumber(quickCodeInput.trim());
    onQuickScanCode(clean || quickCodeInput.trim());
    setQuickCodeInput('');
  };

  const filteredEquipments = useMemo(() => {
    let result = [...equipments];

    if (activeFilter === 'checados') {
      result = result.filter(e => isEquipmentChecked(e, activeModality));
    } else if (activeFilter === 'pendentes') {
      result = result.filter(e => !isEquipmentChecked(e, activeModality));
    } else if (activeFilter === 'externa' || activeFilter === 'manutencao_externa') {
      result = result.filter(e => Boolean(e.check_externa));
    } else if (activeFilter === 'vencidos') {
      result = result.filter(e => 
        e.statusCalibracao?.toLowerCase().includes('vencid') || 
        e.statusCalibracao?.toLowerCase().includes('alerta') ||
        e.statusCalibracao?.toLowerCase().includes('a vencer')
      );
    }

    if (selectedSector !== 'ALL') {
      const targetSec = selectedSector.toLowerCase();
      result = result.filter(e => {
        const eff = getEffectiveSector(e).toLowerCase();
        const orig = (e.setor || '').toLowerCase();
        return eff === targetSec || orig === targetSec;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanSerial = extractCleanSerialNumber(searchQuery).toLowerCase();
      
      result = result.filter(e => {
        const serie = (e.serie || '').toLowerCase();
        const tag = (e.tag || '').toLowerCase();
        const code = (e.codigoBarras || '').toLowerCase();

        return (
          code.includes(q) || (code.length >= 4 && q.includes(code)) ||
          tag.includes(q) || (tag.length >= 4 && q.includes(tag)) ||
          serie.includes(q) || (serie.length >= 6 && q.includes(serie)) ||
          (cleanSerial && cleanSerial.length >= 4 && (serie.includes(cleanSerial) || tag.includes(cleanSerial))) ||
          e.equipamento?.toLowerCase().includes(q) ||
          e.fabricante?.toLowerCase().includes(q) ||
          e.modelo?.toLowerCase().includes(q) ||
          e.setor?.toLowerCase().includes(q) ||
          e.observacao?.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'name') {
        valA = a.equipamento || '';
        valB = b.equipamento || '';
      } else if (sortField === 'tag') {
        valA = a.tag || '';
        valB = b.tag || '';
      } else if (sortField === 'validade') {
        valA = a.validadeCalibracao || '';
        valB = b.validadeCalibracao || '';
      } else {
        valA = isEquipmentChecked(a, activeModality) ? 1 : 0;
        valB = isEquipmentChecked(b, activeModality) ? 1 : 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [equipments, activeFilter, selectedSector, searchQuery, sortField, sortAsc, activeModality]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('vencid')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-3 h-3" />
          Vencido
        </span>
      );
    }
    if (s.includes('a vencer') || s.includes('alerta') || s.includes('proximo')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
          <Clock className="w-3 h-3" />
          A Vencer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
        <Check className="w-3 h-3" />
        Válido
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden w-full max-w-full">
      
      {/* Search and Quick Scan Bar */}
      <div className="p-3 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 sm:space-y-3 bg-slate-50/50 dark:bg-slate-900/50 w-full overflow-hidden">
        
        {/* Row 1: Direct Gun/Barcode Scan Bar */}
        <form onSubmit={handleQuickSubmit} className="relative flex items-center w-full min-w-0">
          <div className="absolute left-3 text-blue-600 dark:text-blue-400 flex items-center gap-1.5 pointer-events-none">
            <Barcode className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          </div>
          <input
            type="text"
            placeholder="Bipe com leitor ou digite o código..."
            value={quickCodeInput}
            onChange={(e) => setQuickCodeInput(e.target.value)}
            className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-blue-500/40 dark:border-blue-500/50 rounded-xl sm:rounded-2xl pl-9 sm:pl-11 pr-18 sm:pr-20 py-2 sm:py-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-1.5 sm:right-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Check</span>
          </button>
        </form>

        {/* Row 2: Search Query */}
        <div className="relative w-full min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, tag, série, modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2.5: Sector Selector & Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full overflow-hidden">
          
          {/* Sector Selector & Color Customizer */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 flex-wrap">
            {sectors.length > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full sm:w-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 truncate"
                >
                  <option value="ALL">Todos os Setores ({equipments.length})</option>
                  {sectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onOpenSectorColors && (
              <button
                type="button"
                onClick={onOpenSectorColors}
                className="py-1.5 px-2.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                title="Personalizar cores de cada setor na planilha"
              >
                <Palette className="w-3.5 h-3.5 text-orange-500" />
                <span className="hidden sm:inline">Cores dos Setores</span>
                <span className="sm:hidden">Cores</span>
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto no-scrollbar">
            {['todos', 'pendentes', 'checados', 'vencidos'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition shrink-0 ${
                  activeFilter === f
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

        </div>

        {/* Row 3: Quick Action Tools (Digitalizar Foto OCR & Ações em Massa com Senha) */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 w-full">
          
          {/* Digitalizar Foto OCR Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSerialScan}
              className="py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Digitalizar Foto / NS (OCR)</span>
              <span className="text-[10px] bg-white/20 px-1 rounded font-normal hidden sm:inline">IA</span>
            </button>

            {onOpenServiceConfig && (
              <button
                type="button"
                onClick={onOpenServiceConfig}
                className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition active:scale-95"
                title="Configurar serviços ativos e modo de bipagem (tudo de uma vez ou separado)"
              >
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Opções:</span>
                <span>{serviceConfig?.executionMode === 'all_at_once' ? '⚡ Bipar Tudo' : '🎯 Separado'}</span>
              </button>
            )}
          </div>

          {/* Smart Batch Actions (Password Protected) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onTriggerMassAction && onTriggerMassAction('check_all')}
              className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
              title="Ação inteligente em lote (escolher modalidades, técnico executor e setores)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Ação em Lote</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerMassAction && onTriggerMassAction('uncheck_all')}
              className="py-1.5 px-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              title="Desmarcar / reabrir equipamentos em lote (requer senha)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Desmarcar</span>
            </button>
          </div>

        </div>

      </div>

      {/* MOBILE VIEW: Touch-Optimized Cards for Android & iOS */}
      <div className="sm:hidden p-3 space-y-3">
        {filteredEquipments.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs">Nenhum equipamento encontrado</p>
            <p className="text-[11px] text-slate-400 mt-1">Ajuste os filtros ou a busca acima.</p>
          </div>
        ) : (
          filteredEquipments.map((item) => {
            const isRecentlyScanned = lastScannedId === item.id || lastScannedId === item.codigoBarras;
            const isCheckedCurrent = isEquipmentChecked(item, activeModality);
            const isCalOk = Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
            const isPrevOk = Boolean(item.check_preventiva);
            const isSegOk = Boolean(item.check_seguranca);
            const isExtOk = Boolean(item.check_externa);

            const effectiveSector = getEffectiveSector(item);
            const sectorColor = getSectorColor(effectiveSector, sectorColors);
            const isDiffSector = item.setor_retirada && item.setor && 
              item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();

            return (
              <div
                key={item.id}
                style={{ borderLeft: `5px solid ${sectorColor.hex}` }}
                className={`p-4 rounded-2xl border transition-all ${
                  isCheckedCurrent
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/60 dark:border-emerald-800/50'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm'
                } ${isRecentlyScanned ? 'ring-2 ring-blue-500 animate-pulse' : ''}`}
              >
                {/* Top header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.tag || item.codigoBarras}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                      {item.equipamento}
                    </h4>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isExtOk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        📦 Manut. Externa
                      </span>
                    )}
                    {getStatusBadge(item.statusCalibracao)}
                  </div>
                </div>

                {/* Specs / Details */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 py-2 border-t border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Setor (Coleta/Origem):</span>
                    <span 
                      style={getSectorBadgeStyles(sectorColor)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-xs"
                      title={`Setor de Coleta / Efetivo: ${effectiveSector}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sectorColor.hex }} />
                      <span>{effectiveSector}</span>
                    </span>
                    {isDiffSector && (
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        🏢 Origem: {item.setor}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Validade:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{item.validadeCalibracao || 'N/A'}</span>
                  </div>
                  {(item.fabricante || item.modelo) && (
                    <div className="col-span-2 pt-1 flex items-center gap-1.5 truncate">
                      <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.fabricante} {item.modelo}</span>
                      {item.serie && <span>• S/N: {item.serie}</span>}
                    </div>
                  )}
                </div>

                {/* 3 Work Modalities Quick Pills (Calibração | Preventiva | Segurança) */}
                <div className="py-2.5 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Frentes Técnicas / Equipes:</span>
                    {serviceConfig?.executionMode === 'all_at_once' && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/15 px-1.5 py-0.2 rounded">
                        ⚡ Modo Combo (Bipa Tudo)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {/* Calibração Pill */}
                    {(serviceConfig?.enableCalibracao ?? true) && (
                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.id, 'calibracao')}
                        className={`p-1.5 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center transition active:scale-95 ${
                          isCalOk
                            ? 'bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-blue-400'
                        }`}
                        title="Clique para alternar o status de Calibração"
                      >
                        <span className="flex items-center gap-1">
                          🎯 Calibração
                        </span>
                        <span className={`text-[9px] mt-0.5 font-normal ${isCalOk ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400'}`}>
                          {isCalOk ? '✓ OK' : '⏳ Pendente'}
                        </span>
                      </button>
                    )}

                    {/* Preventiva Pill */}
                    {(serviceConfig?.enablePreventiva ?? true) && (
                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.id, 'preventiva')}
                        className={`p-1.5 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center transition active:scale-95 ${
                          isPrevOk
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-emerald-400'
                        }`}
                        title="Clique para alternar o status de Manutenção Preventiva"
                      >
                        <span className="flex items-center gap-1">
                          🔧 Preventiva
                        </span>
                        <span className={`text-[9px] mt-0.5 font-normal ${isPrevOk ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {isPrevOk ? '✓ OK' : '⏳ Pendente'}
                        </span>
                      </button>
                    )}

                    {/* Teste de Segurança Pill */}
                    {(serviceConfig?.enableSeguranca ?? true) && (
                      <button
                        type="button"
                        onClick={() => onToggleCheck(item.id, 'seguranca')}
                        className={`p-1.5 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center transition active:scale-95 ${
                          isSegOk
                            ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-amber-400'
                        }`}
                        title="Clique para alternar o status de Teste de Segurança Elétrica"
                      >
                        <span className="flex items-center gap-1">
                          ⚡ Seg. Elétrica
                        </span>
                        <span className={`text-[9px] mt-0.5 font-normal ${isSegOk ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}`}>
                          {isSegOk ? '✓ OK' : '⏳ Pendente'}
                        </span>
                      </button>
                    )}

                    {/* Manutenção Externa Pill */}
                    <button
                      type="button"
                      onClick={() => onToggleCheck(item.id, 'externa')}
                      className={`p-1.5 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center transition active:scale-95 ${
                        isExtOk
                          ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-purple-400'
                      }`}
                      title="Equipamento enviado para calibração e conserto por terceirizados"
                    >
                      <span className="flex items-center gap-1">
                        📦 Manut. Externa
                      </span>
                      <span className={`text-[9px] mt-0.5 font-normal ${isExtOk ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-400'}`}>
                        {isExtOk ? '✓ Enviada' : '⏳ Não enviada'}
                      </span>
                    </button>
                  </div>

                  {/* Auditoria / Quem conferiu a modalidade ativa */}
                  {(() => {
                    const meta = getCheckMeta(item, activeModality);
                    if (meta.checked && meta.user) {
                      return (
                        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">
                            {currentMod.shortName}: {meta.user}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Big Touch Action Button (focado na frente de trabalho atual) */}
                <div className="pt-2">
                  <button
                    onClick={() => onToggleCheck(item.id, activeModality)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm ${
                      isCheckedCurrent
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600'
                        : currentMod.btnClass
                    }`}
                  >
                    {isCheckedCurrent ? (
                      <>
                        <X className="w-4 h-4 text-slate-500" />
                        Desmarcar {currentMod.shortName}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        Confirmar {currentMod.shortName}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW: High-Density Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider select-none">
            <tr>
              <th className="py-3.5 px-4 w-16 text-center">Status</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1.5">
                  Equipamento / Aparelho
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white hidden md:table-cell" onClick={() => toggleSort('tag')}>
                <div className="flex items-center gap-1.5">
                  Tag / Código
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 hidden lg:table-cell">Setor / Local</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort('validade')}>
                <div className="flex items-center gap-1.5">
                  Validade Calibração
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 text-center">Frentes Técnicas (3 Equipes)</th>
              <th className="py-3.5 px-4 text-center w-32">Ação ({currentMod.shortName})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredEquipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-400" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhum equipamento encontrado</p>
                    <p className="text-xs">Tente ajustar seus termos de busca ou mudar o filtro selecionado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEquipments.map((item) => {
                const isRecentlyScanned = lastScannedId === item.id || lastScannedId === item.codigoBarras;
                const isCheckedCurrent = isEquipmentChecked(item, activeModality);
                const isCalOk = Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
                const isPrevOk = Boolean(item.check_preventiva);
                const isSegOk = Boolean(item.check_seguranca);
                const isExtOk = Boolean(item.check_externa);

                const effectiveSector = getEffectiveSector(item);
                const sectorColor = getSectorColor(effectiveSector, sectorColors);
                const isDiffSector = item.setor_retirada && item.setor && 
                  item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();

                return (
                  <tr 
                    key={item.id}
                    style={{ borderLeft: `4px solid ${sectorColor.hex}` }}
                    className={`transition-colors duration-200 group ${
                      isCheckedCurrent 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15' 
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    } ${isRecentlyScanned ? 'animate-pulse bg-blue-100/60 dark:bg-blue-900/40' : ''}`}
                  >
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleCheck(item.id, activeModality)}
                        className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                          isCheckedCurrent
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'border-2 border-slate-300 dark:border-slate-700 text-transparent hover:border-blue-500'
                        }`}
                        title={isCheckedCurrent ? `Desmarcar ${currentMod.shortName}` : `Marcar ${currentMod.shortName}`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                        <span>{item.equipamento}</span>
                        {isExtOk && (
                          <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            📦 Manut. Externa
                          </span>
                        )}
                        {isCheckedCurrent && !isExtOk && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            OK ({currentMod.shortName})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                        {item.fabricante && <span>{item.fabricante}</span>}
                        {item.modelo && <span>• Mod: {item.modelo}</span>}
                        {item.serie && <span>• S/N: {item.serie}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell font-mono">
                      <div className="text-slate-800 dark:text-slate-200 font-bold">{item.tag}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Barcode className="w-3 h-3 text-slate-400" />
                        {item.codigoBarras}
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden lg:table-cell text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col gap-1 items-start">
                        <span 
                          style={getSectorBadgeStyles(sectorColor)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-xs"
                          title={`Setor de Coleta / Efetivo: ${effectiveSector}`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sectorColor.hex }} />
                          <span>{effectiveSector}</span>
                        </span>
                        {isDiffSector && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium pl-1 flex items-center gap-1" title={`Cadastrado originalmente em: ${item.setor}`}>
                            🏢 Origem: {item.setor}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.validadeCalibracao || 'Não informada'}</span>
                      </div>
                    </td>

                    {/* Work Modalities Interactive Pills */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        {/* Calibração */}
                        {(serviceConfig?.enableCalibracao ?? true) && (
                          <button
                            type="button"
                            onClick={() => onToggleCheck(item.id, 'calibracao')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition active:scale-95 ${
                              isCalOk
                                ? 'bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                            }`}
                            title={`Calibração: ${isCalOk ? 'Conferido' : 'Pendente'}. Clique para alternar.`}
                          >
                            🎯 {isCalOk ? '✓ Calib' : '⏳ Calib'}
                          </button>
                        )}

                        {/* Preventiva */}
                        {(serviceConfig?.enablePreventiva ?? true) && (
                          <button
                            type="button"
                            onClick={() => onToggleCheck(item.id, 'preventiva')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition active:scale-95 ${
                              isPrevOk
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                            }`}
                            title={`Preventiva: ${isPrevOk ? 'Conferido' : 'Pendente'}. Clique para alternar.`}
                          >
                            🔧 {isPrevOk ? '✓ Prev' : '⏳ Prev'}
                          </button>
                        )}

                        {/* Segurança */}
                        {(serviceConfig?.enableSeguranca ?? true) && (
                          <button
                            type="button"
                            onClick={() => onToggleCheck(item.id, 'seguranca')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition active:scale-95 ${
                              isSegOk
                                ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                            }`}
                            title={`Teste de Segurança: ${isSegOk ? 'Conferido' : 'Pendente'}. Clique para alternar.`}
                          >
                            ⚡ {isSegOk ? '✓ Seg' : '⏳ Seg'}
                          </button>
                        )}

                        {/* Manutenção Externa */}
                        <button
                          type="button"
                          onClick={() => onToggleCheck(item.id, 'externa')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition active:scale-95 ${
                            isExtOk
                              ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-400/40'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-purple-600'
                          }`}
                          title={`Manutenção Externa: ${isExtOk ? 'Enviada para conserto/calibração terceirizada' : 'Não enviada'}. Clique para alternar.`}
                        >
                          📦 {isExtOk ? '✓ Externa' : 'Externa'}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleCheck(item.id, activeModality)}
                        className={`w-full py-1.5 px-3 rounded-xl font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 ${
                          isCheckedCurrent
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-400'
                            : currentMod.btnClass
                        }`}
                      >
                        {isCheckedCurrent ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            Desmarcar
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Checar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats summary */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div>
          Exibindo <strong>{filteredEquipments.length}</strong> de <strong>{equipments.length}</strong> equipamentos ({currentMod.name})
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Checados: {equipments.filter(e => isEquipmentChecked(e, activeModality)).length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            Pendentes: {equipments.filter(e => !isEquipmentChecked(e, activeModality)).length}
          </span>
        </div>
      </div>

    </div>
  );
}
