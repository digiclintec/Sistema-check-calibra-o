import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Wifi,
  Building2,
  Crown
} from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import StatsCards from './components/StatsCards';
import EquipmentTable from './components/EquipmentTable';
import ScannerModal from './components/ScannerModal';
import GoogleSheetsModal from './components/GoogleSheetsModal';
import MasterPanelModal from './components/MasterPanelModal';
import HospitalModal from './components/HospitalModal';
import InstallPromptModal from './components/InstallPromptModal';
import MobileBottomBar from './components/MobileBottomBar';
import TeamManagementModal from './components/TeamManagementModal';
import MonthlyPlanningTab from './components/MonthlyPlanningTab';
import SerialScanModal from './components/SerialScanModal';
import MassActionPasswordModal from './components/MassActionPasswordModal';
import SmartBatchModal from './components/SmartBatchModal';
import SpreadsheetAuditView from './components/SpreadsheetAuditView';
import SheetServicesConfigModal from './components/SheetServicesConfigModal';
import ManualCheckPasswordModal from './components/ManualCheckPasswordModal';
import ModalityBar from './components/ModalityBar';

import { parseSpreadsheetFile, exportToExcel } from './utils/sheetParser';
import { SAMPLE_EQUIPMENT } from './utils/sampleData';
import { playSuccessSound, playWarningSound, playErrorSound } from './utils/audio';
import { findBestEquipmentMatches } from './utils/fuzzyMatch';
import { MODALITIES, normalizeEquipmentModalities, isEquipmentChecked, isEquipmentFullyChecked } from './utils/modalities';

export default function App() {
  // LocalStorage keys
  const STORAGE_KEY = 'calibracheck_data_v1';
  const SOUND_KEY = 'calibracheck_sound_enabled';
  const SHEET_NAME_KEY = 'calibracheck_sheet_name';
  const USER_KEY = 'calibracheck_user_v1';
  const HOSP_KEY = 'calibracheck_active_hosp_v1';
  const MODALITY_KEY = 'calibracheck_work_modality_v1';

  // Modalidade de Serviço / Equipe Ativa (Calibração, Preventiva, Segurança Elétrica, Visão Geral)
  const [activeModality, setActiveModality] = useState(() => {
    return localStorage.getItem(MODALITY_KEY) || 'calibracao';
  });

  // User session state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';

  // Multi-Hospital SaaS state
  const [hospitals, setHospitals] = useState([]);
  const [activeHospitalId, setActiveHospitalId] = useState(() => {
    return localStorage.getItem(HOSP_KEY) || 'hosp_central';
  });

  // Equipments state
  const [equipments, setEquipments] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normalizeEquipmentModalities) : [];
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
  const [activeMainTab, setActiveMainTab] = useState('conferencia'); // 'conferencia' | 'planejamento'
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSerialScanOpen, setIsSerialScanOpen] = useState(false);
  const [massActionModal, setMassActionModal] = useState({ isOpen: false, action: 'check_all' });
  const [manualCheckModal, setManualCheckModal] = useState({ isOpen: false, equipment: null, modality: 'calibracao', nextState: true });
  const PIN_AUTH_KEY = 'calibracheck_pin_auth_until';
  const [pinAuthorizedUntil, setPinAuthorizedUntil] = useState(() => {
    try {
      const saved = sessionStorage.getItem(PIN_AUTH_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isMasterPanelOpen, setIsMasterPanelOpen] = useState(false);
  const [hospitalModal, setHospitalModal] = useState({ isOpen: false, initialTab: 'create' });
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [serviceConfig, setServiceConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(`calibracheck_service_config_${activeHospitalId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      enableCalibracao: true,
      enablePreventiva: true,
      enableSeguranca: true,
      executionMode: 'separated' // 'all_at_once' | 'separated'
    };
  });
  const [serviceConfigModal, setServiceConfigModal] = useState({ isOpen: false, isInitialSetup: false });

  const handleSaveServiceConfig = async (newConfig) => {
    setServiceConfig(newConfig);
    try {
      localStorage.setItem(`calibracheck_service_config_${activeHospitalId}`, JSON.stringify(newConfig));
      await fetch('/api/service-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId: activeHospitalId, serviceConfig: newConfig })
      });
    } catch (e) {}
    showToast('success', `Opções atualizadas: ${newConfig.executionMode === 'all_at_once' ? '⚡ Bipar Tudo de Uma Vez' : '🎯 Bipar Separado'}`);
  };
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [lastScannedId, setLastScannedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const fileInputRef = useRef(null);
  const lastUpdatedServerRef = useRef(0);
  const broadcastChannelRef = useRef(null);

  // Available hospitals allowed for the current logged-in user
  const availableHospitals = useMemo(() => {
    if (!currentUser) return hospitals;
    const isMasterUser = currentUser.role === 'master' || currentUser.email?.toLowerCase() === 'digiclintec@gmail.com';
    if (isMasterUser) return hospitals;

    const userHospIds = Array.isArray(currentUser.hospitalIds) && currentUser.hospitalIds.length > 0
      ? currentUser.hospitalIds
      : [currentUser.hospitalId || 'all'];

    if (userHospIds.includes('all')) return hospitals;

    const filtered = hospitals.filter(h => userHospIds.includes(h.id));
    return filtered.length > 0 ? filtered : hospitals;
  }, [hospitals, currentUser]);

  // Active hospital helper
  const activeHospital = useMemo(() => {
    return availableHospitals.find(h => h.id === activeHospitalId) || availableHospitals[0] || hospitals[0] || {
      id: activeHospitalId,
      name: 'Hospital Central - Digiclintec',
      plano: 'enterprise'
    };
  }, [availableHospitals, hospitals, activeHospitalId]);

  // Ensure active hospital is valid for current user
  useEffect(() => {
    if (availableHospitals.length > 0 && !availableHospitals.some(h => h.id === activeHospitalId)) {
      const fallbackId = availableHospitals[0].id;
      setActiveHospitalId(fallbackId);
      try {
        localStorage.setItem(HOSP_KEY, fallbackId);
      } catch (e) {}
    }
  }, [availableHospitals, activeHospitalId]);

  // Load hospitals from server
  const loadHospitals = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/hospitals');
      const data = await res.json();
      if (data.success && data.hospitals) {
        setHospitals(data.hospitals);
        if (data.activeHospitalId && !localStorage.getItem(HOSP_KEY)) {
          setActiveHospitalId(data.activeHospitalId);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar hospitais:', e);
    }
  }, [currentUser]);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  // Load monthly calibration plans for active hospital
  const loadMonthlyPlans = useCallback(async (hospId = activeHospitalId) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/plans?hospitalId=${encodeURIComponent(hospId)}`);
      const data = await res.json();
      if (data.success && data.plans) {
        setMonthlyPlans(data.plans);
        if (data.activePlanId) {
          setActivePlanId(data.activePlanId);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar planejamentos mensais:', e);
    }
  }, [currentUser, activeHospitalId]);

  useEffect(() => {
    loadMonthlyPlans(activeHospitalId);
  }, [loadMonthlyPlans, activeHospitalId]);

  // Switch active monthly plan
  const handleSwitchPlan = async (planId) => {
    try {
      const res = await fetch('/api/plans/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          planId
        })
      });
      const data = await res.json();
      if (data.success) {
        setActivePlanId(planId);
        setEquipments(data.equipments || []);
        if (data.activeSheetName) setActiveSheetName(data.activeSheetName);
        setActiveMainTab('conferencia');
        showToast('success', `Planilha "${data.planTitle || planId}" ativada para validação!`);
        loadMonthlyPlans(activeHospitalId);
      } else {
        showToast('error', data.message || 'Erro ao alternar planilha.');
      }
    } catch (err) {
      showToast('error', 'Erro de conexão ao ativar plano.');
    }
  };

  // Create new monthly plan
  const handleCreatePlan = async (planData) => {
    try {
      const res = await fetch('/api/plans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          title: planData.title,
          mes: planData.mes,
          fileName: planData.fileName,
          equipments: planData.equipments,
          userEmail: currentUser?.email,
          userName: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setActivePlanId(data.plan.id);
        setEquipments(data.plan.equipments || []);
        setActiveSheetName(data.plan.title);
        setActiveMainTab('conferencia');
        showToast('success', `Plano "${data.plan.title}" criado com ${data.plan.equipments?.length || 0} equipamentos!`);
        loadMonthlyPlans(activeHospitalId);
        loadHospitals();
      } else {
        showToast('error', data.message || 'Erro ao criar plano.');
      }
    } catch (err) {
      showToast('error', 'Falha ao salvar planejamento.');
    }
  };

  // Delete monthly plan
  const handleDeletePlan = async (planId, planTitle) => {
    if (!window.confirm(`Tem certeza que deseja excluir a planilha "${planTitle}"?`)) return;
    try {
      const res = await fetch('/api/plans/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          planId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('info', `Planilha "${planTitle}" removida.`);
        loadMonthlyPlans(activeHospitalId);
        loadHospitals();
      } else {
        showToast('error', data.message || 'Erro ao excluir plano.');
      }
    } catch (err) {
      showToast('error', 'Falha ao excluir plano.');
    }
  };

  // Switch hospital
  const handleSwitchHospital = async (hospId) => {
    setActiveHospitalId(hospId);
    localStorage.setItem(HOSP_KEY, hospId);
    lastUpdatedServerRef.current = 0; // force reload

    try {
      await fetch('/api/hospitals/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hospId })
      });
    } catch (e) {}

    // Fetch hospital data immediately
    try {
      const res = await fetch(`/api/data?hospitalId=${hospId}`);
      const data = await res.json();
      if (data.success) {
        setEquipments(data.equipments || []);
        setActiveSheetName(data.activeSheetName || '');
        const target = hospitals.find(h => h.id === hospId);
        showToast('info', `Alternado para: ${target?.name || hospId}`);
      }
    } catch (e) {}
    loadMonthlyPlans(hospId);
  };

  // Update hospital plan
  const handleUpdateHospitalPlan = async (hospId, planId) => {
    const res = await fetch('/api/hospitals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: hospId, plano: planId })
    });
    const data = await res.json();
    if (data.success) {
      await loadHospitals();
      showToast('success', `Plano do hospital atualizado para ${planId.toUpperCase()}!`);
    } else {
      showToast('error', data.message || 'Erro ao alterar plano.');
    }
  };

  // Cross-tab broadcast channel
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('calibracheck_sync');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'STATE_UPDATE') {
          if (!payload.hospitalId || payload.hospitalId === activeHospitalId) {
            setEquipments((payload.equipments || []).map(normalizeEquipmentModalities));
            if (payload.activeSheetName !== undefined) setActiveSheetName(payload.activeSheetName);
            if (payload.lastAction) {
              showToast('info', payload.lastAction);
            }
          }
        }
      };

      return () => channel.close();
    }
  }, [activeHospitalId]);

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

  useEffect(() => {
    localStorage.setItem(MODALITY_KEY, activeModality);
  }, [activeModality]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  // Sync with Server API (Shared real-time state for hospital)
  const syncWithServer = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/data?hospitalId=${encodeURIComponent(activeHospitalId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.lastUpdated && data.lastUpdated > lastUpdatedServerRef.current) {
        lastUpdatedServerRef.current = data.lastUpdated;
        
        // If server data differs, update local state
        if (data.equipments && data.equipments.length >= 0) {
          setEquipments(data.equipments.map(normalizeEquipmentModalities));
          if (data.activeSheetName !== undefined) {
            setActiveSheetName(data.activeSheetName);
          }
        }
        if (data.serviceConfig) {
          setServiceConfig(data.serviceConfig);
        }
      }
    } catch (err) {
      // Offline fallback silent
    }
  }, [currentUser, activeHospitalId]);

  // Poll server every 2.5s for changes made by other users/devices
  useEffect(() => {
    if (!currentUser) return;
    syncWithServer();
    const interval = setInterval(syncWithServer, 2500);
    return () => clearInterval(interval);
  }, [currentUser, syncWithServer]);

  // Push full update to server & broadcast
  const pushServerUpdate = async (newEquipments, sheetName, actionDesc) => {
    setEquipments(newEquipments);
    if (sheetName !== undefined) setActiveSheetName(sheetName);

    // Broadcast to other tabs on same machine
    broadcastChannelRef.current?.postMessage({
      type: 'STATE_UPDATE',
      payload: {
        hospitalId: activeHospitalId,
        equipments: newEquipments,
        activeSheetName: sheetName !== undefined ? sheetName : activeSheetName,
        lastAction: actionDesc
      }
    });

    // Post to backend server
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          equipments: newEquipments,
          activeSheetName: sheetName !== undefined ? sheetName : activeSheetName,
          userEmail: currentUser?.email,
          userName: currentUser?.name
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
  }, [equipments, soundEnabled, currentUser, activeHospitalId]);

  // Statistics calculation baseada na modalidade / equipe ativa e configuração de serviços
  const stats = useMemo(() => {
    const total = equipments.length;
    const checked = equipments.filter(e => isEquipmentChecked(e, activeModality, serviceConfig)).length;
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
  }, [equipments, activeModality, serviceConfig]);

  // Confetti when 100% checked
  const prevCheckedRef = useRef(stats.checked);
  useEffect(() => {
    if (stats.total > 0 && stats.checked === stats.total && prevCheckedRef.current < stats.total) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      const modName = MODALITIES[activeModality]?.shortName || 'Equipe';
      showToast('success', `🎉 Parabéns! Todos os equipamentos do ${activeHospital?.name || 'hospital'} foram validados para [${modName}]!`);
    }
    prevCheckedRef.current = stats.checked;
  }, [stats.checked, stats.total, activeHospital?.name, activeModality]);

  // Executa alternância de status de check (interno / autorizado) com suporte ao modo combo
  const executeToggleCheck = async (id, targetModality = activeModality) => {
    const target = equipments.find(e => e.id === id || e.codigoBarras === id);
    if (!target) return;

    let targetMods = [];
    if (serviceConfig?.executionMode === 'all_at_once' && (targetModality === 'geral' || !targetModality)) {
      if (serviceConfig.enableCalibracao) targetMods.push('calibracao');
      if (serviceConfig.enablePreventiva) targetMods.push('preventiva');
      if (serviceConfig.enableSeguranca) targetMods.push('seguranca');
      if (targetMods.length === 0) targetMods = ['calibracao'];
    } else {
      const mod = targetModality === 'geral' ? 'calibracao' : targetModality;
      targetMods = [mod];
    }

    const allChecked = targetMods.every(m => isEquipmentChecked(target, m));
    const nextState = !allChecked;
    const inspector = currentUser?.name ? `${currentUser.name} (${currentUser.email})` : (currentUser?.email || 'Operador');
    const nowIso = new Date().toISOString();

    const updatedList = equipments.map(item => {
      if (item.id === id || item.codigoBarras === id) {
        const copy = { ...item };
        targetMods.forEach(m => {
          if (m === 'calibracao') {
            copy.check_calibracao = nextState;
            copy.data_calibracao = nextState ? nowIso : null;
            copy.usuario_calibracao = nextState ? inspector : null;
          } else if (m === 'preventiva') {
            copy.check_preventiva = nextState;
            copy.data_preventiva = nextState ? nowIso : null;
            copy.usuario_preventiva = nextState ? inspector : null;
          } else if (m === 'seguranca') {
            copy.check_seguranca = nextState;
            copy.data_seguranca = nextState ? nowIso : null;
            copy.usuario_seguranca = nextState ? inspector : null;
          }
        });

        copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca);
        copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || null;
        copy.conferidoPor = copy.usuario_calibracao || copy.usuario_preventiva || copy.usuario_seguranca || null;
        return copy;
      }
      return item;
    });

    setEquipments(updatedList);

    if (soundEnabled) {
      if (nextState) playSuccessSound();
      else playWarningSound();
    }

    try {
      targetMods.forEach(m => {
        fetch('/api/toggle-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            modality: m,
            hospitalId: activeHospitalId,
            userEmail: currentUser?.email,
            userName: currentUser?.name
          })
        }).then(res => res.json()).then(data => {
          if (data.success && data.lastUpdated) {
            lastUpdatedServerRef.current = data.lastUpdated;
          }
        }).catch(() => {});
      });
    } catch (e) {}

    const modLabels = targetMods.map(m => MODALITIES[m]?.shortName || m).join(' + ');
    await pushServerUpdate(
      updatedList, 
      activeSheetName, 
      `${target.equipamento} teve [${modLabels}] ${nextState ? 'confirmada' : 'desmarcada'}`
    );
  };

  // Toggle item check status disparado por clique manual na tela (tabelas e cards)
  // Requer senha simples de confirmação (1234) para evitar cliques acidentais
  const handleToggleCheck = async (id, targetModality = activeModality) => {
    const mod = targetModality === 'geral' ? 'calibracao' : targetModality;
    const target = equipments.find(e => e.id === id || e.codigoBarras === id);
    if (!target) return;

    // Se já estiver pré-autorizado na sessão (últimos 15 min), executa direto sem bloquear
    if (Date.now() < pinAuthorizedUntil) {
      await executeToggleCheck(id, mod);
      return;
    }

    // Solicita a senha simples de conferência manual
    const currentChecked = isEquipmentChecked(target, mod);
    setManualCheckModal({
      isOpen: true,
      equipment: target,
      modality: mod,
      nextState: !currentChecked
    });
  };

  // Confirmação de PIN para Check Manual
  const handleConfirmManualCheck = async ({ pin, equipmentId, modality, remember15Min }) => {
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (!data.success) {
        return { success: false, message: data.message || 'Senha incorreta. (Padrão: 1234)' };
      }

      if (remember15Min) {
        const expires = Date.now() + 15 * 60 * 1000;
        try {
          sessionStorage.setItem(PIN_AUTH_KEY, String(expires));
        } catch (e) {}
        setPinAuthorizedUntil(expires);
      }

      await executeToggleCheck(equipmentId, modality);
      return { success: true };
    } catch (err) {
      // Fallback local se offline ou servidor inacessível
      if (pin === '1234' || pin === 'digiclintec' || pin === currentUser?.password) {
        if (remember15Min) {
          const expires = Date.now() + 15 * 60 * 1000;
          try {
            sessionStorage.setItem(PIN_AUTH_KEY, String(expires));
          } catch (e) {}
          setPinAuthorizedUntil(expires);
        }
        await executeToggleCheck(equipmentId, modality);
        return { success: true };
      }
      return { success: false, message: 'Senha incorreta. (Padrão: 1234)' };
    }
  };

  // Conferência em Lote (Staging / Batch Check) para a modalidade ativa com suporte a setor de retirada
  const handleBatchCheck = async (itemsOrIds, targetModality = activeModality) => {
    if (!itemsOrIds || itemsOrIds.length === 0) return;

    const mod = targetModality === 'geral' ? 'calibracao' : targetModality;
    const nowIso = new Date().toISOString();
    const inspector = currentUser?.name ? `${currentUser.name} (${currentUser.email})` : (currentUser?.email || 'Operador');

    // Normaliza tanto lista de IDs simples quanto lista de objetos { id, setorRetirada }
    const idSet = new Set();
    const sectorMap = new Map();
    const payloadItems = [];

    itemsOrIds.forEach(it => {
      if (typeof it === 'string') {
        const k = it.toLowerCase();
        idSet.add(k);
        payloadItems.push({ id: it });
      } else if (it && (it.id || it.equipment?.id)) {
        const realId = it.id || it.equipment?.id;
        const k = String(realId).toLowerCase();
        idSet.add(k);
        if (it.setorRetirada) {
          sectorMap.set(k, String(it.setorRetirada).trim());
        }
        payloadItems.push({
          id: realId,
          setorRetirada: it.setorRetirada
        });
      }
    });

    let checkedCount = 0;
    const updated = equipments.map(item => {
      const id = String(item.id || '').toLowerCase();
      const code = String(item.codigoBarras || '').toLowerCase();
      const tag = String(item.tag || '').toLowerCase();
      const serie = String(item.serie || '').toLowerCase();

      if (idSet.has(id) || idSet.has(code) || idSet.has(tag) || idSet.has(serie)) {
        checkedCount++;
        const copy = { ...item };
        if (mod === 'preventiva') {
          copy.check_preventiva = true;
          copy.data_preventiva = nowIso;
          copy.usuario_preventiva = inspector;
        } else if (mod === 'seguranca') {
          copy.check_seguranca = true;
          copy.data_seguranca = nowIso;
          copy.usuario_seguranca = inspector;
        } else {
          copy.check_calibracao = true;
          copy.data_calibracao = nowIso;
          copy.usuario_calibracao = inspector;
        }

        // Setor de retirada / coleta registrado para esta bomba
        const assignedSector = sectorMap.get(id) || 
                               sectorMap.get(code) || 
                               sectorMap.get(tag) || 
                               sectorMap.get(serie);
        if (assignedSector) {
          copy.setor_retirada = assignedSector;
          copy.data_retirada = nowIso;
          copy.usuario_retirada = inspector;
        }

        copy.checado = true;
        copy.dataCheck = nowIso;
        copy.conferidoPor = inspector;
        return copy;
      }
      return item;
    });

    setEquipments(updated);

    // Envia ao servidor via endpoint em lote com payload detalhado
    try {
      fetch('/api/batch-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems,
          ids: Array.from(idSet),
          modality: mod,
          hospitalId: activeHospitalId,
          userEmail: currentUser?.email,
          userName: currentUser?.name
        })
      }).then(res => res.json()).then(data => {
        if (data.success && data.lastUpdated) {
          lastUpdatedServerRef.current = data.lastUpdated;
        }
      }).catch(() => {});
    } catch (e) {}

    const modName = MODALITIES[mod]?.name || mod;
    await pushServerUpdate(
      updated, 
      activeSheetName, 
      `Check em lote [${modName}]: ${checkedCount} equipamentos conferidos com sucesso`
    );

    if (soundEnabled) playSuccessSound();
    showToast('success', `🎉 ${checkedCount} equipamentos conferidos para [${modName}]!`);
  };

  // Ações em Massa com Senha (Marcar / Desmarcar em Lote) com suporte inteligente multi-modalidade e técnico
  const handleMassCheck = async (payloadOrAction, maybePassword, maybeModality) => {
    let payload = {};
    if (typeof payloadOrAction === 'object' && payloadOrAction !== null) {
      payload = {
        action: payloadOrAction.action || 'check_all',
        modalities: payloadOrAction.modalities,
        assignedTechnician: payloadOrAction.assignedTechnician,
        assignedDate: payloadOrAction.assignedDate,
        sectorFilter: payloadOrAction.sectorFilter || 'ALL',
        onlyPending: payloadOrAction.onlyPending ?? false,
        password: payloadOrAction.password,
        hospitalId: activeHospitalId,
        userEmail: currentUser?.email,
        userName: currentUser?.name
      };
    } else {
      payload = {
        action: payloadOrAction,
        modality: maybeModality || activeModality,
        password: maybePassword,
        hospitalId: activeHospitalId,
        userEmail: currentUser?.email,
        userName: currentUser?.name
      };
    }

    try {
      const res = await fetch('/api/mass-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        if (soundEnabled) playErrorSound();
        return { success: false, message: data.message || 'Senha incorreta.' };
      }

      if (data.equipments) {
        setEquipments(data.equipments.map(normalizeEquipmentModalities));
      }
      if (data.lastUpdated) {
        lastUpdatedServerRef.current = data.lastUpdated;
      }

      if (payload.action === 'check_all') {
        if (soundEnabled) playSuccessSound();
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 }
        });
        showToast('success', data.message || `Equipamentos marcados com sucesso!`);
      } else {
        if (soundEnabled) playWarningSound();
        showToast('info', data.message || `Equipamentos desmarcados.`);
      }

      loadMonthlyPlans(activeHospitalId);
      return { success: true };
    } catch (err) {
      if (soundEnabled) playErrorSound();
      return { success: false, message: 'Erro de conexão com o servidor.' };
    }
  };

  // Main barcode lookup & check logic com busca inteligente e suporte à modalidade ativa
  const handleScanCode = async (code) => {
    if (!code || !equipments || equipments.length === 0) {
      if (soundEnabled) playErrorSound();
      showToast('error', 'Nenhuma planilha carregada ainda para este hospital.');
      return { status: 'not_found', message: 'Nenhuma planilha carregada' };
    }

    // Modalidades que o bip vai validar
    let targetMods = [];
    if (serviceConfig?.executionMode === 'all_at_once') {
      if (serviceConfig.enableCalibracao) targetMods.push('calibracao');
      if (serviceConfig.enablePreventiva) targetMods.push('preventiva');
      if (serviceConfig.enableSeguranca) targetMods.push('seguranca');
      if (targetMods.length === 0) targetMods = ['calibracao'];
    } else {
      const mod = activeModality === 'geral' ? 'calibracao' : activeModality;
      targetMods = [mod];
    }

    const appliedLabels = targetMods.map(m => MODALITIES[m]?.shortName || m).join(' + ');

    // Busca inteligente com algoritmo de similaridade de dígitos e caracteres
    const matches = findBestEquipmentMatches(code, equipments);

    if (!matches || matches.length === 0) {
      if (soundEnabled) playErrorSound();
      showToast('error', `Aparelho não encontrado para o código: "${code}"`);
      return {
        status: 'not_found',
        message: `Não encontrado na planilha: ${code}`
      };
    }

    // Seleciona o melhor candidato (maior score / números mais próximos)
    const bestMatch = matches[0];
    const targetItem = bestMatch.equipment;
    const targetIndex = equipments.findIndex(e => e.id === targetItem.id);

    if (targetIndex === -1) {
      return { status: 'not_found', message: 'Item não localizado' };
    }

    setLastScannedId(targetItem.id);

    // Verifica se já está conferido para todas as modalidades alvo
    const allAlreadyChecked = targetMods.every(m => isEquipmentChecked(targetItem, m));

    if (allAlreadyChecked) {
      if (soundEnabled) playWarningSound();
      showToast('warning', `Equipamento já possui [${appliedLabels}] conferido: ${targetItem.equipamento} (${targetItem.tag || targetItem.serie})`);
      return {
        status: 'already_checked',
        equipment: targetItem,
        match: bestMatch,
        message: `Já conferido para ${appliedLabels}: ${targetItem.equipamento}`
      };
    }

    // Mark as checked para as modalidades alvo
    if (soundEnabled) playSuccessSound();

    const inspector = currentUser?.name ? `${currentUser.name} (${currentUser.email})` : (currentUser?.email || 'Operador');
    const nowIso = new Date().toISOString();
    const updated = [...equipments];
    const copy = { ...updated[targetIndex] };

    targetMods.forEach(m => {
      if (m === 'calibracao') {
        copy.check_calibracao = true;
        copy.data_calibracao = copy.data_calibracao || nowIso;
        copy.usuario_calibracao = copy.usuario_calibracao || inspector;
      } else if (m === 'preventiva') {
        copy.check_preventiva = true;
        copy.data_preventiva = copy.data_preventiva || nowIso;
        copy.usuario_preventiva = copy.usuario_preventiva || inspector;
      } else if (m === 'seguranca') {
        copy.check_seguranca = true;
        copy.data_seguranca = copy.data_seguranca || nowIso;
        copy.usuario_seguranca = copy.usuario_seguranca || inspector;
      }
    });

    copy.checado = true;
    copy.dataCheck = nowIso;
    copy.conferidoPor = inspector;
    updated[targetIndex] = copy;

    setEquipments(updated);
    const reasonLabel = bestMatch.isExact ? '100% Exato' : `${bestMatch.matchingDigits} dígitos iguais`;
    showToast('success', `Check [${appliedLabels}] confirmado: ${targetItem.equipamento} (${targetItem.tag || targetItem.serie}) [${reasonLabel}]`);

    // Notifica backend
    try {
      targetMods.forEach(m => {
        fetch('/api/toggle-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: targetItem.id,
            modality: m,
            hospitalId: activeHospitalId,
            userEmail: currentUser?.email,
            userName: currentUser?.name
          })
        }).then(res => res.json()).then(data => {
          if (data.success && data.lastUpdated) {
            lastUpdatedServerRef.current = data.lastUpdated;
          }
        }).catch(() => {});
      });
    } catch (e) {}

    await pushServerUpdate(updated, activeSheetName, `Check [${currentMod.shortName}]: ${targetItem.equipamento}`);

    return {
      status: 'found',
      equipment: targetItem,
      match: bestMatch,
      message: `Check [${currentMod.shortName}] OK: ${targetItem.equipamento}`
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
      await pushServerUpdate(result.equipments, result.fileName, `Planilha carregada: ${result.fileName}`);
      const checkedCount = (result.equipments || []).filter(e => e.checado).length;
      if (checkedCount > 0) {
        showToast('success', `Planilha "${result.fileName}" carregada com ${result.total} itens (${checkedCount} já validados da planilha)!`);
      } else {
        showToast('success', `Planilha "${result.fileName}" carregada no ${activeHospital?.name || 'hospital'} com ${result.total} itens!`);
      }
      loadHospitals();
      // Solicita configuração do serviço (somente calibração ou todos os parâmetros, tudo de uma vez ou separado)
      setServiceConfigModal({ isOpen: true, isInitialSetup: true });
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

  // Google Sheets import
  const handleGoogleDataImport = async (data) => {
    await pushServerUpdate(data.equipments, data.fileName, 'Planilha Google importada');
    const checkedCount = (data.equipments || []).filter(e => e.checado).length;
    if (checkedCount > 0) {
      showToast('success', `Planilha importada com ${data.total} equipamentos (${checkedCount} já validados da planilha)!`);
    } else {
      showToast('success', `Planilha importada com ${data.total} equipamentos!`);
    }
    loadHospitals();
    setServiceConfigModal({ isOpen: true, isInitialSetup: true });
  };

  // Load sample data
  const handleLoadSample = async () => {
    await pushServerUpdate(SAMPLE_EQUIPMENT, 'Exemplo_Calibracao_Padrao.xlsx', 'Exemplo carregado');
    showToast('success', '10 equipamentos de exemplo carregados para teste imediato!');
    loadHospitals();
    setServiceConfigModal({ isOpen: true, isInitialSetup: true });
  };

  // Reset / Clear hospital data
  const handleResetData = async () => {
    if (window.confirm(`Deseja limpar todos os dados da planilha atual do "${activeHospital?.name || 'hospital atual'}"?`)) {
      await pushServerUpdate([], '', 'Planilha limpa');
      try {
        await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hospitalId: activeHospitalId })
        });
      } catch (e) {}
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SHEET_NAME_KEY);
      showToast('warning', 'Dados do hospital resetados com sucesso.');
      loadHospitals();
    }
  };

  // Export to Excel com suporte a multiequipes (todas as frentes)
  const handleExport = () => {
    if (equipments.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const hospSlug = (activeHospital?.name || 'calibracao').replace(/[^a-zA-Z0-9]/g, '_');
    const baseName = activeSheetName ? activeSheetName.replace(/\.[^/.]+$/, "") : hospSlug;
    const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;
    const fileName = `${baseName}_multiequipes_${dateStr}.xlsx`;
    exportToExcel(equipments, fileName, activeModality);
    showToast('success', `Planilha completa multiequipes baixada com sucesso!`);
  };

  // Login handler
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
    showToast('success', `Bem-vindo, ${user.name || user.email}!`);
    loadHospitals();
  };

  // Logout handler
  const handleLogout = () => {
    if (window.confirm('Deseja realmente sair da sua conta?')) {
      setCurrentUser(null);
      localStorage.removeItem(USER_KEY);
      showToast('info', 'Você saiu do sistema.');
    }
  };

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div 
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white"
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

      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center animate-in fade-in duration-150">
          <Upload className="w-16 h-16 mb-4 animate-bounce" />
          <h2 className="text-3xl font-extrabold mb-2">Solte sua planilha crua aqui</h2>
          <p className="text-blue-100 text-sm">Destino: {activeHospital?.name} (.xlsx, .xls, .csv)</p>
        </div>
      )}

      {/* Toast Notification Bar */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-5 right-5 z-50 max-w-md animate-in slide-in-from-bottom duration-200">
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

      {/* Top Navbar with Multi-Hospital Switcher, Plans & User Profile */}
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
        hospitals={availableHospitals}
        activeHospitalId={activeHospitalId}
        onSwitchHospital={handleSwitchHospital}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
        onOpenHospitalModal={(tab) => setHospitalModal({ isOpen: true, initialTab: tab || 'create' })}
        activeMainTab={activeMainTab}
        onChangeMainTab={setActiveMainTab}
        monthlyPlans={monthlyPlans}
        activePlanId={activePlanId}
        onSwitchPlan={handleSwitchPlan}
        activeModality={activeModality}
        onChangeModality={setActiveModality}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 sm:pb-6 overflow-hidden">
        
        {activeMainTab === 'auditoria' ? (
          <SpreadsheetAuditView
            equipments={equipments}
            hospitalName={activeHospital?.name}
            planTitle={activeSheetName}
            onRefresh={fetchHospitalData}
            serviceConfig={serviceConfig}
            onOpenServiceConfig={() => setServiceConfigModal({ isOpen: true, isInitialSetup: false })}
          />
        ) : activeMainTab === 'planejamento' ? (
          <MonthlyPlanningTab
            plans={monthlyPlans}
            activePlanId={activePlanId}
            onSwitchPlan={handleSwitchPlan}
            onCreatePlan={handleCreatePlan}
            onDeletePlan={handleDeletePlan}
            hospitalName={activeHospital?.name}
            onNavigateToScanner={() => {
              setActiveMainTab('conferencia');
              setIsScannerOpen(true);
            }}
          />
        ) : equipments.length === 0 ? (
          /* Empty / Welcome State */
          <HeroBanner
            onOpenFilePicker={() => fileInputRef.current?.click()}
            onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
            onLoadSample={handleLoadSample}
            onDropFile={processFile}
            hospitalName={activeHospital?.name}
          />
        ) : (
          /* Active Spreadsheet View */
          <div className="space-y-4 sm:space-y-6 w-full">
            
            {/* Active Hospital & File Header info & live sync indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full overflow-hidden">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/50">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-base truncate">
                      {activeHospital?.name || 'Hospital Central'}
                    </h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono shrink-0">
                      {equipments.length} itens
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Tempo Real
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Arquivo ativo: <span className="font-medium text-slate-700 dark:text-slate-300">{activeSheetName || 'Planilha Compartilhada'}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto">
                <button
                  onClick={handleExport}
                  className="flex-1 sm:flex-initial py-2 px-3 sm:px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Excel</span>
                </button>

                <button
                  onClick={handleResetData}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
                  title="Trocar ou Limpar Planilha deste Hospital"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Seletor de Frente de Trabalho / Equipes Técnicas */}
            <ModalityBar
              activeModality={activeModality}
              onChangeModality={setActiveModality}
              equipments={equipments}
              serviceConfig={serviceConfig}
              onOpenServiceConfig={() => setServiceConfigModal({ isOpen: true, isInitialSetup: false })}
            />

            {/* Stats Cards & Progress */}
            <StatsCards
              stats={stats}
              activeFilter={activeFilter}
              onSelectFilter={setActiveFilter}
              activeModality={activeModality}
            />

            {/* Equipment Table with Search & Scanner Bar (Mobile cards + Desktop table) */}
            <EquipmentTable
              equipments={equipments}
              onToggleCheck={handleToggleCheck}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              onQuickScanCode={handleScanCode}
              lastScannedId={lastScannedId}
              onOpenSerialScan={() => setIsSerialScanOpen(true)}
              onTriggerMassAction={(action) => setMassActionModal({ isOpen: true, action })}
              activeModality={activeModality}
              onChangeModality={setActiveModality}
              serviceConfig={serviceConfig}
              onOpenServiceConfig={() => setServiceConfigModal({ isOpen: true, isInitialSetup: false })}
            />

          </div>
        )}

      </main>

      {/* Scanner Modal com Conferência em Lote e Fuzzy Matching */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanCode}
        onBatchCheck={handleBatchCheck}
        equipments={equipments}
        soundEnabled={soundEnabled}
        activeModality={activeModality}
      />

      {/* Agente Digitalizador de Número de Série por Foto / OCR */}
      <SerialScanModal
        isOpen={isSerialScanOpen}
        onClose={() => setIsSerialScanOpen(false)}
        equipments={equipments}
        onBatchCheck={handleBatchCheck}
        soundEnabled={soundEnabled}
        hospitalName={activeHospital?.name}
        planTitle={activeSheetName}
        activeModality={activeModality}
      />

      {/* Modal Inteligente de Confirmação com Senha para Ações em Lote */}
      <SmartBatchModal
        isOpen={massActionModal.isOpen}
        onClose={() => setMassActionModal(prev => ({ ...prev, isOpen: false }))}
        initialAction={massActionModal.action}
        activeModality={activeModality}
        equipments={equipments}
        hospitalName={activeHospital?.name}
        planTitle={activeSheetName}
        currentUser={currentUser}
        onConfirm={handleMassCheck}
      />

      {/* Modal de Senha Simples para Check Manual por Clique na Tela */}
      <ManualCheckPasswordModal
        isOpen={manualCheckModal.isOpen}
        onClose={() => setManualCheckModal(prev => ({ ...prev, isOpen: false }))}
        equipment={manualCheckModal.equipment}
        modality={manualCheckModal.modality}
        nextState={manualCheckModal.nextState}
        onConfirm={handleConfirmManualCheck}
      />

      {/* Google Sheets / File Import Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onImportData={handleGoogleDataImport}
      />

      {/* Modal de Configuração de Serviços e Modo de Bipagem da Planilha */}
      <SheetServicesConfigModal
        isOpen={serviceConfigModal.isOpen}
        onClose={() => setServiceConfigModal(prev => ({ ...prev, isOpen: false }))}
        serviceConfig={serviceConfig}
        onSaveConfig={handleSaveServiceConfig}
        hospitalName={activeHospital?.name}
        planTitle={activeSheetName}
        totalEquipments={equipments.length}
        isInitialSetup={serviceConfigModal.isInitialSetup}
      />

      {/* Dedicated Hospital Registration, Switching & Access Modal */}
      <HospitalModal
        isOpen={hospitalModal.isOpen}
        onClose={() => setHospitalModal(prev => ({ ...prev, isOpen: false }))}
        hospitals={hospitals}
        activeHospitalId={activeHospitalId}
        onSwitchHospital={handleSwitchHospital}
        onRefreshHospitals={loadHospitals}
        currentUser={currentUser}
        initialTab={hospitalModal.initialTab}
      />

      {/* Master User & Hospital Management Panel */}
      <MasterPanelModal
        isOpen={isMasterPanelOpen}
        onClose={() => setIsMasterPanelOpen(false)}
        currentUser={currentUser}
        hospitals={hospitals}
        activeHospitalId={activeHospitalId}
        onSwitchHospital={handleSwitchHospital}
        onRefreshHospitals={loadHospitals}
      />

      {/* Team Management & Work Audit Modal */}
      <TeamManagementModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        currentUser={currentUser}
        equipments={equipments}
        hospitalName={activeHospital?.name || 'Hospital'}
        activeHospitalId={activeHospitalId}
        hospitals={availableHospitals}
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
        onOpenSerialScan={() => setIsSerialScanOpen(true)}
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
