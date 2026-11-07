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
  Check
} from 'lucide-react';

export function calculateNextCalibration(dateStr, months = 12) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + parseInt(months, 10));
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

export function computeCalibrationStatus(validadeStr) {
  if (!validadeStr) return 'Válido';
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(validadeStr + 'T00:00:00');
    if (isNaN(target.getTime())) return 'Válido';
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Vencido';
    if (diffDays <= 30) return 'A Vencer';
    return 'Válido';
  } catch (e) {
    return 'Válido';
  }
}

export default function AddEquipmentModal({
  isOpen,
  onClose,
  onSave,
  plans = [],
  activePlanId = null,
  hospitalName = '',
  existingSectors = []
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(activePlanId || plans[0]?.id || '');
  const [equipamento, setEquipamento] = useState('');
  const [tag, setTag] = useState('');
  const [serie, setSerie] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [modelo, setModelo] = useState('');
  const [setor, setSetor] = useState('');
  
  // Datas e Previsão de Calibração
  const [dataCalibracao, setDataCalibracao] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodicidadeMeses, setPeriodicidadeMeses] = useState('12');
  const [validadeCalibracao, setValidadeCalibracao] = useState(() => calculateNextCalibration(new Date().toISOString().split('T')[0], 12));
  const [statusCalibracao, setStatusCalibracao] = useState('Válido');
  const [observacao, setObservacao] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);

  // Sincroniza plano ativo ao abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedPlanId(activePlanId || plans[0]?.id || '');
      setEquipamento('');
      setTag('');
      setSerie('');
      setCodigoBarras('');
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
      setError('');

      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, activePlanId, plans]);

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

  const handleUseSerialAsBarcode = () => {
    if (serie.trim()) setCodigoBarras(serie.trim());
  };

  const handleUseTagAsBarcode = () => {
    if (tag.trim()) setCodigoBarras(tag.trim());
  };

  const handleGenerateBarcode = () => {
    const randomCode = 'EQP-' + Math.floor(100000 + Math.random() * 900000);
    setCodigoBarras(randomCode);
    if (!tag.trim()) setTag(randomCode);
  };

  const handleSubmit = async (e) => {
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
        check_calibracao: false,
        check_preventiva: false,
        check_seguranca: false,
        check_externa: false,
        observacao: observacao.trim()
      };

      const res = await onSave(newEquipment, selectedPlanId);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col"
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
        <div className="flex items-start gap-3.5 mb-4 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <div className="pr-6 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                Novo Equipamento
              </span>
              {hospitalName && (
                <span className="text-[10px] text-slate-400 font-semibold truncate">
                  • {hospitalName}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              Cadastrar Aparelho no Plano
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adicione instrumentos com previsão e datas de calibração para conferência
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção do Plano Alvo */}
          {plans.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Adicionar ao Plano / Cronograma *</span>
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.mes || 'Geral'}) - {p.total || 0} equipamentos
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nome / Tipo do Equipamento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                <span>Tag / Patrimônio</span>
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex: CAL-0108"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                <span>Nº de Série</span>
              </label>
              <input
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="Ex: SN-9824102"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Barcode className="w-3.5 h-3.5 text-emerald-500" />
                <span>Código de Barras</span>
              </label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Ex: 78910008"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Atalhos para preenchimento de código de barras */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
            <span>Copiar para código de barras:</span>
            {serie && (
              <button
                type="button"
                onClick={handleUseSerialAsBarcode}
                className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-md font-mono font-semibold"
              >
                Usar Série ({serie})
              </button>
            )}
            {tag && (
              <button
                type="button"
                onClick={handleUseTagAsBarcode}
                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-md font-mono font-semibold"
              >
                Usar Tag ({tag})
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateBarcode}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-md font-semibold"
            >
              Gerar Código Auto
            </button>
          </div>

          {/* Fabricante, Modelo e Setor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fabricante
              </label>
              <input
                type="text"
                list="fabricantes-sugeridos"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Ex: Terumo, Mindray"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <datalist id="fabricantes-sugeridos">
                <option value="Terumo" />
                <option value="Lifemed" />
                <option value="B. Braun" />
                <option value="Mindray" />
                <option value="Dixtal / Philips" />
                <option value="GE Healthcare" />
                <option value="Fluke" />
                <option value="Mitutoyo" />
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex: TE-171, LF2001"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Setor / Localização
              </label>
              <input
                type="text"
                list="setores-sugeridos"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                placeholder="Ex: UTI Adulto"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <datalist id="setores-sugeridos">
                {existingSectors.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
                <option value="UTI Geral" />
                <option value="UTI Pediátrica" />
                <option value="Centro Cirúrgico" />
                <option value="Pronto Socorro" />
                <option value="Engenharia Clínica" />
                <option value="Maternidade" />
                <option value="Hemodinâmica" />
              </datalist>
            </div>
          </div>

          {/* SEÇÃO DE CRONOGRAMA & DATAS DE CALIBRAÇÃO */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data da Calibração Realizada
                </label>
                <input
                  type="date"
                  value={dataCalibracao}
                  onChange={handleDataCalibracaoChange}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periodicidade
                </label>
                <select
                  value={periodicidadeMeses}
                  onChange={handlePeriodicidadeChange}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
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
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observações / Notas Metrológicas
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Calibração acreditada RBC, lacre intacto, cabo incluso..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Cadastrar Equipamento</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

