import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles, 
  Apple, 
  ExternalLink 
} from 'lucide-react';

export default function InstallPromptModal({ isOpen, onClose, deferredPrompt }) {
  const [platform, setPlatform] = useState('android'); // 'android' | 'ios'

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    if (isIos) {
      setPlatform('ios');
    } else {
      setPlatform('android');
    }
  }, []);

  const handleInstallAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      }
      onClose();
    } else {
      // If prompt already dismissed or not available yet in browser
      alert(
        'Para instalar no seu Android:\n1. Toque nos 3 pontinhos (⋮) do Chrome no topo à direita.\n2. Escolha "Instalar aplicativo" ou "Adicionar à tela inicial".'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Baixar App no Celular</h3>
              <p className="text-xs text-slate-400">Instalação Direta • Android & iOS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
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
            Android (Google Chrome)
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
            iPhone / iPad (Safari)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {platform === 'android' ? (
            <div className="space-y-4">
              <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-4 text-xs text-emerald-200/90 leading-relaxed space-y-2">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Instalação Oficial Android (PWA / WebAPK)
                </div>
                <p>
                  O aplicativo é baixado diretamente para a gaveta de apps do seu Android, sem precisar da Play Store.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                  <li>Funciona em tela cheia (sem barra de navegador).</li>
                  <li>Acesso direto à câmera com leitor de código de barras.</li>
                  <li>Ícone de alta resolução na tela inicial.</li>
                </ul>
              </div>

              <button
                onClick={handleInstallAndroid}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/25 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Aplicativo no Android
              </button>

              <div className="text-center">
                <p className="text-[11px] text-slate-400">
                  Ou no Chrome: clique nos <strong>3 pontinhos (⋮)</strong> no topo e escolha <strong>"Instalar aplicativo"</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="font-bold text-white text-sm">Como instalar no iPhone (Safari):</p>
                
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <p className="leading-relaxed">
                    No navegador <strong>Safari</strong> do iPhone, toque no botão <strong>Compartilhar</strong> (ícone de um quadrado com uma seta para cima <Share className="w-3.5 h-3.5 inline text-blue-400" />) na barra inferior.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <p className="leading-relaxed">
                    Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-blue-400" />).
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <p className="leading-relaxed">
                    Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! O app fica na sua tela inicial como um aplicativo nativo.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Entendi
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

