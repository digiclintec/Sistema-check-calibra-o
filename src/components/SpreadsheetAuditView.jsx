import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  User, 
  Calendar, 
  ArrowRight,
  FileSpreadsheet,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Maximize2,
  Settings,
  Users,
  Target,
  Wrench,
  Zap,
  MapPin,
  Clock3,
  Palette
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getSectorColor, getEffectiveSector, getSectorBadgeStyles } from '../utils/sectorColors';
import { exportStyledEquipmentsExcel, exportStyledPontoExcel } from '../utils/excelExporter';

export default function SpreadsheetAuditView({
  equipments = [],
  hospitalName = '',
  planTitle = '',
  onRefresh,
  isRefreshing = false,
  serviceConfig = null,
  onOpenServiceConfig = null,
  sectorColors = {},
  onOpenSectorColors = null
}) {
  const [viewMode, setViewMode] = useState('equipments'); // 'equipments' | 'ponto'
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');

  // Setores disponíveis (tanto cadastrados quanto de retirada)
  const sectors = useMemo(() => {
    const list = new Set();
    equipments.forEach(e => {
      if (e.setor_retirada && e.setor_retirada.trim()) list.add(e.setor_retirada.trim());
      if (e.setor && e.setor.trim()) list.add(e.setor.trim());
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [equipments]);

  // Técnicos disponíveis a partir das checagens
  const technicians = useMemo(() => {
    const list = new Set();
    equipments.forEach(e => {
      if (e.usuario_calibracao) list.add(e.usuario_calibracao);
      if (e.usuario_preventiva) list.add(e.usuario_preventiva);
      if (e.usuario_seguranca) list.add(e.usuario_seguranca);
      if (e.conferidoPor) list.add(e.conferidoPor);
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [equipments]);

  // Cálculos de Estatísticas Globais
  const stats = useMemo(() => {
    const total = equipments.length;
    let calOk = 0;
    let prevOk = 0;
    let segOk = 0;
    let complete100 = 0;
    let withSectorDiff = 0;

    equipments.forEach(e => {
      if (e.check_calibracao) calOk++;
      if (e.check_preventiva) prevOk++;
      if (e.check_seguranca) segOk++;

      const isComplete = (
        (!serviceConfig || !serviceConfig.enableCalibracao || e.check_calibracao) &&
        (!serviceConfig || !serviceConfig.enablePreventiva || e.check_preventiva) &&
        (!serviceConfig || !serviceConfig.enableSeguranca || e.check_seguranca)
      );

      if (isComplete) {
        complete100++;
      }

      if (e.setor_retirada && e.setor && e.setor_retirada.trim().toLowerCase() !== e.setor.trim().toLowerCase()) {
        withSectorDiff++;
      }
    });

    return {
      total,
      calOk,
      calPct: total > 0 ? Math.round((calOk / total) * 100) : 0,
      prevOk,
      prevPct: total > 0 ? Math.round((prevOk / total) * 100) : 0,
      segOk,
      segPct: total > 0 ? Math.round((segOk / total) * 100) : 0,
      complete100,
      complete100Pct: total > 0 ? Math.round((complete100 / total) * 100) : 0,
      pendingTotal: total - complete100,
      withSectorDiff
    };
  }, [equipments, serviceConfig]);

  // ---------------- ENTRADAS DO ESPELHO DE PONTO & TRABALHOS ---------------- //
  const pontoEntries = useMemo(() => {
    const list = [];

    equipments.forEach(eq => {
      // 1. Calibração
      if (eq.check_calibracao) {
        list.push({
          id: `${eq.id}-cal`,
          equipmentName: eq.equipamento || eq.nome || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          modality: 'calibracao',
          modalityLabel: 'Calibração',
          user: eq.usuario_calibracao || eq.conferidoPor || 'Técnico',
          date: eq.data_calibracao || eq.dataCheck || null,
          setorOriginal: eq.setor || 'Geral',
          setorRetirada: eq.setor_retirada || eq.setor || 'Geral',
          obs: eq.observacao || ''
        });
      }

      // 2. Preventiva
      if (eq.check_preventiva) {
        list.push({
          id: `${eq.id}-prev`,
          equipmentName: eq.equipamento || eq.nome || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          modality: 'preventiva',
          modalityLabel: 'Preventiva',
          user: eq.usuario_preventiva || eq.conferidoPor || 'Técnico',
          date: eq.data_preventiva || eq.dataCheck || null,
          setorOriginal: eq.setor || 'Geral',
          setorRetirada: eq.setor_retirada || eq.setor || 'Geral',
          obs: eq.observacao || ''
        });
      }

      // 3. Segurança Elétrica
      if (eq.check_seguranca) {
        list.push({
          id: `${eq.id}-seg`,
          equipmentName: eq.equipamento || eq.nome || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          modality: 'seguranca',
          modalityLabel: 'Segurança Elétrica',
          user: eq.usuario_seguranca || eq.conferidoPor || 'Técnico',
          date: eq.data_seguranca || eq.dataCheck || null,
          setorOriginal: eq.setor || 'Geral',
          setorRetirada: eq.setor_retirada || eq.setor || 'Geral',
          obs: eq.observacao || ''
        });
      }
    });

    // Ordena do mais recente para o mais antigo
    return list.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [equipments]);

  // Estatísticas agrupadas por técnico (Resumo do Espelho de Ponto)
  const technicianPontoStats = useMemo(() => {
    const statsMap = {};

    pontoEntries.forEach(entry => {
      const user = entry.user || 'Técnico';
      if (!statsMap[user]) {
        statsMap[user] = {
          name: user,
          total: 0,
          calibracao: 0,
          preventiva: 0,
          seguranca: 0,
          sectors: new Set(),
          firstAction: entry.date,
          lastAction: entry.date
        };
      }

      statsMap[user].total += 1;
      if (entry.modality === 'calibracao') statsMap[user].calibracao += 1;
      if (entry.modality === 'preventiva') statsMap[user].preventiva += 1;
      if (entry.modality === 'seguranca') statsMap[user].seguranca += 1;
      if (entry.setorRetirada) statsMap[user].sectors.add(entry.setorRetirada);

      // Atualiza primeira e última data
      if (entry.date) {
        const time = new Date(entry.date).getTime();
        if (!statsMap[user].firstAction || time < new Date(statsMap[user].firstAction).getTime()) {
          statsMap[user].firstAction = entry.date;
        }
        if (!statsMap[user].lastAction || time > new Date(statsMap[user].lastAction).getTime()) {
          statsMap[user].lastAction = entry.date;
        }
      }
    });

    return Object.values(statsMap).sort((a, b) => b.total - a.total);
  }, [pontoEntries]);

  // Filtragem da Lista de Equipamentos
  const filteredEquipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return equipments.filter(item => {
      if (query) {
        const tag = String(item.tag || '').toLowerCase();
        const serie = String(item.serie || '').toLowerCase();
        const nome = String(item.nome || item.equipamento || '').toLowerCase();
        const setor = String(item.setor || '').toLowerCase();
        const setorRet = String(item.setor_retirada || '').toLowerCase();
        const obs = String(item.observacao || '').toLowerCase();
        const uCal = String(item.usuario_calibracao || '').toLowerCase();
        const uPrev = String(item.usuario_preventiva || '').toLowerCase();
        const uSeg = String(item.usuario_seguranca || '').toLowerCase();

        const match = tag.includes(query) ||
          serie.includes(query) ||
          nome.includes(query) ||
          setor.includes(query) ||
          setorRet.includes(query) ||
          obs.includes(query) ||
          uCal.includes(query) ||
          uPrev.includes(query) ||
          uSeg.includes(query);

        if (!match) return false;
      }

      if (sectorFilter !== 'ALL') {
        const s1 = String(item.setor || '').trim().toLowerCase();
        const s2 = String(item.setor_retirada || '').trim().toLowerCase();
        const target = sectorFilter.trim().toLowerCase();
        if (s1 !== target && s2 !== target) return false;
      }

      if (technicianFilter !== 'ALL') {
        const t1 = item.usuario_calibracao;
        const t2 = item.usuario_preventiva;
        const t3 = item.usuario_seguranca;
        const t4 = item.conferidoPor;
        if (t1 !== technicianFilter && t2 !== technicianFilter && t3 !== technicianFilter && t4 !== technicianFilter) {
          return false;
        }
      }

      const isCompleteItem = (
        (!serviceConfig || !serviceConfig.enableCalibracao || item.check_calibracao) &&
        (!serviceConfig || !serviceConfig.enablePreventiva || item.check_preventiva) &&
        (!serviceConfig || !serviceConfig.enableSeguranca || item.check_seguranca)
      );

      if (statusFilter === '100_COMPLETE') return isCompleteItem;
      if (statusFilter === 'ANY_PENDING') return !isCompleteItem;
      if (statusFilter === 'PENDING_CAL') return !item.check_calibracao;
      if (statusFilter === 'PENDING_PREV') return !item.check_preventiva;
      if (statusFilter === 'PENDING_SEG') return !item.check_seguranca;
      if (statusFilter === 'SECTOR_DIFF') {
        return item.setor_retirada && item.setor && 
          item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();
      }

      return true;
    });
  }, [equipments, searchQuery, sectorFilter, statusFilter, technicianFilter, serviceConfig]);

  // Filtragem da Lista de Ponto
  const filteredPontoEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return pontoEntries.filter(entry => {
      if (technicianFilter !== 'ALL' && entry.user !== technicianFilter) return false;
      if (sectorFilter !== 'ALL' && entry.setorRetirada !== sectorFilter && entry.setorOriginal !== sectorFilter) return false;
      if (query) {
        const name = entry.equipmentName.toLowerCase();
        const tag = entry.tag.toLowerCase();
        const serie = entry.serie.toLowerCase();
        const user = entry.user.toLowerCase();
        const mod = entry.modalityLabel.toLowerCase();
        const sec = entry.setorRetirada.toLowerCase();
        return name.includes(query) || tag.includes(query) || serie.includes(query) || user.includes(query) || mod.includes(query) || sec.includes(query);
      }
      return true;
    });
  }, [pontoEntries, searchQuery, technicianFilter, sectorFilter]);

  // Exportação 1: Espelho da Planilha Completa de Equipamentos com Cores
  const handleExportAuditExcel = () => {
    if (equipments.length === 0) return;
    const cleanHosp = (hospitalName || 'Auditoria').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Espelho_Planilha_${cleanHosp}_${dateStr}.xlsx`;

    exportStyledEquipmentsExcel(equipments, {
      hospitalName,
      planTitle: planTitle || 'Espelho da Planilha',
      fileName,
      sectorColors
    });
  };

  // Exportação 2: Espelho de Ponto & Trabalhos dos Técnicos com Cores e Resumo
  const handleExportPontoExcel = () => {
    if (pontoEntries.length === 0) return;
    const cleanHosp = (hospitalName || 'Auditoria').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Espelho_de_Ponto_Tecnicos_${cleanHosp}_${dateStr}.xlsx`;

    exportStyledPontoExcel(filteredPontoEntries, {
      hospitalName,
      fileName,
      sectorColors
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* Banner de Segurança & Modo Somente Leitura */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-lg border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-300 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-xl tracking-tight">
                Espelho Seguro da Planilha & Ponto
              </h2>
              <span className="bg-emerald-400/20 text-emerald-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-300/30">
                100% Protegido
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5">
              Auditoria dos equipamentos e espelho de ponto/jornada dos técnicos sem risco de alterações acidentais.
            </p>
          </div>
        </div>

        {/* Botões de Exportação e Atualização */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-white/15"
              title="Atualizar dados em tempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          )}

          {viewMode === 'equipments' ? (
            <button
              onClick={handleExportAuditExcel}
              className="py-2 px-3.5 bg-white text-slate-900 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md active:scale-95"
              title="Exportar espelho completo da planilha para Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Baixar Espelho Excel</span>
            </button>
          ) : (
            <button
              onClick={handleExportPontoExcel}
              className="py-2 px-3.5 bg-white text-slate-900 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md active:scale-95"
              title="Exportar espelho de ponto dos técnicos para Excel"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Baixar Espelho de Ponto (Excel)</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 hidden sm:flex items-center justify-center"
            title="Imprimir relatório"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-Aba Seletora: Espelho de Equipamentos vs Espelho de Ponto dos Técnicos */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => setViewMode('equipments')}
          className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            viewMode === 'equipments'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>📋 Espelho da Planilha ({equipments.length} Equipamentos)</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('ponto')}
          className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            viewMode === 'ponto'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock3 className="w-4 h-4 text-blue-500" />
          <span>⏱️ Espelho de Ponto & Jornada da Equipe ({pontoEntries.length} Ações)</span>
        </button>
      </div>

      {/* Cards de Métricas e Desempenho Global */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total Equipamentos */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Equipamentos
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats.total}
            </span>
            <span className="text-xs text-slate-400 font-medium">100% da base</span>
          </div>
        </div>

        {/* 🎯 Calibração */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <span>🎯 Calibração</span>
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
              {stats.calPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-300 font-mono">
              {stats.calOk}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {stats.total}</span>
          </div>
          <div className="mt-2 w-full bg-blue-100 dark:bg-blue-950/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${stats.calPct}%` }} />
          </div>
        </div>

        {/* 🔧 Preventiva */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>🔧 Preventiva</span>
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
              {stats.prevPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {stats.prevOk}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {stats.total}</span>
          </div>
          <div className="mt-2 w-full bg-amber-100 dark:bg-amber-950/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.prevPct}%` }} />
          </div>
        </div>

        {/* ⚡ Segurança Elétrica */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <span>⚡ Seg. Elétrica</span>
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">
              {stats.segPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {stats.segOk}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {stats.total}</span>
          </div>
          <div className="mt-2 w-full bg-purple-100 dark:bg-purple-950/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${stats.segPct}%` }} />
          </div>
        </div>

        {/* 🏆 100% Concluídos */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/30 dark:to-teal-950/30 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
              <span>🏆 100% Geral</span>
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.complete100Pct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.complete100}
            </span>
            <span className="text-xs text-slate-400 font-mono">concluídos</span>
          </div>
          <div className="mt-2 w-full bg-emerald-100 dark:bg-emerald-950/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.complete100Pct}%` }} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={viewMode === 'equipments' ? "Buscar por tag, número de série, equipamento, setor ou técnico..." : "Buscar técnico, tag, serviço ou setor de retirada..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Setor */}
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">🏢 Setores: Todos</option>
              {sectors.map(sec => (
                <option key={sec} value={sec}>📍 {sec}</option>
              ))}
            </select>

            {/* Filtro Técnico */}
            {technicians.length > 0 && (
              <select
                value={technicianFilter}
                onChange={(e) => setTechnicianFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">👤 Técnico: Todos</option>
                {technicians.map(tech => (
                  <option key={tech} value={tech}>👤 {tech}</option>
                ))}
              </select>
            )}

            {/* Filtro Status (somente no modo equipamentos) */}
            {viewMode === 'equipments' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">📋 Status: Todos</option>
                <option value="100_COMPLETE">🏆 100% Concluídos</option>
                <option value="ANY_PENDING">⏳ Pendência em alguma modalidade</option>
                <option value="PENDING_CAL">🎯 Pendente em Calibração</option>
                <option value="PENDING_PREV">🔧 Pendente em Preventiva</option>
                <option value="PENDING_SEG">⚡ Pendente em Seg. Elétrica</option>
                <option value="SECTOR_DIFF">📦 Divergência de Setor</option>
              </select>
            )}

            {/* Botão de Cores dos Setores */}
            {onOpenSectorColors && (
              <button
                type="button"
                onClick={onOpenSectorColors}
                className="px-3 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                title="Personalizar cores de cada setor na planilha"
              >
                <Palette className="w-3.5 h-3.5 text-orange-500" />
                <span className="hidden sm:inline">Cores dos Setores</span>
                <span className="sm:hidden">Cores</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= VIEW 1: ESPELHO DA PLANILHA (EQUIPAMENTOS) ================= */}
      {viewMode === 'equipments' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-xs">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 min-w-[120px]">Tag / Patrimônio</th>
                  <th className="py-3 px-3 min-w-[130px]">Nº de Série</th>
                  <th className="py-3 px-3 min-w-[200px]">Equipamento</th>
                  <th className="py-3 px-3 min-w-[140px]">Setor Cadastrado</th>
                  <th className="py-3 px-3 min-w-[140px]">Setor Retirada</th>
                  <th className="py-3 px-3 min-w-[160px] text-center bg-blue-500/10 dark:bg-blue-950/40">Calibração</th>
                  <th className="py-3 px-3 min-w-[160px] text-center bg-amber-500/10 dark:bg-amber-950/40">Preventiva</th>
                  <th className="py-3 px-3 min-w-[160px] text-center bg-purple-500/10 dark:bg-purple-950/40">Seg. Elétrica</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Status Geral</th>
                  <th className="py-3 px-3 min-w-[180px]">Observações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                {filteredEquipments.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400">
                      Nenhum equipamento corresponde aos filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredEquipments.map((item, idx) => {
                    const isComplete = item.check_calibracao && item.check_preventiva && item.check_seguranca;
                    const isDiffSector = item.setor_retirada && item.setor && 
                      item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();

                    const effectiveSector = getEffectiveSector(item);
                    const effectiveColor = getSectorColor(effectiveSector, sectorColors);
                    const originalColor = getSectorColor(item.setor, sectorColors);

                    return (
                      <tr 
                        key={item.id || item.tag || idx}
                        style={{ borderLeft: `4px solid ${effectiveColor.hex}` }}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isComplete ? 'bg-emerald-500/[0.02]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono text-[11px]">{item.tag || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">{item.serie || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">{item.nome || item.equipamento || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          <span 
                            style={getSectorBadgeStyles(originalColor)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] border"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: originalColor.hex }} />
                            <span>{item.setor || 'Geral'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.setor_retirada ? (
                            <span 
                              style={getSectorBadgeStyles(effectiveColor)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-[11px] border shadow-xs"
                              title={`Setor de Coleta: ${item.setor_retirada}${isDiffSector ? ` (Origem: ${item.setor})` : ''}`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: effectiveColor.hex }} />
                              {isDiffSector && <ArrowRight className="w-3 h-3" />}
                              <span>{item.setor_retirada}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Calibração */}
                        <td className="py-2 px-3 text-center bg-blue-500/[0.03] dark:bg-blue-950/10">
                          {item.check_calibracao ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>OK</span>
                              </span>
                              {item.usuario_calibracao && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium">
                                  {item.usuario_calibracao}
                                </span>
                              )}
                              {item.data_calibracao && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {formatDate(item.data_calibracao)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              <Clock className="w-3 h-3" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>

                        {/* Preventiva */}
                        <td className="py-2 px-3 text-center bg-amber-500/[0.03] dark:bg-amber-950/10">
                          {item.check_preventiva ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>OK</span>
                              </span>
                              {item.usuario_preventiva && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium">
                                  {item.usuario_preventiva}
                                </span>
                              )}
                              {item.data_preventiva && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {formatDate(item.data_preventiva)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              <Clock className="w-3 h-3" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>

                        {/* Seg. Elétrica */}
                        <td className="py-2 px-3 text-center bg-purple-500/[0.03] dark:bg-purple-950/10">
                          {item.check_seguranca ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>OK</span>
                              </span>
                              {item.usuario_seguranca && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium">
                                  {item.usuario_seguranca}
                                </span>
                              )}
                              {item.data_seguranca && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {formatDate(item.data_seguranca)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              <Clock className="w-3 h-3" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>

                        {/* Status Geral */}
                        <td className="py-2.5 px-3 text-center">
                          {isComplete ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase tracking-wide border border-emerald-500/40">
                              <Sparkles className="w-3 h-3 text-emerald-500" />
                              <span>100% OK</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
                              Parcial
                            </span>
                          )}
                        </td>

                        {/* Observações */}
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[200px]" title={item.observacao || ''}>
                          {item.observacao || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: ESPELHO DE PONTO & JORNADA DA EQUIPE ================= */}
      {viewMode === 'ponto' && (
        <div className="space-y-4">
          
          {/* Cards de Produtividade & Horários por Técnico */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {technicianPontoStats.map((tech) => (
              <div 
                key={tech.name}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                      {tech.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{tech.name}</h4>
                      <p className="text-[11px] text-slate-500">Técnico em Campo</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-xs font-mono">
                    {tech.total} {tech.total === 1 ? 'Ação' : 'Ações'}
                  </span>
                </div>

                {/* Métricas por Modalidade */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/30">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">🎯 Calibração</span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono">{tech.calibracao}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">🔧 Preventiva</span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono">{tech.preventiva}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/30">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">⚡ Seg. Elétr.</span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono">{tech.seguranca}</span>
                  </div>
                </div>

                {/* Horários de Início e Fim da Jornada (Registro de Ponto) */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>🟢 Início da Jornada:</span>
                    <strong className="text-slate-700 dark:text-slate-300 font-mono">{formatDate(tech.firstAction) || 'N/A'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>🔴 Último Registro:</span>
                    <strong className="text-slate-700 dark:text-slate-300 font-mono">{formatDate(tech.lastAction) || 'N/A'}</strong>
                  </div>
                  {tech.sectors.size > 0 && (
                    <div className="pt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mr-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        Setores:
                      </span>
                      {Array.from(tech.sectors).map(sec => {
                        const sColor = getSectorColor(sec, sectorColors);
                        return (
                          <span
                            key={sec}
                            style={getSectorBadgeStyles(sColor)}
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded border shadow-2xs"
                          >
                            {sec}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela Cronológica de Ações (O Espelho de Ponto Detalhado) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Registro Cronológico de Atividades ({filteredPontoEntries.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">Ordenado por horário mais recente</span>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-xs">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[140px]">⏰ Data & Hora</th>
                    <th className="py-2.5 px-3 min-w-[150px]">👤 Técnico</th>
                    <th className="py-2.5 px-3 min-w-[130px]">🛠️ Serviço</th>
                    <th className="py-2.5 px-3 min-w-[180px]">📦 Equipamento</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Tag / IDEC</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Nº de Série</th>
                    <th className="py-2.5 px-3 min-w-[140px]">📍 Setor Coleta</th>
                    <th className="py-2.5 px-3 min-w-[140px]">🏢 Setor Cadastro</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                  {filteredPontoEntries.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-slate-400">
                        Nenhuma ação de conferência registrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredPontoEntries.map((entry, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                          {formatDate(entry.date) || '—'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{entry.user}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            entry.modality === 'calibracao' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                              : entry.modality === 'preventiva'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          }`}>
                            {entry.modalityLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">{entry.equipmentName}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">{entry.tag}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{entry.serie}</td>
                        <td className="py-2 px-3">
                          {(() => {
                            const pColor = getSectorColor(entry.setorRetirada, sectorColors);
                            return (
                              <span 
                                style={getSectorBadgeStyles(pColor)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pColor.hex }} />
                                <span>📍 {entry.setorRetirada}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{entry.setorOriginal}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
