import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

export default function MassActionPasswordModal({
  isOpen,
  onClose,
  action = 'check_all', // 'check_all' | 'uncheck_all'
  totalEquipments = 0,
  hospitalName = '',
  planTitle = '',
  onConfirm
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const isCheckAll = action === 'check_all';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Por favor, digite a senha de segurança.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await onConfirm(action, password.trim());
      if (res && res.success === false) {
        setError(res.message || 'Senha incorreta.');
      } else {
        setPassword('');
        setError('');
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Falha ao executar ação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setPassword('1234');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-2 ${
          isCheckAll 
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500' 
            : 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500'
        }`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
            isCheckAll 
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' 
              : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60'
          }`}>
            {isCheckAll ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <div className="pr-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {isCheckAll ? 'Marcar Todos como Conferidos' : 'Desmarcar Todos os Equipamentos'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {hospitalName} {planTitle ? `• ${planTitle}` : ''}
            </p>
          </div>
        </div>

        {/* Warning / Explanation Box */}
        <div className={`p-3.5 rounded-2xl mb-5 text-xs border leading-relaxed ${
          isCheckAll
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-200/80 dark:border-emerald-800/50'
            : 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200/80 dark:border-amber-800/50'
        }`}>
          {isCheckAll ? (
            <p>
              Esta ação marcará <strong>todos os {totalEquipments} equipamentos</strong> da planilha ativa como <strong>CONFERIDOS</strong> com data, hora e seu usuário de inspetor.
            </p>
          ) : (
            <p>
              <strong>Atenção:</strong> Esta ação <strong>removerá o check de todos os {totalEquipments} equipamentos</strong>, zerando a conferência do planejamento para reiniciar a validação.
            </p>
          )}
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                <span>Senha de Segurança</span>
              </label>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Preencher padrão (1234)
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Digite a senha (padrão: 1234)"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-11 tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center gap-1 font-medium animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              Proteção contra cliques acidentais. Senha mestre configurada: <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">1234</span>
            </p>
          </div>

          {/* Action Buttons */}
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
              disabled={isLoading || !password.trim()}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50 ${
                isCheckAll
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-500/20'
                  : 'bg-red-600 hover:bg-red-500 active:scale-95 shadow-red-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : isCheckAll ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Marcar Todos</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmar e Desmarcar Tudo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

