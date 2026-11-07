import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Barcode, 
  Tag, 
  Cpu, 
  Building2, 
  Calendar, 
  Clock, 
  Sparkles, 
  Layers,
  FileSpreadsheet,
  Check,
  UploadCloud,
  ClipboardPaste,
  ScanLine,
  Trash2,
  Filter,
  FileText
} from 'lucide-react';
import { 
  parseEquipmentFile, 
  calculateNextCalibration, 
  computeCalibrationStatus 
} from '../utils/fileEquipmentParser.js';

export { calculateNextCalibration, computeCalibrationStatus };

export function parsePastedExcelText(text, defaultSetor = 'Geral') {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Checa se primeira linha é cabeçalho
  const firstCols = lines[0].split(/\t|,|;/).map(c => c.trim().toLowerCase());
  let hasHeader = false;
  let headerMap = { tag: -1, serie: -1, equipamento: -1, fabricante: -1, modelo: -1, setor: -1, validade: -1 };

  firstCols.forEach((col, idx) => {
    if (col.includes('tag') || col.includes('patrimonio') || col.includes('idec')) {
      headerMap.tag = idx;
      hasHeader = true;
    } else if (col.includes('serie') || col.includes('serial') || col.includes('sn')) {
      headerMap.serie = idx;
      hasHeader = true;
    } else if (col.includes('equipamento') || col.includes('nome') || col.includes('aparelho') || col.includes('instrumento') || col.includes('descricao')) {
      headerMap.equipamento = idx;
      hasHeader = true;
    } else if (col.includes('fabricante') || col.includes('marca')) {
      headerMap.fabricante = idx;
      hasHeader = true;
    } else if (col.includes('modelo')) {
      headerMap.modelo = idx;
      hasHeader = true;
    } else if (col.includes('setor') || col.includes('local') || col.includes('departamento') || col.includes('unidade')) {
      headerMap.setor = idx;
      hasHeader = true;
    } else if (col.includes('validade') || col.includes('calibracao') || col.includes('vencimento')) {
      headerMap.validade = idx;
      hasHeader = true;
    }
  });

  const startIndex = hasHeader ? 1 : 0;
  const results = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = startIndex; i < lines.length; i++) {
    const rawCols = lines[i].split(/\t|,|;/).map(c => c.trim());
    if (rawCols.length === 0 || (rawCols.length === 1 && !rawCols[0])) continue;

    let tag = '';
    let serie = '';
    let eqNome = '';
    let fabricante = '';
    let modelo = '';
    let setor = defaultSetor;
    let validade = '';

    if (hasHeader) {
      if (headerMap.tag >= 0) tag = rawCols[headerMap.tag] || '';
      if (headerMap.serie >= 0) serie = rawCols[headerMap.serie] || '';
      if (headerMap.equipamento >= 0) eqNome = rawCols[headerMap.equipamento] || '';
      if (headerMap.fabricante >= 0) fabricante = rawCols[headerMap.fabricante] || '';
      if (headerMap.modelo >= 0) modelo = rawCols[headerMap.modelo] || '';
      if (headerMap.setor >= 0) setor = rawCols[headerMap.setor] || defaultSetor;
      if (headerMap.validade >= 0) validade = rawCols[headerMap.validade] || '';
    } else {
      if (rawCols.length === 1) {
        tag = rawCols[0];
        serie = rawCols[0];
        eqNome = 'Equipamento ' + rawCols[0];
      } else if (rawCols.length === 2) {
        tag = rawCols[0];
        serie = rawCols[1];
        eqNome = 'Equipamento ' + tag;
      } else if (rawCols.length === 3) {
        tag = rawCols[0];
        serie = rawCols[1];
        eqNome = rawCols[2];
      } else {
        tag = rawCols[0] || '';
        serie = rawCols[1] || '';
        eqNome = rawCols[2] || 'Equipamento';
        setor = rawCols[3] || defaultSetor;
        if (rawCols[4]) fabricante = rawCols[4];
        if (rawCols[5]) modelo = rawCols[5];
      }
    }

    const finalBarcode = serie || tag || 'BAR-' + (i + 1);
    if (!tag && !serie && !eqNome) continue;

    results.push({
      id: 'EQP-' + Date.now().toString(36) + '-' + i + '-' + Math.random().toString(36).substring(2, 5),
      tag: tag || finalBarcode,
      serie: serie || finalBarcode,
      codigoBarras: finalBarcode,
      equipamento: eqNome || 'Equipamento',
      fabricante: fabricante || 'Não especificado',
      modelo: modelo || 'Padrão',
      setor: setor || defaultSetor,
      dataCalibracao: today,
      periodicidadeMeses: 12,
      validadeCalibracao: validade || calculateNextCalibration(today, 12),
      proximaCalibracao: validade || calculateNextCalibration(today, 12),
      statusCalibracao: 'Válido',
      checado: false
    });
  }

  return results;
}

export default function AddEquipmentModal({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
  plans = [],
  activePlanId = null,
  hospitalName = '',
  existingSectors = [],
  initialCode = '',
  initialMode = 'manual' // 'manual' | 'excel' | 'paste' | 'scanner'
}) {
  // Aba ativa: 'manual' (1 por 1), 'excel' (Anexar Arquivo), 'paste' (Colar do Excel), 'scanner' (Bipagem contínua)
  const [activeTab, setActiveTab] = useState(initialMode || 'manual');
  const [selectedPlanId, setSelectedPlanId] = useState(activePlanId || plans[0]?.id || '');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Blindagem de Plano Ativo: Sempre vincula estritamente ao plano em execução no momento
  const activePlan = plans.find(p => p.id === (selectedPlanId || activePlanId)) || plans[0] || null;
  const effectivePlanId = activePlan?.id || selectedPlanId || activePlanId;
  const targetPlanTitle = activePlan?.title || 'Plano Ativo';
  const targetPlanTotal = activePlan?.total || (activePlan?.equipments?.length || 0);

  // --- FORMULÁRIO INDIVIDUAL (MANUAL) ---
  const [equipamento, setEquipamento] = useState('');
  const [tag, setTag] = useState('');
  const [serie, setSerie] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [modelo, setModelo] = useState('');
  const [setor, setSetor] = useState('');
  const [dataCalibracao, setDataCalibracao] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodicidadeMeses, setPeriodicidadeMeses] = useState('12');
  const [validadeCalibracao, setValidadeCalibracao] = useState(() => calculateNextCalibration(new Date().toISOString().split('T')[0], 12));
  const [statusCalibracao, setStatusCalibracao] = useState('Válido');
  const [observacao, setObservacao] = useState('');

  // --- MODO 2: IMPORTAR ARQUIVO (CSV, PDF, XLS, XLSX) ---
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parsedExcelResult, setParsedExcelResult] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  // --- MODO 3: COLAR EM LOTE (Ctrl+V) ---
  const [pastedText, setPastedText] = useState('');
  const [pastedEquipments, setPastedEquipments] = useState([]);
  const [batchDefaultSetor, setBatchDefaultSetor] = useState(existingSectors[0] || 'UTI Adulto');
  const [batchDefaultPeriod, setBatchDefaultPeriod] = useState('12');

  // --- MODO 4: BIPAGEM CONTÍNUA / FILA ---
  const [scannerQueueInput, setScannerQueueInput] = useState('');
  const [scannerQueue, setScannerQueue] = useState([]);
  const [queueEquipamentoNome, setQueueEquipamentoNome] = useState('Bomba de Infusão');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const queueInputRef = useRef(null);

  // Inicialização ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setSelectedPlanId(activePlanId || plans[0]?.id || '');
      setActiveTab(initialMode || 'manual');
      setError('');
      setExcelError('');
      setParsedExcelResult(null);
      setPastedText('');
      setPastedEquipments([]);
      setScannerQueue([]);
      setScannerQueueInput('');

      // Pré-carrega código se veio de uma busca ou leitura não encontrada
      if (initialCode) {
        setCodigoBarras(initialCode);
        setSerie(initialCode);
        setTag(initialCode);
      } else {
        setTag('');
        setSerie('');
        setCodigoBarras('');
      }

      setEquipamento('');
      setFabricante('');
      setModelo('');
      setSetor(existingSectors[0] || 'UTI Geral');

      const today = new Date().toISOString().split('T')[0];
      setDataCalibracao(today);
      setPeriodicidadeMeses('12');
      const nextDate = calculateNextCalibration(today, 12);
      setValidadeCalibracao(nextDate);
      setStatusCalibracao(computeCalibrationStatus(nextDate));
      setObservacao('');

      setTimeout(() => {
        if (initialMode === 'scanner') {
          queueInputRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 150);
    }
  }, [isOpen, activePlanId, plans, initialCode, initialMode]);

  // Recalcula próxima calibração quando data ou periodicidade mudam
  const handleDataCalibracaoChange = (e) => {
    const val = e.target.value;
    setDataCalibracao(val);
    if (val && periodicidadeMeses) {
      const next = calculateNextCalibration(val, periodicidadeMeses);
      setValidadeCalibracao(next);
      setStatusCalibracao(computeCalibrationStatus(next));
    }
  };

  const handlePeriodicidadeChange = (e) => {
    const val = e.target.value;
    setPeriodicidadeMeses(val);
    if (dataCalibracao && val) {
      const next = calculateNextCalibration(dataCalibracao, val);
      setValidadeCalibracao(next);
      setStatusCalibracao(computeCalibrationStatus(next));
    }
  };

  const handleValidadeChange = (e) => {
    const val = e.target.value;
    setValidadeCalibracao(val);
    setStatusCalibracao(computeCalibrationStatus(val));
  };

  // --- Handlers para Importação de Arquivo (CSV, PDF, XLS, XLSX) ---
  const processUploadedFile = async (file) => {
    if (!file) return;
    setIsParsingExcel(true);
    setExcelError('');
    try {
      const result = await parseEquipmentFile(file, batchDefaultSetor);
      setParsedExcelResult(result);
    } catch (err) {
      setExcelError(err.message || 'Erro ao processar o arquivo selecionado.');
      setParsedExcelResult(null);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleSelectExcelFile = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
      e.target.value = '';
    }
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  // --- Handlers para Colar em Lote (Ctrl+V) ---
  const handlePastedTextChange = (e) => {
    const val = e.target.value;
    setPastedText(val);
    if (val.trim()) {
      const parsed = parsePastedExcelText(val, batchDefaultSetor);
      setPastedEquipments(parsed);
    } else {
      setPastedEquipments([]);
    }
  };

  // --- Handlers para Bipagem Contínua em Fila ---
  const handleAddScannedCode = (e) => {
    e.preventDefault();
    const code = scannerQueueInput.trim();
    if (!code) return;

    if (scannerQueue.some(item => item.code.toLowerCase() === code.toLowerCase())) {
      alert(`O código "${code}" já está na lista de bipagem!`);
      setScannerQueueInput('');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const newItem = {
      id: 'EQP-QUEUE-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 5),
      code,
      tag: code,
      serie: code,
      codigoBarras: code,
      equipamento: queueEquipamentoNome || 'Equipamento Bipado',
      setor: batchDefaultSetor,
      dataCalibracao: today,
      periodicidadeMeses: 12,
      validadeCalibracao: calculateNextCalibration(today, 12),
      statusCalibracao: 'Válido'
    };

    setScannerQueue(prev => [newItem, ...prev]);
    setScannerQueueInput('');
    queueInputRef.current?.focus();
  };

  // Submissão de 1 Equipamento Manual
  const handleSubmitManual = async (e) => {
    e.preventDefault();
    setError('');

    if (!equipamento.trim()) {
      setError('Informe o nome ou tipo do equipamento.');
      return;
    }

    if (!tag.trim() && !serie.trim() && !codigoBarras.trim()) {
      setError('O aparelho precisa ter ao menos um identificador (Tag, Série ou Código de Barras).');
      return;
    }

    const finalBarcode = codigoBarras.trim() || serie.trim() || tag.trim();

    setIsLoading(true);

    try {
      const newEquipment = {
        id: 'EQP-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        equipamento: equipamento.trim(),
        tag: tag.trim() || finalBarcode,
        serie: serie.trim() || finalBarcode,
        codigoBarras: finalBarcode,
        fabricante: fabricante.trim() || 'Não especificado',
        modelo: modelo.trim() || 'Padrão',
        setor: setor.trim() || 'Geral',
        dataCalibracao: dataCalibracao || null,
        periodicidadeMeses: parseInt(periodicidadeMeses, 10) || 12,
        validadeCalibracao: validadeCalibracao || null,
        proximaCalibracao: validadeCalibracao || null,
        statusCalibracao: statusCalibracao || 'Válido',
        checado: false,
        observacao: observacao.trim()
      };

      const res = await onSave(newEquipment, effectivePlanId);
      if (res && res.success === false) {
        setError(res.message || 'Falha ao cadastrar equipamento.');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Erro inesperado ao salvar equipamento.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submissão em Lote (Planilha Complementar, Colar ou Bipagem)
  const handleSubmitBatch = async (itemsToSave, sourceLabel) => {
    if (!itemsToSave || itemsToSave.length === 0) {
      alert('Nenhum equipamento para adicionar.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (onSaveBatch) {
        const res = await onSaveBatch(itemsToSave, effectivePlanId, skipDuplicates);
        if (res && res.success === false) {
          setError(res.message || 'Erro ao adicionar equipamentos em lote.');
        } else {
          onClose();
        }
      } else {
        // Fallback: salva um por um se onSaveBatch não estiver definido
        for (const item of itemsToSave) {
          await onSave(item, effectivePlanId);
        }
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Falha ao processar adição em lote.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-600 to-indigo-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-3 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <div className="pr-6 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                Adicionar Equipamentos
              </span>
              {hospitalName && (
                <span className="text-[10px] text-slate-400 font-semibold truncate">
                  • {hospitalName}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              Acrescentar Equipamentos ao Plano
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cadastre manualmente, anexe outra planilha Excel ou cole dados em lote sem perder os checks já realizados
            </p>
          </div>
        </div>

        {/* Plano Ativo Vinculado (Blindagem Total contra Mistura de Dados) */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50/90 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900/60 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  🔒 Plano Ativo Selecionado
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  • Inserção direta sem risco de misturar com outros planos
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-slate-900 dark:text-white font-extrabold text-sm truncate">
                  {targetPlanTitle}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-semibold">
                  ({targetPlanTotal} {targetPlanTotal === 1 ? 'equipamento atual' : 'equipamentos atuais'})
                </span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Evitar duplicados (Tag/Série)</span>
          </label>
        </div>

        {/* 4 MODOS DE ENTRADA: Segmented Tabs */}
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-3 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 sm:px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">1 a 1 (Manual)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`py-2 px-1 sm:px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
              activeTab === 'excel'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Importar equipamentos via arquivo CSV, PDF, XLS ou XLSX"
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">CSV / PDF / XLS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`py-2 px-1 sm:px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Colar (Ctrl+V)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`py-2 px-1 sm:px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
              activeTab === 'scanner'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Bipar Fila</span>
          </button>
        </div>

        {error && (
          <div className="p-3 mb-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================
            ABA 1: FORMULÁRIO INDIVIDUAL (MANUAL)
        ============================================================ */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmitManual} className="space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs">
            
            {/* Nome / Tipo do Equipamento */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome / Descrição do Equipamento *
              </label>
              <input
                ref={inputRef}
                type="text"
                list="equipamentos-sugeridos"
                value={equipamento}
                onChange={(e) => setEquipamento(e.target.value)}
                placeholder="Ex: Bomba de Infusão Linear, Monitor Multiparâmetro..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                required
              />
              <datalist id="equipamentos-sugeridos">
                <option value="Bomba de Infusão Linear" />
                <option value="Bomba de Infusão de Seringa" />
                <option value="Monitor Multiparâmetro" />
                <option value="Cardioversor / Desfibrilador" />
                <option value="Eletrocardiógrafo (ECG)" />
                <option value="Ventilador Pulmonar" />
                <option value="Bisturi Eletrônico" />
                <option value="Oxímetro de Pulso" />
                <option value="Termômetro Digital Padrão" />
                <option value="Manômetro Digital de Pressão" />
                <option value="Balança Analítica" />
                <option value="Multímetro True RMS" />
              </datalist>
            </div>

            {/* Identificadores: Tag, Série e Código de Barras */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tag / Patrimônio</span>
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Ex: CAL-0108"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Nº de Série</span>
                </label>
                <input
                  type="text"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  placeholder="Ex: SN-9824102"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Código de Barras</span>
                </label>
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="Ex: 78910008"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Fabricante, Modelo e Setor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fabricante
                </label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Ex: Terumo, Mindray"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: TE-171, LF2001"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Setor / Localização
                </label>
                <input
                  type="text"
                  list="setores-sugeridos"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  placeholder="Ex: UTI Adulto"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <datalist id="setores-sugeridos">
                  {existingSectors.map((s, idx) => (
                    <option key={idx} value={s} />
                  ))}
                  <option value="UTI Geral" />
                  <option value="UTI Pediátrica" />
                  <option value="Centro Cirúrgico" />
                  <option value="Pronto Socorro" />
                </datalist>
              </div>
            </div>

            {/* SEÇÃO DE DATAS E PREVISÃO DE CALIBRAÇÃO */}
            <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Datas & Previsão da Próxima Calibração</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  statusCalibracao === 'Vencido'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : statusCalibracao === 'A Vencer'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  Status: {statusCalibracao}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data da Calibração Realizada
                  </label>
                  <input
                    type="date"
                    value={dataCalibracao}
                    onChange={handleDataCalibracaoChange}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Periodicidade
                  </label>
                  <select
                    value={periodicidadeMeses}
                    onChange={handlePeriodicidadeChange}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="3">3 Meses (Trimestral)</option>
                    <option value="6">6 Meses (Semestral)</option>
                    <option value="12">12 Meses (Anual - Padrão)</option>
                    <option value="24">24 Meses (Bienal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Previsão Próxima Calibração *
                  </label>
                  <input
                    type="date"
                    value={validadeCalibracao}
                    onChange={handleValidadeChange}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observações / Metrologia
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Calibração RBC, lacre ok..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Adicionar ao Plano Ativo ("{targetPlanTitle}")</span>
              </button>
            </div>

          </form>
        )}

        {/* ============================================================
            ABA 2: IMPORTAR ARQUIVO (CSV, PDF, XLS, XLSX)
        ============================================================ */}
        {activeTab === 'excel' && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-blue-50/50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-blue-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Acrescentar Equipamentos via Arquivo (CSV, PDF, XLS ou XLSX)</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px] sm:text-xs">
                Selecione ou arraste qualquer arquivo nos formatos <strong>.CSV</strong>, <strong>.PDF</strong> (laudos ou relatórios de calibração) ou <strong>Excel (.xlsx, .xls)</strong>. Os aparelhos encontrados serão incorporados diretamente ao plano sem apagar os dados ou conferências já realizadas.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectExcelFile}
              accept=".xlsx, .xls, .csv, .pdf, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
              className="hidden"
            />

            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition ${
                isDraggingFile 
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/50 ring-4 ring-emerald-500/20 scale-[0.99]' 
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
              }`}
            >
              {isParsingExcel ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-3">
                  <Clock className="w-9 h-9 text-emerald-500 animate-spin" />
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    Lendo e analisando arquivo...
                  </span>
                  <span className="text-xs text-slate-400">
                    Extraindo dados de tabelas, laudos e certificados
                  </span>
                </div>
              ) : parsedExcelResult ? (
                <div className="flex flex-col items-center justify-center space-y-2 text-emerald-600 dark:text-emerald-400 py-1">
                  <CheckCircle2 className="w-9 h-9" />
                  
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      parsedExcelResult.fileType === 'pdf'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                        : parsedExcelResult.fileType === 'csv'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                    }`}>
                      {parsedExcelResult.fileType === 'pdf' ? '📄 Documento PDF' : parsedExcelResult.fileType === 'csv' ? '📊 Arquivo CSV' : '📗 Planilha Excel'}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                      {parsedExcelResult.fileName}
                    </span>
                  </div>

                  <span className="text-xs bg-emerald-100 dark:bg-emerald-950 px-3.5 py-1 rounded-full font-bold">
                    ✓ {parsedExcelResult.total} equipamentos detectados e prontos para adicionar!
                  </span>

                  <span className="text-[11px] text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer pt-1">
                    Clique para trocar de arquivo
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <UploadCloud className="w-10 h-10 text-emerald-500 mb-0.5 animate-bounce duration-1000" />
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Clique aqui ou arraste o arquivo (CSV, PDF, XLS ou XLSX)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    Reconhece tabelas, laudos de calibração, inventários hospitalares e relatórios técnicos
                  </span>
                  <div className="flex items-center gap-1.5 pt-1.5 flex-wrap justify-center">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black border border-blue-200 dark:border-blue-900">.CSV</span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-200 dark:border-rose-900">.PDF</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-900">.XLSX</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-900">.XLS</span>
                  </div>
                </div>
              )}
            </div>

            {excelError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-semibold">{excelError}</span>
              </div>
            )}

            {/* Prévia dos equipamentos lidos */}
            {parsedExcelResult && parsedExcelResult.equipments && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  <span>Prévia dos primeiros itens lidos:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Total: {parsedExcelResult.total} itens</span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-[11px] bg-white dark:bg-slate-900">
                  {parsedExcelResult.equipments.slice(0, 10).map((eq, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <div className="min-w-0 truncate">
                        <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                          {eq.equipamento || eq.nome || 'Equipamento'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono flex-wrap mt-0.5">
                          {eq.tag && <span>Tag: <strong className="text-slate-600 dark:text-slate-300">{eq.tag}</strong></span>}
                          {eq.serie && <span>• S/N: <strong className="text-slate-600 dark:text-slate-300">{eq.serie}</strong></span>}
                          {(eq.fabricante || eq.modelo) && (
                            <span className="text-slate-500 font-sans">• {eq.fabricante} {eq.modelo}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold block text-[10px]">
                          {eq.setor || 'Geral'}
                        </span>
                        {eq.validadeCalibracao && (
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Val: {eq.validadeCalibracao}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedExcelResult.equipments.length > 10 && (
                    <div className="p-2.5 text-center text-slate-500 font-bold bg-slate-50 dark:bg-slate-800/60 text-[11px]">
                      ... e mais {parsedExcelResult.equipments.length - 10} equipamentos encontrados no arquivo
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!parsedExcelResult || isLoading}
                onClick={() => handleSubmitBatch(parsedExcelResult.equipments, parsedExcelResult.fileName)}
                className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {parsedExcelResult ? `Acrescentar ${parsedExcelResult.total} Itens ao Plano Ativo ("${targetPlanTitle}")` : 'Selecione um Arquivo'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            ABA 3: COLAR EM LOTE (Ctrl+V) DO EXCEL / GOOGLE SHEETS
        ============================================================ */}
        {activeTab === 'paste' && (
          <div className="space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs">
            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 mb-1">
                <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                <span>Copiar e Colar Linhas do Excel (Ctrl+C / Ctrl+V)</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Selecione as linhas na sua planilha do Excel ou Google Sheets, copie (Ctrl+C) e cole na caixa abaixo. Você pode colar colunas inteiras ou simplesmente uma lista de tags/séries!
              </p>
            </div>

            {/* Setor Padrão para os Itens Colados */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Setor Padrão para Novos Itens:
                </label>
                <input
                  type="text"
                  list="setores-sugeridos-batch"
                  value={batchDefaultSetor}
                  onChange={(e) => {
                    setBatchDefaultSetor(e.target.value);
                    if (pastedText) {
                      setPastedEquipments(parsePastedExcelText(pastedText, e.target.value));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
                <datalist id="setores-sugeridos-batch">
                  {existingSectors.map((s, idx) => (
                    <option key={idx} value={s} />
                  ))}
                  <option value="UTI Adulto" />
                  <option value="Pronto Socorro" />
                  <option value="Centro Cirúrgico" />
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periodicidade de Calibração:
                </label>
                <select
                  value={batchDefaultPeriod}
                  onChange={(e) => setBatchDefaultPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="6">6 Meses (Semestral)</option>
                  <option value="12">12 Meses (Anual - Padrão)</option>
                  <option value="24">24 Meses (Bienal)</option>
                </select>
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cole aqui os dados copiados:
              </label>
              <textarea
                value={pastedText}
                onChange={handlePastedTextChange}
                placeholder="Exemplo de conteúdo aceito:&#10;CAL-0101	SN-9824102	Bomba de Infusão	UTI Adulto&#10;CAL-0102	SN-4432190	Monitor Multiparamétrico	Centro Cirúrgico&#10;&#10;Ou cole apenas uma lista de códigos/séries um por linha."
                rows={5}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Prévia da Análise */}
            {pastedEquipments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{pastedEquipments.length} equipamentos identificados na colagem:</span>
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {pastedEquipments.slice(0, 10).map((eq, i) => (
                    <div key={i} className="p-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{eq.equipamento}</span>
                        <span className="text-slate-400 font-mono text-[10px]">Tag: {eq.tag} | S/N: {eq.serie}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                        {eq.setor}
                      </span>
                    </div>
                  ))}
                  {pastedEquipments.length > 10 && (
                    <div className="p-2 text-center text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/60">
                      ... e mais {pastedEquipments.length - 10} itens
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pastedEquipments.length === 0 || isLoading}
                onClick={() => handleSubmitBatch(pastedEquipments, 'Colagem Excel')}
                className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {pastedEquipments.length > 0 ? `Adicionar ${pastedEquipments.length} Itens ao Plano Ativo ("${targetPlanTitle}")` : 'Cole os Dados'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            ABA 4: BIPAGEM CONTÍNUA / FILA DE ENTRADA RÁPIDA
        ============================================================ */}
        {activeTab === 'scanner' && (
          <div className="space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs">
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <h4 className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                <ScanLine className="w-4 h-4 text-amber-600" />
                <span>Leitura Rápida com Pistola de Bipagem USB / Bluetooth</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Mantenha o foco no campo abaixo e vá bipando os equipamentos em campo. Cada bip adicionará um novo item à lista de inclusão do plano atual.
              </p>
            </div>

            {/* Configuração rápida do tipo de aparelho para a fila */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Aparelho que está sendo bipado:
                </label>
                <input
                  type="text"
                  value={queueEquipamentoNome}
                  onChange={(e) => setQueueEquipamentoNome(e.target.value)}
                  placeholder="Ex: Bomba de Infusão"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Setor:
                </label>
                <input
                  type="text"
                  value={batchDefaultSetor}
                  onChange={(e) => setBatchDefaultSetor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Campo de Bipagem com Submit no Enter */}
            <form onSubmit={handleAddScannedCode} className="relative">
              <input
                ref={queueInputRef}
                type="text"
                value={scannerQueueInput}
                onChange={(e) => setScannerQueueInput(e.target.value)}
                placeholder="Aponte a pistola ou digite o código/série e aperte Enter..."
                className="w-full pl-10 pr-24 py-3 bg-white dark:bg-slate-950 border-2 border-amber-500/50 rounded-2xl font-mono text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
              />
              <Barcode className="w-5 h-5 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 animate-pulse" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                + Inserir
              </button>
            </form>

            {/* Fila de Bipagens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Fila de Aparelhos Bipados ({scannerQueue.length}):</span>
                {scannerQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScannerQueue([])}
                    className="text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar fila</span>
                  </button>
                )}
              </div>

              {scannerQueue.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Nenhum código bipado ainda. Aponte a pistola para o código de barras.
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {scannerQueue.map((item, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">
                          {scannerQueue.length - idx}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                          {item.code}
                        </span>
                        <span className="text-slate-400 truncate">• {item.equipamento}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScannerQueue(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={scannerQueue.length === 0 || isLoading}
                onClick={() => handleSubmitBatch(scannerQueue, 'Bipagem Contínua')}
                className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {scannerQueue.length > 0 ? `Salvar ${scannerQueue.length} Bipados no Plano Ativo ("${targetPlanTitle}")` : 'Bipe os Códigos'}
                </span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
