import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Download, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  LogOut, 
  Crown, 
  Users,
  Smartphone,
  Building2,
  Sparkles,
  Calendar,
  FileCheck,
  ShieldCheck,
  PlusCircle,
  MoreVertical,
  ChevronDown,
  GitMerge,
  RotateCcw,
  User
} from 'lucide-react';

export default function Navbar({ 
  onOpenFilePicker, 
  onOpenGoogleModal, 
  onOpenScanner, 
  onExportExcel, 
  onOpenMergeModal,
  hasData,
  soundEnabled,
  setSoundEnabled,
  currentUser,
  onLogout,
  onOpenMasterPanel,
  onOpenInstall,
  hospitals = [],
  activeHospitalId,
  onSwitchHospital,
  onOpenTeamModal,
  onOpenHospitalModal,
  activeMainTab = 'conferencia',
  onChangeMainTab,
  monthlyPlans = [],
  activePlanId,
  onSwitchPlan,
  activeModality = 'calibracao',
  onChangeModality,
  undoCheckpoint = null,
  onUndo = null
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';
  const activeHospital = hospitals.find(h => h.id === activeHospitalId) || hospitals[0];

  // Fecha menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showMoreMenu]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full select-none shadow-xs">
      
      {/* ============================================================
          LINHA PRINCIPAL (Row 1): Logo, Hospital & Ações Primárias
      ============================================================ */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* LADO ESQUERDO: Logo & Seletor de Hospital */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            
            {/* Logo da Marca */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                    Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                  </h1>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hidden xl:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide hidden xs:block">
                  Digiclintec
                </p>
              </div>
            </div>

            {/* Separador vertical sutil */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block shrink-0" />

            {/* Seletor de Hospital Elegante com largura protegida */}
            <div className="flex items-center gap-1 min-w-0 shrink">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 transition shadow-xs w-32 xs:w-36 sm:w-48 md:w-56 max-w-[220px] shrink min-w-0">
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  value={activeHospitalId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__NEW_HOSPITAL__') {
                      if (onOpenHospitalModal) onOpenHospitalModal('create');
                    } else if (val === '__MANAGE_HOSPITALS__') {
                      if (onOpenHospitalModal) onOpenHospitalModal('list');
                    } else if (onSwitchHospital) {
                      onSwitchHospital(val);
                    }
                  }}
                  className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate w-full"
                  title={`Hospital ativo: ${activeHospital?.name || 'Selecione'}`}
                >
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      🏥 {h.name}
                    </option>
                  ))}
                  <option disabled className="bg-slate-200 dark:bg-slate-800 text-slate-500">──────────</option>
                  <option value="__NEW_HOSPITAL__" className="bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold">
                    ➕ Cadastrar Novo Hospital...
                  </option>
                  <option value="__MANAGE_HOSPITALS__" className="bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold">
                    ⚙️ Gerenciar / Trocar Unidades...
                  </option>
                </select>
              </div>

              {/* Botão Rápido + Hospital (Tablet / Desktop md+) */}
              <button
                onClick={() => onOpenHospitalModal && onOpenHospitalModal('create')}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition shrink-0 shadow-xs"
                title="Cadastrar Novo Hospital ou Clínica"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden lg:inline">+ Hospital</span>
              </button>
            </div>
          </div>

          {/* CENTRO: Abas de Navegação (Visível EXCLUSIVAMENTE em Desktop lg+ >= 1024px para evitar qualquer sobreposição) */}
          {onChangeMainTab && (
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-inner shrink-0 mx-2">
              <button
                onClick={() => onChangeMainTab('conferencia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'conferencia'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Conferência de Equipamentos e Bipagem"
              >
                <FileCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Conferência</span>
              </button>

              <button
                onClick={() => onChangeMainTab('auditoria')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'auditoria'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Espelho Seguro da planilha e Espelho de Ponto da Equipe"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Espelho Seguro</span>
              </button>

              <button
                onClick={() => onChangeMainTab('planejamento')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'planejamento'
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Planejamento de Cronogramas e Metas Mensais"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Planejamento</span>
                {monthlyPlans.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeMainTab === 'planejamento' 
                      ? 'bg-white/25 text-white' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {monthlyPlans.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => onChangeMainTab('perfil')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'perfil'
                    ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Perfil do Técnico: Frente de Trabalho e Opções de Checagem"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Perfil do Técnico</span>
              </button>
            </nav>
          )}

          {/* LADO DIREITO: Ações, Menu e Perfil */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            
            {/* Equipe (Desktop md+) */}
            <button
              onClick={onOpenTeamModal}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition shadow-xs shrink-0"
              title="Gerenciar usuários da equipe e auditar trabalhos"
            >
              <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden lg:inline">Equipe</span>
            </button>

            {/* Alternador de Sons Rápido */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
              title={soundEnabled ? "Desativar sons de bipagem" : "Ativar sons de bipagem"}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              )}
            </button>

            {/* Painel Master (visível em telas 2xl+) */}
            {isMaster && (
              <button
                onClick={onOpenMasterPanel}
                className="hidden 2xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 transition shadow-xs shrink-0"
                title="Painel Master de Administração"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Master</span>
              </button>
            )}

            {/* Baixar APK (visível em telas 2xl+) */}
            <button
              onClick={onOpenInstall}
              className="hidden 2xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition shadow-xs shrink-0"
              title="Baixar instalador APK para Android"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Baixar APK</span>
            </button>

            {/* Exportar Excel (visível em telas xl+) */}
            {hasData && (
              <button
                onClick={onExportExcel}
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition shrink-0"
                title="Exportar planilha Excel"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Exportar</span>
              </button>
            )}

            {/* Botão de Bipar na Câmera (Desktop/Tablet sm+) */}
            <button
              onClick={onOpenScanner}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Abrir câmera para ler código de barras"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Ler Código</span>
              <span className="md:hidden">Bipar</span>
            </button>

            {/* Botão Rápido Desfazer Alteração Recente / em Massa */}
            {undoCheckpoint && onUndo && (
              <button
                onClick={onUndo}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-md shadow-amber-500/25 transition active:scale-95 shrink-0 border border-amber-400"
                title={`Desfazer última alteração: ${undoCheckpoint.actionDesc}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desfazer</span>
              </button>
            )}

            {/* Menu "Mais Opções" (Dropdown unificado para ferramentas secundárias) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
                title="Mais ferramentas e opções"
                aria-label="Mais opções"
              >
                <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100">
                  
                  {/* Cabeçalho do Menu com Usuário */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onChangeMainTab) onChangeMainTab('perfil');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition block"
                      title="Abrir Perfil do Técnico"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {currentUser.name || 'Operador'}
                        </span>
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          Perfil →
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {currentUser.email || ''}
                      </p>
                    </button>
                  )}

                  {/* Ações e Ferramentas */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onOpenTeamModal) onOpenTeamModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
                    >
                      <Users className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Gerenciar Equipe</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onOpenHospitalModal) onOpenHospitalModal('list');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
                    >
                      <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Gerenciar Hospitais</span>
                    </button>

                    {isMaster && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          if (onOpenMasterPanel) onOpenMasterPanel();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-amber-600 dark:text-amber-400"
                      >
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Painel Master</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onOpenInstall) onOpenInstall();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-emerald-600 dark:text-emerald-400"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Baixar APK Android</span>
                    </button>

                    {hasData && (
                      <>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (onOpenMergeModal) onOpenMergeModal();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-indigo-600 dark:text-indigo-400"
                        >
                          <GitMerge className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>Mesclar Calibrações (XLS/PDF)</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (onExportExcel) onExportExcel();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
                        >
                          <Download className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>Exportar Planilha</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Sair da Conta */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    >
                      <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Perfil do Usuário e Sair (visível em tablet/desktop sm+) */}
            {currentUser && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => onChangeMainTab && onChangeMainTab('perfil')}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center font-bold text-xs transition active:scale-95 shrink-0 ${
                    activeMainTab === 'perfil'
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30 ring-2 ring-purple-500/40'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                  title={`Abrir Perfil do Técnico: ${currentUser.name || 'Usuário'} (${currentUser.email || ''})`}
                >
                  {isMaster ? (
                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                  ) : (
                    <span>{(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </button>

                <button
                  onClick={onLogout}
                  className="hidden sm:flex p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
                  title="Sair da conta"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* ============================================================
          LINHA SECUNDÁRIA (Row 2): Abas Nativas no Mobile & Tablet (< lg)
          Garante navegação com 100% de largura, sem cortes ou sobreposições
      ============================================================ */}
      {onChangeMainTab && (
        <div className="lg:hidden w-full bg-slate-50/95 dark:bg-[#090f1d]/95 border-t border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-1.5">
          <nav className="max-w-xl mx-auto grid grid-cols-4 gap-1 bg-white/90 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
            <button
              onClick={() => onChangeMainTab('conferencia')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 truncate ${
                activeMainTab === 'conferencia'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Conferência</span>
            </button>

            <button
              onClick={() => onChangeMainTab('auditoria')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 truncate ${
                activeMainTab === 'auditoria'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Espelho Seguro da Planilha"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Espelho</span>
            </button>

            <button
              onClick={() => onChangeMainTab('planejamento')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 relative truncate ${
                activeMainTab === 'planejamento'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Planejamento de Metas"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Metas</span>
              {monthlyPlans.length > 0 && (
                <span className={`text-[9px] px-1 py-0.2 rounded-full font-black shrink-0 ${
                  activeMainTab === 'planejamento' 
                    ? 'bg-white/30 text-white' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {monthlyPlans.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onChangeMainTab('perfil')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 truncate ${
                activeMainTab === 'perfil'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Perfil do Técnico: Frente de Trabalho e Opções"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Perfil</span>
            </button>
          </nav>
        </div>
      )}

    </header>
  );
}
