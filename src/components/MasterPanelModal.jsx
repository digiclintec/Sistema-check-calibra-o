import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  UserPlus, 
  Users, 
  Trash2, 
  KeyRound, 
  Crown, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  PlusCircle,
  Sparkles,
  Layers,
  Wrench,
  Zap,
  Target,
  ExternalLink,
  Edit2,
  Save,
  Check
} from 'lucide-react';

export default function MasterPanelModal({ 
  isOpen, 
  onClose, 
  currentUser,
  hospitals = [],
  activeHospitalId,
  onSwitchHospital,
  onRefreshHospitals
}) {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' | 'create_hospital' | 'users' | 'create_user'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // User creation state
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('operador');
  const [selectedHospitalIds, setSelectedHospitalIds] = useState(['all']);
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Hospital creation state
  const [hospName, setHospName] = useState('');
  const [hospCity, setHospCity] = useState('');
  const [hospCnpj, setHospCnpj] = useState('');
  const [hospPlan, setHospPlan] = useState('pro');

  // Password reset modal state
  const [editingUserId, setEditingUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Inline user hospital permissions editing
  const [editingPermsUserId, setEditingPermsUserId] = useState(null);
  const [editingPermsHospitalIds, setEditingPermsHospitalIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      if (onRefreshHospitals) onRefreshHospitals();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
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
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao atualizar permissões.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName.trim(),
          email: userEmail.trim(),
          password: userPassword.trim(),
          role: userRole,
          hospitalIds: selectedHospitalIds
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Usuário "${userName}" cadastrado com sucesso!` });
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setSelectedHospitalIds(['all']);
        setActiveTab('users');
        loadUsers();
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao cadastrar usuário.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHospital = async (e) => {
    e.preventDefault();
    if (!hospName.trim()) {
      setMessage({ type: 'error', text: 'Informe o nome do hospital ou clínica.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hospName.trim(),
          cidade: hospCity.trim(),
          cnpj: hospCnpj.trim(),
          plano: hospPlan
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Hospital "${hospName}" cadastrado com sucesso!` });
        setHospName('');
        setHospCity('');
        setHospCnpj('');
        setActiveTab('hospitals');
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao cadastrar hospital.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHospital = async (hospId, hospTitle) => {
    if (!window.confirm(`Tem certeza que deseja excluir o hospital "${hospTitle}"? Todos os equipamentos deste hospital serão apagados.`)) {
      return;
    }

    try {
      const res = await fetch('/api/hospitals/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hospId })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Hospital "${hospTitle}" excluído com sucesso.` });
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao excluir hospital.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    }
  };

  const handleChangeHospitalPlan = async (hospId, newPlan) => {
    try {
      const res = await fetch('/api/hospitals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hospId, plano: newPlan })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Plano atualizado para ${newPlan.toUpperCase()}!` });
        if (onRefreshHospitals) onRefreshHospitals();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao atualizar plano.' });
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir o acesso de "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Usuário "${name}" removido com sucesso.` });
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Não foi possível excluir o usuário.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão ao excluir.' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || !editingUserId) return;

    try {
      const res = await fetch('/api/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUserId, newPassword: newPassword.trim() })
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setEditingUserId(null);
        setNewPassword('');
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao alterar senha.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Painel Master
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Multi-Hospital & Equipes
                </span>
              </h3>
              <p className="text-xs text-slate-400">Gerenciamento de hospitais, progresso individual e atribuição de técnicos</p>
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('hospitals'); setMessage(null); }}
            className={`py-2 px-3.5 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'hospitals'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Hospitais & Progresso ({hospitals.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('create_hospital'); setMessage(null); }}
            className={`py-2 px-3.5 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'create_hospital'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            + Novo Hospital
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('users'); setMessage(null); }}
            className={`py-2 px-3.5 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Operadores & Acessos ({users.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('create_user'); setMessage(null); }}
            className={`py-2 px-3.5 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'create_user'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Novo Operador
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {message && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              message.type === 'error'
                ? 'bg-red-500/15 border-red-500/30 text-red-200'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
            }`}>
              {message.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{message.text}</div>
            </div>
          )}

          {/* TAB 1: LIST HOSPITALS & DETAILED PROGRESS DASHBOARD */}
          {activeTab === 'hospitals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Acompanhamento em tempo real do progresso de calibração e preventiva de cada hospital:</span>
                <span className="text-slate-500">{hospitals.length} hospitais cadastrados</span>
              </div>

              {hospitals.map((h) => {
                const isActive = h.id === activeHospitalId;
                const planName = h.plano === 'enterprise' ? 'Enterprise' : h.plano === 'basico' ? 'Básico' : 'Profissional';
                const total = h.equipmentCount || 0;

                return (
                  <div
                    key={h.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border-blue-500/60 shadow-xl ring-1 ring-blue-500/30' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-base tracking-wide">{h.name}</h4>
                          {isActive && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-sm flex items-center gap-1">
                              <Check className="w-3 h-3" /> Em Operação
                            </span>
                          )}
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            h.plano === 'enterprise' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : h.plano === 'basico'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            Plano {planName}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {h.cidade && <span>📍 {h.cidade}</span>}
                          {h.cnpj && <span className="font-mono text-slate-500">CNPJ: {h.cnpj}</span>}
                          {h.activeSheetName && (
                            <span className="text-slate-400">📄 Planilha: <strong className="text-slate-300">{h.activeSheetName}</strong></span>
                          )}
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={h.plano || 'pro'}
                          onChange={(e) => handleChangeHospitalPlan(h.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
                          title="Alterar plano deste hospital"
                        >
                          <option value="basico">Básico (R$ 290)</option>
                          <option value="pro">Pro (R$ 590)</option>
                          <option value="enterprise">Enterprise (R$ 1.290)</option>
                        </select>

                        <button
                          onClick={() => {
                            if (onSwitchHospital) onSwitchHospital(h.id);
                            onClose();
                          }}
                          className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isActive ? 'Ver Hospital' : 'Abrir Hospital'}
                        </button>

                        <button
                          onClick={() => handleDeleteHospital(h.id, h.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Excluir este hospital"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                      {/* Calibração */}
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-blue-400 font-semibold flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" /> Calibração
                          </span>
                          <span className="text-xs font-bold text-blue-300">{h.calPercent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(h.calPercent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>{h.calOk || 0} de {total}</span>
                          <span className="text-slate-500">concluídos</span>
                        </div>
                      </div>

                      {/* Preventiva */}
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5" /> Preventiva
                          </span>
                          <span className="text-xs font-bold text-emerald-300">{h.prevPercent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(h.prevPercent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>{h.prevOk || 0} de {total}</span>
                          <span className="text-slate-500">concluídos</span>
                        </div>
                      </div>

                      {/* Segurança Elétrica */}
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-purple-400 font-semibold flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> Seg. Elétrica
                          </span>
                          <span className="text-xs font-bold text-purple-300">{h.segPercent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(h.segPercent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>{h.segOk || 0} de {total}</span>
                          <span className="text-slate-500">concluídos</span>
                        </div>
                      </div>

                      {/* 100% Geral */}
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> 100% Geral
                          </span>
                          <span className="text-xs font-bold text-amber-300">{h.completePercent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(h.completePercent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>{h.complete100 || 0} de {total}</span>
                          <span className="text-slate-500">completos</span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Team Members Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500 font-medium text-[11px]">Equipe autorizada:</span>
                        {Array.isArray(h.assignedUsers) && h.assignedUsers.length > 0 ? (
                          h.assignedUsers.map(u => (
                            <span 
                              key={u.id}
                              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 text-[11px] font-medium"
                            >
                              👤 {u.name} {u.role === 'master' ? '👑' : ''}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Nenhum operador exclusivo</span>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: CREATE HOSPITAL */}
          {activeTab === 'create_hospital' && (
            <form onSubmit={handleCreateHospital} className="space-y-4 max-w-xl mx-auto py-2">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome do Hospital ou Clínica:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hospital Santa Helena"
                    value={hospName}
                    onChange={(e) => setHospName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Cidade / Estado:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo - SP"
                      value={hospCity}
                      onChange={(e) => setHospCity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      CNPJ (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={hospCnpj}
                      onChange={(e) => setHospCnpj(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Plano de Serviço:
                  </label>
                  <select
                    value={hospPlan}
                    onChange={(e) => setHospPlan(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="basico">Plano Básico (Até 100 equipamentos • R$ 290/mês)</option>
                    <option value="pro">Plano Profissional (Até 500 equipamentos • R$ 590/mês)</option>
                    <option value="enterprise">Plano Enterprise (Equipamentos Ilimitados • R$ 1.290/mês)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {loading ? 'Cadastrando...' : 'Cadastrar Hospital'}
              </button>
            </form>
          )}

          {/* TAB 3: LIST OPERATORS & HOSPITAL ACCESS PERMISSIONS */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Gerencie quem pode acessar cada hospital ou conceda acesso a múltiplos hospitais:
              </div>

              {users.map((u) => {
                const isMaster = u.role === 'master' || u.email.toLowerCase() === 'digiclintec@gmail.com';
                const isEditingPassword = editingUserId === u.id;
                const isEditingPerms = editingPermsUserId === u.id;

                const userHospIds = Array.isArray(u.hospitalIds) && u.hospitalIds.length > 0
                  ? u.hospitalIds
                  : [u.hospitalId || 'all'];

                const hasAllAccess = userHospIds.includes('all') || isMaster;

                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{u.name}</span>
                          {isMaster ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <Crown className="w-3 h-3" /> Master
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                              {u.role || 'Operador'}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-mono">({u.email})</span>
                        </div>

                        {/* Assigned Hospitals Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] text-slate-500 font-medium">Hospitais autorizados:</span>
                          {hasAllAccess ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              🌐 Todos os Hospitais (Acesso Global)
                            </span>
                          ) : (
                            userHospIds.map(hId => {
                              const hospObj = hospitals.find(h => h.id === hId);
                              return (
                                <span 
                                  key={hId}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                >
                                  🏥 {hospObj?.name || hId}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!isMaster && (
                          <button
                            onClick={() => {
                              if (isEditingPerms) {
                                setEditingPermsUserId(null);
                              } else {
                                setEditingPermsUserId(u.id);
                                setEditingPermsHospitalIds(userHospIds);
                              }
                            }}
                            className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                              isEditingPerms 
                                ? 'bg-blue-600 border-blue-500 text-white' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Vincular Hospitais</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingUserId(isEditingPassword ? null : u.id);
                            setNewPassword('');
                          }}
                          className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>Senha</span>
                        </button>

                        {!isMaster && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Remover operador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Hospital Permissions Editor */}
                    {isEditingPerms && (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/40 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-300">
                            Selecione os hospitais que {u.name} pode acessar:
                          </span>
                          <button
                            onClick={() => setEditingPermsUserId(null)}
                            className="text-slate-400 hover:text-white text-xs"
                          >
                            Cancelar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700">
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
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                                editingPermsHospitalIds.includes(h.id) || editingPermsHospitalIds.includes('all')
                                  ? 'bg-blue-950/30 border-blue-500/50 text-blue-200'
                                  : 'bg-slate-950/80 border-slate-800 text-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={editingPermsHospitalIds.includes('all')}
                                checked={editingPermsHospitalIds.includes('all') || editingPermsHospitalIds.includes(h.id)}
                                onChange={() => handleToggleEditingPerms(h.id)}
                                className="rounded text-blue-600 focus:ring-0"
                              />
                              <span className="text-xs font-medium truncate">{h.name}</span>
                            </label>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveUserPermissions(u.id)}
                            className="py-1.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Salvar Permissões
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Password Change */}
                    {isEditingPassword && (
                      <form
                        onSubmit={handleChangePassword}
                        className="w-full pt-3 mt-2 border-t border-slate-800 flex items-center gap-2"
                      >
                        <input
                          type="password"
                          required
                          placeholder="Digite a nova senha..."
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          className="py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
                        >
                          Salvar Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="py-1.5 px-2 text-slate-400 hover:text-white text-xs"
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: CREATE USER WITH MULTI-HOSPITAL SELECTOR */}
          {activeTab === 'create_user' && (
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-xl mx-auto py-2">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome do Operador / Técnico:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Metrologista"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    E-mail de Login:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@helpclintec.com.br"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Senha Inicial:
                  </label>
                  <div className="relative">
                    <input
                      type={showUserPassword ? 'text' : 'password'}
                      required
                      placeholder="Defina uma senha de acesso..."
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                    >
                      {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Perfil de Acesso:
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="operador">Operador de Campo / Bipagem</option>
                    <option value="administrador">Administrador Técnico</option>
                  </select>
                </div>

                {/* MULTI-HOSPITAL SELECTOR */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Hospitais Autorizados para este Usuário:
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Marque um ou mais hospitais onde este operador poderá atuar e acompanhar o progresso:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedHospitalIds.includes('all')}
                        onChange={() => handleToggleHospSelection('all')}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-white">🌐 Todos os Hospitais (Global)</span>
                    </label>

                    {hospitals.map(h => (
                      <label 
                        key={h.id} 
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                          selectedHospitalIds.includes(h.id) || selectedHospitalIds.includes('all')
                            ? 'bg-blue-950/30 border-blue-500/50 text-blue-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={selectedHospitalIds.includes('all')}
                          checked={selectedHospitalIds.includes('all') || selectedHospitalIds.includes(h.id)}
                          onChange={() => handleToggleHospSelection(h.id)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span className="text-xs font-medium truncate">{h.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Cadastrando...' : 'Cadastrar Operador'}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
