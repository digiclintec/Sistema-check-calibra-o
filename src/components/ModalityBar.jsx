import React from 'react';
import { MODALITIES } from '../utils/modalities';
import { Target, Wrench, Zap, LayoutGrid, CheckCircle2, Info, Settings, Package } from 'lucide-react';

export default function ModalityBar({
  activeModality = 'calibracao',
  onChangeModality,
  equipments = [],
  serviceConfig = null,
  onOpenServiceConfig = null
}) {
  const total = equipments.length;

  const calOk = equipments.filter(e => e.check_calibracao !== undefined ? e.check_calibracao : e.checado).length;
  const prevOk = equipments.filter(e => e.check_preventiva).length;
  const segOk = equipments.filter(e => e.check_seguranca).length;
  const externaOk = equipments.filter(e => Boolean(e.check_externa)).length;
  const allThreeOk = equipments.filter(e => 
    (e.check_calibracao !== undefined ? e.check_calibracao : e.checado) && 
    e.check_preventiva && 
    e.check_seguranca
  ).length;

  const allModalitiesList = [
    {
      id: 'calibracao',
      label: 'Calibração',
      icon: Target,
      count: calOk,
      color: 'blue',
      activeBg: 'bg-blue-600 text-white shadow-blue-500/25',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
    },
    {
      id: 'preventiva',
      label: 'Preventiva',
      icon: Wrench,
      count: prevOk,
      color: 'emerald',
      activeBg: 'bg-emerald-600 text-white shadow-emerald-500/25',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    },
    {
      id: 'seguranca',
      label: 'Segurança Elétrica (TSE)',
      shortLabel: 'TSE Elétrica',
      icon: Zap,
      count: segOk,
      color: 'amber',
      activeBg: 'bg-amber-600 text-white shadow-amber-500/25',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    },
    {
      id: 'externa',
      label: 'Manutenção Externa',
      shortLabel: 'Manut. Externa',
      icon: Package,
      count: externaOk,
      color: 'purple',
      activeBg: 'bg-purple-600 text-white shadow-purple-500/25',
      badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
    },
    {
      id: 'geral',
      label: 'Visão Integrada',
      icon: LayoutGrid,
      count: allThreeOk,
      color: 'indigo',
      activeBg: 'bg-indigo-600 text-white shadow-indigo-500/25',
      badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
    }
  ];

  const modalitiesList = allModalitiesList.filter(m => {
    if (m.id === 'calibracao') return serviceConfig?.enableCalibracao ?? true;
    if (m.id === 'preventiva') return serviceConfig?.enablePreventiva ?? true;
    if (m.id === 'seguranca') return serviceConfig?.enableSeguranca ?? true;
    if (m.id === 'geral') {
      const activeCount = [
        serviceConfig?.enableCalibracao ?? true,
        serviceConfig?.enablePreventiva ?? true,
        serviceConfig?.enableSeguranca ?? true
      ].filter(Boolean).length;
      return activeCount > 1;
    }
    return true;
  });

  const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 shadow-sm space-y-2.5 overflow-hidden">
      
      {/* Top Header Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Frente de Trabalho / Equipe:
          </span>
          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ${currentMod.badgeClass}`}>
            <span>{currentMod.icon}</span>
            <span>{currentMod.name}</span>
          </span>
          
          {serviceConfig && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${
              serviceConfig.executionMode === 'all_at_once'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
            }`}>
              <span>{serviceConfig.executionMode === 'all_at_once' ? '🔒 Calibração Completa Fixada' : '🎯 Modo: Separado'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate hidden md:flex">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              {serviceConfig?.executionMode === 'all_at_once' 
                ? '🔒 Calibração Completa Fixada: 1 bip carimba Calibração + Preventiva + Segurança Elétrica juntas. A única exceção é Manutenção Externa.' 
                : (activeModality === 'preventiva' && 'Validações afetam apenas a Manutenção Preventiva.') ||
                  (activeModality === 'calibracao' && 'Validações afetam apenas a Calibração Metrológica.') ||
                  (activeModality === 'seguranca' && 'Validações afetam apenas o Teste de Segurança Elétrica (TSE).') ||
                  (activeModality === 'externa' && 'Equipamentos enviados para calibração e conserto por equipe terceirizada.') ||
                  (activeModality === 'geral' && 'Visão completa das equipes ativas em tempo real.')
              }
            </span>
          </div>

          {onOpenServiceConfig && (
            <button
              onClick={onOpenServiceConfig}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shrink-0 active:scale-95"
              title="Configurar quais serviços checar (Calibração, Preventiva, TSE) e modo de bipagem"
            >
              <Settings className="w-3.5 h-3.5 text-blue-500" />
              <span>Opções de Checagem</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Modality Selector Tabs */}
      <div className={`grid gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl sm:rounded-2xl ${
        modalitiesList.length === 1 ? 'grid-cols-1' :
        modalitiesList.length === 2 ? 'grid-cols-2' :
        modalitiesList.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
        modalitiesList.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      }`}>
        {modalitiesList.map((m) => {
          const Icon = m.icon;
          const isActive = activeModality === m.id;
          const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;

          return (
            <button
              key={m.id}
              onClick={() => onChangeModality(m.id)}
              className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-150 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-left active:scale-[0.98] ${
                isActive
                  ? `${m.activeBg} shadow-md font-bold`
                  : 'bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate w-full sm:w-auto">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-xs truncate">
                  {m.shortLabel || m.label}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : m.badgeClass
                }`}>
                  {m.count}/{total}
                </span>
                <span className={`text-[10px] font-mono hidden md:inline ${
                  isActive ? 'text-white/80' : 'text-slate-400'
                }`}>
                  ({pct}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

