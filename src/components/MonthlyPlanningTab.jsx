import React, { useState, useMemo, useRef } from 'react';
import { 
  Calendar, 
  FileSpreadsheet, 
  Upload, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  Trash2, 
  ArrowRight, 
  Sparkles, 
  Building2, 
  Layers, 
  Check, 
  Filter, 
  X,
  FileText,
  CalendarDays,
  AlertCircle,
  Tag,
  Cpu,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Search,
  Pencil,
  Zap
} from 'lucide-react';
import { parseEquipmentFile } from '../utils/fileEquipmentParser.js';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MonthlyPlanningTab({
  plans = [],
  activePlanId,
  onSwitchPlan,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  hospitalName,
  onNavigateToScanner,
  onOpenAddEquipment,
  onEditEquipment
}) {
  // Sub-abas de visualização: 'planos' (Cards de Planos) ou 'cronograma' (Previsão Anual)
  const [activeSubTab, setActiveSubTab] = useState('planos');

  // Filtros de Planos
  const [typeFilter, setTypeFilter] = useState('todos'); // 'todos', 'anual', 'mensal'
  const [yearFilter, setYearFilter] = useState('todos');
  const [searchPlan, setSearchPlan] = useState('');

  // Filtros da Visão de Cronograma / Previsão
  const [selectedCronogramaYear, setSelectedCronogramaYear] = useState(() => String(new Date().getFullYear()));
  const [selectedCronogramaMonth, setSelectedCronogramaMonth] = useState('todos'); // 'todos' ou 0-11
  const [cronogramaStatusFilter, setCronogramaStatusFilter] = useState('todos'); // 'todos', 'vencidos', 'a_vencer', 'em_dia'
  const [cronogramaSearch, setCronogramaSearch] = useState('');

  // Modais de Criação e Edição de Plano
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState('manual'); // 'manual' ou 'excel'

  // Form de Novo Plano
  const [newTitle, setNewTitle] = useState('');
  const [newTipo, setNewTipo] = useState('anual');
  const [newAno, setNewAno] = useState(() => String(new Date().getFullYear()));
  const [newMes, setNewMes] = useState(() => `Ano Todo / ${new Date().getFullYear()}`);
  const [newDataInicio, setNewDataInicio] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [newDataFim, setNewDataFim] = useState(() => `${new Date().getFullYear()}-12-31`);
  const [newDescricao, setNewDescricao] = useState('');
  const [newGoogleSheetUrl, setNewGoogleSheetUrl] = useState('');

  // Importação de arquivo Excel
  const [parsedFileResult, setParsedFileResult] = useState(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef(null);

  // Modal de Edição de Metadados de Plano Existente
  const [editingPlan, setEditingPlan] = useState(null);

  // Lista única de anos disponíveis nos planos
  const availableYears = useMemo(() => {
    const set = new Set();
    plans.forEach(p => {
      if (p.ano) set.add(String(p.ano));
      else if (p.mes) {
        const match = p.mes.match(/\d{4}/);
        if (match) set.add(match[0]);
      }
    });
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [plans]);

  // Filtra os planos
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      // Tipo
      if (typeFilter !== 'todos') {
        const pTipo = p.tipo || (p.ano ? 'anual' : 'mensal');
        if (pTipo !== typeFilter) return false;
      }
      // Ano
      if (yearFilter !== 'todos') {
        const pAno = p.ano || (p.mes && p.mes.match(/\d{4}/) ? p.mes.match(/\d{4}/)[0] : '');
        if (pAno !== yearFilter) return false;
      }
      // Busca
      if (searchPlan.trim()) {
        const q = searchPlan.toLowerCase();
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const descMatch = (p.descricao || '').toLowerCase().includes(q);
        const fileMatch = (p.fileName || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !fileMatch) return false;
      }
      return true;
    });
  }, [plans, typeFilter, yearFilter, searchPlan]);

  // Estatísticas gerais agregadas
  const overallStats = useMemo(() => {
    let totalItems = 0;
    let checkedItems = 0;
    let totalVencidos = 0;
    let totalAVencer = 0;
    let totalEmDia = 0;

    plans.forEach(p => {
      totalItems += p.total || 0;
      checkedItems += p.checked || 0;
      totalVencidos += p.vencidos || 0;
      totalAVencer += p.aVencer || 0;
      totalEmDia += p.emDia || 0;
    });

    const percent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
    return { 
      totalPlans: plans.length, 
      totalItems, 
      checkedItems, 
      percent,
      vencidos: totalVencidos,
      aVencer: totalAVencer,
      emDia: totalEmDia
    };
  }, [plans]);

  // Todos os equipamentos consolidados dos planos para a visualização de Cronograma
  const allEquipmentsWithPlan = useMemo(() => {
    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    plans.forEach(plan => {
      const eqs = Array.isArray(plan.equipments) ? plan.equipments : [];
      eqs.forEach(eq => {
        const valDateStr = eq.validadeCalibracao || eq.proximaCalibracao;
        let diffDays = null;
        let calculatedStatus = eq.statusCalibracao || 'Válido';
        let mesVencimento = null;
        let anoVencimento = null;

        if (valDateStr) {
          const d = new Date(valDateStr + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            mesVencimento = d.getMonth();
            anoVencimento = String(d.getFullYear());

            if (diffDays < 0) calculatedStatus = 'Vencido';
            else if (diffDays <= 30) calculatedStatus = 'A Vencer';
            else calculatedStatus = 'Válido';
          }
        }

        list.push({
          ...eq,
          planId: plan.id,
          planTitle: plan.title,
          planAno: plan.ano,
          diffDays,
          calculatedStatus,
          mesVencimento,
          anoVencimento
        });
      });
    });

    return list;
  }, [plans]);

  // Filtra equipamentos do Cronograma
  const filteredCronogramaEquipments = useMemo(() => {
    return allEquipmentsWithPlan.filter(item => {
      // Filtro de ano
      if (selectedCronogramaYear !== 'todos') {
        const matchAno = item.anoVencimento === selectedCronogramaYear || item.planAno === selectedCronogramaYear;
        if (!matchAno) return false;
      }
      // Filtro de mês
      if (selectedCronogramaMonth !== 'todos') {
        if (item.mesVencimento !== parseInt(selectedCronogramaMonth, 10)) return false;
      }
      // Filtro de status
      if (cronogramaStatusFilter === 'vencidos' && item.calculatedStatus !== 'Vencido') return false;
      if (cronogramaStatusFilter === 'a_vencer' && item.calculatedStatus !== 'A Vencer') return false;
      if (cronogramaStatusFilter === 'em_dia' && item.calculatedStatus !== 'Válido') return false;

      // Busca por texto
      if (cronogramaSearch.trim()) {
        const q = cronogramaSearch.toLowerCase();
        const nomeMatch = (item.equipamento || '').toLowerCase().includes(q);
        const tagMatch = (item.tag || '').toLowerCase().includes(q);
        const serieMatch = (item.serie || '').toLowerCase().includes(q);
        const setorMatch = (item.setor || '').toLowerCase().includes(q);
        if (!nomeMatch && !tagMatch && !serieMatch && !setorMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordena por data de próxima calibração (mais urgentes primeiro)
      const dateA = a.validadeCalibracao || a.proximaCalibracao || '9999-99-99';
      const dateB = b.validadeCalibracao || b.proximaCalibracao || '9999-99-99';
      return dateA.localeCompare(dateB);
    });
  }, [allEquipmentsWithPlan, selectedCronogramaYear, selectedCronogramaMonth, cronogramaStatusFilter, cronogramaSearch]);

  // Contagem mensal do cronograma para o ano selecionado (12 meses)
  const cronogramaMonthlyCounts = useMemo(() => {
    const counts = Array(12).fill(0).map(() => ({ total: 0, vencidos: 0, aVencer: 0, validos: 0 }));
    allEquipmentsWithPlan.forEach(eq => {
      if (selectedCronogramaYear === 'todos' || eq.anoVencimento === selectedCronogramaYear || eq.planAno === selectedCronogramaYear) {
        if (eq.mesVencimento !== null && eq.mesVencimento >= 0 && eq.mesVencimento < 12) {
          counts[eq.mesVencimento].total++;
          if (eq.calculatedStatus === 'Vencido') counts[eq.mesVencimento].vencidos++;
          else if (eq.calculatedStatus === 'A Vencer') counts[eq.mesVencimento].aVencer++;
          else counts[eq.mesVencimento].validos++;
        }
      }
    });
    return counts;
  }, [allEquipmentsWithPlan, selectedCronogramaYear]);

  // Upload de arquivo (CSV, PDF, XLS ou XLSX)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setParseError('');
    try {
      const result = await parseEquipmentFile(file);
      setParsedFileResult(result);
      if (!newTitle) {
        setNewTitle(result.fileName.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setParseError(err.message || 'Erro ao ler arquivo selecionado (CSV, PDF, XLS ou XLSX).');
      setParsedFileResult(null);
    } finally {
      setIsParsingFile(false);
      e.target.value = '';
    }
  };

  // Submissão do novo plano
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Informe um título para o plano.');
      return;
    }

    if (createMode === 'excel') {
      if (!parsedFileResult || !parsedFileResult.equipments || parsedFileResult.equipments.length === 0) {
        alert('Selecione uma planilha válida com equipamentos.');
        return;
      }
    }

    onCreatePlan({
      title: newTitle.trim(),
      tipo: newTipo,
      ano: newAno,
      mes: newMes.trim() || `Ano Todo / ${newAno}`,
      dataInicio: newDataInicio,
      dataFim: newDataFim,
      descricao: newDescricao.trim(),
      googleSheetUrl: newGoogleSheetUrl.trim(),
      fileName: createMode === 'excel' && parsedFileResult ? parsedFileResult.fileName : 'Cadastro_Manual.xlsx',
      equipments: createMode === 'excel' && parsedFileResult ? parsedFileResult.equipments : []
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescricao('');
    setNewGoogleSheetUrl('');
    setParsedFileResult(null);
    setParseError('');
  };

  // Submissão de edição de metadados do plano
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (onUpdatePlan) {
      onUpdatePlan({
        planId: editingPlan.id,
        title: editingPlan.title,
        tipo: editingPlan.tipo,
        ano: editingPlan.ano,
        mes: editingPlan.mes,
        dataInicio: editingPlan.dataInicio,
        dataFim: editingPlan.dataFim,
        descricao: editingPlan.descricao
      });
    }
    setEditingPlan(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden animate-in fade-in duration-200">
      
      {/* ============================================================
          TOP HERO BANNER: Gestão Integrada de Planos & Cronograma
      ============================================================ */}
      <div className="bg-gradient-to-r from-blue-900/70 via-slate-900 to-indigo-950/80 border border-blue-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl relative overflow-hidden w-full">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Gestão de Metrologia & Cronograma Anual
              </span>
              <span className="text-xs text-slate-400 font-semibold">• {hospitalName}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Planos & Cronograma de Calibrações
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Crie planos anuais ou campanhas mensais, cadastre novos equipamentos e acompanhe a <strong>previsão e validade das próximas calibrações</strong> de toda a rede.
            </p>
          </div>

          {/* Botões de Ação Principais */}
          <div className="shrink-0 flex items-center gap-2 flex-wrap">
            {onOpenAddEquipment && (
              <button
                onClick={() => onOpenAddEquipment(activePlanId)}
                className="py-2.5 sm:py-3 px-4 sm:px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/25 transition active:scale-95 flex items-center gap-1.5"
                title="Cadastrar um novo equipamento e adicionar ao plano"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Cadastrar Equipamento</span>
              </button>
            )}

            <button
              onClick={() => {
                setCreateMode('manual');
                setIsCreateModalOpen(true);
              }}
              className="py-2.5 sm:py-3 px-4 sm:px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Novo Plano / Campanha</span>
            </button>
          </div>
        </div>

        {/* Resumo Rápido de Progresso e Validades */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Planos Cadastrados</span>
            <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{overallStats.totalPlans}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Total de Instrumentos</span>
            <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{overallStats.totalItems}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-emerald-400 font-medium">Calibrações em Dia</span>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-0.5">{overallStats.emDia}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-amber-400 font-medium">A Vencer (Próx. 30d)</span>
            <p className="text-lg sm:text-xl font-extrabold text-amber-400 mt-0.5">{overallStats.aVencer}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-rose-400 font-medium">Vencidos / Atrasados</span>
            <p className="text-lg sm:text-xl font-extrabold text-rose-400 mt-0.5">{overallStats.vencidos}</p>
          </div>
        </div>
      </div>

      {/* ============================================================
          ABAS DE VISUALIZAÇÃO: "Planos Cadastrados" vs "Cronograma & Previsão Anual"
      ============================================================ */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('planos')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeSubTab === 'planos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Planos & Campanhas ({plans.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cronograma')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeSubTab === 'cronograma'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Cronograma & Previsão Anual</span>
            {overallStats.aVencer > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                {overallStats.aVencer}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================
          SUB-ABA 1: VISUALIZAÇÃO DE PLANOS & CAMPANHAS
      ============================================================ */}
      {activeSubTab === 'planos' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros e Busca */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro por Tipo */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
                <button
                  onClick={() => setTypeFilter('todos')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    typeFilter === 'todos' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos os Tipos
                </button>
                <button
                  onClick={() => setTypeFilter('anual')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    typeFilter === 'anual' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Planos Anuais
                </button>
                <button
                  onClick={() => setTypeFilter('mensal')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    typeFilter === 'mensal' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mensais / Campanhas
                </button>
              </div>

              {/* Filtro por Ano */}
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="todos">Todos os Anos</option>
                {availableYears.map(ano => (
                  <option key={ano} value={ano}>Ano {ano}</option>
                ))}
              </select>
            </div>

            {/* Busca rápida */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar plano..."
                value={searchPlan}
                onChange={(e) => setSearchPlan(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Grid de Planos */}
          {filteredPlans.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum plano encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Ajuste os filtros ou clique em "Novo Plano / Campanha" acima para criar um plano anual ou subir uma planilha.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {filteredPlans.map(plan => {
                const isActive = plan.id === activePlanId;
                const percent = plan.percent || 0;
                const isAnual = plan.tipo === 'anual';

                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl p-5 border transition shadow-xs flex flex-col justify-between gap-4 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 border-blue-500/80 dark:border-blue-500/80 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Header do Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              isAnual 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50' 
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {isAnual ? `Plano Anual ${plan.ano || ''}` : (plan.mes || 'Campanha')}
                            </span>

                            {isActive ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Ativo para Conferência
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Em espera
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                            {plan.title || 'Planejamento de Calibração'}
                          </h3>

                          {plan.descricao && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {plan.descricao}
                            </p>
                          )}

                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 pt-0.5">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Origem: {plan.fileName || 'Cadastro Direto'}</span>
                            {plan.dataInicio && plan.dataFim && (
                              <span className="ml-1 text-slate-500">• Vigência: {plan.dataInicio} a {plan.dataFim}</span>
                            )}
                          </p>
                        </div>

                        {/* Botões de Ações de Topo do Card */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingPlan(plan)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                            title="Editar detalhes do plano"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {plans.length > 1 && (
                            <button
                              onClick={() => onDeletePlan(plan.id, plan.title)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                              title="Excluir este plano"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Barra de Progresso e Métricas */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">Progresso da Conferência</span>
                          <span className="text-blue-600 dark:text-blue-400 font-extrabold">{percent}%</span>
                        </div>

                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent === 100 
                                ? 'bg-emerald-500' 
                                : percent > 50 
                                ? 'bg-blue-600' 
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <span>Total: <strong className="text-slate-700 dark:text-slate-200">{plan.total}</strong> itens</span>
                          <span>Checados: <strong className="text-emerald-600 dark:text-emerald-400">{plan.checked}</strong></span>
                          <span>Pendentes: <strong className="text-amber-600 dark:text-amber-400">{plan.pending}</strong></span>
                        </div>

                        {/* Indicadores de Validade de Calibração */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Em dia: {plan.emDia || 0}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            A Vencer (30d): {plan.aVencer || 0}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            Vencidos: {plan.vencidos || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões do Rodapé do Card */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive ? (
                          <>
                            <span className="py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Plano Ativo no Momento</span>
                            </span>
                            <button
                              onClick={onNavigateToScanner}
                              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                            >
                              <span>Bipar neste Plano</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onSwitchPlan && onSwitchPlan(plan.id)}
                            className="py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95"
                            title="Ativar este plano como foco de calibração"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                            <span>⚡ Ativar Este Plano de Calibração</span>
                          </button>
                        )}

                        {onOpenAddEquipment && (
                          <button
                            onClick={() => onOpenAddEquipment(plan.id)}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            title="Cadastrar equipamento diretamente neste plano"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-500" />
                            <span>+ Equipamento</span>
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {plan.id.substring(0, 8)}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ============================================================
          SUB-ABA 2: CRONOGRAMA & PREVISÃO DAS PRÓXIMAS CALIBRAÇÕES
      ============================================================ */}
      {activeSubTab === 'cronograma' && (
        <div className="space-y-5">
          
          {/* Seletor de Ano & Resumo de Vencimentos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-500" />
                  <span>Cronograma Anual de Vencimentos & Calibrações</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Previsão mensal de vencimentos de certificados e re-calibração periódica
                </p>
              </div>

              {/* Seletor do Ano de Referência */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Ano:</span>
                <select
                  value={selectedCronogramaYear}
                  onChange={(e) => setSelectedCronogramaYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="todos">Todos os Anos</option>
                  {availableYears.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid dos 12 Meses (Timeline Anual) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
              {MONTH_NAMES.map((mesNome, idx) => {
                const dataMes = cronogramaMonthlyCounts[idx];
                const isCurrentMonth = new Date().getMonth() === idx && (selectedCronogramaYear === 'todos' || selectedCronogramaYear === String(new Date().getFullYear()));
                const isSelected = selectedCronogramaMonth === String(idx);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCronogramaMonth(isSelected ? 'todos' : String(idx))}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : isCurrentMonth
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 hover:border-blue-400'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                        {mesNome}
                      </span>
                      {isCurrentMonth && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          Atual
                        </span>
                      )}
                    </div>

                    <div className="mt-1">
                      <span className={`text-xl font-extrabold font-mono block ${
                        isSelected ? 'text-white' : dataMes.total > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                      }`}>
                        {dataMes.total}
                      </span>
                      <span className={`text-[10px] block ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {dataMes.total === 1 ? 'calibração' : 'calibrações'}
                      </span>
                    </div>

                    {dataMes.total > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[9px]">
                        {dataMes.vencidos > 0 && (
                          <span className={`font-bold ${isSelected ? 'text-white' : 'text-rose-500'}`}>
                            🔴 {dataMes.vencidos}
                          </span>
                        )}
                        {dataMes.aVencer > 0 && (
                          <span className={`font-bold ${isSelected ? 'text-white' : 'text-amber-500'}`}>
                            🟡 {dataMes.aVencer}
                          </span>
                        )}
                        {dataMes.validos > 0 && (
                          <span className={`font-bold ${isSelected ? 'text-white' : 'text-emerald-500'}`}>
                            🟢 {dataMes.validos}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros da Tabela de Previsão */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCronogramaStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  cronogramaStatusFilter === 'todos'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos ({allEquipmentsWithPlan.length})
              </button>
              <button
                onClick={() => setCronogramaStatusFilter('a_vencer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  cronogramaStatusFilter === 'a_vencer'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                }`}
              >
                <span>🟡 A Vencer nos Próximos 30d</span>
                <span className="font-mono">({overallStats.aVencer})</span>
              </button>
              <button
                onClick={() => setCronogramaStatusFilter('vencidos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  cronogramaStatusFilter === 'vencidos'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                <span>🔴 Vencidos</span>
                <span className="font-mono">({overallStats.vencidos})</span>
              </button>
              <button
                onClick={() => setCronogramaStatusFilter('em_dia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  cronogramaStatusFilter === 'em_dia'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                }`}
              >
                <span>🟢 Em Dia</span>
                <span className="font-mono">({overallStats.emDia})</span>
              </button>
            </div>

            {/* Busca textual */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por aparelho, tag, série..."
                value={cronogramaSearch}
                onChange={(e) => setCronogramaSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tabela de Previsão de Calibrações */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            {filteredCronogramaEquipments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  Nenhum equipamento encontrado para os filtros selecionados
                </p>
                <p className="text-xs text-slate-500">
                  Tente limpar os filtros de mês ou status.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Equipamento</th>
                      <th className="py-3 px-4">Tag / Patrimônio</th>
                      <th className="py-3 px-4">Nº de Série</th>
                      <th className="py-3 px-4">Setor</th>
                      <th className="py-3 px-4">Plano de Origem</th>
                      <th className="py-3 px-4">Data Calibração</th>
                      <th className="py-3 px-4">Periodicidade</th>
                      <th className="py-3 px-4">Previsão Próxima</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCronogramaEquipments.map((item, idx) => {
                      const isVencido = item.calculatedStatus === 'Vencido';
                      const isAVencer = item.calculatedStatus === 'A Vencer';

                      return (
                        <tr 
                          key={item.id || idx}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                            isVencido 
                              ? 'bg-rose-50/20 dark:bg-rose-950/10' 
                              : isAVencer 
                              ? 'bg-amber-50/20 dark:bg-amber-950/10' 
                              : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 dark:text-white block">
                              {item.equipamento}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.fabricante} {item.modelo}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.tag || item.codigoBarras || '-'}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {item.serie || '-'}
                          </td>

                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                              {item.setor || 'Geral'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-[140px]">
                            {item.planTitle}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {item.dataCalibracao || '-'}
                          </td>

                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {item.periodicidadeMeses ? `${item.periodicidadeMeses} meses` : '12 meses'}
                          </td>

                          <td className="py-3 px-4 font-mono font-extrabold">
                            <span className={isVencido ? 'text-rose-600 dark:text-rose-400' : isAVencer ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}>
                              {item.validadeCalibracao || item.proximaCalibracao || '-'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              isVencido
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : isAVencer
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isVencido ? 'bg-rose-500' : isAVencer ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                              {item.calculatedStatus}
                              {item.diffDays !== null && (
                                <span className="opacity-80 font-normal">
                                  {item.diffDays < 0 ? `(${Math.abs(item.diffDays)}d atrás)` : `(em ${item.diffDays}d)`}
                                </span>
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {onEditEquipment && (
                              <button
                                onClick={() => onEditEquipment(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                                title="Editar calibração e identificação"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ============================================================
          MODAL: NOVO PLANO DE CALIBRAÇÃO (MANUAL OU EXCEL)
      ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Criar Novo Plano / Campanha</h3>
                  <p className="text-xs text-slate-500">Defina cronogramas anuais ou campanhas de calibração</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alternador de Modo: Manual (Sem Planilha) vs Subir Planilha */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setCreateMode('manual')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  createMode === 'manual'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Plano do Zero (Manual)</span>
              </button>

              <button
                type="button"
                onClick={() => setCreateMode('excel')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  createMode === 'excel'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Planilha Excel</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              
              {/* Título do Plano */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Plano / Campanha *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Plano Anual de Calibração 2026, Bombas Terumo UTI..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Tipo e Ano de Referência */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo do Plano *
                  </label>
                  <select
                    value={newTipo}
                    onChange={(e) => {
                      const t = e.target.value;
                      setNewTipo(t);
                      if (t === 'anual') {
                        setNewMes(`Ano Todo / ${newAno}`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="anual">Plano Anual (12 Meses)</option>
                    <option value="mensal">Campanha Mensal</option>
                    <option value="semestral">Plano Semestral</option>
                    <option value="campanha">Campanha Específica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ano de Referência *
                  </label>
                  <input
                    type="number"
                    value={newAno}
                    onChange={(e) => {
                      const a = e.target.value;
                      setNewAno(a);
                      setNewDataInicio(`${a}-01-01`);
                      setNewDataFim(`${a}-12-31`);
                      if (newTipo === 'anual') setNewMes(`Ano Todo / ${a}`);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Vigência: Início e Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={newDataInicio}
                    onChange={(e) => setNewDataInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    value={newDataFim}
                    onChange={(e) => setNewDataFim(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Descrição / Metas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Objetivo do Plano
                </label>
                <textarea
                  value={newDescricao}
                  onChange={(e) => setNewDescricao(e.target.value)}
                  placeholder="Ex: Calibração de rotina de todas as bombas de infusão do hospital..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Se o modo for Excel, exibe o drop zone do arquivo */}
              {createMode === 'excel' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Arquivo da Planilha Excel (.xlsx, .xls ou .csv) *
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".xlsx, .xls, .csv, .pdf, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                    className="hidden"
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-5 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/40"
                  >
                    {isParsingFile ? (
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Clock className="w-6 h-6 text-blue-500 animate-spin" />
                        <span className="text-xs text-slate-500">Lendo e analisando arquivo...</span>
                      </div>
                    ) : parsedFileResult ? (
                      <div className="flex flex-col items-center justify-center space-y-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-7 h-7" />
                        <span className="text-xs font-bold">{parsedFileResult.fileName}</span>
                        <span className="text-[11px] text-slate-500">
                          {parsedFileResult.total} equipamentos detectados!
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Clique para escolher o arquivo
                        </span>
                        <span className="text-[11px] text-slate-400">CSV, PDF, XLSX ou XLS</span>
                      </div>
                    )}
                  </div>

                  {parseError && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{parseError}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMode === 'excel' && (!parsedFileResult || isParsingFile)}
                  className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Plano</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: EDITAR METADADOS DO PLANO EXISTENTE
      ============================================================ */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Dados do Plano</h3>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Título do Plano:
                </label>
                <input
                  type="text"
                  value={editingPlan.title || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tipo:
                  </label>
                  <select
                    value={editingPlan.tipo || 'anual'}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="anual">Plano Anual</option>
                    <option value="mensal">Campanha Mensal</option>
                    <option value="semestral">Plano Semestral</option>
                    <option value="campanha">Específica</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Ano:
                  </label>
                  <input
                    type="number"
                    value={editingPlan.ano || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, ano: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Data Início:
                  </label>
                  <input
                    type="date"
                    value={editingPlan.dataInicio || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, dataInicio: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Data Fim:
                  </label>
                  <input
                    type="date"
                    value={editingPlan.dataFim || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, dataFim: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Descrição / Objetivo:
                </label>
                <textarea
                  value={editingPlan.descricao || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, descricao: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="py-2 px-3.5 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
