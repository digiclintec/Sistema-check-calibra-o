import React from 'react';
import ModalityBar from './ModalityBar';
import { MODALITIES } from '../utils/modalities';
import { 
  User, 
  Settings, 
  SlidersHorizontal, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  LogOut, 
  ArrowLeft, 
  Crown, 
  Sparkles, 
  Building2, 
  Layers, 
  CheckCircle2, 
  Zap, 
  Package, 
  Target, 
  Wrench,
  Radio,
  Check
} from 'lucide-react';

export default function TechnicianProfileTab({
  currentUser,
  activeHospital,
  equipments = [],
  activeModality = 'calibracao',
  onChangeModality,
  serviceConfig,
  onOpenServiceConfig,
  soundEnabled = true,
  setSoundEnabled,
  onNavigateToConferencia,
  onLogout
}) {
  const isMaster = currentUser?.role === 'master';
  const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;

  const total = equipments.length;
  const bipados = equipments.filter(e => Boolean(e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa)).length;
  const calOk = equipments.filter(e => e.check_calibracao !== undefined ? e.check_calibracao : e.checado).length;
  const prevOk = equipments.filter(e => Boolean(e.check_preventiva)).length;
  const segOk = equipments.filter(e => Boolean(e.check_seguranca)).length;
  const extOk = equipments.filter(e => Boolean(e.check_externa)).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Top Header Card com Identificação do Técnico */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg shadow-purple-500/25 shrink-0 border border-white/20">
              {isMaster ? (
                <Crown className="w-8 h-8 text-amber-300" />
              ) : (
                <span>{(currentUser?.name || currentUser?.email || 'T').charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                  {currentUser?.name || 'Técnico de Campo'}
                </h2>
                {isMaster ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Master
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    Operador
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {currentUser?.email || 'digiclintec@gmail.com'}
              </p>

              {activeHospital && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-1 font-semibold truncate">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">Unidade: {activeHospital.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Botão de Retorno Rápido para a Conferência */}
          {onNavigateToConferencia && (
            <button
              onClick={onNavigateToConferencia}
              className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition shadow-md shadow-blue-500/25 active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Voltar para Conferência</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          BLOCO 1: PAINEL DA FRENTE DE TRABALHO / EQUIPE ATIVA
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Target className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Frente de Trabalho Ativa do Técnico
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecione qual equipe você está operando. Suas validações e bipes serão computados nesta modalidade:
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-black px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${currentMod.badgeClass}`}>
              <span>{currentMod.icon}</span>
              <span>Frente Ativa: {currentMod.name}</span>
            </span>
          </div>
        </div>

        {/* Componente ModalityBar Completo Integrado no Perfil */}
        <ModalityBar
          activeModality={activeModality}
          onChangeModality={onChangeModality}
          equipments={equipments}
          serviceConfig={serviceConfig}
          onOpenServiceConfig={onOpenServiceConfig}
        />
      </div>

      {/* ============================================================
          BLOCO 2: OPÇÕES DE CHECAGEM DOS SERVIÇOS DA PLANILHA
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Opções de Checagem dos Serviços
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure como a planilha valida as bombas e quais modalidades estão habilitadas:
              </p>
            </div>
          </div>

          {onOpenServiceConfig && (
            <button
              onClick={onOpenServiceConfig}
              className="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 transition active:scale-95 shrink-0"
            >
              <Settings className="w-4 h-4 text-blue-500" />
              <span>Configurar Opções de Checagem</span>
            </button>
          )}
        </div>

        {/* Resumo Visual das Opções de Checagem Atuais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Card do Modo de Bipagem */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Modo de Execução dos Bipes:
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                serviceConfig?.executionMode === 'all_at_once'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
              }`}>
                <span>{serviceConfig?.executionMode === 'all_at_once' ? '🔒 Calibração Completa Fixada' : '🎯 Modo: Bipar Separado'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {serviceConfig?.executionMode === 'all_at_once'
                ? '1 único bip carimba Calibração Metrológica + Preventiva + TSE juntas. (Apenas Manutenção Externa é separada).'
                : 'Cada equipe bipa e valida sua própria etapa individualmente.'}
            </p>
          </div>

          {/* Card dos Serviços Habilitados */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Modalidades Habilitadas na Planilha:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                (serviceConfig?.enableCalibracao ?? true)
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 border-transparent opacity-60'
              }`}>
                {(serviceConfig?.enableCalibracao ?? true) ? '✓ Calibração' : '✕ Calibração'}
              </span>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                (serviceConfig?.enablePreventiva ?? true)
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 border-transparent opacity-60'
              }`}>
                {(serviceConfig?.enablePreventiva ?? true) ? '✓ Preventiva' : '✕ Preventiva'}
              </span>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                (serviceConfig?.enableSeguranca ?? true)
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 border-transparent opacity-60'
              }`}>
                {(serviceConfig?.enableSeguranca ?? true) ? '✓ TSE Elétrica' : '✕ TSE Elétrica'}
              </span>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">
                ✓ Manut. Externa
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Define quais colunas e critérios devem ser atingidos para cada aparelho no hospital.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================
          BLOCO 3: PREFERÊNCIAS PESSOAIS DE BIPAGEM E SOM
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Volume2 className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Preferências de Bipagem & Feedback do Coletor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajustes de som, voz em português e vibração para a conferência hospitalar:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Alternador de Som */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Sons de Bipagem Hospitalar (Modo Silencioso / UTIN & UCINCO)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Bipes curtos e discretos (&lt;80ms) sem voz falada, adequados para UTIN, UCINCO e leitos com pacientes em repouso.
              </p>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition shadow-xs shrink-0 ${
                soundEnabled
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'
              }`}
              title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {/* Sair da Conta */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Sessão do Técnico
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Encerrar login e desconectar este operador deste celular/computador.
              </p>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/30 transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
