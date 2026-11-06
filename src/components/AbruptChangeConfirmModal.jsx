import React, { useEffect } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Trash2, 
  FileSpreadsheet, 
  GitMerge, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function AbruptChangeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Atenção: Alteração em Massa Detectada!',
  subtitle = 'Você está prestes a realizar uma alteração abrupta que afetará múltiplos registros.',
  affectedCount = 0,
  affectedLabel = 'equipamentos',
  operationType = 'bulk', // 'merge' | 'reset' | 'replace' | 'mass_check' | 'bulk'
  details = [],
  confirmText = 'Sim, Confirmar Alteração',
  cancelText = 'Cancelar e Revisar',
  severity = 'warning', // 'warning' | 'danger'
  planTitle = '',
  hospitalName = ''
}) {
  // Fecha no ESC e confirma no Enter
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = severity === 'danger';

  const getHeaderIcon = () => {
    switch (operationType) {
      case 'reset':
        return <Trash2 className="w-7 h-7 text-rose-500 animate-pulse" />;
      case 'merge':
        return <GitMerge className="w-7 h-7 text-indigo-500 animate-bounce" />;
      case 'replace':
        return <FileSpreadsheet className="w-7 h-7 text-amber-500" />;
      default:
        return <AlertTriangle className="w-7 h-7 text-amber-500" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Topo Colorida */}
        <div className={`h-2.5 w-full ${
          isDanger 
            ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-600' 
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600'
        }`} />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl shrink-0 ${
              isDanger 
                ? 'bg-rose-500/15 border border-rose-500/30' 
                : 'bg-amber-500/15 border border-amber-500/30'
            }`}>
              {getHeaderIcon()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isDanger 
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border-rose-200 dark:border-rose-900' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                }`}>
                  {isDanger ? 'Ação Crítica' : 'Alerta de Lote'}
                </span>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1 transition"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1.5 leading-snug">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Destaque da Quantidade Afetada */}
          {affectedCount > 0 && (
            <div className={`mt-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isDanger
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/50'
                : 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border-amber-500/30 dark:border-amber-500/30'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-5 h-5 shrink-0 ${isDanger ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`} />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Total afetado de uma só vez:
                </span>
              </div>
              <span className={`text-base sm:text-lg font-black font-mono px-3 py-1 rounded-xl shadow-xs ${
                isDanger
                  ? 'bg-rose-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950'
              }`}>
                {affectedCount} {affectedLabel}
              </span>
            </div>
          )}

          {/* Detalhes específicos da ação */}
          {details.length > 0 && (
            <div className="mt-3.5 bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              {details.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-none">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {item.label}:
                  </span>
                  <span className={`font-bold ${item.color || 'text-slate-800 dark:text-slate-200'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Garantia do Botão de Desfazer */}
          <div className="mt-4 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/50 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] sm:text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              <strong className="block font-bold">Ponto de Restauração Automático</strong>
              Caso precise reverter, o sistema criará um snapshot para você <strong>desfazer a ação com 1 clique</strong> logo após aplicar.
            </div>
          </div>
        </div>

        {/* Footer com botões de ação */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition text-xs sm:text-sm"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className={`py-2.5 px-5 rounded-xl font-black text-white text-xs sm:text-sm flex items-center gap-2 shadow-lg transition active:scale-95 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
            }`}
            autoFocus
          >
            <span>{confirmText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
