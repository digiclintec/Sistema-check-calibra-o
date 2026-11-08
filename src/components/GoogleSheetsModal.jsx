import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  ClipboardPaste, 
  UploadCloud, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { parseCsvText, parseSpreadsheetFile } from '../utils/sheetParser';

export default function GoogleSheetsModal({ 
  isOpen, 
  onClose, 
  onImportData
}) {
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'paste'
  const [pastedData, setPastedData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const modalFileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await parseSpreadsheetFile(file);
      onImportData(result);
      onClose();
    } catch (err) {
      console.error(err);
      setError(`Erro ao ler arquivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleParsePasted = (e) => {
    e.preventDefault();
    if (!pastedData.trim()) {
      setError('Por favor, cole as linhas da sua planilha no campo de texto.');
      return;
    }

    try {
      const parsed = parseCsvText(pastedData.trim(), 'Dados Colados');
      onImportData(parsed);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Não foi possível interpretar o conteúdo colado. Certifique-se de copiar incluindo a linha de cabeçalhos!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Importar Planilha
              </h3>
              <p className="text-xs text-slate-400">
                Selecione o arquivo Excel (.xlsx, .xls, .csv) ou cole os dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveTab('file'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'file'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Subir Arquivo (.xlsx / .csv)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('paste'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Copiar e Colar Linhas
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{successMsg}</div>
            </div>
          )}

          {/* TAB 1: SUBIR ARQUIVO */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={modalFileInputRef}
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
              />

              <div
                onClick={() => modalFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files?.[0]);
                }}
                className="border-2 border-dashed border-blue-500/40 hover:border-blue-500 bg-slate-950/60 hover:bg-blue-950/20 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-white text-base mb-1">
                  Arraste ou clique para selecionar o arquivo
                </h4>
                <p className="text-slate-400 text-xs max-w-sm mb-3">
                  Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>
                </p>
                <span className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-sm">
                  {loading ? 'Lendo planilha...' : 'Procurar no Computador'}
                </span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Dica de exportação do Google Sheets ou Excel:
                </p>
                <p className="text-slate-400 leading-relaxed">
                  No Google Sheets ou Excel, basta salvar/baixar como <strong>Microsoft Excel (.xlsx)</strong> e carregar o arquivo diretamente aqui.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: COPIAR E COLAR */}
          {activeTab === 'paste' && (
            <form onSubmit={handleParsePasted} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Selecione as células na sua planilha, copie com <strong>Ctrl+C</strong> e cole abaixo:
                </label>
                <textarea
                  rows={8}
                  placeholder={`Código\tEquipamento\tModelo\tNº Série\tSetor\tValidade\n78910001\tBomba de Infusão\tLF2001\tSN-9988\tUTI Adulto\t2026-12-31`}
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                Processar Dados Colados
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
