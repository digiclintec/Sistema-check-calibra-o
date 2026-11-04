import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Sparkles, 
  Barcode, 
  CheckCircle2, 
  ShieldCheck, 
  Zap,
  ArrowRight,
  FileText
} from 'lucide-react';

export default function HeroBanner({ 
  onOpenFilePicker, 
  onOpenGoogleModal, 
  onLoadSample,
  onDropFile
}) {
  const [isHoveringDrop, setIsHoveringDrop] = useState(false);

  return (
    <div className="bg-gradient-to-b from-blue-50/70 via-white to-white dark:from-slate-900/60 dark:via-slate-900 dark:to-slate-900 border border-blue-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-10 shadow-sm mb-6 w-full max-w-full overflow-hidden">
      
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-900/50">
          <Zap className="w-3.5 h-3.5 fill-current" />
          Pronto para uso em campo, laboratório ou chão de fábrica
        </div>

        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
          Conferência & Check-in de Calibração <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">
            direto da sua planilha crua
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Suba seu arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> bruto.
          O sistema detecta automaticamente os aparelhos, tags e códigos de barra para você começar a bipar e dar check na hora!
        </p>

        {/* 3 Call to Action Options */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
          
          {/* Option 1: File Upload (Drag & Drop Zone) */}
          <button
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
            className={`p-5 rounded-2xl bg-white dark:bg-slate-800/80 border-2 border-dashed transition text-left group flex flex-col justify-between ${
              isHoveringDrop 
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-4 ring-blue-500/20 scale-[1.02]' 
                : 'border-blue-400 dark:border-blue-500/50 hover:border-blue-600 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  Recomendado
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Subir Planilha Crua
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Solte aqui seu arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              Escolher do Computador <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Option 2: Google Sheets / Copiar e Colar */}
          <button
            onClick={onOpenGoogleModal}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-500 hover:shadow-lg transition text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                  Sem Baixar
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Copiar e Colar (Ctrl+V)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cole dados do Google Sheets ou link compartilhado
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              Abrir importador <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Option 3: Test Sample Data */}
          <button
            onClick={onLoadSample}
            className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-slate-800/90 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 hover:border-indigo-500 hover:shadow-lg transition text-left group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                  1 Clique
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Testar com Exemplo
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Carrega 10 equipamentos com códigos de barra para testar agora
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              Ver demonstração <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

        </div>

        {/* Feature Pills */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            Leitura pela Câmera (Celular ou Notebook)
          </span>
          <span className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-blue-500" />
            Pistola de Bipagem USB / Bluetooth
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            Exporta de volta para Excel com os Checks
          </span>
        </div>

      </div>

    </div>
  );
}
