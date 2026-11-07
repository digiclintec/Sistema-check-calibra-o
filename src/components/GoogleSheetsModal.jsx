import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  ExternalLink, 
  ClipboardPaste, 
  UploadCloud, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  FileCheck,
  Copy,
  Check,
  Zap,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Send
} from 'lucide-react';
import { parseCsvText, parseSpreadsheetFile } from '../utils/sheetParser';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate';

export default function GoogleSheetsModal({ 
  isOpen, 
  onClose, 
  onImportData, 
  currentGoogleSheetUrl = '',
  currentGoogleSheetWebhookUrl = '',
  onSaveGoogleWebhook = null,
  hospitalId = null,
  planId = null,
  equipments = []
}) {
  const [activeTab, setActiveTab] = useState(
    currentGoogleSheetWebhookUrl ? 'webhook' : (currentGoogleSheetUrl ? 'link' : 'file')
  ); // 'file', 'paste', 'link', 'webhook'

  const [sheetUrl, setSheetUrl] = useState(currentGoogleSheetUrl || '');
  const [webhookUrl, setWebhookUrl] = useState(currentGoogleSheetWebhookUrl || '');
  const [pastedData, setPastedData] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const modalFileInputRef = useRef(null);

  useEffect(() => {
    setSheetUrl(currentGoogleSheetUrl || '');
    setWebhookUrl(currentGoogleSheetWebhookUrl || '');
  }, [currentGoogleSheetUrl, currentGoogleSheetWebhookUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

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

  const handleFetchUrl = async (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) {
      setError('Por favor, insira o link da sua planilha.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
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

  // Testar conexão com o Google Apps Script Webhook
  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setError('Insira a URL do Webhook do Google Apps Script para testar.');
      return;
    }
    setTestingWebhook(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/test-google-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          webhookUrl: webhookUrl.trim(),
          hospitalId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao testar conexão com o Webhook.');
      }
      setSuccessMsg('✅ Conexão validada com sucesso! A planilha do Google respondeu e está pronta para receber calibrações em tempo real.');
    } catch (err) {
      setError(`Erro no teste do Webhook: ${err.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  // Salvar configuração do Webhook
  const handleSaveWebhook = async (e) => {
    if (e) e.preventDefault();
    if (!webhookUrl.trim()) {
      setError('Por favor, insira a URL do Webhook antes de salvar.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/save-google-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          webhookUrl: webhookUrl.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao salvar Webhook.');
      }
      if (onSaveGoogleWebhook) {
        onSaveGoogleWebhook(webhookUrl.trim());
      }
      setSuccessMsg('🎉 Webhook salvo com sucesso! A partir de agora, toda calibração feita pelos técnicos atualizará a planilha do Google instantaneamente.');
    } catch (err) {
      setError(`Erro ao salvar Webhook: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Gravar todas as calibrações atuais na planilha Google
  const handlePushAllToGoogleSheet = async () => {
    const targetUrl = webhookUrl.trim() || currentGoogleSheetWebhookUrl;
    if (!targetUrl) {
      setError('Salve a URL do Webhook primeiro para poder gravar os dados.');
      return;
    }

    if (!window.confirm('Deseja gravar todas as calibrações e status atuais na planilha do Google agora?')) {
      return;
    }

    setPushingAll(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/push-all-to-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          planId,
          webhookUrl: targetUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao gravar calibrações na planilha.');
      }
      setSuccessMsg(`🚀 ${data.message || 'Equipamentos gravados com sucesso na planilha Google!'}`);
      if (onSaveGoogleWebhook) {
        onSaveGoogleWebhook(targetUrl);
      }
    } catch (err) {
      setError(`Erro ao gravar na planilha: ${err.message}`);
    } finally {
      setPushingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Integração Google Sheets
                {currentGoogleSheetWebhookUrl && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Bidirecional Ativa
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Importação, leitura e gravação bidirecional em tempo real</p>
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('webhook'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'webhook'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
            Gravação no Google Sheets ⚡
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('link'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'link'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Link da Planilha
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('file'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
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
            onClick={() => { setActiveTab('paste'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'paste'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Copiar e Colar
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

          {/* TAB 4: GRAVAÇÃO BIDIRECIONAL GOOGLE SHEETS */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              {/* Card de Explicação */}
              <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-white text-sm">
                    Sincronização Bidirecional (Gravar no Google Sheets)
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Por padrão de segurança do Google, um link comum de visualização permite apenas <strong>leitura externa</strong>. Para que o CalibraCheck <strong>grave os IDECs conferidos diretamente na sua planilha</strong> em tempo real, conecte o Script Webhook abaixo (leva apenas 30 segundos e é 100% gratuito)!
                </p>
              </div>

              {/* Esclarecimento sobre Link de Editor Público */}
              <div className="bg-amber-950/25 border border-amber-500/30 rounded-2xl p-3.5 space-y-1.5 text-xs text-amber-200">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  Por que mesmo com o link de "Editor Público" a planilha não altera sozinha?
                </p>
                <p className="leading-relaxed text-amber-200/90">
                  A permissão de "Editor" do Google Drive é exclusiva para <strong>pessoas físicas no navegador</strong>. A infraestrutura do Google <strong>bloqueia qualquer software ou servidor externo</strong> de alterar células diretamente por link sem um canal autorizado. O <strong>Agente do CalibraCheck</strong> resolve isso ativando essa ponte oficial do Google abaixo para gravar tudo em tempo real!
                </p>
              </div>

              {/* Passo a Passo em 4 Etapas */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Como ativar em 4 passos rápidos:
                </h5>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">1</span>
                    <span className="leading-relaxed">Na sua planilha aberta no Google Sheets, clique no menu <strong>Extensões</strong> ➔ <strong>Apps Script</strong>.</span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">2</span>
                    <div className="flex-1 space-y-1.5">
                      <span className="leading-relaxed block">Apague o código que estiver lá e cole o nosso script de integração:</span>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                          copiedCode 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCode ? 'Código Copiado com Sucesso!' : 'Copiar Código do Apps Script (1 Clique)'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">3</span>
                    <span className="leading-relaxed">
                      Clique no ícone de <strong>Salvar (Disquete)</strong> ➔ No topo direito, clique em <strong>Implantar</strong> ➔ <strong>Nova Implantação</strong> ➔ Tipo: <strong>App da Web</strong> ➔ Em <em>Quem pode acessar</em> selecione <strong>Qualquer pessoa</strong> ➔ Clique em <strong>Implantar</strong>.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">4</span>
                    <span className="leading-relaxed">Copie a URL do App da Web gerada (termina em <code>/exec</code>) e cole no campo abaixo!</span>
                  </div>
                </div>
              </div>

              {/* Formulário de URL do Webhook */}
              <form onSubmit={handleSaveWebhook} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>URL do Webhook do Google Apps Script (terminada em /exec):</span>
                    {currentGoogleSheetWebhookUrl && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Configurado
                      </span>
                    )}
                  </label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !webhookUrl.trim()}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingWebhook ? 'animate-spin' : ''}`} />
                    {testingWebhook ? 'Testando Conexão...' : 'Testar Conexão com Google'}
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !webhookUrl.trim()}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-emerald-600/30"
                  >
                    {loading ? 'Salvando...' : 'Salvar Webhook de Gravação'}
                    {!loading && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </form>

              {/* Botão de Envio em Lote / Push All */}
              {equipments.length > 0 && (
                <div className="bg-slate-950/80 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                        Gravação Imediata em Lote
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        {equipments.length} equipamentos no plano atual ({equipments.filter(e => e.checado || e.check_calibracao).length} conferidos)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePushAllToGoogleSheet}
                      disabled={pushingAll || (!webhookUrl.trim() && !currentGoogleSheetWebhookUrl)}
                      className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${pushingAll ? 'animate-spin' : ''}`} />
                      {pushingAll ? 'Gravando no Google...' : 'Gravar Calibrações na Planilha Google Agora'}
                    </button>
                  </div>
                </div>
              )}
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
                  1. Na sua planilha aberta no navegador, clique em <strong>Arquivo</strong>.<br />
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
                    Leitura Ativa
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

              {/* Callout de alerta sobre gravação bidirecional */}
              <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3.5 text-xs text-blue-200 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-blue-100">Deseja que os IDECs calibrados alterem a planilha do Google?</p>
                  <p className="text-blue-300/90 leading-relaxed">
                    O link do Google Sheets importa e lê os dados. Para habilitar a <strong>gravação bidirecional em tempo real</strong> (marcar como calibrado direto nas células do Google), acesse a aba <strong>Gravação no Google Sheets ⚡</strong>!
                  </p>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 space-y-2 text-xs text-emerald-200">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sincronização em Tempo Real (Link Ativo):
                </p>
                <p className="leading-relaxed text-emerald-200/90">
                  Ao vincular o link, qualquer alteração que a equipe fizer na planilha do Google (novas linhas, troca de setores ou anotações) será <strong>atualizada automaticamente no sistema</strong> a cada 25 segundos, sem perder as bipagens já feitas pelos técnicos!
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
