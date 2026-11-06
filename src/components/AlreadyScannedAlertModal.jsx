import React, { useEffect } from 'react';
import { AlertTriangle, Package, CheckCircle2, X, MapPin, Tag, Hash, User, Calendar, FileText, Check } from 'lucide-react';

export default function AlreadyScannedAlertModal({
  isOpen,
  onClose,
  alertData, // { type: 'already_checked' | 'maintenance', equipment, meta, message, timestamp }
  onLocateInTable
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !alertData || !alertData.equipment) return null;

  const eq = alertData.equipment;
  const isMaintenance = alertData.type === 'maintenance' || Boolean(eq.check_externa);
  const meta = alertData.meta || {};

  const inspector = meta.user || eq.usuario_calibracao || eq.usuario_externa || eq.conferidoPor || 'Operador Técnico';
  const checkDate = meta.date || eq.data_calibracao || eq.data_externa || eq.dataCheck;
  const formattedDate = checkDate 
    ? new Date(checkDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) 
    : 'Registrado no plano ativo';

  const motivo = eq.motivo_externa || meta.motivo || eq.observacao || (isMaintenance ? 'Calibração e conserto por equipe externa terceirizada' : 'Validação metrológica e conferência no hospital');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all transform animate-in zoom-in-95 duration-200 ${
          isMaintenance
            ? 'bg-slate-900 border-purple-500/50 shadow-purple-950/50 text-slate-100'
            : 'bg-slate-900 border-amber-500/50 shadow-amber-950/50 text-slate-100'
        }`}
      >
        {/* Top Header Banner */}
        <div 
          className={`p-4 sm:p-5 border-b relative ${
            isMaintenance
              ? 'bg-gradient-to-r from-purple-950 via-slate-900 to-purple-900/60 border-purple-500/40 text-purple-100'
              : 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900/60 border-amber-500/40 text-amber-100'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3.5 pr-8">
            <div 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                isMaintenance
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {isMaintenance ? (
                <Package className="w-7 h-7 text-purple-400 animate-pulse" />
              ) : (
                <AlertTriangle className="w-7 h-7 text-amber-400 animate-pulse" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span 
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs ${
                    isMaintenance
                      ? 'bg-purple-500 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {isMaintenance ? '📦 BOMBA EM MANUTENÇÃO EXTERNA' : '⚠️ BOMBA JÁ BIPADA E CONFERIDA'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {alertData.timestamp || new Date().toLocaleTimeString('pt-BR')}
                </span>
              </div>

              <h3 className="text-lg font-black text-white leading-tight">
                {isMaintenance ? 'Equipamento Já Separado para Conserto' : 'Esta Bomba Já Foi Checada'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {isMaintenance
                  ? 'O bip foi bloqueado para não misturar com as bombas liberadas.'
                  : 'O bip foi bloqueado para evitar duplicação ou contagem repetida.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">

          {/* Dados do Aparelho */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Equipamento Identificado:
              </span>
              <h4 className="text-base font-black text-white">
                {eq.equipamento || 'Bomba de Infusão'}
              </h4>
              <p className="text-xs text-slate-400">
                {eq.fabricante} {eq.modelo}
              </p>
            </div>

            {/* Badges de Código, Série e Setor */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              {eq.tag && (
                <span className="font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>IDEC: {eq.tag}</span>
                </span>
              )}

              {eq.serie && (
                <span className="font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>S/N: {eq.serie}</span>
                </span>
              )}

              {(eq.setor_retirada || eq.setor) && (
                <span className="px-2.5 py-1 rounded-xl bg-teal-950/60 text-teal-300 border border-teal-800/80 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>{eq.setor_retirada || eq.setor}</span>
                </span>
              )}
            </div>
          </div>

          {/* Dados da Auditoria: Quem, Quando e Motivo */}
          <div 
            className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
              isMaintenance
                ? 'bg-purple-950/30 border-purple-500/30 text-purple-100'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className={`w-4 h-4 ${isMaintenance ? 'text-purple-400' : 'text-amber-400'}`} />
              <span>Histórico de Conferência Registrado:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-200">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate"><strong>Responsável:</strong> {inspector}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate"><strong>Data/Hora:</strong> {formattedDate}</span>
              </div>
            </div>

            {motivo && (
              <div className="pt-1 border-t border-white/10 flex items-start gap-1.5 text-slate-300">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><strong>Status/Motivo:</strong> {motivo}</span>
              </div>
            )}
          </div>

          {/* Status Atual dos Serviços (Matriz de Modalidades) */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Situação das Modalidades Técnicas:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              <div className={`p-2 rounded-xl border text-center ${
                eq.check_calibracao 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold' 
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                <div className="text-[10px] uppercase font-bold">Calibração</div>
                <div className="text-xs">{eq.check_calibracao ? '✓ Concluída' : '— Pendente'}</div>
              </div>

              <div className={`p-2 rounded-xl border text-center ${
                eq.check_preventiva 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' 
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                <div className="text-[10px] uppercase font-bold">Preventiva</div>
                <div className="text-xs">{eq.check_preventiva ? '✓ Concluída' : '— Pendente'}</div>
              </div>

              <div className={`p-2 rounded-xl border text-center ${
                eq.check_seguranca 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' 
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                <div className="text-[10px] uppercase font-bold">Seg. TSE</div>
                <div className="text-xs">{eq.check_seguranca ? '✓ Concluída' : '— Pendente'}</div>
              </div>

              <div className={`p-2 rounded-xl border text-center ${
                eq.check_externa 
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold' 
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                <div className="text-[10px] uppercase font-bold">Manut. Ext.</div>
                <div className="text-xs">{eq.check_externa ? '📦 Terceirizada' : '— No Hospital'}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onLocateInTable) onLocateInTable(eq.id);
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
          >
            <span>🔍 Destacar na Lista</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition shadow-lg flex items-center gap-1.5 active:scale-95 ${
              isMaintenance
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>✓ Entendido (Manter como já checada)</span>
          </button>
        </div>

      </div>
    </div>
  );
}

