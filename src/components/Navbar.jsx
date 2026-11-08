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
  CalendarDays,
  FileCheck,
  ShieldCheck,
  PlusCircle,
  MoreVertical,
  ChevronDown,
  GitMerge,
  RotateCcw,
  User,
  Link2,
  Trash2,
  Truck
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
  onUndo = null,
  onResetData = null,
  googleSheetUrl = '',
  googleSheetWebhookUrl = '',
  serviceConfig = null,
  onOpenAddEquipment = null
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
          Totalmente flexível, sem largura fixa restritiva que esprema os botões
      ============================================================ */}
      <div className="w-full px-2.5 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3">
          
          {/* LADO ESQUERDO: Logo & Seletor de Hospital */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            
            {/* Logo da Marca */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <div className="shrink-0 hidden xs:block">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                    Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                  </h1>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
                  Digiclintec
                </p>
              </div>
            </div>

            {/* Separador vertical sutil */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block shrink-0" />

            {/* Seletor de Hospital Elegante com largura elástica protegida */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 transition shadow-xs w-36 xs:w-44 sm:w-52 md:w-60 max-w-[240px] shrink min-w-0">
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

            {/* Seletor Rápido de Plano de Calibração Ativo */}
            {Array.isArray(monthlyPlans) && monthlyPlans.length > 0 && (
              <div 
                className="hidden lg:flex items-center gap-1.5 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 px-2 sm:px-2.5 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-800/80 transition shadow-xs w-36 sm:w-44 max-w-[200px] shrink min-w-0"
                title={`Plano de Calibração Ativo: ${monthlyPlans.find(p => p.id === activePlanId)?.title || 'Selecione'}`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  value={activePlanId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__MANAGE_PLANS__') {
                      if (onChangeMainTab) onChangeMainTab('planejamento');
                    } else if (onSwitchPlan) {
                      onSwitchPlan(val);
                    }
                  }}
                  className="bg-transparent text-[11px] sm:text-xs font-bold text-blue-900 dark:text-blue-200 focus:outline-none cursor-pointer truncate w-full"
                >
                  {monthlyPlans.map(p => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                      📋 {p.title || `Plano ${p.ano || ''}`}
                    </option>
                  ))}
                  <option disabled className="bg-slate-200 dark:bg-slate-800 text-slate-500">──────────</option>
                  <option value="__MANAGE_PLANS__" className="bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold">
                    ⚙️ Gerenciar Todos os Planos...
                  </option>
                </select>
              </div>
            )}
          </div>

          {/* CENTRO: Abas de Navegação (Visível EXCLUSIVAMENTE em Desktop xl+ >= 1280px para espaço amplo) */}
          {onChangeMainTab && (
            <nav className="hidden xl:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-inner shrink-0 mx-2">
              <button
                onClick={() => onChangeMainTab('conferencia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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

              {serviceConfig?.enableCarrinhoDevolucao && (
                <button
                  onClick={() => onChangeMainTab('devolucao')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeMainTab === 'devolucao'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Carrinho & Devolução de Bombas aos Setores"
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <span>Carrinho & Devolução</span>
                </button>
              )}

              <button
                onClick={() => onChangeMainTab('perfil')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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

          {/* LADO DIREITO: Ações Rápidas, Menu e Perfil */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            
            {/* Botão Primário: Bipar na Câmera (Sempre visível em todos os tamanhos!) */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Abrir câmera para ler código de barras"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Ler Código</span>
              <span className="sm:hidden">Bipar</span>
            </button>

            {/* Alternador de Sons Hospitalares */}
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
                    {onOpenAddEquipment && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onOpenAddEquipment();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition text-blue-600 dark:text-blue-400"
                      >
                        <PlusCircle className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>+ Adicionar ao Plano</span>
                      </button>
                    )}

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
                        {onOpenGoogleModal && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onOpenGoogleModal();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-emerald-600 dark:text-emerald-400"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Importar Planilha (Arquivo / Colar)</span>
                          </button>
                        )}

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
                          <span>Exportar Planilha Excel</span>
                        </button>

                        {onResetData && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onResetData();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Limpar / Trocar Planilha</span>
                          </button>
                        )}
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

            {/* Perfil do Usuário e Sair */}
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
                  className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
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
          LINHA SECUNDÁRIA (Row 2): Abas no Tablet & Mobile (< xl / < 1280px)
          Segmented Bar de Alta Performance para Tablets e Celulares
      ============================================================ */}
      {onChangeMainTab && (
        <div className="xl:hidden w-full bg-slate-50/95 dark:bg-[#090f1d]/95 border-t border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-1.5">
          <nav className="w-full max-w-2xl mx-auto grid grid-cols-4 gap-1 sm:gap-2 bg-white/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
            <button
              onClick={() => onChangeMainTab('conferencia')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
                activeMainTab === 'conferencia'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Conferência de Bombas"
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Conferência</span>
            </button>

            <button
              onClick={() => onChangeMainTab('auditoria')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
                activeMainTab === 'auditoria'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Espelho Seguro da Planilha"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate hidden sm:inline">Espelho Seguro</span>
              <span className="truncate sm:hidden">Espelho</span>
            </button>

            <button
              onClick={() => onChangeMainTab('planejamento')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 relative truncate ${
                activeMainTab === 'planejamento'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Planejamento de Cronogramas e Metas"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate hidden sm:inline">Planejamento</span>
              <span className="truncate sm:hidden">Metas</span>
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

            {serviceConfig?.enableCarrinhoDevolucao && (
              <button
                onClick={() => onChangeMainTab('devolucao')}
                className={`py-1.5 px-1 sm:px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
                  activeMainTab === 'devolucao'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Carrinho de Devolução"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate hidden sm:inline">Carrinho & Devolução</span>
                <span className="truncate sm:hidden">Carrinho</span>
              </button>
            )}

            <button
              onClick={() => onChangeMainTab('perfil')}
              className={`py-1.5 px-1 sm:px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 truncate ${
                activeMainTab === 'perfil'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Perfil do Técnico: Frente de Trabalho e Opções de Checagem"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate hidden sm:inline">Perfil Técnico</span>
              <span className="truncate sm:hidden">Perfil</span>
            </button>
          </nav>
        </div>
      )}

    </header>
  );
}
