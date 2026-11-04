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
  Users
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
  onOpenMasterPanel
}) {
  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <CheckCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Calibra<span className="text-blue-600 dark:text-blue-400">Check</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden xs:block truncate">
                Digiclintec • Sincronização em Tempo Real
              </p>
            </div>
          </div>

          {/* Actions & Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={soundEnabled ? "Desativar sons de bipagem" : "Ativar sons de bipagem"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Master Panel Trigger Button */}
            {isMaster && (
              <button
                onClick={onOpenMasterPanel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 transition shadow-sm"
                title="Painel Master para gerenciar cadastros de usuários"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Painel Master</span>
              </button>
            )}

            {/* Google Sheets Modal Button */}
            <button
              onClick={onOpenGoogleModal}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Google Planilhas</span>
            </button>

            {/* Import Excel Button */}
            <button
              onClick={onOpenFilePicker}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700 transition"
            >
              <Upload className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="hidden sm:inline">Subir Planilha</span>
              <span className="sm:hidden">Excel</span>
            </button>

            {/* Export Excel Button (Active when data exists) */}
            {hasData && (
              <button
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-sm transition"
                title="Exportar planilha atualizada com as checagens"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar Excel</span>
                <span className="sm:hidden">Exportar</span>
              </button>
            )}

            {/* Primary Scanner Trigger Button */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Ler Código</span>
            </button>

            {/* User Profile & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden xl:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px] flex items-center justify-end gap-1">
                    {isMaster && <Crown className="w-3 h-3 text-amber-500" />}
                    {currentUser.name || 'Digiclintec'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  title="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
