import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles, 
  Apple, 
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Check,
  AlertTriangle,
  FolderDown,
  Layers,
  Zap
} from 'lucide-react';

export default function InstallPromptModal({ isOpen, onClose, deferredPrompt }) {
  const [platform, setPlatform] = useState('android'); // 'android' | 'ios'
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [showChromeGuide, setShowChromeGuide] = useState(false);

  useEffect(() => {
    const userAgent = (window.navigator?.userAgent || '').toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    if (isIos) {
      setPlatform('ios');
    } else {
      setPlatform('android');
    }
  }, []);

  // Detecta se está rodando dentro do WebView de apps (ex: WhatsApp, Instagram)
  const isInAppBrowser = useMemo(() => {
    const ua = (window.navigator?.userAgent || '').toLowerCase();
    return /whatsapp|instagram|fbav|fban|line|micromessenger|telegram|wv/.test(ua);
  }, []);

  // Download do arquivo APK compilado nativo (2.2 MB)
  const handleDownloadApk = () => {
    setDownloadStarted(true);
    const link = document.createElement('a');
    link.href = '/download/apk';
    link.download = 'CalibraCheck.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Instalação via PWA no Chrome
  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          onClose();
        }
      } catch (err) {
        setShowChromeGuide(true);
      }
    } else {
      setShowChromeGuide(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scale-in text-slate-100 max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-slate-900 to-blue-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Instalar Aplicativo
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                  APK Ativo
                </span>
              </h3>
              <p className="text-xs text-slate-400">Instale no celular para uso rápido em campo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* In-App Browser Warning (WhatsApp / Instagram) */}
        {isInAppBrowser && (
          <div className="px-5 py-3 bg-amber-950/40 border-b border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-300 font-bold mb-0.5">Aberto pelo WhatsApp ou Instagram?</strong>
              Para instalar sem erros, toque nos <strong>3 pontinhos (⋮)</strong> no topo do WhatsApp e escolha <strong>"Abrir no Chrome"</strong> ou baixe o APK direto abaixo.
            </div>
          </div>
        )}

        {/* Platform Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              platform === 'android'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Android (APK & Chrome)
          </button>
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
              platform === 'ios'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            iPhone / iPad (iOS Safari)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {platform === 'android' ? (
            <div className="space-y-4">

              {/* OPÇÃO 1: BAIXAR APK DIRETO (MÉTODO RECOMENDADO) */}
              <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg shadow-emerald-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-emerald-400" />
                    Opção 1 (Recomendada): Baixar Instalador APK
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    2.2 MB • Oficial
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Baixe o instalador oficial do <strong>CalibraCheck</strong> direto no seu celular. Funciona em qualquer smartphone Android, com câmera e leitor de código de barras 100% integrados.
                </p>

                {/* Botão Principal de Download do APK */}
                <button
                  type="button"
                  onClick={handleDownloadApk}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-extrabold shadow-md shadow-emerald-500/25 transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5 animate-bounce" />
                  <span>Baixar CalibraCheck.apk (2.2 MB)</span>
                </button>

                {downloadStarted && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Download iniciado! Verifique a barra de notificações do celular.</span>
                  </div>
                )}

                {/* Passo a Passo de Instalação do APK */}
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <span className="font-bold text-slate-300 block">Passo a passo rápido após baixar:</span>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Se o Android exibir <em>"O arquivo pode ser nocivo"</em>, toque em <strong>Fazer o download mesmo assim</strong> (aviso padrão do Google para qualquer APK fora da Play Store).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Abra o arquivo baixado <strong>CalibraCheck.apk</strong> nas notificações ou na pasta <strong>Downloads</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                    <span>Toque em <strong>Instalar</strong> (se pedir, habilite "Permitir desta fonte"). Pronto! O ícone oficial fica na sua tela inicial!</span>
                  </div>
                </div>
              </div>

              {/* OPÇÃO 2: INSTALAÇÃO DIRETA VIA GOOGLE CHROME (SEM BAIXAR ARQUIVO) */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    Opção 2: Instalar direto pelo Chrome (Sem baixar arquivo)
                  </span>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Adiciona o aplicativo como WebApp nativo diretamente pelo Google Chrome.
                </p>

                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span>Instalar via Navegador Chrome</span>
                </button>

                {showChromeGuide && (
                  <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl space-y-1 text-[11px] text-blue-200">
                    <p className="font-bold">Para instalar pelo Chrome:</p>
                    <p>1. Toque nos <strong>3 pontinhos verticais (⋮)</strong> no canto superior direito do Chrome.</p>
                    <p>2. Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* GUIA IPHONE / IPAD */
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                <p className="font-bold text-white text-sm flex items-center gap-2">
                  <Apple className="w-4 h-4 text-blue-400" />
                  Como instalar no iPhone / iPad (Safari):
                </p>
                
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    No navegador <strong>Safari</strong> do iPhone, toque no botão <strong>Compartilhar</strong> (ícone de um quadrado com uma seta para cima <Share className="w-3.5 h-3.5 inline text-blue-400" />) na barra inferior.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Role as opções para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-blue-400" />).
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! O app fica na sua tela inicial como um aplicativo nativo em tela cheia.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Versão 1.0.0 • Digiclintec Metrologia
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
