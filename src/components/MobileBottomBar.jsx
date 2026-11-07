import React from 'react';
import { Camera, ListFilter, Smartphone, Sparkles, Cpu, CheckSquare, PlusCircle } from 'lucide-react';

export default function MobileBottomBar({
  onOpenScanner,
  onOpenSerialScan,
  onOpenInstall,
  onOpenAddEquipment,
  activeFilter,
  onCycleFilter,
  checkedCount,
  totalCount
}) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 w-full max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      
      {/* Filter Button */}
      <button
        type="button"
        onClick={onCycleFilter}
        className="flex flex-col items-center justify-center px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 transition"
        title="Filtrar Lista"
      >
        <div className="relative">
          <ListFilter className="w-5 h-5" />
          {checkedCount > 0 && (
            <span className="absolute -top-1 -right-2.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-blue-600 text-white shadow-xs">
              {checkedCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold mt-0.5 capitalize truncate max-w-[65px]">
          {activeFilter}
        </span>
      </button>

      {/* Digitalizar Foto OCR Button */}
      <button
        type="button"
        onClick={onOpenSerialScan}
        className="flex flex-col items-center justify-center px-2 py-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 active:scale-95 transition"
        title="Leitura por Foto OCR"
      >
        <Cpu className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          Foto OCR
        </span>
      </button>

      {/* Botão Principal de Captura / Bipar (Perfeitamente enquadrado dentro da barra) */}
      <button
        type="button"
        onClick={onOpenScanner}
        className="flex flex-col items-center justify-center px-4 py-1.5 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30 active:scale-95 transition-all"
        title="Abrir Câmera para Bipar"
      >
        <Camera className="w-5 h-5 stroke-[2.5]" />
        <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
          BIPAR
        </span>
      </button>

      {/* Adicionar Equipamento ao Plano */}
      {onOpenAddEquipment && (
        <button
          type="button"
          onClick={() => onOpenAddEquipment()}
          className="flex flex-col items-center justify-center px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 transition"
          title="Adicionar Novo Equipamento ao Plano"
        >
          <PlusCircle className="w-5 h-5 text-blue-500" />
          <span className="text-[10px] font-bold mt-0.5 text-blue-600 dark:text-blue-400">
            + Item
          </span>
        </button>
      )}

      {/* Install Mobile App / APK Button */}
      <button
        type="button"
        onClick={onOpenInstall}
        className="flex flex-col items-center justify-center px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 active:scale-95 transition"
        title="Baixar Aplicativo Android / APK"
      >
        <Smartphone className="w-5 h-5 text-emerald-500" />
        <span className="text-[10px] font-extrabold mt-0.5 text-emerald-600 dark:text-emerald-400">
          Baixar APK
        </span>
      </button>

    </div>
  );
}

