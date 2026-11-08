import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Building2, 
  Plus, 
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  CalendarDays,
  Tag
} from 'lucide-react';
import { getSectorColor } from '../utils/sectorColors';

// Setores clínicos padrão de hospitais para acesso rápido
const DEFAULT_CLINICAL_SECTORS = [
  'CENTRO CIRÚRGICO',
  'UTI ADULTO',
  'UTI NEONATAL / PEDIÁTRICA',
  'ENFERMARIA / INTERNAÇÃO',
  'PRONTO SOCORRO / EMERGÊNCIA',
  'CME (ESTERILIZAÇÃO)',
  'LABORATÓRIO / DIAGNÓSTICO',
  'AMBULATÓRIO',
  'GERAL'
];

export default function HeroBanner({ 
  onOpenFilePicker, 
  onOpenGoogleModal, 
  onLoadSample,
  onDropFile,
  onOpenAddEquipment,
  hospitalName = '',
  planTitle = 'Plano Atual',
  sectorColors = {}
}) {
  const [isHoveringDrop, setIsHoveringDrop] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-7 shadow-sm space-y-6 w-full max-w-4xl mx-auto animate-in fade-in duration-200">
      
      {/* Cabeçalho do Plano Ativo */}
      <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/40 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Plano Ativo
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {hospitalName || 'Hospital'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {planTitle || 'Plano de Calibração'}
            </h3>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
          0 equipamentos cadastrados
        </span>
      </div>

      {/* Opção Principal: Subir Planilha do Plano (Dropzone Direta) */}
      <div
        onClick={onOpenFilePicker}
        onDragOver={(e) => {
          e.preventDefault();
          setIsHoveringDrop(true);
        }}
        onDragLeave={() => setIsHoveringDrop(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsHoveringDrop(false);
          const file = e.dataTransfer.files?.[0];
          if (file && onDropFile) onDropFile(file);
        }}
        className={`p-5 sm:p-6 border-2 border-dashed rounded-2xl cursor-pointer transition flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isHoveringDrop 
            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 ring-4 ring-blue-500/20 scale-[1.01]' 
            : 'border-blue-300 dark:border-blue-800/80 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500 hover:bg-blue-50/50'
        }`}
      >
        <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
            <UploadCloud className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-0.5">
              Subir Planilha (.xlsx, .xls ou .csv)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clique para selecionar o arquivo no seu computador ou arraste e solte aqui
            </p>
          </div>
        </div>

        <button
          type="button"
          className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition active:scale-95 shrink-0 flex items-center justify-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Escolher Arquivo</span>
        </button>
      </div>

      {/* Lista Simples de Setores (Set.) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Lista Simples de Setores (Set.)
            </h4>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              — Adicione equipamentos organizados por setor
            </span>
          </div>

          {onOpenAddEquipment && (
            <button
              type="button"
              onClick={() => onOpenAddEquipment(null, '', 'manual', '')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Novo Equipamento Geral</span>
            </button>
          )}
        </div>

        {/* Tabela / Lista Simples de Setores */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30">
          {DEFAULT_CLINICAL_SECTORS.map((sectorName) => {
            const colorMeta = getSectorColor(sectorName, sectorColors);
            return (
              <div 
                key={sectorName}
                style={{ borderLeft: `4px solid ${colorMeta.hex}` }}
                className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span 
                    style={{ backgroundColor: colorMeta.bg, color: colorMeta.text, borderColor: colorMeta.border }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border truncate"
                  >
                    {sectorName}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    0 aparelhos
                  </span>
                </div>

                {onOpenAddEquipment && (
                  <button
                    type="button"
                    onClick={() => onOpenAddEquipment(null, '', 'manual', sectorName)}
                    className="py-1.5 px-3 rounded-xl bg-slate-200/80 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    title={`Adicionar equipamento no setor ${sectorName}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Adicionar neste Setor</span>
                    <span className="sm:hidden">Adicionar</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Opções Rápidas Adicionais (Discretas no rodapé) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAddEquipment && (
            <button
              type="button"
              onClick={() => onOpenAddEquipment(null, '', 'manual', '')}
              className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Manualmente</span>
            </button>
          )}

          {onOpenGoogleModal && (
            <button
              type="button"
              onClick={onOpenGoogleModal}
              className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1.5"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Colar Linhas de Planilha</span>
            </button>
          )}
        </div>

        {onLoadSample && (
          <button
            type="button"
            onClick={onLoadSample}
            className="py-2 px-3 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition font-medium flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Testar com Exemplo Demonstrativo</span>
          </button>
        )}
      </div>

    </div>
  );
}
