import React from 'react';
import { 
  Camera, 
  Upload, 
  Download, 
  FileSpreadsheet, 
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
  Layers,
  FileCheck,
  ShieldCheck,
  PlusCircle
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
  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';
  const activeHospital = hospitals.find(h => h.id === activeHospitalId) || hospitals[0];

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-1 sm:gap-2">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Online
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hidden xs:block truncate">
                Digiclintec
              </p>
            </div>
          </div>

          {/* Hospital Switcher Dropdown (Multi-Hospital SaaS) & Quick Add */}
          <div className="flex items-center gap-1 shrink min-w-0">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/60 max-w-[130px] xs:max-w-[160px] sm:max-w-xs shrink min-w-0">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-0.5 hidden xs:block" />
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
                className="bg-transparent text-[11px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate w-full"
                title="Selecione o hospital ou clínica para visualizar os equipamentos"
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

            {/* Quick + Hospital Button (Always accessible) */}
            <button
              onClick={() => onOpenHospitalModal && onOpenHospitalModal('create')}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition shrink-0 shadow-sm"
              title="Cadastrar Novo Hospital ou Clínica"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="hidden sm:inline">+ Hospital</span>
            </button>
          </div>

          {/* Work Modality Selector (Equipes: Calibração / Preventiva / TSE - No mobile, o ModalityBar abaixo já cumpre esta função) */}
          {onChangeModality && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink min-w-0">
              <select
                value={activeModality || 'calibracao'}
                onChange={(e) => onChangeModality(e.target.value)}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate"
                title="Selecione sua frente de trabalho / equipe"
              >
                <option value="calibracao" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🎯 Calibração</option>
                <option value="preventiva" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🔧 Preventiva</option>
                <option value="seguranca" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">⚡ Seg. Elétrica</option>
                <option value="geral" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">📋 Visão Integrada</option>
              </select>
            </div>
          )}

          {/* Navigation Tabs (Conferência vs Planejamento do Mês) */}
          {onChangeMainTab && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => onChangeMainTab('conferencia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'conferencia'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Conferência</span>
              </button>

              <button
                onClick={() => onChangeMainTab('auditoria')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'auditoria'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Espelho seguro da planilha sem risco de alterações acidentais"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Espelho Seguro</span>
              </button>

              <button
                onClick={() => onChangeMainTab('planejamento')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeMainTab === 'planejamento'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Planejamento</span>
                {monthlyPlans.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeMainTab === 'planejamento' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {monthlyPlans.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Actions & Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Mobile Navigation Buttons */}
            {onChangeMainTab && (
              <div className="flex md:hidden items-center gap-1">
                <button
                  onClick={() => onChangeMainTab(activeMainTab === 'auditoria' ? 'conferencia' : 'auditoria')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold border transition ${
                    activeMainTab === 'auditoria'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Alternar para o Espelho Seguro da Planilha e Ponto da Equipe"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Espelho</span>
                </button>

                <button
                  onClick={() => onChangeMainTab(activeMainTab === 'planejamento' ? 'conferencia' : 'planejamento')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold border transition ${
                    activeMainTab === 'planejamento'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Alternar para aba de Planejamento do Mês"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>Planos</span>
                </button>
              </div>
            )}

            {/* Team Management & Work Audit Button (Substitui painel de preços) */}
            <button
              onClick={onOpenTeamModal}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition shadow-sm"
              title="Gerenciar usuários da equipe e auditar todos os trabalhos realizados"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
              <span className="hidden sm:inline">Equipe & Trabalhos</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={soundEnabled ? "Desativar sons de bipagem" : "Ativar sons de bipagem"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />}
            </button>

            {/* Master Panel Trigger Button */}
            {isMaster && (
              <button
                onClick={onOpenMasterPanel}
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 transition shadow-sm"
                title="Painel Master para gerenciar cadastros de hospitais e operadores"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">Master</span>
              </button>
            )}

            {/* Install App / Download APK Button */}
            <button
              onClick={onOpenInstall}
              className="hidden sm:flex items-center gap-1.5 px-2 sm:px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition shadow-sm"
              title="Baixar instalador APK para Android ou instalar aplicativo"
            >
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span>Baixar APK</span>
            </button>

            {/* Export Excel Button (Active when data exists) */}
            {hasData && (
              <button
                onClick={onExportExcel}
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-sm transition"
                title="Exportar planilha atualizada com as checagens"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            )}

            {/* Primary Scanner Trigger Button (Visível no topo apenas em desktop, pois mobile usa o botão central do rodapé) */}
            <button
              onClick={onOpenScanner}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Ler Código</span>
            </button>

            {/* User Profile & Logout */}
            {currentUser && (
              <div className="flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden xl:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px] flex items-center justify-end gap-1">
                    {isMaster && <Crown className="w-3 h-3 text-amber-500" />}
                    {currentUser.name || 'Digiclintec'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
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
