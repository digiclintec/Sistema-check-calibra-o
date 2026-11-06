import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  Percent, 
  Target, 
  Wrench, 
  Zap, 
  LayoutGrid, 
  Package,
  PieChart,
  BarChart3,
  TrendingUp,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { MODALITIES } from '../utils/modalities';

export default function StatsCards({ stats, activeFilter, onSelectFilter, activeModality = 'calibracao' }) {
  const { total, checked, pending, expired, expiringSoon, percent, externa = 0 } = stats;
  const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;

  const validInHouse = Math.max(0, checked - externa);
  const validPercent = total > 0 ? ((validInHouse / total) * 100).toFixed(1) : '0';
  const externaPercent = total > 0 ? ((externa / total) * 100).toFixed(1) : '0';
  const pendingPercent = total > 0 ? ((pending / total) * 100).toFixed(1) : '0';

  // Cálculos geométricos precisos para o Gráfico em Pizza / Rosca SVG (SVG Donut Chart)
  const RADIUS = 38;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~238.761

  const validStroke = total > 0 ? (validInHouse / total) * CIRCUMFERENCE : 0;
  const externaStroke = total > 0 ? (externa / total) * CIRCUMFERENCE : 0;
  const pendingStroke = total > 0 ? (pending / total) * CIRCUMFERENCE : 0;

  const validOffset = 0;
  const externaOffset = -validStroke;
  const pendingOffset = -(validStroke + externaStroke);

  const modalityLabels = {
    calibracao: {
      checkedTitle: 'Calibrações / OK',
      checkedSubtext: `${percent}% da Calibração concluída`,
      pendingTitle: 'Pendentes de Calibração',
      pendingSubtext: 'Aguardando validação metrológica',
      progressGradient: 'bg-gradient-to-r from-blue-600 to-indigo-500'
    },
    preventiva: {
      checkedTitle: 'Preventivas / OK',
      checkedSubtext: `${percent}% da Preventiva concluída`,
      pendingTitle: 'Pendentes de Preventiva',
      pendingSubtext: 'Aguardando manutenção preventiva',
      progressGradient: 'bg-gradient-to-r from-emerald-600 to-teal-500'
    },
    seguranca: {
      checkedTitle: 'Testes de Seg. / OK',
      checkedSubtext: `${percent}% dos testes TSE realizados`,
      pendingTitle: 'Pendentes de Teste Seg.',
      pendingSubtext: 'Aguardando teste de segurança elétrica',
      progressGradient: 'bg-gradient-to-r from-amber-600 to-orange-500'
    },
    externa: {
      checkedTitle: 'Manutenção Externa',
      checkedSubtext: `${percent}% recolhidas p/ conserto/calibração terceirizada`,
      pendingTitle: 'Bombas no Hospital',
      pendingSubtext: 'Permanecem na unidade hospitalar',
      progressGradient: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500'
    },
    geral: {
      checkedTitle: 'Total Bipados',
      checkedSubtext: `${percent}% já lidos e separados (calibração ou manutenção)`,
      pendingTitle: 'Falta Bipar',
      pendingSubtext: 'Aguardando bipagem e separação',
      progressGradient: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500'
    }
  }[activeModality] || {
    checkedTitle: 'Checados / OK',
    checkedSubtext: `${percent}% da meta concluída`,
    pendingTitle: 'Pendentes de Bipagem',
    pendingSubtext: 'Aguardando conferência',
    progressGradient: 'bg-gradient-to-r from-blue-600 to-indigo-500'
  };

  const cards = [
    {
      id: 'todos',
      label: 'Total de Aparelhos',
      value: total,
      subtext: 'Cadastrados na planilha',
      icon: Layers,
      color: 'blue',
      borderColor: 'border-blue-500/20',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600 dark:text-blue-400',
      activeRing: 'ring-2 ring-blue-500 shadow-blue-500/20',
    },
    {
      id: 'checados',
      label: modalityLabels.checkedTitle,
      value: checked,
      subtext: modalityLabels.checkedSubtext,
      icon: CheckCircle2,
      color: activeModality === 'preventiva' ? 'emerald' : (activeModality === 'seguranca' ? 'amber' : (activeModality === 'externa' ? 'purple' : 'blue')),
      borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500 shadow-emerald-500/20',
    },
    {
      id: 'pendentes',
      label: modalityLabels.pendingTitle,
      value: pending,
      subtext: modalityLabels.pendingSubtext,
      icon: Clock,
      color: 'amber',
      borderColor: 'border-amber-500/20',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
      activeRing: 'ring-2 ring-amber-500 shadow-amber-500/20',
    },
    {
      id: 'externa',
      label: 'Manutenção Externa',
      value: externa,
      subtext: 'Terceirizada (conserto/calibração)',
      icon: Package,
      color: 'purple',
      borderColor: 'border-purple-500/20',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-600 dark:text-purple-400',
      activeRing: 'ring-2 ring-purple-500 shadow-purple-500/20',
    },
    {
      id: 'vencidos',
      label: 'Calibração Vencida / Alerta',
      value: expired + expiringSoon,
      subtext: `${expired} vencidos, ${expiringSoon} a vencer`,
      icon: AlertTriangle,
      color: 'rose',
      borderColor: 'border-rose-500/20',
      bgColor: 'bg-rose-500/10',
      textColor: 'text-rose-600 dark:text-rose-400',
      activeRing: 'ring-2 ring-rose-500 shadow-rose-500/20',
    }
  ];

  return (
    <div className="space-y-2.5 sm:space-y-3 w-full overflow-hidden">
      
      {/* ============================================================
          DASHBOARD HERO EXECUTIVO COM GRÁFICO EM PIZZA / ROSCA
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 sm:p-5 shadow-sm w-full relative overflow-hidden">
        
        {/* Glow de fundo estético */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 relative">
          
          {/* LADO ESQUERDO: GRÁFICO EM PIZZA / ROSCA SVG */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg 
              className="w-28 h-28 sm:w-32 sm:h-32 transform -rotate-90 drop-shadow-sm" 
              viewBox="0 0 100 100"
            >
              {/* Trilha de fundo (neutra) */}
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="transparent"
                strokeWidth="10"
                className="text-slate-100 dark:text-slate-800/80 stroke-current"
              />

              {total > 0 && (
                <>
                  {/* Fatia 1: Validadas / Checadas no Hospital (Azul / Ciano) */}
                  {validInHouse > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="transparent"
                      strokeWidth="10"
                      strokeDasharray={`${validStroke} ${CIRCUMFERENCE}`}
                      strokeDashoffset={validOffset}
                      className="text-blue-500 dark:text-blue-400 stroke-current transition-all duration-700 ease-out"
                    />
                  )}

                  {/* Fatia 2: Manutenção Externa / Terceirizada (Roxo) */}
                  {externa > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="transparent"
                      strokeWidth="10"
                      strokeDasharray={`${externaStroke} ${CIRCUMFERENCE}`}
                      strokeDashoffset={externaOffset}
                      className="text-purple-500 dark:text-purple-400 stroke-current transition-all duration-700 ease-out"
                    />
                  )}

                  {/* Fatia 3: Pendentes de Bipagem (Âmbar suave / Ardósia) */}
                  {pending > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="transparent"
                      strokeWidth="10"
                      strokeDasharray={`${pendingStroke} ${CIRCUMFERENCE}`}
                      strokeDashoffset={pendingOffset}
                      className="text-amber-400/50 dark:text-slate-700 stroke-current transition-all duration-700 ease-out"
                    />
                  )}
                </>
              )}
            </svg>

            {/* Centro do Gráfico: Percentual & Total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white leading-none">
                {percent}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-0.5">
                {checked}/{total}
              </span>
              <span className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${
                percent === 100 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-blue-600 dark:text-blue-400'
              }`}>
                {percent === 100 ? '✓ 100% OK' : 'BIPADOS'}
              </span>
            </div>
          </div>

          {/* LADO DIREITO: DASHBOARD INFORMATIVO & LEGENDA INTERATIVA */}
          <div className="flex-1 min-w-0 w-full space-y-3">
            
            {/* Header com Identificador da Frente e Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Dashboard Metrológico
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {currentMod.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribuição e cobertura em tempo real da carga de trabalho hospitalar.
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-[11px] font-mono text-slate-400 block">
                  Carga Total: <strong>{total} bombas</strong>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {checked} atendidas ({percent}%)
                </span>
              </div>
            </div>

            {/* Barra Segmentada Multi-Cores Proporcional */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex shadow-inner p-0.5 gap-0.5">
                {/* Segmento Validadas */}
                {parseFloat(validPercent) > 0 && (
                  <div
                    style={{ width: `${validPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                    title={`Validadas no Hospital: ${validInHouse} (${validPercent}%)`}
                  />
                )}
                {/* Segmento Manutenção Externa */}
                {parseFloat(externaPercent) > 0 && (
                  <div
                    style={{ width: `${externaPercent}%` }}
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                    title={`Manutenção Externa: ${externa} (${externaPercent}%)`}
                  />
                )}
                {/* Segmento Pendentes */}
                {parseFloat(pendingPercent) > 0 && (
                  <div
                    style={{ width: `${pendingPercent}%` }}
                    className="h-full bg-slate-200 dark:bg-slate-700/60 rounded-full transition-all duration-500"
                    title={`Pendentes: ${pending} (${pendingPercent}%)`}
                  />
                )}
              </div>
            </div>

            {/* Legenda Interativa com Acesso Rápido a Filtros */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
              
              {/* 1. Validadas no Hospital */}
              <button
                type="button"
                onClick={() => onSelectFilter('checados')}
                className={`p-2 rounded-xl border text-left transition active:scale-95 flex items-center justify-between gap-1.5 ${
                  activeFilter === 'checados'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 shadow-xs ring-1 ring-blue-400/40'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800'
                }`}
                title="Filtrar por bombas validadas no hospital"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                      Validadas
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pl-4">
                    {validPercent}%
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400 shrink-0">
                  {validInHouse}
                </span>
              </button>

              {/* 2. Manutenção Externa */}
              <button
                type="button"
                onClick={() => onSelectFilter('externa')}
                className={`p-2 rounded-xl border text-left transition active:scale-95 flex items-center justify-between gap-1.5 ${
                  activeFilter === 'externa'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-700 shadow-xs ring-1 ring-purple-400/40'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800'
                }`}
                title="Filtrar por bombas em manutenção externa"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                      Manut. Ext.
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pl-4">
                    {externaPercent}%
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400 shrink-0">
                  {externa}
                </span>
              </button>

              {/* 3. Pendentes de Bipagem */}
              <button
                type="button"
                onClick={() => onSelectFilter('pendentes')}
                className={`p-2 rounded-xl border text-left transition active:scale-95 flex items-center justify-between gap-1.5 col-span-2 sm:col-span-1 ${
                  activeFilter === 'pendentes'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/40'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
                }`}
                title="Filtrar por bombas ainda pendentes de bipagem"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-slate-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                      Pendentes
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pl-4">
                    {pendingPercent}%
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400 shrink-0">
                  {pending}
                </span>
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* ============================================================
          CARDS GRID (5 Cards com Filtros Rápidos de Status)
      ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 w-full">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() => onSelectFilter(card.id)}
              className={`p-3 sm:p-4 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between relative group min-w-0 overflow-hidden ${
                isSelected
                  ? `${card.activeRing} bg-white dark:bg-slate-800/90 shadow-lg`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 truncate pr-1">
                  {card.label}
                </span>
                <div className={`p-1.5 sm:p-2 rounded-xl ${card.bgColor} ${card.textColor} shrink-0`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div>
                <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  {card.value}
                </div>
                <div className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {card.subtext}
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

