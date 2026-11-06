import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  GitMerge, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  SlidersHorizontal, 
  Filter, 
  Search,
  ArrowRight,
  Info
} from 'lucide-react';
import { parseFileForCalibrationMerge, mergeCalibrationsIntoEquipments } from '../utils/mergeCalibrations.js';
import { MODALITIES } from '../utils/modalities.js';

export default function MergeCalibrationsModal({
  isOpen,
  onClose,
  equipments = [],
  serviceConfig = null,
  currentUser = null,
  onApplyMerge,
  hospitalName = '',
  planTitle = ''
}) {
  const safeEquipments = useMemo(() => {
    return Array.isArray(equipments) ? equipments : [];
  }, [equipments]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending_only' | 'already_checked'
  
  // Opções de Mesclagem
  const [applyModalities, setApplyModalities] = useState(() => {
    const mods = [];
    if (!serviceConfig || serviceConfig.enableCalibracao !== false) mods.push('calibracao');
    if (!serviceConfig || serviceConfig.enablePreventiva !== false) mods.push('preventiva');
    if (!serviceConfig || serviceConfig.enableSeguranca !== false) mods.push('seguranca');
    return mods.length > 0 ? mods : ['calibracao', 'preventiva', 'seguranca'];
  });
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [inspectorName, setInspectorName] = useState(() => {
    if (currentUser?.name) {
      return `${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''}`;
    }
    return currentUser?.email || 'Técnico Responsável';
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.name) {
        setInspectorName(`${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''}`);
      } else if (currentUser?.email) {
        setInspectorName(currentUser.email);
      }
    }
  }, [isOpen, currentUser]);

  const handleReset = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setParseResult(null);
    setErrorMessage('');
    setSearchQuery('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const processFile = async (file) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const res = await parseFileForCalibrationMerge(file, safeEquipments);
      setParseResult(res);
      if (res.totalMatches === 0) {
        setErrorMessage('Nenhuma bomba deste arquivo correspondeu ao plano ativo. Verifique se o arquivo contém as Tags/IDECs ou Séries deste hospital.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(`Erro ao ler arquivo: ${err.message || 'Formato incompatível ou ilegível.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle seleção individual de match
  const handleToggleMatch = (index) => {
    if (!parseResult) return;
    setParseResult(prev => {
      const updated = [...prev.matches];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return { ...prev, matches: updated };
    });
  };

  // Selecionar todos ou desmarcar todos
  const handleToggleSelectAll = () => {
    if (!parseResult) return;
    const allSelected = parseResult.matches.every(m => m.selected);
    setParseResult(prev => ({
      ...prev,
      matches: prev.matches.map(m => ({ ...m, selected: !allSelected }))
    }));
  };

  // Filtra itens para visualização na tabela
  const filteredMatches = useMemo(() => {
    if (!parseResult || !parseResult.matches) return [];
    return parseResult.matches.filter(m => {
      if (filterMode === 'pending_only' && m.isAlreadyChecked) return false;
      if (filterMode === 'already_checked' && !m.isAlreadyChecked) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tag = (m.targetEquipment?.tag || '').toLowerCase();
        const serie = (m.targetEquipment?.serie || '').toLowerCase();
        const eqName = (m.targetEquipment?.equipamento || '').toLowerCase();
        const reason = (m.matchReason || '').toLowerCase();
        return tag.includes(q) || serie.includes(q) || eqName.includes(q) || reason.includes(q);
      }
      return true;
    });
  }, [parseResult, filterMode, searchQuery]);

  const selectedCount = parseResult?.matches?.filter(m => m.selected).length || 0;
  const newCalibrationsCount = parseResult?.matches?.filter(m => m.selected && !m.isAlreadyChecked).length || 0;

  // Confirmar e aplicar a mesclagem
  const handleConfirmMerge = async () => {
    if (!parseResult || selectedCount === 0) return;

    const { updatedEquipments, updatedCount } = mergeCalibrationsIntoEquipments(
      safeEquipments,
      parseResult.matches,
      {
        modalities: applyModalities,
        inspector: inspectorName,
        overwriteExisting
      }
    );

    if (onApplyMerge) {
      await onApplyMerge(
        updatedEquipments, 
        `Mesclagem via ${parseResult.fileName}: ${updatedCount} bombas carimbadas como calibradas`
      );
    }

    try {
      const { default: confetti } = await import('canvas-confetti');
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Ignora se confetti não estiver disponível
    }

    onClose();
    handleReset();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md"
      onClick={() => { onClose(); handleReset(); }}
    >
      <div 
        className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <GitMerge className="w-5 h-5 sm:w-6 sm:h-6 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight truncate">
                  Mesclar Calibrações Feitas
                </h3>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                  XLS, XLSX, CSV ou PDF
                </span>
              </div>
              <p className="text-xs text-white/80 truncate mt-0.5">
                {hospitalName || 'Hospital'} {planTitle ? `• ${planTitle}` : ''} • ({safeEquipments.length} bombas no plano)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { onClose(); handleReset(); }}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/40 px-4 py-2 border-b border-blue-100 dark:border-blue-900/50 flex items-center gap-2 text-[11px] sm:text-xs text-blue-900 dark:text-blue-200 shrink-0">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            <strong>Seguro:</strong> Nenhum equipamento do seu plano será apagado ou duplicado. O sistema apenas identifica as bombas que já foram feitas e atualiza seus status de calibração.
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv, .pdf, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
          />

          {!parseResult ? (
            /* ============================================================
               ETAPA 1: ÁREA DE UPLOAD (DRAG & DROP / SELEÇÃO)
            ============================================================ */
            <div className="space-y-4">
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isProcessing 
                    ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 cursor-wait'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 bg-slate-50/70 dark:bg-slate-800/40'
                }`}
              >
                <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-inner">
                  {isProcessing ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                    {isProcessing ? 'Cruzando bombas com seu plano ativo...' : 'Selecione a lista de calibrações'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    {isProcessing 
                      ? 'Extraindo números de série, tags e datas do arquivo para encontrar as bombas no plano...' 
                      : 'Aceita planilhas de outros técnicos (.xlsx, .xls, .csv) ou relatórios/certificados em PDF.'}
                  </p>
                </div>

                {!isProcessing && (
                  <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
                    <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      <span>Planilha Excel / CSV</span>
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                      <FileText className="w-4 h-4 text-rose-500" />
                      <span>Relatório em PDF</span>
                    </span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* ============================================================
               ETAPA 2: PRÉ-VISUALIZAÇÃO DOS MATCHES E CONFIRMAÇÃO
            ============================================================ */
            <div className="space-y-4">
              
              {/* Resumo Estatístico dos Itens Encontrados */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Arquivo Lido</span>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate mt-0.5" title={parseResult.fileName}>
                    {parseResult.fileName}
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">
                    {parseResult.fileType === 'pdf' ? 'PDF' : 'Excel/CSV'}
                  </span>
                </div>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/60 text-center">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Bombas no Plano</span>
                  <div className="text-lg font-black text-blue-700 dark:text-blue-300">
                    {parseResult.totalMatches}
                  </div>
                  <span className="text-[10px] text-blue-600/80 font-bold">
                    correspondências
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 text-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Serão Calibradas</span>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {newCalibrationsCount}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 font-bold">
                    novas conferências
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Já Calibradas</span>
                  <div className="text-lg font-black text-slate-700 dark:text-slate-300">
                    {(parseResult.matches || []).filter(m => m.isAlreadyChecked).length}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    já estavam OK
                  </span>
                </div>
              </div>

              {/* Controles de Configuração da Mesclagem */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                    <span>Opções ao Aplicar a Mesclagem:</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setParseResult(null); }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    Trocar Arquivo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Serviços que serão carimbados nas bombas:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800">
                        🎯 Calibração
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                        🔧 Preventiva
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800">
                        ⚡ Seg. Elétrica
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Responsável registrado:
                    </label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={e => setInspectorName(e.target.value)}
                      placeholder="Nome do técnico ou laboratório"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="overwriteExisting"
                    checked={overwriteExisting}
                    onChange={e => setOverwriteExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <label htmlFor="overwriteExisting" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    Sobrescrever mesmo as bombas que já estavam calibradas (atualizar data e responsável)
                  </label>
                </div>
              </div>

              {/* Tabela de Bombas Identificadas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Bombas para Mesclar ({selectedCount} de {(parseResult.matches || []).length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {(parseResult.matches || []).every(m => m.selected) ? 'Desmarcar Todas' : 'Marcar Todas'}
                    </button>
                  </div>

                  {/* Filtro e Busca Rápida */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar por tag, série..."
                        className="pl-8 pr-2.5 py-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-36 sm:w-48"
                      />
                    </div>

                    <select
                      value={filterMode}
                      onChange={e => setFilterMode(e.target.value)}
                      className="px-2 py-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <option value="all">Todas ({(parseResult.matches || []).length})</option>
                      <option value="pending_only">Somente Pendentes ({newCalibrationsCount})</option>
                      <option value="already_checked">Já Calibradas</option>
                    </select>
                  </div>
                </div>

                {/* Lista / Tabela com Rolagem */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 sm:max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3 w-8 text-center">#</th>
                        <th className="py-2 px-3">Bomba / Modelo</th>
                        <th className="py-2 px-3">IDEC / Série</th>
                        <th className="py-2 px-3">Correspondência</th>
                        <th className="py-2 px-3">Status Atual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredMatches.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            Nenhuma bomba corresponde aos filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        filteredMatches.map((m, idx) => {
                          const eq = m.targetEquipment || {};
                          return (
                            <tr 
                              key={eq.id || idx}
                              onClick={() => handleToggleMatch(idx)}
                              className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                                m.selected ? 'bg-blue-50/30 dark:bg-blue-950/15' : 'opacity-60'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={m.selected}
                                  onChange={() => handleToggleMatch(idx)}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                                  {eq.equipamento || 'Equipamento'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {eq.fabricante} {eq.modelo}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <div className="font-bold text-blue-600 dark:text-blue-400">
                                  {eq.tag || 'N/A'}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  S/N: {eq.serie || 'N/A'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  <Check className="w-3 h-3" />
                                  <span>{m.matchReason}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {m.isAlreadyChecked ? (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    ✓ Já Calibrada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full animate-pulse">
                                    ⚡ Será Calibrada
                                  </span>
                                )}
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
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => { onClose(); handleReset(); }}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition text-xs sm:text-sm"
          >
            Cancelar
          </button>

          {parseResult && parseResult.totalMatches > 0 && (
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={selectedCount === 0}
              className={`py-2.5 px-5 rounded-xl font-extrabold text-white text-xs sm:text-sm flex items-center gap-2 shadow-lg transition active:scale-95 ${
                selectedCount === 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/25'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Confirmar Mesclagem e Carimbar ({selectedCount} bombas)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
