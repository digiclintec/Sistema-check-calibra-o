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
  FileText
} from 'lucide-react';
import { parseSpreadsheetFile, exportToExcel } from '../utils/sheetParser';

export default function MonthlyPlanningTab({
  plans = [],
  activePlanId,
  onSwitchPlan,
  onCreatePlan,
  onDeletePlan,
  hospitalName,
  onNavigateToScanner
}) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('todos');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMes, setNewMes] = useState('Novembro/2026');
  const [parsedFileResult, setParsedFileResult] = useState(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');

  const fileInputRef = useRef(null);

  // Lista única de meses disponíveis nos planos existentes
  const availableMonths = useMemo(() => {
    const set = new Set();
    plans.forEach(p => {
      if (p.mes) set.add(p.mes);
    });
    return Array.from(set);
  }, [plans]);

  // Filtra planos pelo mês selecionado
  const filteredPlans = useMemo(() => {
    if (selectedMonthFilter === 'todos') return plans;
    return plans.filter(p => p.mes === selectedMonthFilter);
  }, [plans, selectedMonthFilter]);

  // Estatísticas gerais de planejamento
  const overallStats = useMemo(() => {
    let totalItems = 0;
    let checkedItems = 0;
    plans.forEach(p => {
      totalItems += p.total || 0;
      checkedItems += p.checked || 0;
    });
    const percent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
    return { totalPlans: plans.length, totalItems, checkedItems, percent };
  }, [plans]);

  // Processamento do arquivo no modal de novo planejamento
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setParseError('');
    try {
      const result = await parseSpreadsheetFile(file);
      setParsedFileResult(result);
      if (!newTitle) {
        setNewTitle(result.fileName.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setParseError(err.message || 'Erro ao ler arquivo da planilha.');
      setParsedFileResult(null);
    } finally {
      setIsParsingFile(false);
      e.target.value = '';
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Informe um título para o planejamento.');
      return;
    }
    if (!parsedFileResult || !parsedFileResult.equipments || parsedFileResult.equipments.length === 0) {
      alert('Selecione uma planilha válida com equipamentos.');
      return;
    }

    onCreatePlan({
      title: newTitle.trim(),
      mes: newMes.trim(),
      fileName: parsedFileResult.fileName,
      equipments: parsedFileResult.equipments
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setParsedFileResult(null);
    setParseError('');
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden animate-in fade-in duration-200">
      
      {/* Top Banner / Planejamento Header */}
      <div className="bg-gradient-to-r from-blue-900/60 via-slate-900 to-indigo-950/70 border border-blue-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl relative overflow-hidden w-full">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Planejamento de Calibração
              </span>
              <span className="text-xs text-slate-400">• {hospitalName}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Campanhas e Planilhas do Mês
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Organize diferentes planos de calibração por mês ou setor (ex: Bombas Terumo, Monitores, UTI). Escolha abaixo qual planilha você deseja <strong>validar e bipar agora</strong>.
            </p>
          </div>

          {/* Botão de Criar Novo Planejamento */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="py-3 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Novo Planejamento</span>
            </button>
          </div>
        </div>

        {/* Resumo Rápido de Progresso Geral */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Planilhas no Hospital</span>
            <p className="text-lg font-extrabold text-white mt-0.5">{overallStats.totalPlans}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Total de Equipamentos</span>
            <p className="text-lg font-extrabold text-white mt-0.5">{overallStats.totalItems}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-emerald-400 font-medium">Conferidos / Checados</span>
            <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{overallStats.checkedItems}</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-blue-400 font-medium">Aderência Geral</span>
            <p className="text-lg font-extrabold text-blue-400 mt-0.5">{overallStats.percent}%</p>
          </div>
        </div>
      </div>

      {/* Month Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedMonthFilter('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedMonthFilter === 'todos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Todos os Meses ({plans.length})
          </button>
          
          {availableMonths.map(mes => (
            <button
              key={mes}
              onClick={() => setSelectedMonthFilter(mes)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                selectedMonthFilter === mes
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>{mes}</span>
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500">
          Mostrando {filteredPlans.length} {filteredPlans.length === 1 ? 'planejamento' : 'planejamentos'}
        </span>
      </div>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum planejamento encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Clique em "Novo Planejamento" acima para subir uma planilha Excel de calibração para este mês.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {filteredPlans.map(plan => {
            const isActive = plan.id === activePlanId;
            const percent = plan.percent || 0;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-5 border transition shadow-sm flex flex-col justify-between gap-4 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-blue-500/80 dark:border-blue-500/80 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-blue-500" />
                          {plan.mes || 'Mês Atual'}
                        </span>

                        {isActive ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ativa para Validação
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

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{plan.fileName || 'Arquivo importado'}</span>
                      </p>
                    </div>

                    {/* Excluir (se houver mais de um) */}
                    {plans.length > 1 && (
                      <button
                        onClick={() => onDeletePlan(plan.id, plan.title)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
                        title="Excluir este planejamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Progress Bar & Counters */}
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
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  {isActive ? (
                    <button
                      onClick={onNavigateToScanner}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Validando Agora (Bipar)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onSwitchPlan(plan.id)}
                      className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Validar Esta Planilha</span>
                    </button>
                  )}

                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {plan.id.substring(0, 10)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Planejamento de Calibração / Subir Planilha */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Planejamento do Mês</h3>
                  <p className="text-xs text-slate-500">Adicione uma nova planilha de calibração para validação</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              {/* Título do Planejamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Planejamento / Campanha *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Bombas Terumo - Novembro 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Mês Alvo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mês da Calibração *
                </label>
                <select
                  value={newMes}
                  onChange={(e) => setNewMes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Novembro/2026">Novembro/2026</option>
                  <option value="Dezembro/2026">Dezembro/2026</option>
                  <option value="Janeiro/2027">Janeiro/2027</option>
                  <option value="Fevereiro/2027">Fevereiro/2027</option>
                  <option value="Março/2027">Março/2027</option>
                  <option value="Abril/2027">Abril/2027</option>
                  <option value="Maio/2027">Maio/2027</option>
                  <option value="Campanha Específica">Campanha Específica / Geral</option>
                </select>
              </div>

              {/* Upload de Planilha (.xlsx, .xls, .csv) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Arquivo da Planilha Excel (.xlsx, .xls ou .csv) *
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-5 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/40"
                >
                  {isParsingFile ? (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Clock className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-xs text-slate-500">Lendo e mapeando colunas...</span>
                    </div>
                  ) : parsedFileResult ? (
                    <div className="flex flex-col items-center justify-center space-y-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-8 h-8" />
                      <span className="text-xs font-bold">{parsedFileResult.fileName}</span>
                      <span className="text-[11px] text-slate-500">
                        {parsedFileResult.total} equipamentos detectados e prontos para importar!
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Upload className="w-7 h-7 text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Clique para escolher a planilha crua
                      </span>
                      <span className="text-[11px] text-slate-400">Formatos aceitos: .xlsx, .xls ou .csv</span>
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

              {/* Botões do Modal */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!parsedFileResult || isParsingFile}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar e Ativar Planilha</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

