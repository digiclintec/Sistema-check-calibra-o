import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  KeyRound, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Calendar,
  Clock,
  MapPin,
  Tag,
  Download,
  Filter,
  Activity,
  Award,
  Sparkles,
  Layers,
  Wrench,
  Zap,
  Target,
  Building2,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MODALITIES } from '../utils/modalities';
import { exportStyledPontoExcel } from '../utils/excelExporter';

export default function TeamManagementModal({ 
  isOpen, 
  onClose, 
  currentUser,
  equipments = [],
  hospitalName = 'Hospital',
  activeHospitalId,
  hospitals = [],
  initialTab = 'users'
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Filtros da aba de auditoria
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [selectedModalityFilter, setSelectedModalityFilter] = useState('ALL');
  const [searchAuditQuery, setSearchAuditQuery] = useState('');

  // Formulário de novo usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('operador');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedHospitalIds, setSelectedHospitalIds] = useState(() => [activeHospitalId || 'all']);

  // Redefinição de senha
  const [editingUserId, setEditingUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Edição de hospitais vinculados ao usuário
  const [editingPermsUserId, setEditingPermsUserId] = useState(null);
  const [editingPermsHospitalIds, setEditingPermsHospitalIds] = useState([]);

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || isMaster;

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      loadUsers();
      setMessage(null);
    }
  }, [isOpen, initialTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const hospParam = (!isMaster && activeHospitalId) ? `?hospitalId=${encodeURIComponent(activeHospitalId)}` : '';
      const res = await fetch(`/api/users${hospParam}`);
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (e) {
      console.warn('Erro ao carregar usuários:', e);
    } finally {
      setLoading(false);
    }
  };

  // Limitação de visibilidade por hospital:
  // O Master pode ver todos os usuários cadastrados.
  // Técnicos e supervisores locais enxergam ESTRITAMENTE os técnicos alocados no seu hospital!
  const visibleUsers = useMemo(() => {
    if (isMaster) {
      return users;
    }

    const targetHospId = activeHospitalId || currentUser?.hospitalIds?.[0] || currentUser?.hospitalId;
    if (!targetHospId) return users;

    return users.filter(u => {
      const uHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0 
        ? u.hospitalIds 
        : [u.hospitalId || 'all'];

      // Retorna apenas se o usuário pertencer a este hospital ou for o próprio usuário logado
      return uHospIds.includes(targetHospId) || (u.role === 'master' && uHospIds.includes('all')) || u.id === currentUser?.id;
    });
  }, [users, isMaster, activeHospitalId, currentUser]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    // Se não for master, o usuário é vinculado obrigatoriamente e exclusivamente a este hospital
    const targetHospId = activeHospitalId || currentUser?.hospitalIds?.[0] || currentUser?.hospitalId || 'hosp_central';
    const targetHospIds = isMaster ? selectedHospitalIds : [targetHospId];

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName.trim(),
          email: userEmail.trim(),
          password: userPassword.trim(),
          role: isAdmin ? userRole : 'operador',
          hospitalIds: targetHospIds
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Usuário ${userName} criado com sucesso!` });
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setUserRole('operador');
        setSelectedHospitalIds([activeHospitalId || 'all']);
        setActiveTab('users');
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Falha ao cadastrar usuário.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHospSelection = (hospId) => {
    if (hospId === 'all') {
      setSelectedHospitalIds(['all']);
      return;
    }

    let next = selectedHospitalIds.filter(id => id !== 'all');
    if (next.includes(hospId)) {
      next = next.filter(id => id !== hospId);
      if (next.length === 0) next = ['all'];
    } else {
      next.push(hospId);
    }
    setSelectedHospitalIds(next);
  };

  const handleToggleEditingPerms = (hospId) => {
    if (hospId === 'all') {
      setEditingPermsHospitalIds(['all']);
      return;
    }
    let next = editingPermsHospitalIds.filter(id => id !== 'all');
    if (next.includes(hospId)) {
      next = next.filter(id => id !== hospId);
      if (next.length === 0) next = ['all'];
    } else {
      next.push(hospId);
    }
    setEditingPermsHospitalIds(next);
  };

  const handleSaveUserPermissions = async (userId) => {
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          hospitalIds: editingPermsHospitalIds
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Hospitais do usuário atualizados com sucesso!' });
        setEditingPermsUserId(null);
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao atualizar permissões.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    }
  };

  const handleDeleteUser = async (userId, userEmailName) => {
    if (!window.confirm(`Tem certeza que deseja excluir o acesso de ${userEmailName}?`)) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Usuário excluído com sucesso.' });
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao excluir usuário.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!editingUserId || !newPassword.trim()) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUserId, newPassword: newPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
        setEditingUserId(null);
        setNewPassword('');
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao atualizar senha.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- MÉTODOS DE AUDITORIA & PRODUTIVIDADE ---------------- //

  // Extrai todas as ações de conferência registradas
  const auditEntries = useMemo(() => {
    const list = [];

    equipments.forEach(eq => {
      // 1. Calibração
      if (eq.check_calibracao || (eq.checado && !eq.check_preventiva && !eq.check_seguranca)) {
        list.push({
          id: `${eq.id}-calibracao`,
          equipmentId: eq.id,
          equipmentName: eq.equipamento || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          barcode: eq.codigoBarras || '',
          setorOriginal: eq.setor || 'N/A',
          setorRetirada: eq.setor_retirada || eq.setor || 'N/A',
          modality: 'calibracao',
          modalityLabel: 'Calibração',
          user: eq.usuario_calibracao || eq.conferidoPor || 'Técnico',
          date: eq.data_calibracao || eq.dataCheck || null,
          obs: eq.observacao || ''
        });
      }

      // 2. Preventiva
      if (eq.check_preventiva) {
        list.push({
          id: `${eq.id}-preventiva`,
          equipmentId: eq.id,
          equipmentName: eq.equipamento || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          barcode: eq.codigoBarras || '',
          setorOriginal: eq.setor || 'N/A',
          setorRetirada: eq.setor_retirada || eq.setor || 'N/A',
          modality: 'preventiva',
          modalityLabel: 'Manutenção Preventiva',
          user: eq.usuario_preventiva || eq.conferidoPor || 'Técnico',
          date: eq.data_preventiva || eq.dataCheck || null,
          obs: eq.observacao || ''
        });
      }

      // 3. Segurança Elétrica
      if (eq.check_seguranca) {
        list.push({
          id: `${eq.id}-seguranca`,
          equipmentId: eq.id,
          equipmentName: eq.equipamento || 'Bomba de Infusão',
          tag: eq.tag || 'N/A',
          serie: eq.serie || 'N/A',
          barcode: eq.codigoBarras || '',
          setorOriginal: eq.setor || 'N/A',
          setorRetirada: eq.setor_retirada || eq.setor || 'N/A',
          modality: 'seguranca',
          modalityLabel: 'Segurança Elétrica (TSE)',
          user: eq.usuario_seguranca || eq.conferidoPor || 'Técnico',
          date: eq.data_seguranca || eq.dataCheck || null,
          obs: eq.observacao || ''
        });
      }
    });

    // Ordena por data mais recente primeiro
    return list.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [equipments]);

  // Estatísticas agrupadas por usuário
  const userStats = useMemo(() => {
    const statsMap = {};

    auditEntries.forEach(entry => {
      const userName = entry.user || 'Operador';
      if (!statsMap[userName]) {
        statsMap[userName] = {
          name: userName,
          total: 0,
          calibracao: 0,
          preventiva: 0,
          seguranca: 0,
          sectors: new Set(),
          lastActionDate: entry.date
        };
      }

      statsMap[userName].total += 1;
      if (entry.modality === 'calibracao') statsMap[userName].calibracao += 1;
      if (entry.modality === 'preventiva') statsMap[userName].preventiva += 1;
      if (entry.modality === 'seguranca') statsMap[userName].seguranca += 1;
      if (entry.setorRetirada && entry.setorRetirada !== 'N/A') {
        statsMap[userName].sectors.add(entry.setorRetirada);
      }
    });

    return Object.values(statsMap).sort((a, b) => b.total - a.total);
  }, [auditEntries]);

  // Lista de usuários únicos identificados nos trabalhos
  const uniqueTechnicians = useMemo(() => {
    const set = new Set();
    auditEntries.forEach(e => {
      if (e.user) set.add(e.user);
    });
    return Array.from(set).sort();
  }, [auditEntries]);

  // Entradas filtradas
  const filteredAuditEntries = useMemo(() => {
    return auditEntries.filter(entry => {
      if (selectedUserFilter !== 'ALL' && entry.user !== selectedUserFilter) {
        return false;
      }
      if (selectedModalityFilter !== 'ALL' && entry.modality !== selectedModalityFilter) {
        return false;
      }
      if (searchAuditQuery.trim()) {
        const q = searchAuditQuery.toLowerCase().trim();
        const tag = (entry.tag || '').toLowerCase();
        const serie = (entry.serie || '').toLowerCase();
        const name = (entry.equipmentName || '').toLowerCase();
        const sector = (entry.setorRetirada || '').toLowerCase();
        const user = (entry.user || '').toLowerCase();
        return tag.includes(q) || serie.includes(q) || name.includes(q) || sector.includes(q) || user.includes(q);
      }
      return true;
    });
  }, [auditEntries, selectedUserFilter, selectedModalityFilter, searchAuditQuery]);

  // Exportar relatório de auditoria e produtividade em Excel com cores e resumo
  const handleExportAuditExcel = () => {
    if (filteredAuditEntries.length === 0) return;
    exportStyledPontoExcel(filteredAuditEntries, {
      hospitalName: hospitalName || 'Hospital',
      fileName: `relatorio_trabalhos_equipe_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                Equipe & Auditoria de Trabalhos
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {hospitalName}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie usuários do sistema e audite o trabalho realizado por cada técnico
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 shrink-0 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Técnicos & Equipe ({visibleUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create_user')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'create_user'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>+ Criar Novo Login</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 text-blue-400" />
            <span>Auditoria & Trabalhos ({auditEntries.length})</span>
          </button>
        </div>

        {/* Global Feedback Message */}
        {message && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* ================= TAB 1: AUDITORIA DE TRABALHOS ================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6">

              {/* Top Productivity Cards per Technician */}
              {userStats.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    Produtividade por Técnico
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {userStats.map((st, i) => (
                      <div 
                        key={st.name}
                        onClick={() => setSelectedUserFilter(selectedUserFilter === st.name ? 'ALL' : st.name)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer relative overflow-hidden ${
                          selectedUserFilter === st.name
                            ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white truncate max-w-[170px]">
                            {st.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-500/20 text-blue-300">
                            {st.total} {st.total === 1 ? 'conferência' : 'conferências'}
                          </span>
                        </div>

                        {/* Modalities pills breakdown */}
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            Calib: {st.calibracao}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            Prev: {st.preventiva}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Seg: {st.seguranca}
                          </span>
                        </div>

                        {st.sectors.size > 0 && (
                          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                            <span className="truncate">
                              Setores: {Array.from(st.sectors).slice(0, 3).join(', ')}{st.sectors.size > 3 ? '...' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters & Export Bar */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por tag, série, setor ou técnico..."
                      value={searchAuditQuery}
                      onChange={(e) => setSearchAuditQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    {/* User Filter */}
                    <select
                      value={selectedUserFilter}
                      onChange={(e) => setSelectedUserFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">Todos os Técnicos ({uniqueTechnicians.length})</option>
                      {uniqueTechnicians.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    {/* Modality Filter */}
                    <select
                      value={selectedModalityFilter}
                      onChange={(e) => setSelectedModalityFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">Todas as Frentes</option>
                      <option value="calibracao">Calibração</option>
                      <option value="preventiva">Manut. Preventiva</option>
                      <option value="seguranca">Segurança Elétrica</option>
                    </select>

                    {/* Export Excel Button */}
                    <button
                      onClick={handleExportAuditExcel}
                      disabled={filteredAuditEntries.length === 0}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
                      title="Exportar esta lista de trabalhos para planilha Excel"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed Activity Feed / Table */}
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-slate-400">
                  <span>Trabalhos Realizados ({filteredAuditEntries.length})</span>
                  {selectedUserFilter !== 'ALL' && (
                    <button 
                      onClick={() => setSelectedUserFilter('ALL')}
                      className="text-blue-400 hover:underline"
                    >
                      Limpar filtro de técnico
                    </button>
                  )}
                </div>

                {filteredAuditEntries.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <Activity className="w-8 h-8 mx-auto opacity-30 text-blue-400" />
                    <p className="text-xs font-semibold">Nenhuma conferência encontrada com os filtros selecionados</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredAuditEntries.map((entry) => {
                      const mod = MODALITIES[entry.modality] || MODALITIES.calibracao;

                      return (
                        <div 
                          key={entry.id}
                          className="p-3.5 bg-slate-950/50 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${mod.bgLight} ${mod.color} ${mod.border}`}>
                              <CheckCircle className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs sm:text-sm truncate">
                                  {entry.equipmentName}
                                </span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                  IDEC: {entry.tag}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  SN: {entry.serie}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-1 flex-wrap">
                                <span className={`font-semibold ${mod.color}`}>
                                  {entry.modalityLabel}
                                </span>

                                <span className="text-slate-600">•</span>

                                {/* Setor de Retirada */}
                                <span className="flex items-center gap-1 text-teal-300 font-medium">
                                  <MapPin className="w-3 h-3 text-teal-400" />
                                  Retirado em: <strong>{entry.setorRetirada}</strong>
                                </span>

                                {entry.setorOriginal && entry.setorOriginal !== entry.setorRetirada && (
                                  <span className="text-[10px] text-slate-500">
                                    (Cadastrado: {entry.setorOriginal})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Technician & Date info */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 text-xs shrink-0">
                            <span className="font-semibold text-slate-200 flex items-center gap-1">
                              👤 {entry.user}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {entry.date ? new Date(entry.date).toLocaleString('pt-BR') : 'Data não registrada'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ================= TAB 2: LISTA DE USUÁRIOS ================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {isMaster 
                    ? `Todos os Usuários do Sistema (${visibleUsers.length})` 
                    : `Técnicos da Equipe - ${hospitalName} (${visibleUsers.length})`}
                </h4>
                <button
                  onClick={() => setActiveTab('create_user')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Criar Novo Login</span>
                </button>
              </div>

              {visibleUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Nenhum técnico cadastrado para este hospital além de você.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleUsers.map((u) => {
                    const isUCurrent = u.email === currentUser?.email;
                    const isUMaster = u.role === 'master';

                    return (
                      <div
                        key={u.id}
                        className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name?.slice(0, 2).toUpperCase() || 'US'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">{u.name}</span>
                              {isUMaster && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Master
                                </span>
                              )}
                              {u.role === 'admin' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Admin
                                </span>
                              )}
                              {u.role === 'operador' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Técnico de Campo
                                </span>
                              )}
                              {isUCurrent && (
                                <span className="text-[10px] font-semibold text-emerald-400">
                                  (Você)
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>

                            {/* Assigned Hospitals */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {(u.role === 'master' || (u.hospitalIds && u.hospitalIds.includes('all')) || u.hospitalId === 'all') ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  🌐 Todos os Hospitais
                                </span>
                              ) : (
                                (u.hospitalIds || [u.hospitalId]).filter(Boolean).map(hId => {
                                  const hospObj = hospitals.find(h => h.id === hId);
                                  return (
                                    <span 
                                      key={hId}
                                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                    >
                                      🏥 {hospObj?.name || hId}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isAdmin && !isUMaster && (
                            <button
                              onClick={() => {
                                if (editingPermsUserId === u.id) {
                                  setEditingPermsUserId(null);
                                } else {
                                  setEditingPermsUserId(u.id);
                                  const currentIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0
                                    ? u.hospitalIds
                                    : [u.hospitalId || 'all'];
                                  setEditingPermsHospitalIds(currentIds);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg transition flex items-center gap-1 font-semibold border ${
                                editingPermsUserId === u.id
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
                              }`}
                              title="Alterar hospitais autorizados para este técnico"
                            >
                              <Building2 className="w-3.5 h-3.5 text-blue-400" />
                              <span>Hospitais</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => setEditingUserId(editingUserId === u.id ? null : u.id)}
                              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-1 font-semibold"
                              title="Redefinir senha"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Senha</span>
                            </button>
                          )}

                          {isAdmin && !isUMaster && !isUCurrent && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Inline hospital permissions form */}
                        {editingPermsUserId === u.id && (
                          <div className="w-full pt-3 mt-2 border-t border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                              <span>Marque os hospitais autorizados para {u.name}:</span>
                              <button
                                type="button"
                                onClick={() => setEditingPermsUserId(null)}
                                className="text-slate-400 hover:text-white"
                              >
                                Cancelar
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800">
                              <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editingPermsHospitalIds.includes('all')}
                                  onChange={() => handleToggleEditingPerms('all')}
                                  className="rounded text-blue-600 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-white">🌐 Todos os Hospitais</span>
                              </label>

                              {hospitals.map(h => (
                                <label
                                  key={h.id}
                                  className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer text-xs transition ${
                                    editingPermsHospitalIds.includes(h.id) || editingPermsHospitalIds.includes('all')
                                      ? 'bg-blue-950/20 border-blue-500/40 text-blue-200'
                                      : 'bg-slate-950 border-slate-800 text-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={editingPermsHospitalIds.includes('all')}
                                    checked={editingPermsHospitalIds.includes('all') || editingPermsHospitalIds.includes(h.id)}
                                    onChange={() => handleToggleEditingPerms(h.id)}
                                    className="rounded text-blue-600 focus:ring-0"
                                  />
                                  <span className="truncate">{h.name}</span>
                                </label>
                              ))}
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleSaveUserPermissions(u.id)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Salvar Vínculos</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline password edit form */}
                        {editingUserId === u.id && (
                          <div className="w-full pt-3 mt-2 border-t border-slate-800 flex items-center gap-2">
                            <input
                              type="password"
                              placeholder="Digite a nova senha..."
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 flex-1 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={handleUpdatePassword}
                              disabled={!newPassword.trim() || loading}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                            >
                              Salvar Senha
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: CRIAR NOVO USUÁRIO ================= */}
          {activeTab === 'create_user' && (
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo:</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Técnico, Rodrigo Santos"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail de Login:</label>
                <input
                  type="email"
                  placeholder="tecnico@digiclintec.com.br"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso:</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo de 6 caracteres"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Função / Nível de Acesso:</label>
                {isAdmin ? (
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="operador">Técnico de Campo (Bipagem, conferência e fotos)</option>
                    <option value="admin">Administrador (Subir planilhas e gerenciar dados)</option>
                    {isMaster && <option value="master">Master (Controle total do sistema)</option>}
                  </select>
                ) : (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Técnico de Campo (Acesso à bipagem e devolução no hospital ativo)</span>
                  </div>
                )}
              </div>

              {/* Multi-hospital permissions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vincular ao Hospital:
                </label>
                {isMaster ? (
                  <div className="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedHospitalIds.includes('all')}
                        onChange={() => handleToggleHospSelection('all')}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-white">🌐 Todos os Hospitais</span>
                    </label>

                    {hospitals.map(h => (
                      <label 
                        key={h.id} 
                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer text-xs ${
                          selectedHospitalIds.includes(h.id) || selectedHospitalIds.includes('all')
                            ? 'bg-blue-950/20 border-blue-500/40 text-blue-200'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={selectedHospitalIds.includes('all')}
                          checked={selectedHospitalIds.includes('all') || selectedHospitalIds.includes(h.id)}
                          onChange={() => handleToggleHospSelection(h.id)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{h.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Este técnico terá acesso exclusivamente ao: <strong>{hospitalName}</strong></span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Cadastrando...' : 'Cadastrar Novo Usuário'}</span>
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}

