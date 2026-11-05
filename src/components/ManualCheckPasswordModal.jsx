import React, { useState, useEffect, useRef } from 'react';
import { 
  KeyRound, 
  Lock, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Delete, 
  Clock, 
  RotateCcw,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { MODALITIES } from '../utils/modalities';

export default function ManualCheckPasswordModal({
  isOpen,
  onClose,
  equipment,
  modality = 'calibracao',
  nextState = true,
  onConfirm
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [remember15Min, setRemember15Min] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen || !equipment) return null;

  const currentMod = MODALITIES[modality] || MODALITIES.calibracao;

  const handleKeyPress = (num) => {
    if (pin.length < 10) {
      setPin(prev => prev + num);
      if (error) setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    if (error) setError('');
  };

  const handleClear = () => {
    setPin('');
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError('Digite a senha ou PIN de conferência.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await onConfirm({
        pin: pin.trim(),
        equipmentId: equipment.id,
        modality,
        nextState,
        remember15Min
      });

      if (res && res.success === false) {
        setError(res.message || 'Senha incorreta. (Padrão: 1234)');
        setPin('');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Falha na validação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          nextState
            ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-400'
            : 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500'
        }`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header: Action & Modality */}
        <div className="flex items-start gap-3 mb-3.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
            nextState
              ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
              : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
          }`}>
            <KeyRound className="w-5 h-5" />
          </div>

          <div className="pr-5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Conferência Manual
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug truncate">
              {nextState ? 'Confirmar Check Manual' : 'Desmarcar Check Manual'}
            </h3>
          </div>
        </div>

        {/* Equipment Snapshot Card */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-4 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900 dark:text-white truncate">
              {equipment.equipamento || 'Equipamento'}
            </span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
              {equipment.tag || equipment.codigoBarras}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="flex items-center gap-1 truncate">
              <span>Frente:</span>
              <strong className="text-blue-600 dark:text-blue-400">{currentMod.name}</strong>
            </span>
            <span className={`font-semibold ${nextState ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {nextState ? '✓ Marcar OK' : '↩ Desmarcar'}
            </span>
          </div>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Digite a senha de liberação:
              </label>
              <button
                type="button"
                onClick={() => {
                  setPin('1234');
                  if (error) setError('');
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                Padrão (1234)
              </button>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••"
                maxLength={20}
                className="w-full text-center text-xl sm:text-2xl font-mono tracking-widest py-2.5 px-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1 font-semibold animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick Touch Keypad for Mobile Screen */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeyPress(String(n))}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-base transition active:scale-95 shadow-2xs"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs transition active:scale-95"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-base transition active:scale-95 shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm flex items-center justify-center transition active:scale-95"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Remember for 15 minutes checkbox */}
          <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember15Min}
              onChange={(e) => setRemember15Min(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Lembrar autorização por 15 min nesta sessão</span>
            </div>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className={`flex-1 py-2.5 px-3 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50 ${
                nextState
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 active:scale-95'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20 active:scale-95'
              }`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

