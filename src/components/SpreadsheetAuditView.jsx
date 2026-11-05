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
  Maximize2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SpreadsheetAuditView({
  equipments = [],
  hospitalName = '',
  planTitle = '',
  onRefresh,
  isRefreshing = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');

  // Setores disponíveis
  const sectors = useMemo(() => {
    return Array.from(new Set(
      equipments.map(e => String(e.setor || '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
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

      if (e.check_calibracao && e.check_preventiva && e.check_seguranca) {
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
  }, [equipments]);

  // Filtragem da Lista
  const filteredEquipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return equipments.filter(item => {
      // Filtro de Busca Texto
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

      // Filtro de Setor
      if (sectorFilter !== 'ALL') {
        const s1 = String(item.setor || '').trim().toLowerCase();
        const s2 = String(item.setor_retirada || '').trim().toLowerCase();
        const target = sectorFilter.trim().toLowerCase();
        if (s1 !== target && s2 !== target) return false;
      }

      // Filtro de Técnico
      if (technicianFilter !== 'ALL') {
        const t1 = item.usuario_calibracao;
        const t2 = item.usuario_preventiva;
        const t3 = item.usuario_seguranca;
        const t4 = item.conferidoPor;
        if (t1 !== technicianFilter && t2 !== technicianFilter && t3 !== technicianFilter && t4 !== technicianFilter) {
          return false;
        }
      }

      // Filtro de Status
      if (statusFilter === '100_COMPLETE') {
        return item.check_calibracao && item.check_preventiva && item.check_seguranca;
      }
      if (statusFilter === 'ANY_PENDING') {
        return !(item.check_calibracao && item.check_preventiva && item.check_seguranca);
      }
      if (statusFilter === 'PENDING_CAL') {
        return !item.check_calibracao;
      }
      if (statusFilter === 'PENDING_PREV') {
        return !item.check_preventiva;
      }
      if (statusFilter === 'PENDING_SEG') {
        return !item.check_seguranca;
      }
      if (statusFilter === 'SECTOR_DIFF') {
        return item.setor_retirada && item.setor && 
          item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();
      }

      return true;
    });
  }, [equipments, searchQuery, sectorFilter, statusFilter, technicianFilter]);

  // Exportação Direta para Excel da Visão de Auditoria
  const handleExportAuditExcel = () => {
    if (equipments.length === 0) return;

    const dataToExport = equipments.map((item, idx) => ({
      'Item': idx + 1,
      'Tag / Patrimônio': item.tag || '',
      'Número de Série': item.serie || '',
      'Equipamento / Modelo': item.nome || item.equipamento || '',
      'Setor Cadastrado': item.setor || '',
      'Setor de Retirada': item.setor_retirada || '',
      'Status Calibração': item.check_calibracao ? 'CONFERIDO' : 'PENDENTE',
      'Técnico Calibração': item.usuario_calibracao || '',
      'Data Calibração': item.data_calibracao ? new Date(item.data_calibracao).toLocaleDateString('pt-BR') : '',
      'Status Preventiva': item.check_preventiva ? 'CONFERIDO' : 'PENDENTE',
      'Técnico Preventiva': item.usuario_preventiva || '',
      'Data Preventiva': item.data_preventiva ? new Date(item.data_preventiva).toLocaleDateString('pt-BR') : '',
      'Status Seg. Elétrica': item.check_seguranca ? 'CONFERIDO' : 'PENDENTE',
      'Técnico Seg. Elétrica': item.usuario_seguranca || '',
      'Data Seg. Elétrica': item.data_seguranca ? new Date(item.data_seguranca).toLocaleDateString('pt-BR') : '',
      '100% Concluído': (item.check_calibracao && item.check_preventiva && item.check_seguranca) ? 'SIM' : 'NÃO',
      'Observação': item.observacao || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Espelho_Auditoria');

    const cleanHosp = (hospitalName || 'Auditoria').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Espelho_Planilha_${cleanHosp}_${dateStr}.xlsx`);
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
                Espelho Seguro da Planilha
              </h2>
              <span className="bg-emerald-400/20 text-emerald-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-300/30">
                100% Protegido
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5">
              Auditoria em tempo real de todas as equipes sem risco de cliques acidentais ou perda de dados.
            </p>
          </div>
        </div>

        {/* Botões de Exportação e Atualização */}
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-white/15"
              title="Atualizar dados em tempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          )}

          <button
            onClick={handleExportAuditExcel}
            className="py-2 px-3.5 bg-white text-slate-900 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md active:scale-95"
            title="Exportar espelho completo da planilha para Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Baixar Espelho Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 hidden sm:flex items-center justify-center"
            title="Imprimir visualização de auditoria"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Desempenho das Equipes */}
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

        {/* 🏆 100% Concluídos em Todas as Frentes */}
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
          
          {/* Campo de Busca Texto */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tag, número de série, equipamento, setor ou nome do técnico..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtros Dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Filtro Setor */}
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">🏢 Setores: Todos ({equipments.length})</option>
              {sectors.map(sec => (
                <option key={sec} value={sec}>📍 {sec}</option>
              ))}
            </select>

            {/* Filtro Status Técnico */}
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
              <option value="SECTOR_DIFF">📦 Divergência de Setor (Retirado de outro local)</option>
            </select>

            {/* Filtro de Técnico Executor */}
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

          </div>

        </div>

        {/* Contador de Itens Filtrados */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <span>
            Exibindo <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredEquipments.length}</strong> de <span className="font-mono">{equipments.length}</span> equipamentos
          </span>
          {stats.withSectorDiff > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              💡 {stats.withSectorDiff} equipamentos retirados de setor diferente do cadastro original
            </span>
          )}
        </div>
      </div>

      {/* Tabela de Alta Densidade (Espelho da Planilha Sem Edição Acidental) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Cabeçalho Fixo (Sticky) */}
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

            {/* Linhas de Dados */}
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

                  return (
                    <tr 
                      key={item.id || item.tag || idx}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isComplete ? 'bg-emerald-500/[0.02]' : ''
                      }`}
                    >
                      {/* Índice */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Tag */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                        {item.tag || '—'}
                      </td>

                      {/* Série */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        {item.serie || '—'}
                      </td>

                      {/* Nome do Equipamento */}
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                        {item.nome || item.equipamento || '—'}
                      </td>

                      {/* Setor Cadastrado */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          {item.setor || 'Geral'}
                        </span>
                      </td>

                      {/* Setor de Retirada (Bipado em campo) */}
                      <td className="py-2.5 px-3">
                        {item.setor_retirada ? (
                          isDiffSector ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold text-[11px]" title={`Retirado de: ${item.setor_retirada} (Setor cadastrado: ${item.setor})`}>
                              <ArrowRight className="w-3 h-3 text-amber-500" />
                              <span>{item.setor_retirada}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium text-[11px]">
                              {item.setor_retirada}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Calibração (Badge Seguro Somente Leitura) */}
                      <td className="py-2 px-3 text-center bg-blue-500/[0.03] dark:bg-blue-950/10">
                        {item.check_calibracao ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>OK</span>
                            </span>
                            {item.usuario_calibracao && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium" title={item.usuario_calibracao}>
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

                      {/* Preventiva (Badge Seguro Somente Leitura) */}
                      <td className="py-2 px-3 text-center bg-amber-500/[0.03] dark:bg-amber-950/10">
                        {item.check_preventiva ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>OK</span>
                            </span>
                            {item.usuario_preventiva && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium" title={item.usuario_preventiva}>
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

                      {/* Seg. Elétrica (Badge Seguro Somente Leitura) */}
                      <td className="py-2 px-3 text-center bg-purple-500/[0.03] dark:bg-purple-950/10">
                        {item.check_seguranca ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>OK</span>
                            </span>
                            {item.usuario_seguranca && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] mt-0.5 font-medium" title={item.usuario_seguranca}>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
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

    </div>
  );
}
