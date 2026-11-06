import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Check, 
  X, 
  Zap, 
  Layers, 
  Wrench, 
  Target, 
  ShieldCheck, 
  Sparkles, 
  CheckSquare, 
  Users, 
  Info,
  Clock,
  ArrowRight,
  Lock,
  Truck,
  KeyRound,
  RotateCcw
} from 'lucide-react';

export default function SheetServicesConfigModal({
  isOpen,
  onClose,
  serviceConfig,
  onSaveConfig,
  hospitalName = '',
  planTitle = '',
  totalEquipments = 0,
  isInitialSetup = false
}) {
  const [enableCalibracao, setEnableCalibracao] = useState(true);
  const [enablePreventiva, setEnablePreventiva] = useState(true);
  const [enableSeguranca, setEnableSeguranca] = useState(true);
  const [executionMode, setExecutionMode] = useState('all_at_once'); // Padrão: 'all_at_once' (Pacote Completo Fixado)
  const [enableCarrinhoDevolucao, setEnableCarrinhoDevolucao] = useState(false);
  
  // Controle de Senha para Habilitar/Desabilitar o Módulo de Carrinho & Devolução
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingCarrinhoToggle, setPendingCarrinhoToggle] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEnableCalibracao(serviceConfig?.enableCalibracao ?? true);
      setEnablePreventiva(serviceConfig?.enablePreventiva ?? true);
      setEnableSeguranca(serviceConfig?.enableSeguranca ?? true);
      setExecutionMode(serviceConfig?.executionMode || 'all_at_once');
      setEnableCarrinhoDevolucao(Boolean(serviceConfig?.enableCarrinhoDevolucao));
      setShowPinPrompt(false);
      setPinInput('');
      setPinError('');
    }
  }, [isOpen, serviceConfig]);

  if (!isOpen) return null;

  // Garante pelo menos um parâmetro ativo
  const toggleCalibracao = () => {
    if (enableCalibracao && !enablePreventiva && !enableSeguranca) return;
    setEnableCalibracao(!enableCalibracao);
  };

  const togglePreventiva = () => {
    if (enablePreventiva && !enableCalibracao && !enableSeguranca) return;
    setEnablePreventiva(!enablePreventiva);
  };

  const toggleSeguranca = () => {
    if (enableSeguranca && !enableCalibracao && !enablePreventiva) return;
    setEnableSeguranca(!enableSeguranca);
  };

  const handleSetOnlyCalibracao = () => {
    setEnableCalibracao(true);
    setEnablePreventiva(false);
    setEnableSeguranca(false);
  };

  const handleLockCompletePackage = () => {
    setEnableCalibracao(true);
    setEnablePreventiva(true);
    setEnableSeguranca(true);
    setExecutionMode('all_at_once');
  };

  const handleSetAllServices = () => {
    setEnableCalibracao(true);
    setEnablePreventiva(true);
    setEnableSeguranca(true);
  };

  const activeCount = [enableCalibracao, enablePreventiva, enableSeguranca].filter(Boolean).length;

  const handleRequestCarrinhoToggle = () => {
    const nextVal = !enableCarrinhoDevolucao;
    setPendingCarrinhoToggle(nextVal);
    setShowPinPrompt(true);
    setPinInput('');
    setPinError('');
  };

  const handleConfirmPin = (e) => {
    e?.preventDefault();
    const clean = pinInput.trim();
    if (clean === '1234' || clean.toLowerCase() === 'digiclintec' || clean === 'admin123') {
      setEnableCarrinhoDevolucao(pendingCarrinhoToggle);
      setShowPinPrompt(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Senha incorreta. (Padrão de segurança: 1234)');
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig({
      enableCalibracao,
      enablePreventiva,
      enableSeguranca,
      executionMode,
      enableCarrinhoDevolucao
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <Settings className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  {isInitialSetup ? 'Configuração Inicial da Planilha' : 'Opções e Serviços da Planilha'}
                </h3>
                <p className="text-xs text-white/80 truncate">
                  {hospitalName} {planTitle ? `• ${planTitle}` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isInitialSetup && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold bg-white/15 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-white/20">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Planilha pronta com {totalEquipments} bombas! Defina abaixo como deseja conferir:</span>
            </div>
          )}
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs sm:text-sm">
          
          {/* Seção 1: Quais serviços deseja checar nesta planilha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>1. Quais serviços checar nesta planilha?</span>
              </label>

              {/* Botões Rápidos de Preset */}
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                <button
                  type="button"
                  onClick={handleLockCompletePackage}
                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-xs transition flex items-center gap-1"
                  title="Fixar todos os 3 serviços juntos em 1 único bip"
                >
                  <Lock className="w-3 h-3 text-amber-300" />
                  <span>🔒 Fixar Calibração Completa (3 em 1)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSetOnlyCalibracao}
                  className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700 transition"
                >
                  Somente Calibração
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Desabilite parâmetros caso o contrato deste hospital seja somente para calibração, ou mantenha todos ativos.
            </p>

            {/* Grid dos 3 Serviços */}
            <div className="space-y-2 pt-1">
              
              {/* Calibração Metrológica */}
              <button
                type="button"
                onClick={toggleCalibracao}
                className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                  enableCalibracao
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    enableCalibracao ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Calibração Metrológica
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Conferência metrológica de vazão e pressão das bombas
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                  enableCalibracao ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {enableCalibracao && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

              {/* Manutenção Preventiva */}
              <button
                type="button"
                onClick={togglePreventiva}
                className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                  enablePreventiva
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    enablePreventiva ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Manutenção Preventiva
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inspeção de bateria, limpeza técnica e mecanismo
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                  enablePreventiva ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {enablePreventiva && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

              {/* Teste de Segurança Elétrica (TSE) */}
              <button
                type="button"
                onClick={toggleSeguranca}
                className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                  enableSeguranca
                    ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    enableSeguranca ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Teste de Segurança Elétrica (TSE)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Corrente de fuga, aterramento e isolação (NBR IEC 60601)
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                  enableSeguranca ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {enableSeguranca && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

            </div>
          </div>

          {/* Seção 2: Modo de Bipagem e Checagem */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>2. Como deseja bipar os equipamentos?</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Opção A: Tudo de Uma Vez */}
              <button
                type="button"
                onClick={() => setExecutionMode('all_at_once')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                  executionMode === 'all_at_once'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 shadow-sm ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Zap className="w-4 h-4" />
                      <span>Tudo de uma vez</span>
                    </span>
                    {executionMode === 'all_at_once' && (
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <strong>1 único bip</strong> valida automaticamente todos os serviços ativos juntos.
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-md w-fit">
                  ⚡ Recomendado para 1 técnico fazendo tudo
                </div>
              </button>

              {/* Opção B: Separado um por um */}
              <button
                type="button"
                onClick={() => setExecutionMode('separated')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                  executionMode === 'separated'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Users className="w-4 h-4" />
                      <span>Separado um por um</span>
                    </span>
                    {executionMode === 'separated' && (
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Cada equipe bipa apenas a sua modalidade selecionada (Calibração, Preventiva ou TSE).
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-500/15 px-2 py-0.5 rounded-md w-fit">
                  🎯 Recomendado para 2 ou mais equipes
                </div>
              </button>

            </div>
          </div>

          {/* Seção 3: Logística e Carrinho de Devolução aos Setores */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-500" />
                <span>3. Logística: Carrinho & Devolução aos Setores</span>
              </label>

              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                enableCarrinhoDevolucao 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {enableCarrinhoDevolucao ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Habilita a aba de conferência e separação de bombas por setor de destino para devolução aos andares do hospital (com identificação rápida por bip).
            </p>

            {/* Toggle Card com Proteção de Senha */}
            <div className="p-3 rounded-2xl border transition bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    enableCarrinhoDevolucao ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Módulo de Carrinho & Devolução
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Requer senha técnica para ativar ou desativar
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestCarrinhoToggle}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs ${
                    enableCarrinhoDevolucao
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{enableCarrinhoDevolucao ? 'Desativar Módulo' : 'Ativar Módulo'}</span>
                </button>
              </div>

              {/* Prompt de Senha Inline se solicitado toggle */}
              {showPinPrompt && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Confirme sua Senha de Técnico:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPinPrompt(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      autoFocus
                      placeholder="Senha (padrão: 1234)"
                      value={pinInput}
                      onChange={e => {
                        setPinInput(e.target.value);
                        setPinError('');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConfirmPin();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmPin}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shrink-0"
                    >
                      Confirmar
                    </button>
                  </div>

                  {pinError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                      {pinError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resumo da Configuração Escolhida */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Resumo do Modo Operacional:</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              • Serviços contratados / ativos: <strong>{activeCount} de 3</strong> ({[
                enableCalibracao ? 'Calibração' : null,
                enablePreventiva ? 'Preventiva' : null,
                enableSeguranca ? 'Seg. Elétrica' : null
              ].filter(Boolean).join(', ')})
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              • Regra de Bipagem: <strong>{executionMode === 'all_at_once' ? '🔒 1 Bip carimba Calibração + Preventiva + Seg. Elétrica juntas (Fixado)' : 'Bipa por frentes separadas de trabalho'}</strong>
            </p>
            {executionMode === 'all_at_once' && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                ✓ Prevenção de erros ativada: O scanner bipará todas as etapas juntas. A única exceção alterável é Manutenção Externa.
              </p>
            )}
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition text-xs sm:text-sm"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{isInitialSetup ? 'Iniciar com Esta Configuração' : 'Salvar Configurações'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

