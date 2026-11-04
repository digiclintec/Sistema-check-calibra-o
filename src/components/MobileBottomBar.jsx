import React from 'react';
import { Camera, ListFilter, Smartphone, Search, CheckCircle2 } from 'lucide-react';

export default function MobileBottomBar({
  onOpenScanner,
  onOpenInstall,
  activeFilter,
  onCycleFilter,
  checkedCount,
  totalCount
}) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      
      {/* Filter Button */}
      <button
        onClick={onCycleFilter}
        className="flex flex-col items-center justify-center p-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
      >
        <div className="relative">
          <ListFilter className="w-5 h-5" />
          {checkedCount > 0 && (
            <span className="absolute -top-1 -right-2 text-[9px] font-extrabold px-1 rounded-full bg-blue-600 text-white">
              {checkedCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold mt-0.5 capitalize truncate max-w-[65px]">
          {activeFilter}
        </span>
      </button>

      {/* Main Center Floating Scan Button (Thumb-friendly) */}
      <button
        onClick={onOpenScanner}
        className="-mt-5 w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white flex flex-col items-center justify-center shadow-lg shadow-blue-500/40 ring-4 ring-white dark:ring-slate-900 active:scale-90 transition-transform"
      >
        <Camera className="w-6 h-6 stroke-[2.5]" />
        <span className="text-[8px] font-black uppercase tracking-tighter">BIPAR</span>
      </button>

      {/* Install Mobile App Button */}
      <button
        onClick={onOpenInstall}
        className="flex flex-col items-center justify-center p-1 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition"
      >
        <Smartphone className="w-5 h-5 text-emerald-500" />
        <span className="text-[10px] font-semibold mt-0.5 text-emerald-500 dark:text-emerald-400">
          Baixar App
        </span>
      </button>

    </div>
  );
}
