import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers, Percent } from 'lucide-react';

export default function StatsCards({ stats, activeFilter, onSelectFilter }) {
  const { total, checked, pending, expired, expiringSoon, percent } = stats;

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
      label: 'Checados / OK',
      value: checked,
      subtext: `${percent}% da meta concluída`,
      icon: CheckCircle2,
      color: 'emerald',
      borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500 shadow-emerald-500/20',
    },
    {
      id: 'pendentes',
      label: 'Pendentes de Bipagem',
      value: pending,
      subtext: 'Aguardando conferência',
      icon: Clock,
      color: 'amber',
      borderColor: 'border-amber-500/20',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
      activeRing: 'ring-2 ring-amber-500 shadow-amber-500/20',
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
    <div className="space-y-3">
      {/* Progress Bar Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Progresso da Conferência
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold font-mono">
              {checked} de {total} itens
            </span>
          </div>
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 font-mono">
            {percent}% CONCLUÍDO
          </span>
        </div>
        
        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              percent === 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-600 to-indigo-500'
            }`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() => onSelectFilter(card.id)}
              className={`p-4 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between relative group ${
                isSelected
                  ? `${card.activeRing} bg-white dark:bg-slate-800/90 shadow-lg`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate pr-1">
                  {card.label}
                </span>
                <div className={`p-2 rounded-xl ${card.bgColor} ${card.textColor} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  {card.value}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
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

