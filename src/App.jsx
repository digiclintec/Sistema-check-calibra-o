import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  X,
  FileText,
  Users,
  Wifi
} from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import StatsCards from './components/StatsCards';
import EquipmentTable from './components/EquipmentTable';
import ScannerModal from './components/ScannerModal';
import GoogleSheetsModal from './components/GoogleSheetsModal';
import MasterPanelModal from './components/MasterPanelModal';
import InstallPromptModal from './components/InstallPromptModal';
import MobileBottomBar from './components/MobileBottomBar';

import { parseSpreadsheetFile, exportToExcel } from './utils/sheetParser';
import { SAMPLE_EQUIPMENT } from './utils/sampleData';
import { playSuccessSound, playWarningSound, playErrorSound } from './utils/audio';

export default function App() {
  // LocalStorage keys
  const STORAGE_KEY = 'calibracheck_data_v1';
  const SOUND_KEY = 'calibracheck_sound_enabled';
  const SHEET_NAME_KEY = 'calibracheck_sheet_name';
  const USER_KEY = 'calibracheck_user_v1';

  // User session state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Equipments state
  const [equipments, setEquipments] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeSheetName, setActiveSheetName] = useState(() => {
    return localStorage.getItem(SHEET_NAME_KEY) || '';
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  });

  // UI state
  const [activeFilter, setActiveFilter] = useState('todos');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isMasterPanelOpen, setIsMasterPanelOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [lastScannedId, setLastScannedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const fileInputRef = useRef(null);
  const lastUpdatedServerRef = useRef(0);
  const broadcastChannelRef = useRef(null);

  // Cross-tab broadcast channel
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('calibracheck_sync');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'STATE_UPDATE') {
          setEquipments(payload.equipments || []);
          if (payload.activeSheetName) setActiveSheetName(payload.activeSheetName);
          if (payload.lastAction) {
            showToast('info', payload.lastAction);
          }
        }
      };

      return () => channel.close();
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(equipments));
      localStorage.setItem(SHEET_NAME_KEY, activeSheetName);
    } catch (e) {
      console.warn('Storage quota exceeded:', e);
    }
  }, [equipments, activeSheetName]);

  // Capture Android PWA beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleCycleFilter = () => {
    const sequence = ['todos', 'pendentes', 'checados', 'vencidos'];
    const nextIdx = (sequence.indexOf(activeFilter) + 1) % sequence.length;
    setActiveFilter(sequence[nextIdx]);
  };

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  // Sync with Server API (Shared real-time state for everyone logged in with the same password)
  const syncWithServer = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.lastUpdated && data.lastUpdated > lastUpdatedServerRef.current) {
        lastUpdatedServerRef.current = data.lastUpdated;
        
        // If server data differs, update local state
        if (data.equipments && data.equipments.length >= 0) {
          setEquipments(data.equipments);
          if (data.activeSheetName) {
            setActiveSheetName(data.activeSheetName);
          }
        }
      }
    } catch (err) {
      // Offline fallback silent
    }
  };

  // Poll server every 2.5s for changes made by other users/devices
  useEffect(() => {
    if (!currentUser) return;
    syncWithServer(); // Initial fetch
    const interval = setInterval(syncWithServer, 2500);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Push full update to server & broadcast
  const pushServerUpdate = async (newEquipments, sheetName, actionDesc) => {
    // 1. Update local state immediately
    setEquipments(newEquipments);
    if (sheetName !== undefined) setActiveSheetName(sheetName);

    // 2. Broadcast to other tabs on same machine
    broadcastChannelRef.current?.postMessage({
      type: 'STATE_UPDATE',
      payload: {
        equipments: newEquipments,
        activeSheetName: sheetName || activeSheetName,
        lastAction: actionDesc
      }
    });

    // 3. Post to backend server for other devices on the network
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipments: newEquipments,
          activeSheetName: sheetName || activeSheetName,
          userEmail: currentUser?.email
        })
      });
      const data = await res.json();
      if (data.success && data.lastUpdated) {
        lastUpdatedServerRef.current = data.lastUpdated;
      }
    } catch (err) {
      console.warn('API sync offline:', err);
    }
  };

  // Hardware Barcode Scanner listener (USB/Bluetooth Gun)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      if (!currentUser) return;
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          handleScanCode(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1) {
        if (diff > 150) {
          buffer = '';
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [equipments, soundEnabled, currentUser]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = equipments.length;
    const checked = equipments.filter(e => e.checado).length;
    const pending = total - checked;
    
    let expired = 0;
    let expiringSoon = 0;

    equipments.forEach(e => {
      const s = String(e.statusCalibracao || '').toLowerCase();
      if (s.includes('vencid')) {
        expired++;
      } else if (s.includes('a vencer') || s.includes('alerta') || s.includes('proximo')) {
        expiringSoon++;
      }
    });

    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { total, checked, pending, expired, expiringSoon, percent };
  }, [equipments]);

  // Check if 100% finished to trigger celebratory confetti
  const prevCheckedRef = useRef(stats.checked);
  useEffect(() => {
    if (stats.total > 0 && stats.checked === stats.total && prevCheckedRef.current < stats.total) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      showToast('success', '🎉 Parabéns! Todos os equipamentos foram conferidos com sucesso!');
    }
    prevCheckedRef.current = stats.checked;
  }, [stats.checked, stats.total]);

  // Toggle item check status
  const handleToggleCheck = async (id) => {
    const target = equipments.find(e => e.id === id || e.codigoBarras === id);
    if (!target) return;

    const nextState = !target.checado;
    const updatedList = equipments.map(item => {
      if (item.id === id || item.codigoBarras === id) {
        return {
          ...item,
          checado: nextState,
          dataCheck: nextState ? new Date().toISOString() : null,
          conferidoPor: nextState ? currentUser?.email : null
        };
      }
      return item;
    });

    // Notify server via API
    try {
      fetch('/api/toggle-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userEmail: currentUser?.email })
      }).then(res => res.json()).then(data => {
        if (data.success && data.lastUpdated) {
          lastUpdatedServerRef.current = data.lastUpdated;
        }
      }).catch(() => {});
    } catch (e) {}

    await pushServerUpdate(
      updatedList, 
      activeSheetName, 
      `${target.equipamento} foi ${nextState ? 'checado' : 'desmarcado'}`
    );
  };

  // Main barcode lookup & check logic
  const handleScanCode = async (code) => {
    if (!code || !equipments || equipments.length === 0) {
      if (soundEnabled) playErrorSound();
      showToast('error', 'Nenhuma planilha carregada ainda. Suba um arquivo para começar.');
      return { status: 'not_found', message: 'Nenhuma planilha carregada' };
    }

    const clean = code.trim().toLowerCase();

    const foundIndex = equipments.findIndex(e => {
      const b = String(e.codigoBarras || '').trim().toLowerCase();
      const t = String(e.tag || '').trim().toLowerCase();
      const id = String(e.id || '').trim().toLowerCase();
      const s = String(e.serie || '').trim().toLowerCase();
      return b === clean || t === clean || id === clean || s === clean;
    });

    if (foundIndex === -1) {
      if (soundEnabled) playErrorSound();
      showToast('error', `Aparelho não encontrado para o código: "${code}"`);
      return {
        status: 'not_found',
        message: `Não encontrado na planilha: ${code}`
      };
    }

    const targetItem = equipments[foundIndex];
    setLastScannedId(targetItem.id);

    if (targetItem.checado) {
      if (soundEnabled) playWarningSound();
      showToast('warning', `Equipamento já estava checado: ${targetItem.equipamento} (${targetItem.tag})`);
      return {
        status: 'already_checked',
        equipment: targetItem,
        message: `Já estava conferido: ${targetItem.equipamento}`
      };
    }

    // Mark as checked!
    if (soundEnabled) playSuccessSound();

    const updated = [...equipments];
    updated[foundIndex] = {
      ...updated[foundIndex],
      checado: true,
      dataCheck: new Date().toISOString(),
      conferidoPor: currentUser?.email
    };

    // Fast local update
    setEquipments(updated);
    showToast('success', `Check confirmado: ${targetItem.equipamento} (${targetItem.tag})`);

    // Sync to server & tabs
    await pushServerUpdate(updated, activeSheetName, `Check: ${targetItem.equipamento}`);

    return {
      status: 'found',
      equipment: targetItem,
      message: `Check OK: ${targetItem.equipamento}`
    };
  };

  // Handle file selection (.xlsx, .xls, .csv)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const processFile = async (file) => {
    try {
      const result = await parseSpreadsheetFile(file);
      await pushServerUpdate(result.equipments, result.fileName, `Nova planilha carregada: ${result.fileName}`);
      showToast('success', `Planilha "${result.fileName}" carregada com ${result.total} equipamentos!`);
    } catch (err) {
      console.error(err);
      showToast('error', `Erro ao ler planilha: ${err.message}`);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Handle Google Sheets Data import
  const handleGoogleDataImport = async (data) => {
    await pushServerUpdate(data.equipments, data.fileName, 'Planilha importada');
    showToast('success', `Planilha importada com ${data.total} equipamentos!`);
  };

  // Load sample data
  const handleLoadSample = async () => {
    await pushServerUpdate(SAMPLE_EQUIPMENT, 'Exemplo_Calibracao_Padrao.xlsx', 'Exemplo carregado');
    showToast('success', '10 equipamentos de exemplo carregados para teste imediato!');
  };

  // Reset / Clear all data
  const handleResetData = async () => {
    if (window.confirm('Deseja limpar todos os dados da planilha atual para todos os usuários?')) {
      await pushServerUpdate([], '', 'Planilha limpa');
      try {
        await fetch('/api/reset', { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SHEET_NAME_KEY);
      showToast('warning', 'Dados resetados com sucesso.');
    }
  };

  // Export back to Excel
  const handleExport = () => {
    if (equipments.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const baseName = activeSheetName ? activeSheetName.replace(/\.[^/.]+$/, "") : "calibracao";
    const fileName = `${baseName}_conferido_${dateStr}.xlsx`;
    exportToExcel(equipments, fileName);
    showToast('success', `Arquivo "${fileName}" baixado com sucesso!`);
  };

  // Login handler
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
    showToast('success', `Bem-vindo, ${user.name || user.email}!`);
  };

  // Logout handler
  const handleLogout = () => {
    if (window.confirm('Deseja realmente sair da sua conta?')) {
      setCurrentUser(null);
      localStorage.removeItem(USER_KEY);
      showToast('info', 'Você saiu do sistema.');
    }
  };

  // If user is not logged in, show Login Screen!
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center animate-in fade-in duration-150">
          <Upload className="w-16 h-16 mb-4 animate-bounce" />
          <h2 className="text-3xl font-extrabold mb-2">Solte sua planilha crua aqui</h2>
          <p className="text-blue-100 text-sm">Formatos aceitos: .xlsx, .xls ou .csv</p>
        </div>
      )}

      {/* Toast Notification Bar */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in slide-in-from-bottom duration-200">
          <div className={`p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold border ${
            toast.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : toast.type === 'info'
              ? 'bg-slate-800 text-white border-slate-700'
              : 'bg-emerald-600 text-white border-emerald-700'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar with User Profile & Logout */}
      <Navbar
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onExportExcel={handleExport}
        hasData={equipments.length > 0}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenMasterPanel={() => setIsMasterPanelOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {equipments.length === 0 ? (
          /* Empty / Welcome State */
          <HeroBanner
            onOpenFilePicker={() => fileInputRef.current?.click()}
            onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
            onLoadSample={handleLoadSample}
            onDropFile={processFile}
          />
        ) : (
          /* Active Spreadsheet View */
          <div className="space-y-6">
            
            {/* Active File Header info & live sync indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/50">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      {activeSheetName || 'Planilha Compartilhada'}
                    </h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                      {equipments.length} itens
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Tempo Real
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sincronizado entre todos os aparelhos conectados com o login Digiclintec.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Excel Atualizado</span>
                </button>

                <button
                  onClick={handleResetData}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  title="Trocar ou Limpar Planilha"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats Cards & Progress */}
            <StatsCards
              stats={stats}
              activeFilter={activeFilter}
              onSelectFilter={setActiveFilter}
            />

            {/* Equipment Table with Search & Scanner Bar */}
            <EquipmentTable
              equipments={equipments}
              onToggleCheck={handleToggleCheck}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              onQuickScanCode={handleScanCode}
              lastScannedId={lastScannedId}
            />

          </div>
        )}

      </main>

      {/* Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanCode}
        soundEnabled={soundEnabled}
      />

      {/* Google Sheets / File Import Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onImportData={handleGoogleDataImport}
      />

      {/* Master User Management Panel */}
      <MasterPanelModal
        isOpen={isMasterPanelOpen}
        onClose={() => setIsMasterPanelOpen(false)}
        currentUser={currentUser}
      />

      {/* PWA Android / iOS Install Modal */}
      <InstallPromptModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
      />

      {/* Floating Mobile Bottom Action Bar (Thumb-friendly for Android & iOS) */}
      <MobileBottomBar
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        activeFilter={activeFilter}
        onCycleFilter={handleCycleFilter}
        checkedCount={stats.checked}
        totalCount={stats.total}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-500">
        <p>CalibraCheck • Digiclintec Metrologia Hospitalar & Industrial</p>
      </footer>
    </div>
  );
}
