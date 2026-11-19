import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  Trophy, 
  FileCheck2,
  CalendarDays,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ClosePlanModal({
  isOpen,
  onClose,
  plan = null,
  onConfirmClose,
  action = 'close' // 'close' | 'reopen'
}) {
  const [securityCode, setSecurityCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Gera código aleatório numérico de 4 dígitos (estilo GitHub / Cloudflare)
  const generateNewCode = () => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setSecurityCode(code);
    setInputCode('');
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      generateNewCode();
      setNotes('');
      setCopied(false);
      // Auto-foco suave no campo
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    }
  }, [isOpen, plan?.id]);

  if (!isOpen || !plan) return null;

  const isReopen = action === 'reopen';
  const percent = plan.percent || 0;
  const isComplete = percent === 100;
  const isCodeMatch = inputCode.trim() === securityCode;

  const handleCopyCode = () => {
    if (securityCode) {
      navigator.clipboard.writeText(securityCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isCodeMatch) {
      setError('O código digitado não corresponde ao código de segurança exibido.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (onConfirmClose) {
        await onConfirmClose(plan.id, notes.trim());
      }

      // Efeito de confetes caso tenha concluído 100%
      if (!isReopen && isComplete) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa Superior de Destaque */}
        <div className={`absolute top-0 left-0 right-0 h-2.5 ${
          isReopen
            ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'
            : isComplete
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
        }`} />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex items-start gap-3.5 sm:gap-4 mb-4">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
            isReopen
              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
              : isComplete
              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
          }`}>
            {isReopen ? (
              <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
            ) : isComplete ? (
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
            ) : (
              <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            )}
          </div>

          <div className="pr-6 min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
              {isReopen ? 'Reabrir Planejamento' : 'Encerrar Planejamento'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate" title={plan.title}>
              Plano: <strong className="text-slate-800 dark:text-slate-200">{plan.title}</strong>
            </p>
          </div>
        </div>

        {/* Resumo de Progresso do Plano */}
        <div className="bg-slate-50 dark:bg-slate-850 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 dark:text-slate-400">Status de Conferência:</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              isComplete
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {percent}% concluído ({plan.checked || 0} de {plan.total || 0} checados)
            </span>
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isReopen ? (
              <span>Ao reabrir este planejamento, ele voltará para o status <strong>Em Andamento</strong> e permitirá novas marcações e conferências de equipamentos.</span>
            ) : isComplete ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                🎉 <strong>Todos os {plan.total} aparelhos foram conferidos!</strong> Ao encerrar, você finaliza oficialmente o ciclo deste planejamento.
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ Este planejamento ainda possui <strong>{plan.pending || 0} equipamentos pendentes</strong>. Ao encerrar, você confirma a conclusão do ciclo com pendências registradas.
              </span>
            )}
          </p>
        </div>

        {/* Caixa de Segurança: Código Aleatório de 4 Dígitos */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-inner relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Código de Segurança Obrigatório</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1"
                  title="Copiar código"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={generateNewCode}
                  className="text-[11px] font-mono text-slate-400 hover:text-amber-300 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1"
                  title="Gerar outro código aleatório"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Novo Código</span>
                </button>
              </div>
            </div>

            {/* Display do Código Aleatório */}
            <div className="py-2.5 px-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-center my-2">
              <span className="font-mono text-3xl sm:text-4xl font-black text-amber-400 tracking-[0.35em] pl-[0.35em] drop-shadow-md select-all">
                {securityCode}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 text-center leading-snug">
              Para confirmar {isReopen ? 'a reabertura' : 'o encerramento'} com segurança, <strong>digite os 4 números acima</strong> no campo abaixo:
            </p>
          </div>

          {/* Campo de Digitação dos 4 Dígitos */}
          <div>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={inputCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setInputCode(val);
                  if (error) setError('');
                }}
                placeholder="____"
                className={`w-full py-3.5 px-4 text-center font-mono text-2xl sm:text-3xl font-black tracking-[0.35em] pl-[0.35em] rounded-2xl border transition-all focus:outline-none ${
                  isCodeMatch
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : inputCode.length === 4
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-700 dark:text-red-300 ring-2 ring-red-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />

              {isCodeMatch && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Feedback Visual de Validação */}
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              {isCodeMatch ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Código de segurança validado!</span>
                </span>
              ) : inputCode.length > 0 && inputCode.length === 4 ? (
                <span className="text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Código não coincide com os 4 números acima</span>
                </span>
              ) : (
                <span className="text-slate-400">
                  {inputCode.length}/4 dígitos digitados
                </span>
              )}

              <span className="text-slate-400">
                Máximo 4 números
              </span>
            </div>
          </div>

          {/* Campo de Observações Opcionais */}
          {!isReopen && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Observação de Encerramento (Opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Todos os equipamentos validados sem não-conformidades..."
                rows={2}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 font-medium bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800/60">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isCodeMatch || isLoading}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                isReopen
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                  : isComplete
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 shadow-amber-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : isReopen ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Confirmar e Reabrir Plano</span>
                </>
              ) : isComplete ? (
                <>
                  <Trophy className="w-4 h-4" />
                  <span>Confirmar e Encerrar Planejamento</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirmar e Encerrar com Pendências</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
