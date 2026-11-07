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
  Crown,
  RefreshCw,
  Link2,
  Unlink,
  ExternalLink,
  GitMerge,
  RotateCcw,
  User,
  Zap
} from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import MergeCalibrationsModal from './components/MergeCalibrationsModal';
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
import TechnicianProfileTab from './components/TechnicianProfileTab';
import SerialScanModal from './components/SerialScanModal';
import MassActionPasswordModal from './components/MassActionPasswordModal';
import SmartBatchModal from './components/SmartBatchModal';
import SpreadsheetAuditView from './components/SpreadsheetAuditView';
import SheetServicesConfigModal from './components/SheetServicesConfigModal';
import CarrinhoDevolucaoTab from './components/CarrinhoDevolucaoTab';
import ManualCheckPasswordModal from './components/ManualCheckPasswordModal';
import ModalityBar from './components/ModalityBar';
import SectorColorModal from './components/SectorColorModal';
import AbruptChangeConfirmModal from './components/AbruptChangeConfirmModal';
import AlreadyScannedAlertModal from './components/AlreadyScannedAlertModal';
import EditEquipmentModal from './components/EditEquipmentModal';
import AddEquipmentModal from './components/AddEquipmentModal';

import { parseSpreadsheetFile, exportToExcel } from './utils/sheetParser';
import { SAMPLE_EQUIPMENT } from './utils/sampleData';
import { 
  playSuccessSound, 
  playBatchConfirmSound,
  playWarningSound, 
  playErrorSound, 
  playManualCheckSound, 
  playUncheckSound, 
  playUndoSound,
  playAlreadyCheckedSound,
  playMaintenanceAlertSound,
  triggerHapticAlert
} from './utils/audio';
import { findBestEquipmentMatches } from './utils/fuzzyMatch';
import { MODALITIES, normalizeEquipmentModalities, isEquipmentChecked, isEquipmentFullyChecked, getCheckMeta } from './utils/modalities';

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
    try {
      const savedUserStr = localStorage.getItem(USER_KEY);
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          const userHosp = localStorage.getItem(`calibracheck_active_hospital_${u.id}`);
          if (userHosp) return userHosp;
          if (u.hospitalIds && u.hospitalIds.length > 0 && u.hospitalIds[0] !== 'all') {
            return u.hospitalIds[0];
          }
        }
      }
    } catch (e) {}
    return localStorage.getItem(HOSP_KEY) || 'hosp_central';
  });

  // Active Plan ID (inicializado sincronamente para evitar qualquer cintilação de tela na recarga)
  const [activePlanId, setActivePlanId] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem(USER_KEY);
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          const hospId = localStorage.getItem(`calibracheck_active_hospital_${u.id}`) || localStorage.getItem(HOSP_KEY) || 'hosp_central';
          const userPlan = localStorage.getItem(`usr_${u.id}_calibracheck_active_plan_${hospId}`);
          if (userPlan) return userPlan;
        }
      }
    } catch (e) {}
    return null;
  });

  // Equipments state (isolado por plano e por hospital)
  const [equipments, setEquipments] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem(USER_KEY);
      let initHosp = localStorage.getItem(HOSP_KEY) || 'hosp_central';
      let initPlan = null;
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          initHosp = localStorage.getItem(`calibracheck_active_hospital_${u.id}`) || initHosp;
          initPlan = localStorage.getItem(`usr_${u.id}_calibracheck_active_plan_${initHosp}`);
        }
      }
      if (initPlan) {
        const planSaved = localStorage.getItem(`calibracheck_data_${initHosp}_${initPlan}`);
        if (planSaved) return JSON.parse(planSaved).map(normalizeEquipmentModalities);
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normalizeEquipmentModalities) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeSheetName, setActiveSheetName] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem(USER_KEY);
      let initHosp = localStorage.getItem(HOSP_KEY) || 'hosp_central';
      let initPlan = null;
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          initHosp = localStorage.getItem(`calibracheck_active_hospital_${u.id}`) || initHosp;
          initPlan = localStorage.getItem(`usr_${u.id}_calibracheck_active_plan_${initHosp}`);
        }
      }
      if (initPlan) {
        const planSheet = localStorage.getItem(`calibracheck_sheet_${initHosp}_${initPlan}`);
        if (planSheet) return planSheet;
      }
      return localStorage.getItem(SHEET_NAME_KEY) || '';
    } catch (e) {
      return '';
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  });

  // UI state
  const [activeMainTab, setActiveMainTab] = useState('conferencia'); // 'conferencia' | 'planejamento'
  const [monthlyPlans, setMonthlyPlans] = useState([]);
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
      executionMode: 'all_at_once', // Padrão recomendado: 'all_at_once' (Pacote Completo Fixado)
      enableCarrinhoDevolucao: false // Ativação opcional com senha do módulo de devolução
    };
  });
  const [serviceConfigModal, setServiceConfigModal] = useState({ isOpen: false, isInitialSetup: false });
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Custom Sector Colors (Map of normalizedSectorKey -> hex)
  const [isSectorColorModalOpen, setIsSectorColorModalOpen] = useState(false);
  const [sectorColors, setSectorColors] = useState(() => {
    try {
      const saved = localStorage.getItem(`calibracheck_sector_colors_${activeHospitalId}`);
      if (saved) return JSON.parse(saved);
      const globalSaved = localStorage.getItem('calibracheck_sector_colors');
      if (globalSaved) return JSON.parse(globalSaved);
    } catch (e) {}
    return {};
  });

  // Google Sheets Live Sync State (Sincronização em Tempo Real via Link Compartilhado)
  const [googleSheetUrl, setGoogleSheetUrl] = useState(() => {
    try {
      return localStorage.getItem(`calibracheck_google_url_${activeHospitalId}`) || '';
    } catch (e) {
      return '';
    }
  });
  const [googleSheetWebhookUrl, setGoogleSheetWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem(`calibracheck_google_webhook_${activeHospitalId}`) || '';
    } catch (e) {
      return '';
    }
  });
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [lastGoogleSyncTime, setLastGoogleSyncTime] = useState(null);

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(`calibracheck_google_url_${activeHospitalId}`) || '';
      setGoogleSheetUrl(savedUrl);
      const savedWebhook = localStorage.getItem(`calibracheck_google_webhook_${activeHospitalId}`) || '';
      setGoogleSheetWebhookUrl(savedWebhook);
    } catch (e) {}
  }, [activeHospitalId]);

  const handleSaveGoogleWebhook = (url) => {
    setGoogleSheetWebhookUrl(url);
    if (url) {
      localStorage.setItem(`calibracheck_google_webhook_${activeHospitalId}`, url);
    } else {
      localStorage.removeItem(`calibracheck_google_webhook_${activeHospitalId}`);
    }
  };

  const handleSaveSectorColors = async (newColors) => {
    setSectorColors(newColors);
    try {
      localStorage.setItem(`calibracheck_sector_colors_${activeHospitalId}`, JSON.stringify(newColors));
      localStorage.setItem('calibracheck_sector_colors', JSON.stringify(newColors));
      await fetch('/api/sector-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId: activeHospitalId, sectorColors: newColors })
      });
      broadcastChannelRef.current?.postMessage({
        type: 'SECTOR_COLORS_UPDATE',
        payload: { hospitalId: activeHospitalId, sectorColors: newColors }
      });
      showToast('success', 'Cores dos setores salvas e sincronizadas!');
    } catch (e) {
      showToast('info', 'Cores dos setores salvas localmente.');
    }
  };

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
    const carrinhoLabel = newConfig.enableCarrinhoDevolucao ? ' • 📦 Carrinho de Devolução Ativo' : '';
    showToast('success', `Opções atualizadas: ${newConfig.executionMode === 'all_at_once' ? '⚡ Bipar Tudo de Uma Vez' : '🎯 Bipar Separado'}${carrinhoLabel}`);
  };

  // Se o módulo de devolução for desativado e o técnico estava nessa aba, volta para conferência
  useEffect(() => {
    if (activeMainTab === 'devolucao' && !serviceConfig?.enableCarrinhoDevolucao) {
      setActiveMainTab('conferencia');
    }
  }, [activeMainTab, serviceConfig]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [lastScannedId, setLastScannedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [undoCheckpoint, setUndoCheckpoint] = useState(null);
  const [alreadyScannedAlert, setAlreadyScannedAlert] = useState(null);
  const [editEquipmentModal, setEditEquipmentModal] = useState({ isOpen: false, equipment: null });
  const [addEquipmentModal, setAddEquipmentModal] = useState({ 
    isOpen: false, 
    planId: null, 
    initialCode: '', 
    initialMode: 'manual' 
  });
  const [abruptConfirmModal, setAbruptConfirmModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    affectedCount: 0,
    affectedLabel: 'equipamentos',
    operationType: 'bulk',
    details: [],
    severity: 'warning',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: null
  });

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
        const userSavedHosp = currentUser?.id ? localStorage.getItem(`calibracheck_active_hospital_${currentUser.id}`) : null;
        if (!userSavedHosp && data.activeHospitalId && !localStorage.getItem(HOSP_KEY)) {
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
        // Respeita o plano escolhido por este técnico individualmente, sem ser sobrescrito pelo plano de outros técnicos
        setActivePlanId(current => {
          if (current && data.plans.some(p => p.id === current)) return current;
          const userSavedPlan = localStorage.getItem(`usr_${currentUser.id}_calibracheck_active_plan_${hospId}`);
          if (userSavedPlan && data.plans.some(p => p.id === userSavedPlan)) return userSavedPlan;
          return data.plans[0]?.id || null;
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar planejamentos mensais:', e);
    }
  }, [currentUser, activeHospitalId]);

  useEffect(() => {
    loadMonthlyPlans(activeHospitalId);
  }, [loadMonthlyPlans, activeHospitalId]);

  // Switch active monthly plan (ação local e independente deste técnico)
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
        if (currentUser?.id) {
          localStorage.setItem(`usr_${currentUser.id}_calibracheck_active_plan_${activeHospitalId}`, planId);
        }
        try {
          localStorage.setItem(`calibracheck_data_${activeHospitalId}_${planId}`, JSON.stringify(data.equipments || []));
          if (data.activeSheetName) localStorage.setItem(`calibracheck_sheet_${activeHospitalId}_${planId}`, data.activeSheetName);
        } catch (e) {}
        setEquipments(data.equipments || []);
        if (data.activeSheetName) setActiveSheetName(data.activeSheetName);
        setActiveMainTab('conferencia');
        showToast('success', `Planilha "${data.planTitle || planId}" ativada para o seu perfil!`);
        loadMonthlyPlans(activeHospitalId);
      } else {
        showToast('error', data.message || 'Erro ao alternar planilha.');
      }
    } catch (err) {
      showToast('error', 'Erro de conexão ao ativar plano.');
    }
  };

  // Create new monthly/annual plan
  const handleCreatePlan = async (planData) => {
    try {
      const res = await fetch('/api/plans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          title: planData.title,
          tipo: planData.tipo,
          ano: planData.ano,
          mes: planData.mes,
          dataInicio: planData.dataInicio,
          dataFim: planData.dataFim,
          descricao: planData.descricao,
          googleSheetUrl: planData.googleSheetUrl,
          fileName: planData.fileName,
          equipments: planData.equipments || [],
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

  // Update plan metadata
  const handleUpdatePlan = async (planData) => {
    try {
      const res = await fetch('/api/plans/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          ...planData
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Plano atualizado com sucesso!');
        loadMonthlyPlans(activeHospitalId);
        loadHospitals();
      } else {
        showToast('error', data.message || 'Erro ao atualizar plano.');
      }
    } catch (err) {
      showToast('error', 'Falha ao atualizar plano.');
    }
  };

  // Save new equipment directly to plan
  const handleSaveNewEquipment = async (newEq, targetPlanId) => {
    try {
      const res = await fetch('/api/equipment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          planId: targetPlanId || activePlanId,
          equipment: newEq,
          userEmail: currentUser?.email,
          userName: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.equipments) {
          setEquipments(data.equipments);
        } else {
          setEquipments(prev => [...prev, data.equipment || newEq]);
        }
        showToast('success', `Equipamento "${newEq.equipamento}" (${newEq.tag || newEq.serie}) cadastrado com sucesso!`);
        if (soundEnabled) playSuccessSound();
        loadMonthlyPlans(activeHospitalId);
        loadHospitals();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Erro ao cadastrar equipamento.' };
      }
    } catch (err) {
      console.error('Erro ao cadastrar equipamento:', err);
      const updatedList = [...equipments, newEq];
      await pushServerUpdate(updatedList, activeSheetName, `Cadastro do equipamento ${newEq.tag || newEq.serie}`);
      showToast('success', `Equipamento "${newEq.equipamento}" cadastrado!`);
      return { success: true };
    }
  };

  // Batch add equipments to plan (via Excel file, clipboard paste or continuous barcode scanning)
  const handleBatchAddEquipments = async (equipmentsList, targetPlanId, skipDuplicates = true) => {
    try {
      const res = await fetch('/api/equipment/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          planId: targetPlanId || activePlanId,
          equipments: equipmentsList,
          skipDuplicates,
          userEmail: currentUser?.email,
          userName: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.equipments) {
          setEquipments(data.equipments);
        }
        showToast('success', data.message || `${data.addedCount} equipamentos adicionados ao plano da planilha!`);
        if (soundEnabled) playSuccessSound();
        loadMonthlyPlans(activeHospitalId);
        loadHospitals();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Falha ao adicionar equipamentos em lote.' };
      }
    } catch (err) {
      console.error('Erro ao adicionar em lote:', err);
      const updatedList = [...equipments, ...equipmentsList];
      await pushServerUpdate(updatedList, activeSheetName, `Adição de ${equipmentsList.length} equipamentos ao plano`);
      showToast('success', `${equipmentsList.length} equipamentos adicionados ao plano!`);
      return { success: true };
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
    if (currentUser?.id) {
      localStorage.setItem(`calibracheck_active_hospital_${currentUser.id}`, hospId);
    }
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
        if (data.sectorColors) {
          setSectorColors(data.sectorColors);
        }
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

  // Reseta o cache de sincronização e carrega configuração ao trocar de hospital
  useEffect(() => {
    lastUpdatedServerRef.current = 0;
    try {
      const saved = localStorage.getItem(`calibracheck_service_config_${activeHospitalId}`);
      if (saved) setServiceConfig(JSON.parse(saved));
    } catch (e) {}
  }, [activeHospitalId]);

  // Save to LocalStorage (global e com escopo por plano/hospital)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(equipments));
      localStorage.setItem(SHEET_NAME_KEY, activeSheetName);
      if (activeHospitalId && activePlanId) {
        localStorage.setItem(`calibracheck_data_${activeHospitalId}_${activePlanId}`, JSON.stringify(equipments));
        localStorage.setItem(`calibracheck_sheet_${activeHospitalId}_${activePlanId}`, activeSheetName);
      }
    } catch (e) {
      console.warn('Storage quota exceeded:', e);
    }
  }, [equipments, activeSheetName, activeHospitalId, activePlanId]);

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

  // Toast auto-dismiss (duração prolongada para 8s se houver botão de ação/desfazer)
  useEffect(() => {
    if (!toast) return;
    const duration = toast.action ? 8000 : 4000;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type, message, action = null) => {
    setToast({ type, message, action });
  };

  // Sync with Server API (Sincronização em tempo real isolada por Hospital e por Plano de Trabalho)
  const syncWithServer = useCallback(async () => {
    if (!currentUser) return;
    try {
      const planParam = activePlanId ? `&planId=${encodeURIComponent(activePlanId)}` : '';
      const res = await fetch(`/api/data?hospitalId=${encodeURIComponent(activeHospitalId)}${planParam}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        if (data.googleSheetUrl !== undefined) {
          setGoogleSheetUrl(data.googleSheetUrl || '');
          if (data.googleSheetUrl) {
            localStorage.setItem(`calibracheck_google_url_${activeHospitalId}`, data.googleSheetUrl);
          } else {
            localStorage.removeItem(`calibracheck_google_url_${activeHospitalId}`);
          }
        }
        if (data.googleSheetWebhookUrl !== undefined) {
          setGoogleSheetWebhookUrl(data.googleSheetWebhookUrl || '');
          if (data.googleSheetWebhookUrl) {
            localStorage.setItem(`calibracheck_google_webhook_${activeHospitalId}`, data.googleSheetWebhookUrl);
          } else {
            localStorage.removeItem(`calibracheck_google_webhook_${activeHospitalId}`);
          }
        }
        if (data.lastGoogleSheetSync) {
          setLastGoogleSyncTime(data.lastGoogleSheetSync);
        }

        if (data.lastUpdated && data.lastUpdated > lastUpdatedServerRef.current) {
          // Se este técnico tem um plano ativo selecionado, não sobrescreve os equipamentos caso a resposta pertença a outro plano
          if (activePlanId && data.activePlanId && data.activePlanId !== activePlanId) {
            return;
          }

          lastUpdatedServerRef.current = data.lastUpdated;
          
          // Se o servidor tem dados atualizados para ESTE plano/hospital, atualiza a lista de bombas
          // SEM fechar a câmera, SEM mudar de aba, SEM resetar o filtro de setor do técnico
          if (data.equipments && data.equipments.length >= 0) {
            setEquipments(data.equipments.map(normalizeEquipmentModalities));
            if (data.activeSheetName !== undefined) {
              setActiveSheetName(data.activeSheetName);
            }
          }
          if (data.serviceConfig) {
            setServiceConfig(data.serviceConfig);
          }
          if (data.sectorColors) {
            setSectorColors(data.sectorColors);
          }
        }
      }
    } catch (err) {
      // Offline fallback silent
    }
  }, [currentUser, activeHospitalId, activePlanId]);

  // Poll server every 2.5s for changes made by other users/devices
  useEffect(() => {
    if (!currentUser) return;
    syncWithServer();
    const interval = setInterval(syncWithServer, 2500);
    return () => clearInterval(interval);
  }, [currentUser, syncWithServer]);

  // Push update to server com vinculação ao plano ativo
  const pushServerUpdate = async (newEquipments, sheetName, actionDesc, gUrl = undefined, gWebhookUrl = undefined) => {
    setEquipments(newEquipments);
    if (sheetName !== undefined) setActiveSheetName(sheetName);

    // Post to backend server com identificação do plano
    try {
      const body = {
        hospitalId: activeHospitalId,
        planId: activePlanId,
        equipments: newEquipments,
        activeSheetName: sheetName !== undefined ? sheetName : activeSheetName,
        userEmail: currentUser?.email,
        userName: currentUser?.name,
        serviceConfig: serviceConfig
      };
      if (gUrl !== undefined) {
        body.googleSheetUrl = gUrl;
      }
      if (gWebhookUrl !== undefined) {
        body.googleSheetWebhookUrl = gWebhookUrl;
      }
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success && data.lastUpdated) {
        lastUpdatedServerRef.current = data.lastUpdated;
      }
    } catch (err) {
      console.warn('API sync offline:', err);
    }
  };

  // Snapshot para desfazer alterações abruptas ou em massa
  const recordUndoCheckpoint = (actionDesc, prevEquips = equipments, prevSheet = activeSheetName, prevUrl = googleSheetUrl) => {
    const snapshot = {
      id: `undo_${Date.now()}`,
      actionDesc,
      equipments: JSON.parse(JSON.stringify(prevEquips || [])),
      activeSheetName: prevSheet || '',
      googleSheetUrl: prevUrl || '',
      timestamp: Date.now(),
      hospitalId: activeHospitalId
    };
    setUndoCheckpoint(snapshot);
    return snapshot;
  };

  // Reverte para o estado anterior registrado no snapshot
  const handleUndoAction = async () => {
    if (!undoCheckpoint) return;
    if (undoCheckpoint.hospitalId && undoCheckpoint.hospitalId !== activeHospitalId) {
      showToast('warning', 'O ponto de restauração pertence a outro hospital.');
      return;
    }

    const { equipments: prevEquipments, activeSheetName: prevSheetName, googleSheetUrl: prevGUrl, actionDesc } = undoCheckpoint;
    
    if (soundEnabled) playUndoSound();

    await pushServerUpdate(
      prevEquipments, 
      prevSheetName, 
      `↩️ Desfeita: ${actionDesc}`, 
      prevGUrl
    );

    setUndoCheckpoint(null);
    showToast('info', `↩️ Alteração desfeita com sucesso! Estado anterior restaurado.`);
  };

  // Suporte a atalho Ctrl+Z / Cmd+Z para desfazer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (undoCheckpoint && undoCheckpoint.hospitalId === activeHospitalId) {
          e.preventDefault();
          handleUndoAction();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoCheckpoint, activeHospitalId, soundEnabled]);

  // Aplicar mesclagem de calibrações com ponto de restauração gravado
  const handleApplyMerge = async (updatedEquipments, actionDesc) => {
    recordUndoCheckpoint(actionDesc, equipments, activeSheetName, googleSheetUrl);
    await pushServerUpdate(updatedEquipments, activeSheetName, actionDesc);
    showToast('success', actionDesc, {
      label: 'Desfazer',
      onClick: handleUndoAction
    });
  };

  // Sincronização com Google Sheets via Link Compartilhado (Merge Inteligente sem perda de checks)
  const handleSyncGoogleSheet = async (isManual = false) => {
    if (!googleSheetUrl) return;
    setIsSyncingGoogle(true);
    try {
      const res = await fetch('/api/sync-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          url: googleSheetUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao sincronizar com Google Sheets');
      }

      setLastGoogleSyncTime(Date.now());

      if (data.hasChanges) {
        setEquipments(data.equipments.map(normalizeEquipmentModalities));
        if (data.activeSheetName) setActiveSheetName(data.activeSheetName);
        lastUpdatedServerRef.current = Date.now();
        showToast('info', `🔄 Planilha Google atualizada: ${data.addedCount} novo(s), ${data.updatedCount} alteração(ões) incorporada(s)!`);
      } else if (isManual) {
        showToast('success', 'Planilha Google já está 100% atualizada! Nenhuma alteração pendente.');
      }
    } catch (err) {
      console.error('Erro na sincronização com Google Sheets:', err);
      if (isManual) {
        showToast('error', `Erro ao sincronizar com Google: ${err.message}`);
      }
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Desvincular link do Google Sheets mantendo os dados no sistema
  const handleUnlinkGoogleSheet = async () => {
    if (window.confirm('Deseja desvincular o link do Google Sheets? A planilha continuará salva localmente neste hospital com todas as checagens intactas.')) {
      setGoogleSheetUrl('');
      localStorage.removeItem(`calibracheck_google_url_${activeHospitalId}`);
      try {
        await fetch('/api/unlink-google-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hospitalId: activeHospitalId })
        });
      } catch (e) {}
      showToast('info', 'Link desvinculado. Hospital operando no modo de arquivo local.');
    }
  };

  // Polling automático da planilha do Google a cada 25s se houver link ativo
  useEffect(() => {
    if (!currentUser || !googleSheetUrl) return;
    const interval = setInterval(() => {
      if (!isSyncingGoogle) {
        handleSyncGoogleSheet(false);
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [currentUser, googleSheetUrl, isSyncingGoogle]);

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
    const externa = equipments.filter(e => Boolean(e.check_externa)).length;
    
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
    return { total, checked, pending, expired, expiringSoon, percent, externa };
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
    if (targetModality === 'externa' || targetModality === 'manutencao_externa') {
      targetMods = ['externa'];
    } else if (serviceConfig?.executionMode === 'all_at_once') {
      // Pacote Completo Fixado: Carimba todas as etapas configuradas juntas (Calibração + Preventiva + Seg. Elétrica)
      if (!serviceConfig || serviceConfig.enableCalibracao !== false) targetMods.push('calibracao');
      if (!serviceConfig || serviceConfig.enablePreventiva !== false) targetMods.push('preventiva');
      if (!serviceConfig || serviceConfig.enableSeguranca !== false) targetMods.push('seguranca');
      if (targetMods.length === 0) targetMods = ['calibracao', 'preventiva', 'seguranca'];
    } else {
      const mod = targetModality === 'geral' ? 'calibracao' : (targetModality || 'calibracao');
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
          if (m === 'externa' || m === 'manutencao_externa') {
            copy.check_externa = nextState;
            copy.data_externa = nextState ? nowIso : null;
            copy.usuario_externa = nextState ? inspector : null;
            copy.motivo_externa = nextState ? 'Calibração e conserto por equipe externa terceirizada' : null;
            if (nextState) {
              // Conforme solicitado: Não colocar como calibração
              copy.check_calibracao = false;
              copy.data_calibracao = null;
              copy.usuario_calibracao = null;
            }
          } else if (m === 'calibracao') {
            copy.check_calibracao = nextState;
            copy.data_calibracao = nextState ? nowIso : null;
            copy.usuario_calibracao = nextState ? inspector : null;
            if (nextState) {
              copy.check_externa = false;
              copy.data_externa = null;
              copy.usuario_externa = null;
              copy.motivo_externa = null;
            }
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

        copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca || copy.check_externa);
        copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || copy.data_externa || null;
        copy.conferidoPor = copy.usuario_calibracao || copy.usuario_preventiva || copy.usuario_seguranca || copy.usuario_externa || null;
        return copy;
      }
      return item;
    });

    setEquipments(updatedList);

    if (soundEnabled) {
      if (nextState) playManualCheckSound();
      else playUncheckSound();
    }

    if (googleSheetWebhookUrl) {
      showToast('info', `🤖 Agente Google Sheets: Enviando [${target.tag || target.equipamento}] para gravação na planilha...`);
    } else if (googleSheetUrl) {
      showToast('info', `Calibração salva no sistema. Para gravar no Google Sheets em tempo real, ative o Agente Webhook!`);
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
            planId: activePlanId,
            userEmail: currentUser?.email,
            userName: currentUser?.name
          })
        }).then(res => res.json()).then(data => {
          if (data.success && data.lastUpdated) {
            lastUpdatedServerRef.current = data.lastUpdated;
            if (googleSheetWebhookUrl) {
              showToast('success', `🤖 Agente: [${target.tag || target.equipamento}] gravado com sucesso na planilha Google!`);
            }
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

  // Edição Segura de Identificação do Equipamento (Tag, Série, Código de Barras, etc.) com Confirmação de Senha
  const handleSaveEquipmentEdit = async (updatedData, pin) => {
    try {
      let isPinValid = false;
      try {
        const res = await fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (data.success) {
          isPinValid = true;
        }
      } catch (netErr) {
        // Fallback local se offline
      }

      if (!isPinValid) {
        const trimmedPin = (pin || '').trim();
        const isValidFallback = 
          trimmedPin === '1234' || 
          trimmedPin === 'digiclintec' || 
          trimmedPin === 'admin123' ||
          (currentUser?.password && trimmedPin === currentUser.password);

        if (!isValidFallback) {
          return { success: false, message: 'Senha incorreta. (Padrão: 1234)' };
        }
      }

      // Grava ponto de restauração (Undo) antes de aplicar
      const label = updatedData.tag || updatedData.serie || updatedData.codigoBarras;
      recordUndoCheckpoint(`Edição de identificação do aparelho ${label}`, equipments, activeSheetName, googleSheetUrl);

      const updatedList = equipments.map(eq => {
        if (eq.id === updatedData.id) {
          return {
            ...eq,
            tag: updatedData.tag,
            serie: updatedData.serie,
            codigoBarras: updatedData.codigoBarras,
            equipamento: updatedData.equipamento || eq.equipamento,
            modelo: updatedData.modelo || eq.modelo,
            fabricante: updatedData.fabricante || eq.fabricante,
            setor: updatedData.setor || eq.setor,
            dataCalibracao: updatedData.dataCalibracao !== undefined ? updatedData.dataCalibracao : eq.dataCalibracao,
            periodicidadeMeses: updatedData.periodicidadeMeses !== undefined ? updatedData.periodicidadeMeses : eq.periodicidadeMeses,
            validadeCalibracao: updatedData.validadeCalibracao !== undefined ? updatedData.validadeCalibracao : eq.validadeCalibracao,
            proximaCalibracao: updatedData.proximaCalibracao !== undefined ? updatedData.proximaCalibracao : eq.proximaCalibracao,
            statusCalibracao: updatedData.statusCalibracao || eq.statusCalibracao,
            observacao: updatedData.observacao !== undefined ? updatedData.observacao : eq.observacao
          };
        }
        return eq;
      });

      await pushServerUpdate(updatedList, undefined, `Edição de identificação da bomba ${label}`);
      showToast('success', `Identificação da bomba (${label}) atualizada com sucesso!`);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar identificação do equipamento:', err);
      return { success: false, message: 'Falha ao salvar alterações: ' + (err.message || 'Erro inesperado') };
    }
  };

  // Conferência em Lote (Staging / Batch Check) com suporte a múltiplas modalidades e setor de retirada
  const handleBatchCheck = async (itemsOrIds, targetModality = activeModality) => {
    if (!itemsOrIds || itemsOrIds.length === 0) return;

    // Normaliza modalidades selecionadas (suporta array, combo fixado ou manutenção externa)
    let targetMods = [];
    if (targetModality === 'externa' || targetModality === 'manutencao_externa' || (Array.isArray(targetModality) && targetModality.includes('externa') && targetModality.length === 1)) {
      targetMods = ['externa'];
    } else if (serviceConfig?.executionMode === 'all_at_once' || !targetModality || targetModality === 'all' || targetModality === 'geral') {
      // Pacote Completo Fixado: Carimba todas as etapas configuradas (Calibração + Preventiva + Seg. Elétrica)
      if (!serviceConfig || serviceConfig.enableCalibracao !== false) targetMods.push('calibracao');
      if (!serviceConfig || serviceConfig.enablePreventiva !== false) targetMods.push('preventiva');
      if (!serviceConfig || serviceConfig.enableSeguranca !== false) targetMods.push('seguranca');
      if (targetMods.length === 0) targetMods = ['calibracao', 'preventiva', 'seguranca'];
    } else if (Array.isArray(targetModality) && targetModality.length > 0) {
      targetMods = targetModality;
    } else {
      const mod = targetModality === 'calibracao+preventiva'
        ? ['calibracao', 'preventiva']
        : [targetModality || 'calibracao'];
      targetMods = mod;
    }

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
        
        if (targetMods.includes('externa') || targetMods.includes('manutencao_externa')) {
          copy.check_externa = true;
          copy.data_externa = nowIso;
          copy.usuario_externa = inspector;
          copy.motivo_externa = 'Calibração e conserto por equipe externa terceirizada';
          // Conforme solicitado: Não colocar como calibração
          copy.check_calibracao = false;
          copy.data_calibracao = null;
          copy.usuario_calibracao = null;
        }
        if (targetMods.includes('calibracao')) {
          copy.check_calibracao = true;
          copy.data_calibracao = nowIso;
          copy.usuario_calibracao = inspector;
          copy.check_externa = false;
          copy.data_externa = null;
          copy.usuario_externa = null;
          copy.motivo_externa = null;
        }
        if (targetMods.includes('preventiva')) {
          copy.check_preventiva = true;
          copy.data_preventiva = nowIso;
          copy.usuario_preventiva = inspector;
        }
        if (targetMods.includes('seguranca')) {
          copy.check_seguranca = true;
          copy.data_seguranca = nowIso;
          copy.usuario_seguranca = inspector;
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

        copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca || copy.check_externa);
        copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || copy.data_externa || nowIso;
        copy.conferidoPor = inspector;
        return copy;
      }
      return item;
    });

    setEquipments(updated);

    // Envia ao servidor via endpoint em lote com payload detalhado e modalidades
    try {
      fetch('/api/batch-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems,
          ids: Array.from(idSet),
          modality: targetMods[0],
          modalities: targetMods,
          hospitalId: activeHospitalId,
          planId: activePlanId,
          userEmail: currentUser?.email,
          userName: currentUser?.name
        })
      }).then(res => res.json()).then(data => {
        if (data.success && data.lastUpdated) {
          lastUpdatedServerRef.current = data.lastUpdated;
          if (googleSheetWebhookUrl) {
            showToast('success', `🤖 Agente: ${checkedCount} equipamentos gravados com sucesso na planilha Google!`);
          }
        }
      }).catch(() => {});
    } catch (e) {}

    const modLabels = targetMods.map(m => MODALITIES[m]?.shortName || m).join(' + ');
    if (checkedCount >= 5) {
      recordUndoCheckpoint(
        `Check em Lote [${modLabels}]: ${checkedCount} bombas`,
        equipments,
        activeSheetName,
        googleSheetUrl
      );
    }

    await pushServerUpdate(
      updated, 
      activeSheetName, 
      `Check em lote [${modLabels}]: ${checkedCount} equipamentos conferidos com sucesso`
    );

    if (soundEnabled) playBatchConfirmSound();
    showToast(
      'success', 
      `✓ ${checkedCount} equipamentos conferidos para [${modLabels}]!`, 
      checkedCount >= 5 ? { label: 'Desfazer', onClick: handleUndoAction } : null
    );
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
        planId: activePlanId,
        userEmail: currentUser?.email,
        userName: currentUser?.name
      };
    } else {
      payload = {
        action: payloadOrAction,
        modality: maybeModality || activeModality,
        password: maybePassword,
        hospitalId: activeHospitalId,
        planId: activePlanId,
        userEmail: currentUser?.email,
        userName: currentUser?.name
      };
    }

    if (equipments && equipments.length > 0) {
      const isCheck = (payload.action === 'check_all');
      recordUndoCheckpoint(
        isCheck ? 'Marcar Todos em Lote' : 'Desmarcar Todos em Lote',
        equipments,
        activeSheetName,
        googleSheetUrl
      );
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
        if (soundEnabled) playBatchConfirmSound();
        showToast('success', data.message || `Equipamentos marcados com sucesso!`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      } else {
        if (soundEnabled) playWarningSound();
        showToast('info', data.message || `Equipamentos desmarcados.`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      }

      loadMonthlyPlans(activeHospitalId);
      return { success: true };
    } catch (err) {
      if (soundEnabled) playErrorSound();
      return { success: false, message: 'Erro de conexão com o servidor.' };
    }
  };

  // Main barcode lookup & check logic com busca inteligente e suporte à modalidade ativa
  const handleScanCode = async (code, customMods = null) => {
    if (!code || !equipments || equipments.length === 0) {
      if (soundEnabled) playErrorSound();
      showToast('error', 'Nenhuma planilha carregada ainda para este hospital.');
      return { status: 'not_found', message: 'Nenhuma planilha carregada' };
    }

    // Modalidades que o bip vai validar
    let targetMods = [];
    if (customMods === 'externa' || (Array.isArray(customMods) && customMods.includes('externa') && customMods.length === 1)) {
      targetMods = ['externa'];
    } else if (serviceConfig?.executionMode === 'all_at_once' || !customMods) {
      // Pacote Completo Fixado: Valida Calibração + Preventiva + Seg. Elétrica juntas
      if (!serviceConfig || serviceConfig.enableCalibracao !== false) targetMods.push('calibracao');
      if (!serviceConfig || serviceConfig.enablePreventiva !== false) targetMods.push('preventiva');
      if (!serviceConfig || serviceConfig.enableSeguranca !== false) targetMods.push('seguranca');
      if (targetMods.length === 0) targetMods = ['calibracao', 'preventiva', 'seguranca'];
    } else if (customMods && Array.isArray(customMods) && customMods.length > 0) {
      targetMods = customMods;
    } else if (typeof customMods === 'string' && customMods) {
      targetMods = [customMods];
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

    // 1. PRIORIDADE MÁXIMA: Equipamento em MANUTENÇÃO EXTERNA (Terceirizada)
    if (Boolean(targetItem.check_externa) && !targetMods.includes('externa')) {
      if (soundEnabled) {
        playMaintenanceAlertSound();
      }
      triggerHapticAlert('maintenance');

      const meta = getCheckMeta(targetItem, 'externa');
      const whoSent = meta.user ? `por ${meta.user}` : '';
      const whenSent = meta.date ? ` em ${new Date(meta.date).toLocaleDateString('pt-BR')}` : '';
      const setorDestino = targetItem.setor_retirada || targetItem.setor || 'Setor de Origem';

      setAlreadyScannedAlert({
        type: 'maintenance',
        equipment: targetItem,
        match: bestMatch,
        meta,
        title: '📦 BOMBA EM MANUTENÇÃO EXTERNA',
        message: `Esta bomba já foi recolhida e registrada para MANUTENÇÃO EXTERNA ${whoSent}${whenSent}! Devolver em: ${setorDestino}`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      showToast('warning', `📦 EM MANUTENÇÃO EXTERNA: ${targetItem.equipamento} (${targetItem.tag || targetItem.serie}) • Devolver em: ${setorDestino}`);
      return {
        status: 'in_maintenance',
        equipment: targetItem,
        match: bestMatch,
        message: `Bomba já em Manutenção Externa: ${targetItem.equipamento}`
      };
    }

    // 2. SEGURANÇA INTELIGENTE: Verifica se já está conferido para todas as modalidades alvo
    const allAlreadyChecked = targetMods.every(m => isEquipmentChecked(targetItem, m));

    if (allAlreadyChecked) {
      if (soundEnabled) {
        playAlreadyCheckedSound();
      }
      triggerHapticAlert('already_checked');

      const meta = getCheckMeta(targetItem, targetMods[0]);
      const whoChecked = meta.user ? `por ${meta.user}` : '';
      const whenChecked = meta.date ? ` em ${new Date(meta.date).toLocaleDateString('pt-BR')}` : '';
      const setorDestino = targetItem.setor_retirada || targetItem.setor || 'Setor de Origem';

      setAlreadyScannedAlert({
        type: 'already_checked',
        equipment: targetItem,
        match: bestMatch,
        meta,
        title: '⚠️ BOMBA JÁ BIPADA E CONFERIDA',
        message: `Esta bomba já possui [${appliedLabels}] concluída ${whoChecked}${whenChecked}! Devolver em: ${setorDestino}. Bip bloqueado para evitar duplicação.`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      showToast('warning', `⚠️ JÁ CONFERIDO: ${targetItem.equipamento} (${targetItem.tag || targetItem.serie}) já possui [${appliedLabels}] OK! • Devolver em: ${setorDestino}`);
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
      if (m === 'externa' || m === 'manutencao_externa') {
        copy.check_externa = true;
        copy.data_externa = copy.data_externa || nowIso;
        copy.usuario_externa = copy.usuario_externa || inspector;
        copy.motivo_externa = 'Calibração e conserto por equipe externa terceirizada';
        // Conforme solicitado: Não colocar como calibração interna
        copy.check_calibracao = false;
        copy.data_calibracao = null;
        copy.usuario_calibracao = null;
      } else if (m === 'calibracao') {
        copy.check_calibracao = true;
        copy.data_calibracao = copy.data_calibracao || nowIso;
        copy.usuario_calibracao = copy.usuario_calibracao || inspector;
        copy.check_externa = false;
        copy.data_externa = null;
        copy.usuario_externa = null;
        copy.motivo_externa = null;
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

    copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca || copy.check_externa);
    copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || copy.data_externa || nowIso;
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
            planId: activePlanId,
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

  const executeApplyNewPlan = async (result) => {
    if (equipments && equipments.length > 0) {
      recordUndoCheckpoint('Substituição de Planilha', equipments, activeSheetName, googleSheetUrl);
    }
    // Arquivo local (.xlsx, .csv) - Opera como arquivo local seguro
    setGoogleSheetUrl('');
    localStorage.removeItem(`calibracheck_google_url_${activeHospitalId}`);
    await pushServerUpdate(result.equipments, result.fileName, `Planilha carregada: ${result.fileName}`, '');
    const checkedCount = (result.equipments || []).filter(e => e.checado).length;
    if (checkedCount > 0) {
      showToast('success', `Planilha "${result.fileName}" carregada com ${result.total} itens (${checkedCount} já validados da planilha)!`, {
        label: 'Desfazer',
        onClick: handleUndoAction
      });
    } else {
      showToast('success', `Planilha "${result.fileName}" carregada no ${activeHospital?.name || 'hospital'} com ${result.total} itens!`, {
        label: 'Desfazer',
        onClick: handleUndoAction
      });
    }
    loadHospitals();
    // Solicita configuração do serviço (somente calibração ou todos os parâmetros, tudo de uma vez ou separado)
    setServiceConfigModal({ isOpen: true, isInitialSetup: true });
  };

  const processFile = async (file) => {
    try {
      const result = await parseSpreadsheetFile(file);
      if (equipments && equipments.length >= 5) {
        setAbruptConfirmModal({
          isOpen: true,
          title: '⚠️ Atenção: Substituir Planilha Atual?',
          subtitle: `O hospital "${activeHospital?.name}" já possui ${equipments.length} equipamentos cadastrados. Ao carregar o novo arquivo, a planilha atual será substituída.`,
          affectedCount: equipments.length,
          affectedLabel: 'equipamentos atuais',
          operationType: 'replace',
          severity: 'warning',
          details: [
            { label: 'Planilha Atual', value: activeSheetName || 'Planilha Atual' },
            { label: 'Novo Arquivo', value: `${result.fileName} (${result.total} itens)` },
            { label: 'Conferências Atuais', value: `${equipments.filter(e => e.checado).length} validadas`, color: 'text-amber-500 font-bold' }
          ],
          confirmText: 'Sim, Substituir Planilha',
          cancelText: 'Cancelar',
          onConfirm: async () => {
            await executeApplyNewPlan(result);
          }
        });
        return;
      }
      await executeApplyNewPlan(result);
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

  // Google Sheets import (com suporte a link ao vivo e sincronização automática)
  const executeGoogleDataImport = async (data) => {
    if (equipments && equipments.length > 0) {
      recordUndoCheckpoint('Importação de Planilha Google', equipments, activeSheetName, googleSheetUrl);
    }
    const gUrl = data.googleSheetUrl || '';
    const gWebhook = data.googleSheetWebhookUrl || '';
    setGoogleSheetUrl(gUrl);
    if (gUrl) {
      localStorage.setItem(`calibracheck_google_url_${activeHospitalId}`, gUrl);
    }
    if (gWebhook) {
      setGoogleSheetWebhookUrl(gWebhook);
      localStorage.setItem(`calibracheck_google_webhook_${activeHospitalId}`, gWebhook);
    }
    await pushServerUpdate(data.equipments, data.fileName, 'Planilha Google importada', gUrl, gWebhook || undefined);
    const checkedCount = (data.equipments || []).filter(e => e.checado).length;
    if (gUrl) {
      if (checkedCount > 0) {
        showToast('success', `Planilha Google conectada com ${data.total} equipamentos (${checkedCount} já validados). Sincronização em tempo real ativada!`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      } else {
        showToast('success', `Planilha Google conectada com ${data.total} equipamentos! Sincronização em tempo real ativada.`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      }
    } else {
      if (checkedCount > 0) {
        showToast('success', `Planilha importada com ${data.total} equipamentos (${checkedCount} já validados da planilha)!`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      } else {
        showToast('success', `Planilha importada com ${data.total} equipamentos!`, {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
      }
    }
    loadHospitals();
    setServiceConfigModal({ isOpen: true, isInitialSetup: true });
  };

  const handleGoogleDataImport = async (data) => {
    if (equipments && equipments.length >= 5) {
      setAbruptConfirmModal({
        isOpen: true,
        title: '⚠️ Atenção: Conectar Nova Planilha Google?',
        subtitle: `O hospital "${activeHospital?.name}" já possui ${equipments.length} equipamentos cadastrados. Ao importar, a lista atual será substituída.`,
        affectedCount: equipments.length,
        affectedLabel: 'equipamentos atuais',
        operationType: 'replace',
        severity: 'warning',
        details: [
          { label: 'Planilha Atual', value: activeSheetName || 'Planilha Atual' },
          { label: 'Nova Planilha Google', value: `${data.fileName} (${data.total} itens)` },
          { label: 'Conferências Atuais', value: `${equipments.filter(e => e.checado).length} validadas`, color: 'text-amber-500 font-bold' }
        ],
        confirmText: 'Sim, Conectar Google Sheets',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          await executeGoogleDataImport(data);
        }
      });
      return;
    }
    await executeGoogleDataImport(data);
  };

  // Load sample data
  const handleLoadSample = async () => {
    if (equipments && equipments.length > 0) {
      recordUndoCheckpoint('Carregamento de Exemplo', equipments, activeSheetName, googleSheetUrl);
    }
    setGoogleSheetUrl('');
    localStorage.removeItem(`calibracheck_google_url_${activeHospitalId}`);
    await pushServerUpdate(SAMPLE_EQUIPMENT, 'Exemplo_Calibracao_Padrao.xlsx', 'Exemplo carregado', '');
    showToast('success', '10 equipamentos de exemplo carregados para teste imediato!', {
      label: 'Desfazer',
      onClick: handleUndoAction
    });
    loadHospitals();
    setServiceConfigModal({ isOpen: true, isInitialSetup: true });
  };

  // Reset / Clear hospital data com Alerta de Alteração Abrupta e Ponto de Restauração
  const handleResetData = async () => {
    if (!equipments || equipments.length === 0) {
      showToast('info', 'Não há dados para limpar neste hospital.');
      return;
    }

    const totalCount = equipments.length;
    const checkedCount = equipments.filter(e => e.checado).length;

    setAbruptConfirmModal({
      isOpen: true,
      title: '🚨 Atenção: Limpeza Total da Planilha!',
      subtitle: `Você está prestes a excluir todos os registros do "${activeHospital?.name || 'hospital atual'}".`,
      affectedCount: totalCount,
      affectedLabel: 'equipamentos',
      operationType: 'reset',
      severity: 'danger',
      details: [
        { label: 'Hospital', value: activeHospital?.name || 'Hospital Ativo' },
        { label: 'Planilha Ativa', value: activeSheetName || 'Planilha Atual' },
        { label: 'Total de Equipamentos', value: `${totalCount} itens`, color: 'text-rose-500 font-extrabold' },
        { label: 'Conferências Realizadas', value: `${checkedCount} itens checados`, color: 'text-amber-500 font-bold' }
      ],
      confirmText: 'Sim, Limpar Tudo',
      cancelText: 'Cancelar e Manter Dados',
      onConfirm: async () => {
        recordUndoCheckpoint('Limpeza Total da Planilha', equipments, activeSheetName, googleSheetUrl);
        setGoogleSheetUrl('');
        localStorage.removeItem(`calibracheck_google_url_${activeHospitalId}`);
        await pushServerUpdate([], '', 'Planilha limpa', '');
        try {
          await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospitalId: activeHospitalId })
          });
        } catch (e) {}
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SHEET_NAME_KEY);
        showToast('warning', 'Dados do hospital resetados com sucesso.', {
          label: 'Desfazer',
          onClick: handleUndoAction
        });
        loadHospitals();
      }
    });
  };

  // Export to Excel com suporte a multiequipes (todas as frentes)
  const handleExport = () => {
    if (equipments.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const hospSlug = (activeHospital?.name || 'calibracao').replace(/[^a-zA-Z0-9]/g, '_');
    const baseName = activeSheetName ? activeSheetName.replace(/\.[^/.]+$/, "") : hospSlug;
    const currentMod = MODALITIES[activeModality] || MODALITIES.calibracao;
    const fileName = `${baseName}_multiequipes_${dateStr}.xlsx`;
    exportToExcel(equipments, fileName, activeModality, sectorColors, activeHospital?.name);
    showToast('success', `Planilha completa multiequipes baixada com cores e formatação!`);
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
            {toast.action && (
              <button
                onClick={() => {
                  toast.action.onClick?.();
                  setToast(null);
                }}
                className="ml-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm shrink-0 border border-white/25 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{toast.action.label || 'Desfazer'}</span>
              </button>
            )}
            <button onClick={() => setToast(null)} className="opacity-80 hover:opacity-100 shrink-0 ml-1">
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
        onOpenMergeModal={() => setIsMergeModalOpen(true)}
        activeModality={activeModality}
        onChangeModality={setActiveModality}
        undoCheckpoint={undoCheckpoint?.hospitalId === activeHospitalId ? undoCheckpoint : null}
        onUndo={handleUndoAction}
        onResetData={handleResetData}
        googleSheetUrl={googleSheetUrl}
        googleSheetWebhookUrl={googleSheetWebhookUrl}
        serviceConfig={serviceConfig}
        onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: targetPlanId || activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 sm:pb-6 overflow-hidden">
        
        {/* Banner Flutuante de Desfazer Alteração em Massa / Abrupta */}
        {undoCheckpoint && undoCheckpoint.hospitalId === activeHospitalId && (
          <div className="mb-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/40 dark:border-amber-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Alteração Recente Realizada:
                  </span>
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 truncate max-w-xs sm:max-w-md">
                    {undoCheckpoint.actionDesc}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Deseja reverter esta alteração? Clique no botão ao lado para restaurar imediatamente os dados anteriores.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={handleUndoAction}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95"
                title="Restaurar dados imediatamente"
              >
                <RotateCcw className="w-4 h-4" />
                <span>↩️ Desfazer Alteração</span>
              </button>
              <button
                onClick={() => setUndoCheckpoint(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition"
                title="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {activeMainTab === 'auditoria' ? (
          <SpreadsheetAuditView
            equipments={equipments}
            hospitalName={activeHospital?.name}
            planTitle={activeSheetName}
            onRefresh={syncWithServer}
            serviceConfig={serviceConfig}
            onOpenServiceConfig={() => setServiceConfigModal({ isOpen: true, isInitialSetup: false })}
            sectorColors={sectorColors}
            onOpenSectorColors={() => setIsSectorColorModalOpen(true)}
            onOpenMergeModal={() => setIsMergeModalOpen(true)}
          />
        ) : activeMainTab === 'planejamento' ? (
          <MonthlyPlanningTab
            plans={monthlyPlans}
            activePlanId={activePlanId}
            onSwitchPlan={handleSwitchPlan}
            onCreatePlan={handleCreatePlan}
            onUpdatePlan={handleUpdatePlan}
            onDeletePlan={handleDeletePlan}
            hospitalName={activeHospital?.name}
            onNavigateToScanner={() => {
              setActiveMainTab('conferencia');
              setIsScannerOpen(true);
            }}
            onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: targetPlanId || activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
            onEditEquipment={(eq) => setEditEquipmentModal({ isOpen: true, equipment: eq })}
          />
        ) : activeMainTab === 'devolucao' ? (
          <CarrinhoDevolucaoTab
            equipments={equipments}
            hospitalName={activeHospital?.name}
            planTitle={activeSheetName}
            planId={activePlanId}
            sectorColors={sectorColors}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        ) : activeMainTab === 'perfil' ? (
          <TechnicianProfileTab
            currentUser={currentUser}
            activeHospital={activeHospital}
            equipments={equipments}
            activeModality={activeModality}
            onChangeModality={setActiveModality}
            serviceConfig={serviceConfig}
            onOpenServiceConfig={() => setServiceConfigModal({ isOpen: true, isInitialSetup: false })}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            onNavigateToConferencia={() => setActiveMainTab('conferencia')}
            onLogout={handleLogout}
          />
        ) : equipments.length === 0 ? (
          /* Empty / Welcome State */
          <HeroBanner
            onOpenFilePicker={() => fileInputRef.current?.click()}
            onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
            onLoadSample={handleLoadSample}
            onDropFile={processFile}
            onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
            hospitalName={activeHospital?.name}
          />
        ) : (
          /* Active Spreadsheet View */
          <div className="space-y-4 sm:space-y-6 w-full">
            


            {/* Barra do Agente de Sincronização Google Sheets em Tempo Real */}
            {(googleSheetUrl || googleSheetWebhookUrl) && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                    googleSheetWebhookUrl 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        🤖 Agente Google Sheets
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        googleSheetWebhookUrl 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${googleSheetWebhookUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                        {googleSheetWebhookUrl ? 'Gravação em Tempo Real Ativa' : 'Aguardando Webhook de Gravação'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {googleSheetWebhookUrl 
                        ? 'Cada calibração feita no sistema é enviada e gravada automaticamente na planilha Google.' 
                        : 'Planilha conectada para leitura. Para que o Agente grave as calibrações em tempo real na planilha, ative a gravação.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsGoogleModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    {googleSheetWebhookUrl ? 'Configurar Agente' : 'Ativar Gravação em Tempo Real'}
                  </button>
                  {googleSheetUrl && (
                    <button
                      onClick={() => handleSyncGoogleSheet(true)}
                      disabled={isSyncingGoogle}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      title="Sincronizar leitura agora"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingGoogle ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            )}

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
              sectorColors={sectorColors}
              onOpenSectorColors={() => setIsSectorColorModalOpen(true)}
              onEditEquipment={(eq) => setEditEquipmentModal({ isOpen: true, equipment: eq })}
              onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
            />

          </div>
        )}

      </main>

      {/* Scanner Modal com Conferência em Lote, Ajuste Exato de Tipos e Painel Redimensionável */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanCode}
        onBatchCheck={handleBatchCheck}
        equipments={equipments}
        soundEnabled={soundEnabled}
        activeModality={activeModality}
        onChangeModality={setActiveModality}
        serviceConfig={serviceConfig}
        onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: targetPlanId || activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
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
        serviceConfig={serviceConfig}
        onOpenAddEquipment={(targetPlanId, code, mode) => setAddEquipmentModal({ isOpen: true, planId: targetPlanId || activePlanId, initialCode: code || '', initialMode: mode || 'manual' })}
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
        hospitalId={activeHospitalId}
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
        currentGoogleSheetUrl={googleSheetUrl}
        currentGoogleSheetWebhookUrl={googleSheetWebhookUrl}
        onSaveGoogleWebhook={handleSaveGoogleWebhook}
        hospitalId={activeHospitalId}
        planId={activePlanId}
        equipments={equipments}
      />

      {/* Modal de Mesclagem de Calibrações Feitas (XLS, XLSX, CSV ou PDF) */}
      {isMergeModalOpen && (
        <MergeCalibrationsModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          equipments={equipments || []}
          serviceConfig={serviceConfig}
          currentUser={currentUser}
          onApplyMerge={handleApplyMerge}
          hospitalName={activeHospital?.name}
          planTitle={activeSheetName}
        />
      )}

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

      {/* Modal de Personalização de Cores dos Setores na Planilha */}
      <SectorColorModal
        isOpen={isSectorColorModalOpen}
        onClose={() => setIsSectorColorModalOpen(false)}
        equipments={equipments}
        sectorColors={sectorColors}
        onSaveSectorColors={handleSaveSectorColors}
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

      {/* Modal de Confirmação para Alteração Abrupta / Exclusão / Substituição */}
      <AbruptChangeConfirmModal
        isOpen={abruptConfirmModal.isOpen}
        onClose={() => setAbruptConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={abruptConfirmModal.onConfirm || (() => {})}
        title={abruptConfirmModal.title}
        subtitle={abruptConfirmModal.subtitle}
        affectedCount={abruptConfirmModal.affectedCount}
        affectedLabel={abruptConfirmModal.affectedLabel}
        operationType={abruptConfirmModal.operationType}
        severity={abruptConfirmModal.severity}
        details={abruptConfirmModal.details}
        confirmText={abruptConfirmModal.confirmText}
        cancelText={abruptConfirmModal.cancelText}
        hospitalName={activeHospital?.name}
        planTitle={activeSheetName}
      />

      {/* Modal Inteligente de Certeza do Operador (Já Bipada ou Em Manutenção) */}
      <AlreadyScannedAlertModal
        isOpen={Boolean(alreadyScannedAlert)}
        onClose={() => setAlreadyScannedAlert(null)}
        alertData={alreadyScannedAlert}
        onLocateInTable={(id) => {
          setLastScannedId(id);
          const el = document.getElementById(`eq-row-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
        onEditEquipment={(eq) => setEditEquipmentModal({ isOpen: true, equipment: eq })}
      />

      {/* Modal de Edição de Identificação do Equipamento (Tag/Série/Código de Barras com Senha) */}
      <EditEquipmentModal
        isOpen={editEquipmentModal.isOpen}
        onClose={() => setEditEquipmentModal({ isOpen: false, equipment: null })}
        equipment={editEquipmentModal.equipment}
        hospitalName={activeHospital?.name || 'Hospital'}
        currentUser={currentUser}
        onSave={handleSaveEquipmentEdit}
      />

      {/* Modal de Cadastro de Novo Equipamento no Plano */}
      <AddEquipmentModal
        isOpen={addEquipmentModal.isOpen}
        onClose={() => setAddEquipmentModal({ isOpen: false, planId: null, initialCode: '', initialMode: 'manual' })}
        onSave={handleSaveNewEquipment}
        onSaveBatch={handleBatchAddEquipments}
        plans={monthlyPlans}
        activePlanId={addEquipmentModal.planId || activePlanId}
        hospitalName={activeHospital?.name || 'Hospital'}
        existingSectors={Array.from(new Set(equipments.map(e => e.setor).filter(Boolean)))}
        initialCode={addEquipmentModal.initialCode}
        initialMode={addEquipmentModal.initialMode}
      />

      {/* Floating Mobile Bottom Action Bar (Thumb-friendly for Android & iOS) */}
      <MobileBottomBar
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenSerialScan={() => setIsSerialScanOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        onOpenAddEquipment={() => setAddEquipmentModal({ isOpen: true, planId: activePlanId, initialCode: '', initialMode: 'manual' })}
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
