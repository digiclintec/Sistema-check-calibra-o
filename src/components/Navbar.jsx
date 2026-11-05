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
  ChevronDown,
  Sparkles,
  Calendar,
  FileCheck,
  ShieldCheck,
  PlusCircle,
  MoreVertical,
  Check
} from 'lucide-react';

export default function Navbar({ 
  onOpenFilePicker, 
  onOpenGoogleModal, 
  onOpenScanner, 
  onExportExcel, 
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
  onChangeModality
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';
  const activeHospital = hospitals.find(h => h.id === activeHospitalId) || hospitals[0];

  // Fecha menu de opções extras ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 w-full transition-colors select-none shadow-xs">
      
      {/* ============================================================
          LINHA PRINCIPAL DO HEADER (Row 1): Logo, Hospital & Ações
      ============================================================ */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* ------------------------------------------------------------
              ZONA 1 (ESQUERDA): Logo + Seletor de Hospital Protegido
          ------------------------------------------------------------ */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            
            {/* Brand Logo & Nome */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <h1 className="text-xs sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                    Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                  </h1>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hidden xl:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Online
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide hidden sm:block">
                  Digiclintec
                </p>
              </div>
            </div>

            {/* Separador vertical sutil */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block shrink-0"></div>

            {/* Hospital Selector Pill (Com overflow protegido e largura calibrada) */}
            <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 pl-2 pr-1 py-1 rounded-xl border border-slate-200/90 dark:border-slate-700/80 transition shadow-xs max-w-[130px] xs:max-w-[170px] sm:max-w-[210px] md:max-w-[240px] shrink min-w-0 overflow-hidden">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              
              <div className="flex-1 min-w-0 mx-1 overflow-hidden">
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
                  className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate w-full block"
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

              {/* Botão rápido + Hospital (visível a partir de sm) */}
              <button
                onClick={() => onOpenHospitalModal && onOpenHospitalModal('create')}
                className="hidden sm:flex p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 transition shrink-0"
                title="Cadastrar Novo Hospital ou Clínica"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------
              ZONA 2 (CENTRO): Abas de Navegação (Visível em Telas sm+ >= 640px)
          ------------------------------------------------------------ */}
          {onChangeMainTab && (
            <nav className="hidden sm:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/70 p-1 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner shrink-0">
              <button
                onClick={() => onChangeMainTab('conferencia')}
                className={`px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'conferencia'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Conferência de Equipamentos e Bipagem"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Conferência</span>
                <span className="md:hidden">Conf.</span>
              </button>

              <button
                onClick={() => onChangeMainTab('auditoria')}
                className={`px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'auditoria'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Espelho Seguro da planilha e Espelho de Ponto da Equipe"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Espelho Seguro</span>
                <span className="md:hidden">Espelho</span>
              </button>

              <button
                onClick={() => onChangeMainTab('planejamento')}
                className={`px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'planejamento'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Planejamento de Cronogramas e Metas Mensais"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Planejamento</span>
                <span className="md:hidden">Planos</span>
                {monthlyPlans.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeMainTab === 'planejamento' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {monthlyPlans.length}
                  </span>
                )}
              </button>
            </nav>
          )}

          {/* ------------------------------------------------------------
              ZONA 3 (DIREITA): Ações, Menu Unificado e Perfil
          ------------------------------------------------------------ */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Equipe & Trabalhos (visível em tablet/desktop md+) */}
            <button
              onClick={onOpenTeamModal}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 transition shadow-xs shrink-0"
              title="Gerenciar equipe e auditar trabalhos realizados"
            >
              <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden xl:inline">Equipe</span>
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

            {/* Botão Ler Código (visível em tablet/desktop md+) */}
            <button
              onClick={onOpenScanner}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Abrir leitor de código de barras ou QR Code"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Ler Código</span>
            </button>

            {/* Menu "Mais Opções" (Dropdown Unificado) */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Mais opções, módulos e ferramentas"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* Seção 1: Navegação de Telas */}
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Navegação do Sistema
                  </div>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onChangeMainTab) onChangeMainTab('conferencia');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                      activeMainTab === 'conferencia'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-blue-500" />
                      <span>Conferência de Bombas</span>
                    </div>
                    {activeMainTab === 'conferencia' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onChangeMainTab) onChangeMainTab('auditoria');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                      activeMainTab === 'auditoria'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Espelho Seguro da Planilha</span>
                    </div>
                    {activeMainTab === 'auditoria' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onChangeMainTab) onChangeMainTab('planejamento');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                      activeMainTab === 'planejamento'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span>Planejamento & Metas</span>
                    </div>
                    {activeMainTab === 'planejamento' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5"></div>

                  {/* Seção 2: Equipe & Administração */}
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Equipe & Administração
                  </div>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onOpenTeamModal) onOpenTeamModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition"
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Equipe & Trabalhos Realizados</span>
                  </button>

                  {isMaster && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onOpenMasterPanel) onOpenMasterPanel();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-500 transition"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Painel Master Digiclintec</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onOpenHospitalModal) onOpenHospitalModal('create');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition"
                  >
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>Cadastrar Novo Hospital</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onOpenHospitalModal) onOpenHospitalModal('list');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Gerenciar Unidades</span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5"></div>

                  {/* Seção 3: Ferramentas */}
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Ferramentas
                  </div>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onOpenInstall) onOpenInstall();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    <span>Baixar Aplicativo / APK</span>
                  </button>

                  {hasData && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onExportExcel) onExportExcel();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition"
                    >
                      <Download className="w-4 h-4 text-blue-500" />
                      <span>Exportar Planilha Excel</span>
                    </button>
                  )}

                  {/* Toggle de Som no menu */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Sons de Bipagem</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      soundEnabled 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {soundEnabled ? 'Ativado' : 'Mudo'}
                    </span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5"></div>

                  {/* Seção 4: Conta & Desconexão */}
                  {currentUser && (
                    <div className="px-2.5 py-1.5 mb-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {isMaster && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span className="truncate">{currentUser.name || 'Digiclintec'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Desconectar Conta</span>
                  </button>
                </div>
              )}
            </div>

            {/* Perfil do Usuário e Logout (visível em tablet/desktop sm+) */}
            {currentUser && (
              <div className="hidden sm:flex items-center gap-1.5 pl-1.5 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <div 
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0"
                  title={`${currentUser.name || 'Usuário'} (${currentUser.email || ''})`}
                >
                  {isMaster ? (
                    <Crown className="w-4 h-4 text-amber-500" />
                  ) : (
                    <span>{(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
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
          LINHA SECUNDÁRIA DO HEADER (Row 2): Abas Nativas no Mobile (< sm)
          Garante navegação com 100% de largura, sem cortes ou sobreposições
      ============================================================ */}
      {onChangeMainTab && (
        <div className="sm:hidden w-full bg-slate-50/95 dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5">
          <nav className="grid grid-cols-3 gap-1 bg-white/80 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
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
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Planos</span>
              {monthlyPlans.length > 0 && (
                <span className={`text-[9px] px-1 py-0.2 rounded-full font-black shrink-0 ${
                  activeMainTab === 'planejamento' ? 'bg-white/30 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {monthlyPlans.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      )}

    </header>
  );
}
