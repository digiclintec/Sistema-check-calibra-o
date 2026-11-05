import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  RotateCcw, 
  Lock, 
  ShieldCheck, 
  AlertTriangle, 
  User, 
  Calendar, 
  Filter, 
  Sparkles, 
  Users, 
  Check, 
  X,
  Layers,
  Wrench,
  Zap,
  Target
} from 'lucide-react';

export default function SmartBatchModal({
  isOpen,
  onClose,
  initialAction = 'check_all',
  activeModality = 'calibracao',
  equipments = [],
  hospitalName = '',
  planTitle = '',
  currentUser,
  onConfirm
}) {
  const [action, setAction] = useState(initialAction); // 'check_all' | 'uncheck_all'
  const [selectedModalities, setSelectedModalities] = useState({
    calibracao: true,
    preventiva: false,
    seguranca: false
  });
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [onlyPending, setOnlyPending] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [customTechnician, setCustomTechnician] = useState('');
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';

  // Sincroniza ao abrir
  useEffect(() => {
    if (isOpen) {
      setAction(initialAction);
      setPassword('');
      setErrorMsg('');
      setIsLoading(false);
      setSectorFilter('ALL');
      setOnlyPending(initialAction === 'check_all');
      setWorkDate(new Date().toISOString().split('T')[0]);

      // Pré-seleciona a modalidade ativa na interface
      if (activeModality === 'geral') {
        setSelectedModalities({ calibracao: true, preventiva: true, seguranca: true });
      } else {
        setSelectedModalities({
          calibracao: activeModality === 'calibracao',
          preventiva: activeModality === 'preventiva',
          seguranca: activeModality === 'seguranca'
        });
      }

      // Define técnico padrão
      const defaultName = currentUser?.name ? `${currentUser.name}` : (currentUser?.email || 'Técnico Digiclintec');
      setSelectedTechnician(defaultName);
      setCustomTechnician('');

      // Busca lista de usuários cadastrados
      fetchUsers();
    }
  }, [isOpen, initialAction, activeModality, currentUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setTeamUsers(data.users);
      }
    } catch (e) {
      console.warn('Não foi possível carregar lista de usuários:', e);
    }
  };

  if (!isOpen) return null;

  // Lista única de setores para o filtro
  const sectors = Array.from(new Set(
    equipments.map(e => String(e.setor || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Contagem de equipamentos que serão afetados pela seleção
  const modalitiesArray = Object.keys(selectedModalities).filter(k => selectedModalities[k]);

  const targetEquipments = equipments.filter(item => {
    if (sectorFilter !== 'ALL') {
      const itemSec = String(item.setor || '').trim().toLowerCase();
      const itemRet = String(item.setor_retirada || '').trim().toLowerCase();
      const selSec = String(sectorFilter).trim().toLowerCase();
      if (itemSec !== selSec && itemRet !== selSec) return false;
    }
    if (action === 'check_all' && onlyPending) {
      // Pelo menos uma das modalidades selecionadas deve estar pendente neste item
      const hasPendingMod = modalitiesArray.some(m => {
        if (m === 'calibracao') return !item.check_calibracao;
        if (m === 'preventiva') return !item.check_preventiva;
        if (m === 'seguranca') return !item.check_seguranca;
        return false;
      });
      return hasPendingMod;
    }
    return true;
  });

  const toggleModality = (mod) => {
    setSelectedModalities(prev => {
      const next = { ...prev, [mod]: !prev[mod] };
      // Garante pelo menos uma modalidade selecionada
      if (!Object.values(next).some(Boolean)) {
        return prev;
      }
      return next;
    });
  };

  const selectAllModalities = () => {
    setSelectedModalities({ calibracao: true, preventiva: true, seguranca: true });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (modalitiesArray.length === 0) {
      setErrorMsg('Selecione pelo menos uma modalidade técnica.');
      return;
    }
    if (!password) {
      setErrorMsg('Digite a senha de segurança (padrão: 1234).');
      return;
    }

    const finalTechnician = selectedTechnician === '__custom__' 
      ? (customTechnician.trim() || 'Técnico Especialista')
      : selectedTechnician;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const result = await onConfirm({
        action,
        modalities: modalitiesArray,
        assignedTechnician: finalTechnician,
        assignedDate: workDate,
        sectorFilter,
        onlyPending,
        password: password.trim()
      });

      if (result && !result.success) {
        setErrorMsg(result.message || 'Senha incorreta.');
        setIsLoading(false);
      } else {
        setIsLoading(false);
        onClose();
      }
    } catch (err) {
      setErrorMsg('Erro de comunicação ao processar ação em lote.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com Gradiente */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                {action === 'check_all' ? (
                  <CheckSquare className="w-5 h-5 text-emerald-300" />
                ) : (
                  <RotateCcw className="w-5 h-5 text-amber-300" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Ação Inteligente em Lote
                </h3>
                <p className="text-xs text-white/80">
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

          {/* Badge Master */}
          {isMaster && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full w-fit border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Controle Master: Você pode atribuir o trabalho a qualquer técnico da equipe</span>
            </div>
          )}
        </div>

        {/* Form Body com Rolagem Suave */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          
          {/* Seletor de Ação: Marcar vs Desmarcar */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
              Tipo de Ação:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setAction('check_all'); setOnlyPending(true); }}
                className={`py-2 px-3 rounded-2xl font-bold flex items-center justify-center gap-2 border transition ${
                  action === 'check_all'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Marcar Concluído</span>
              </button>

              <button
                type="button"
                onClick={() => { setAction('uncheck_all'); setOnlyPending(false); }}
                className={`py-2 px-3 rounded-2xl font-bold flex items-center justify-center gap-2 border transition ${
                  action === 'uncheck_all'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <RotateCcw className="w-4 h-4 text-rose-500" />
                <span>Desmarcar / Reabrir</span>
              </button>
            </div>
          </div>

          {/* Modalidades Técnicas de Trabalho */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Modalidades Técnicas:</span>
              </label>
              <button
                type="button"
                onClick={selectAllModalities}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Selecionar Todas
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => toggleModality('calibracao')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  selectedModalities.calibracao
                    ? 'bg-blue-600/15 border-blue-500 text-blue-700 dark:text-blue-300 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                  selectedModalities.calibracao ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {selectedModalities.calibracao && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="truncate">
                  <div className="text-xs truncate">Calibração</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleModality('preventiva')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  selectedModalities.preventiva
                    ? 'bg-amber-600/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                  selectedModalities.preventiva ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {selectedModalities.preventiva && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="truncate">
                  <div className="text-xs truncate">Preventiva</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleModality('seguranca')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  selectedModalities.seguranca
                    ? 'bg-purple-600/15 border-purple-500 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                  selectedModalities.seguranca ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {selectedModalities.seguranca && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="truncate">
                  <div className="text-xs truncate">Seg. Elétrica</div>
                </div>
              </button>
            </div>
          </div>

          {/* Técnico Executor / Responsável */}
          {action === 'check_all' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-500" />
                <span>Técnico Responsável pelo Trabalho:</span>
              </label>

              <div className="grid grid-cols-1 gap-2">
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {currentUser?.name && (
                    <option value={currentUser.name}>
                      👤 Eu mesmo ({currentUser.name})
                    </option>
                  )}
                  {currentUser?.email && !currentUser.name && (
                    <option value={currentUser.email}>
                      👤 Eu mesmo ({currentUser.email})
                    </option>
                  )}

                  {teamUsers.filter(u => u.name && u.name !== currentUser?.name).map(u => (
                    <option key={u.id || u.email} value={u.name}>
                      👥 {u.name} ({u.role === 'master' ? 'Master' : 'Técnico'})
                    </option>
                  ))}

                  <option value="Equipe Digiclintec">🏢 Equipe Geral Digiclintec</option>
                  <option value="__custom__">✏️ Outro técnico (digitar nome)...</option>
                </select>

                {selectedTechnician === '__custom__' && (
                  <input
                    type="text"
                    value={customTechnician}
                    onChange={(e) => setCustomTechnician(e.target.value)}
                    placeholder="Nome completo do técnico responsável..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-blue-400 dark:border-blue-500 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          {/* Filtro por Setor & Data de Execução em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Setor */}
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Filtrar por Setor:
              </label>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
              >
                <option value="ALL">🏢 Todos os Setores ({equipments.length})</option>
                {sectors.map(sec => {
                  const count = equipments.filter(e => e.setor === sec).length;
                  return (
                    <option key={sec} value={sec}>
                      📍 {sec} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Data */}
            {action === 'check_all' && (
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Data de Execução:
                </label>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Checkbox Inteligente de Preservação */}
          {action === 'check_all' && (
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <div className="text-[11px] sm:text-xs">
                <span className="font-bold text-blue-900 dark:text-blue-300 block">
                  Apenas pendentes (Preservar quem já fez)
                </span>
                <span className="text-blue-700/80 dark:text-blue-400/80">
                  Não sobrescreve os equipamentos já checados anteriormente por outros colegas.
                </span>
              </div>
            </label>
          )}

          {/* Resumo Dinâmico do Impacto */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
            <span>
              {action === 'check_all' ? 'Equipamentos a checar:' : 'Equipamentos a desmarcar:'}
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
              {targetEquipments.length} de {equipments.length}
            </span>
          </div>

          {/* Senha Simples de Proteção */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Senha de Confirmação:</span>
              </label>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                Padrão: 1234
              </span>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite 1234 para confirmar..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-center tracking-widest text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition text-xs sm:text-sm"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading || targetEquipments.length === 0}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-white transition text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md ${
                action === 'check_all'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {action === 'check_all' ? `Marcar (${targetEquipments.length})` : `Desmarcar (${targetEquipments.length})`}
                  </span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
