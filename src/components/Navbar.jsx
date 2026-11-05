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
  MoreVertical
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full transition-colors">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18 gap-2">
          
          {/* ============================================================
              ZONA 1 (ESQUERDA): Logo + Seletor Firme de Hospital
          ============================================================ */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Brand Logo */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                    Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                  </h1>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Online
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide hidden xs:block">
                  Digiclintec
                </p>
              </div>
            </div>

            {/* Separador vertical sutil */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            {/* Hospital Selector Pill (Com largura protegida e sem sobreposição) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 pl-2 pr-1 py-1 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 transition shadow-sm w-36 xs:w-44 sm:w-52 lg:w-56 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              
              <div className="flex-1 min-w-0 mx-1.5">
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

              {/* Botão rápido + Hospital */}
              <button
                onClick={() => onOpenHospitalModal && onOpenHospitalModal('create')}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 transition shrink-0"
                title="Cadastrar Novo Hospital ou Clínica"
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* ============================================================
              ZONA 2 (CENTRO): Abas de Navegação (Conferência / Espelho / Planejamento)
          ============================================================ */}
          {onChangeMainTab && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-inner shrink-0">
              <button
                onClick={() => onChangeMainTab('conferencia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'conferencia'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Conferência de Equipamentos e Bipagem"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Conferência</span>
                <span className="lg:hidden">Conf.</span>
              </button>

              <button
                onClick={() => onChangeMainTab('auditoria')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'auditoria'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Espelho Seguro da planilha e Espelho de Ponto da Equipe"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Espelho Seguro</span>
                <span className="lg:hidden">Espelho</span>
              </button>

              <button
                onClick={() => onChangeMainTab('planejamento')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'planejamento'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                }`}
                title="Planejamento de Cronogramas e Metas Mensais"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Planejamento</span>
                <span className="lg:hidden">Planos</span>
                {monthlyPlans.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeMainTab === 'planejamento' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {monthlyPlans.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ============================================================
              ZONA 3 (DIREITA): Ações Rápidas, Menu e Perfil
          ============================================================ */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Mobile Navigation Toggles (< 768px) */}
            {onChangeMainTab && (
              <div className="flex md:hidden items-center gap-1">
                <button
                  onClick={() => onChangeMainTab(activeMainTab === 'auditoria' ? 'conferencia' : 'auditoria')}
                  className={`p-1.5 rounded-xl border text-[11px] font-bold transition ${
                    activeMainTab === 'auditoria'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Espelho Seguro da Planilha"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onChangeMainTab(activeMainTab === 'planejamento' ? 'conferencia' : 'planejamento')}
                  className={`p-1.5 rounded-xl border text-[11px] font-bold transition ${
                    activeMainTab === 'planejamento'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Planejamento do Mês"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Equipe & Trabalhos (Audit & Users) */}
            <button
              onClick={onOpenTeamModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 transition shadow-sm"
              title="Gerenciar usuários da equipe e auditar todos os trabalhos e pontos realizados"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
              <span className="hidden xl:inline">Equipe & Trabalhos</span>
              <span className="hidden md:inline xl:hidden">Equipe</span>
            </button>

            {/* Painel Master (visível direto em telas maiores) */}
            {isMaster && (
              <button
                onClick={onOpenMasterPanel}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition shadow-sm"
                title="Painel Master para gerenciar cadastros de hospitais e operadores"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Master</span>
              </button>
            )}

            {/* Baixar APK (visível direto em telas xl+) */}
            <button
              onClick={onOpenInstall}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition shadow-sm"
              title="Baixar instalador APK para Android ou instalar aplicativo"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Baixar App</span>
            </button>

            {/* Exportar Excel (visível direto em telas 2xl+) */}
            {hasData && (
              <button
                onClick={onExportExcel}
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-sm transition"
                title="Exportar planilha atualizada com as checagens e cores dos setores"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            )}

            {/* Alternador de Sons */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={soundEnabled ? "Desativar sons de bipagem" : "Ativar sons de bipagem"}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              )}
            </button>

            {/* Botão Principal: Ler Código (Desktop) */}
            <button
              onClick={onOpenScanner}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Abrir leitor de código de barras ou QR Code"
            >
              <Camera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>Ler Código</span>
            </button>

            {/* Menu "Mais Opções" (Dropdown para telas menores ou secundárias) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="xl:hidden p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Mais opções e ferramentas"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Ferramentas & Ações
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

                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

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

            {/* Perfil do Usuário e Logout */}
            {currentUser && (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <div className="hidden 2xl:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px] flex items-center justify-end gap-1">
                    {isMaster && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                    {currentUser.name || 'Digiclintec'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                    {currentUser.email}
                  </span>
                </div>

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
    </header>
  );
}
