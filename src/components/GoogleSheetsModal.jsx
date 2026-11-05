import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  ExternalLink, 
  ClipboardPaste, 
  UploadCloud, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { extractGoogleSheetsExportUrl, parseCsvText, parseSpreadsheetFile } from '../utils/sheetParser';

export default function GoogleSheetsModal({ isOpen, onClose, onImportData, currentGoogleSheetUrl = '' }) {
  const [activeTab, setActiveTab] = useState(currentGoogleSheetUrl ? 'link' : 'file'); // 'file', 'paste', 'link'
  const [sheetUrl, setSheetUrl] = useState(currentGoogleSheetUrl || '');
  const [pastedData, setPastedData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const modalFileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setError('');
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

  const handleFetchUrl = async (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) {
      setError('Por favor, insira o link da sua planilha.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Busca via backend proxy (sem CORS, com suporte a Office rtpof do Google Drive e native Google Sheets)
      const res = await fetch('/api/fetch-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim() })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao carregar o link da planilha.');
      }

      if (!data.equipments || data.equipments.length === 0) {
        throw new Error('A planilha retornou sem registros de equipamentos válidos.');
      }

      onImportData({
        ...data,
        googleSheetUrl: data.googleSheetUrl || sheetUrl.trim()
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err.message || 'Erro ao carregar link. O Google bloqueou o acesso direto sem permissão pública. Recomendação: Baixe o arquivo (.xlsx) ou copie e cole na aba ao lado!'
      );
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
      const parsed = parseCsvText(pastedData.trim(), 'Dados Colados (Google Sheets)');
      onImportData(parsed);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Não foi possível interpretar o conteúdo colado. Certifique-se de copiar incluindo a linha de cabeçalhos!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Carregar Planilha Crua</h3>
              <p className="text-xs text-slate-400">Excel (.xlsx, .xls), CSV ou Google Sheets</p>
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
            onClick={() => { setActiveTab('file'); setError(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'file'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Subir Arquivo Cru
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('paste'); setError(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Copiar e Colar (Ctrl+V)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('link'); setError(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'link'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Link Google Drive
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* TAB 1: SUBIR ARQUIVO CRU */}
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
                  Arraste ou clique para selecionar o arquivo cru
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
                  Como baixar sua planilha direto do Google Sheets:
                </p>
                <p className="text-slate-400 leading-relaxed">
                  1. Na sua planilha aberta no navegador, clique em <strong>Arquivo</strong> (canto superior esquerdo).<br />
                  2. Vá em <strong>Fazer o download</strong> ➔ Escolha <strong>Microsoft Excel (.xlsx)</strong>.<br />
                  3. Jogue o arquivo baixado diretamente nesta tela!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: COPIAR E COLAR */}
          {activeTab === 'paste' && (
            <form onSubmit={handleParsePasted} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Selecione as linhas na sua planilha, dê <strong>Ctrl+C</strong> e dê <strong>Ctrl+V</strong> abaixo:
                </label>
                <textarea
                  rows={8}
                  placeholder={`Código\tEquipamento\tModelo\tNº Série\tSetor\tValidade\n78910001\tMultímetro Fluke 87V\t87V\tSN-9988\tLaboratório\t2026-12-31`}
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-300/90 leading-relaxed">
                💡 <strong>100% à prova de falhas:</strong> Não precisa baixar arquivo nem configurar permissões do Google. Basta copiar as células da sua planilha e colar aqui.
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

          {/* TAB 3: LINK DO GOOGLE SHEETS */}
          {activeTab === 'link' && (
            <form onSubmit={handleFetchUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Cole o link público de compartilhamento da sua planilha Google:</span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Sincronização Ativa
                  </span>
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 space-y-2 text-xs text-emerald-200">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sincronização em Tempo Real (Link Ativo):
                </p>
                <p className="leading-relaxed text-emerald-200/90">
                  Ao vincular o link, qualquer alteração que a equipe fizer na planilha do Google (novas linhas, troca de setores, anotações ou checagens) será <strong>atualizada automaticamente no sistema</strong> a cada 25 segundos, sem perder as bipagens já feitas pelos técnicos!
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-400">
                <p className="font-semibold text-slate-300">
                  Dica de compartilhamento no Google Sheets:
                </p>
                <p className="leading-relaxed">
                  No Google Sheets, certifique-se de que a planilha esteja como <strong>"Qualquer pessoa com o link"</strong> para permitir que o sistema leia as alterações.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                {loading ? 'Conectando e lendo planilha...' : 'Conectar Planilha com Sincronização ao Vivo'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
