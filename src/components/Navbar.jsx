import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Download, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  LogOut, 
  Users,
  Smartphone,
  Building2,
  Sparkles,
  Folder,
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
  Truck,
  FileSpreadsheet,
  UserPlus,
  Database,
  Search,
  Lock
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
  onOpenAddEquipment = null,
  stagedBadgeCount = 0,
  cartBadgeCount = 0,
  onOpenArkmedsSync = null,
  onCloseActivePlan = null
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [openMenuFolder, setOpenMenuFolder] = useState('gerenciamento');
  const moreMenuRef = useRef(null);
  const mobileNavRef = useRef(null);

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';
  const activeHospital = hospitals.find(h => h.id === activeHospitalId) || hospitals[0];

  // Auto-scroll da aba ativa para o centro no mobile/tablet
  useEffect(() => {
    if (mobileNavRef.current) {
      const activeEl = mobileNavRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeMainTab]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
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
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 transition shadow-xs min-w-[130px] sm:min-w-[180px] max-w-[260px] flex-1 sm:flex-initial shrink">
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

            {/* Seletor Rápido de Plano de Calibração Ativo (Frontal em Todos os Tamanhos) */}
            {Array.isArray(monthlyPlans) && monthlyPlans.length > 0 ? (
              <div 
                className="flex items-center gap-1.5 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 px-2 sm:px-2.5 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-800/80 transition shadow-xs w-28 xs:w-36 sm:w-44 max-w-[190px] shrink min-w-0"
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
                      {p.status === 'encerrado' ? '🔒 [Encerrado] ' : '📋 '}{p.title || `Plano ${p.ano || ''}`} ({p.percent || 0}%)
                    </option>
                  ))}
                  <option disabled className="bg-slate-200 dark:bg-slate-800 text-slate-500">──────────</option>
                  <option value="__MANAGE_PLANS__" className="bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold">
                    ⚙️ Gerenciar Todos os Planos...
                  </option>
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onChangeMainTab && onChangeMainTab('planejamento')}
                className="flex items-center gap-1.5 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 px-2 sm:px-2.5 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-bold transition shrink-0"
                title="Acessar Área de Planos de Calibração"
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden xs:inline">Planos</span>
              </button>
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
                onClick={() => onChangeMainTab('consulta')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeMainTab === 'consulta'
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Consulta Rápida de Aparelho & QR Code Arkmeds"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>Consulta</span>
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
                  {cartBadgeCount > 0 && (
                    <span className="ml-1 text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-white shadow-xs animate-pulse">
                      {cartBadgeCount}
                    </span>
                  )}
                </button>
              )}

              {onOpenArkmedsSync && (
                <button
                  type="button"
                  onClick={onOpenArkmedsSync}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 active:scale-95 whitespace-nowrap"
                  title="Sincronizar e Consultar Equipamentos no Arkmeds (Somente Leitura)"
                >
                  <Database className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>Arkmeds</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 font-bold">
                    Sync
                  </span>
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
            
            {/* Botão Frontal: Buscar Aparelho */}
            <button
              type="button"
              onClick={() => onChangeMainTab && onChangeMainTab('consulta')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 ${
                activeMainTab === 'consulta'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400'
                  : 'bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80'
              }`}
              title="Buscar e Consultar Aparelho por IDEC, Tag, Série ou Patrimônio"
            >
              <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">Buscar Aparelho</span>
              <span className="sm:hidden">Buscar</span>
            </button>

            {/* Botão Primário: Bipar na Câmera (Sempre visível em todos os tamanhos!) */}
            <button
              onClick={onOpenScanner}
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Abrir câmera para ler código de barras"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Ler Código</span>
              <span className="sm:hidden">Bipar</span>
              {stagedBadgeCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full animate-pulse shadow-xs">
                  {stagedBadgeCount}
                </span>
              )}
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
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto">
                  
                  {/* Cabeçalho do Menu com Usuário */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onChangeMainTab) onChangeMainTab('perfil');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition block border-b border-slate-100 dark:border-slate-800"
                      title="Abrir Perfil do Técnico"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white truncate text-xs">
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

                  {/* PASTAS CATEGORIZADAS DE FERRAMENTAS */}
                  <div className="p-1.5 space-y-1.5">
                    
                    {/* PASTA 1: GERENCIAMENTO */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-slate-850/60">
                      <button
                        type="button"
                        onClick={() => setOpenMenuFolder(openMenuFolder === 'gerenciamento' ? null : 'gerenciamento')}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <Folder className="w-4 h-4 fill-blue-500/20 text-blue-500 shrink-0" />
                          <span>Gerenciamento</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {isMaster ? '5' : '4'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openMenuFolder === 'gerenciamento' ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {openMenuFolder === 'gerenciamento' && (
                        <div className="p-1 space-y-0.5 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {onOpenAddEquipment && (
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                onOpenAddEquipment();
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition text-blue-600 dark:text-blue-400 rounded-lg text-left"
                            >
                              <PlusCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>+ Adicionar ao Plano</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (onOpenTeamModal) onOpenTeamModal('create_user');
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition text-emerald-600 dark:text-emerald-400 rounded-lg text-left"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Criar Novo Login / Usuário</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (onOpenTeamModal) onOpenTeamModal('users');
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 rounded-lg text-left"
                          >
                            <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>Gerenciar Equipe</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (onOpenHospitalModal) onOpenHospitalModal('list');
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 rounded-lg text-left"
                          >
                            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>Gerenciar Hospitais</span>
                          </button>

                          {onCloseActivePlan && (
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                onCloseActivePlan();
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-rose-600 dark:text-rose-400 rounded-lg text-left"
                            >
                              <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>Encerrar Plano Atual</span>
                            </button>
                          )}

                          {isMaster && (
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                if (onOpenMasterPanel) onOpenMasterPanel();
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-amber-600 dark:text-amber-400 rounded-lg text-left"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>Painel Master</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PASTA 2: ANÁLISES & PLANILHAS */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-slate-850/60">
                      <button
                        type="button"
                        onClick={() => setOpenMenuFolder(openMenuFolder === 'analises' ? null : 'analises')}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <Folder className="w-4 h-4 fill-emerald-500/20 text-emerald-500 shrink-0" />
                          <span>Análises & Planilhas</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {hasData ? '4' : '1'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openMenuFolder === 'analises' ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {openMenuFolder === 'analises' && (
                        <div className="p-1 space-y-0.5 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {onOpenGoogleModal && (
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                onOpenGoogleModal();
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-emerald-600 dark:text-emerald-400 rounded-lg text-left"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Importar Planilha (Arquivo / Colar)</span>
                            </button>
                          )}

                          {hasData && (
                            <>
                              <button
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (onOpenMergeModal) onOpenMergeModal();
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-indigo-600 dark:text-indigo-400 rounded-lg text-left"
                              >
                                <GitMerge className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>Mesclar Calibrações (XLS/PDF)</span>
                              </button>

                              <button
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (onExportExcel) onExportExcel();
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 rounded-lg text-left"
                              >
                                <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>Exportar Planilha Excel</span>
                              </button>

                              {onResetData && (
                                <button
                                  onClick={() => {
                                    setShowMoreMenu(false);
                                    onResetData();
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition rounded-lg text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>Limpar / Trocar Planilha</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PASTA 3: CONFIGURAÇÕES & SISTEMA */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-slate-850/60">
                      <button
                        type="button"
                        onClick={() => setOpenMenuFolder(openMenuFolder === 'configuracoes' ? null : 'configuracoes')}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                          <Folder className="w-4 h-4 fill-purple-500/20 text-purple-500 shrink-0" />
                          <span>Configurações & Sistema</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            2
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openMenuFolder === 'configuracoes' ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {openMenuFolder === 'configuracoes' && (
                        <div className="p-1 space-y-0.5 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {onOpenArkmedsSync && (
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                onOpenArkmedsSync();
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold hover:bg-teal-50 dark:hover:bg-teal-950/40 transition text-teal-600 dark:text-teal-400 rounded-lg text-left"
                            >
                              <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                <span>Sincronizar Arkmeds</span>
                              </div>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                                Leitura
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              if (onOpenInstall) onOpenInstall();
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-emerald-600 dark:text-emerald-400 rounded-lg text-left"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Baixar APK Android</span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Sair da Conta */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>

                </div>
              )}
            </div>



          </div>

        </div>
      </div>

      {/* ============================================================
          LINHA SECUNDÁRIA (Row 2): Abas no Tablet & Mobile (< xl / < 1280px)
          Segmented Bar de Alta Performance para Tablets e Celulares
      ============================================================ */}
      {onChangeMainTab && (
        <div className="xl:hidden w-full bg-slate-50/95 dark:bg-[#090f1d]/95 border-t border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-1.5">
          <nav 
            ref={mobileNavRef}
            className="w-full max-w-4xl mx-auto flex items-center gap-1.5 bg-white/95 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-x-auto no-scrollbar scroll-smooth touch-pan-x"
          >
            <button
              type="button"
              data-active={activeMainTab === 'conferencia'}
              onClick={() => onChangeMainTab('conferencia')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                activeMainTab === 'conferencia'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Conferência de Bombas e Equipamentos"
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Conferência</span>
            </button>

            <button
              type="button"
              data-active={activeMainTab === 'consulta'}
              onClick={() => onChangeMainTab('consulta')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                activeMainTab === 'consulta'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Consulta de Aparelhos & QR Code Arkmeds"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Consulta</span>
            </button>

            <button
              type="button"
              data-active={activeMainTab === 'auditoria'}
              onClick={() => onChangeMainTab('auditoria')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                activeMainTab === 'auditoria'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Espelho Seguro da Planilha"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Espelho Seguro</span>
            </button>

            <button
              type="button"
              data-active={activeMainTab === 'planejamento'}
              onClick={() => onChangeMainTab('planejamento')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                activeMainTab === 'planejamento'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Planejamento de Cronogramas e Metas Mensais"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Planejamento</span>
              {monthlyPlans.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black leading-none shrink-0 ${
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
                type="button"
                data-active={activeMainTab === 'devolucao'}
                onClick={() => onChangeMainTab('devolucao')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                  activeMainTab === 'devolucao'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
                title="Carrinho & Devolução de Bombas aos Setores"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Carrinho & Devolução</span>
                {cartBadgeCount > 0 && (
                  <span className="inline-flex items-center justify-center text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-white shadow-xs shrink-0 animate-pulse">
                    {cartBadgeCount}
                  </span>
                )}
              </button>
            )}

            {onOpenArkmedsSync && (
              <button
                type="button"
                onClick={onOpenArkmedsSync}
                className="py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 active:scale-95"
                title="Sincronizar e Consultar Equipamentos no Arkmeds"
              >
                <Database className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                <span>Arkmeds</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-400 font-bold leading-none shrink-0 border border-teal-500/30">
                  Sync
                </span>
              </button>
            )}

            <button
              type="button"
              data-active={activeMainTab === 'perfil'}
              onClick={() => onChangeMainTab('perfil')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap select-none active:scale-95 ${
                activeMainTab === 'perfil'
                  ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Perfil do Técnico: Frente de Trabalho e Opções de Checagem"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Perfil</span>
            </button>
          </nav>
        </div>
      )}

    </header>
  );
}
