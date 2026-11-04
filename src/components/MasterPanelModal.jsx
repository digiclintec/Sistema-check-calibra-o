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
  Layers
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

  // User form state
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('operador');
  const [userHospitalId, setUserHospitalId] = useState('all');
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Hospital form state
  const [hospName, setHospName] = useState('');
  const [hospCity, setHospCity] = useState('');
  const [hospCnpj, setHospCnpj] = useState('');
  const [hospPlan, setHospPlan] = useState('pro');

  // Password reset modal state
  const [editingUserId, setEditingUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
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
          hospitalId: userHospitalId
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Usuário "${userName}" cadastrado com sucesso!` });
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setActiveTab('users');
        loadUsers();
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
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
                  Multi-Hospital & SaaS
                </span>
              </h3>
              <p className="text-xs text-slate-400">Controle hospitais clientes, planos e operadores</p>
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
            className={`py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'hospitals'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Hospitais ({hospitals.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('create_hospital'); setMessage(null); }}
            className={`py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
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
            className={`py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Operadores ({users.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('create_user'); setMessage(null); }}
            className={`py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'create_user'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Novo Usuário
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
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

          {/* TAB 1: LIST HOSPITALS & PLANS */}
          {activeTab === 'hospitals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Clique em um hospital para ativá-lo ou mude o plano correspondente:</span>
              </div>

              {hospitals.map((h) => {
                const isActive = h.id === activeHospitalId;
                const planName = h.plano === 'enterprise' ? 'Enterprise' : h.plano === 'basico' ? 'Básico' : 'Profissional';

                return (
                  <div
                    key={h.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-blue-950/30 border-blue-500/60 shadow-lg ring-1 ring-blue-500/30' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-base">{h.name}</h4>
                          {isActive && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Ativo Agora
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
                          {h.cnpj && <span>CNPJ: {h.cnpj}</span>}
                          <span className="text-blue-400 font-semibold">
                            📦 {h.equipmentCount || 0} equipamentos ({h.checkedCount || 0} checados)
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Plan Selector Dropdown */}
                        <select
                          value={h.plano || 'pro'}
                          onChange={(e) => handleChangeHospitalPlan(h.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
                          title="Alterar plano deste hospital"
                        >
                          <option value="basico">Plano Básico (R$ 290)</option>
                          <option value="pro">Plano Pro (R$ 590)</option>
                          <option value="enterprise">Plano Enterprise (R$ 1.290)</option>
                        </select>

                        {!isActive && (
                          <button
                            onClick={() => {
                              if (onSwitchHospital) onSwitchHospital(h.id);
                              setMessage({ type: 'success', text: `Alternado para "${h.name}"!` });
                            }}
                            className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                          >
                            Ativar
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteHospital(h.id, h.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Excluir este hospital"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: CREATE HOSPITAL */}
          {activeTab === 'create_hospital' && (
            <form onSubmit={handleCreateHospital} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Hospital ou Clínica:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hospital São Lucas"
                  value={hospName}
                  onChange={(e) => setHospName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cidade / Estado:
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Belo Horizonte - MG"
                    value={hospCity}
                    onChange={(e) => setHospCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Plano Contratado:
                </label>
                <select
                  value={hospPlan}
                  onChange={(e) => setHospPlan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="basico">Plano Básico (Até 100 equipamentos • R$ 290/mês)</option>
                  <option value="pro">Plano Profissional (Até 500 equipamentos • R$ 590/mês)</option>
                  <option value="enterprise">Plano Enterprise (Equipamentos Ilimitados • R$ 1.290/mês)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Hospital'}
              </button>
            </form>
          )}

          {/* TAB 3: LIST USERS */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              {users.map((u) => {
                const isMaster = u.role === 'master' || u.email.toLowerCase() === 'digiclintec@gmail.com';
                const isEditingThis = editingUserId === u.id;
                const assignedHosp = hospitals.find(h => h.id === u.hospitalId)?.name || (u.hospitalId === 'all' ? 'Todos os Hospitais' : 'Geral');

                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {assignedHosp}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUserId(isEditingThis ? null : u.id);
                          setNewPassword('');
                        }}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Trocar Senha</span>
                      </button>

                      {!isMaster && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isEditingThis && (
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
                          Salvar
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

          {/* TAB 4: CREATE USER */}
          {activeTab === 'create_user' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Operador:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Metrologista"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                    placeholder="Defina uma senha..."
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Perfil de Acesso:
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="operador">Operador de Bipagem</option>
                    <option value="administrador">Administrador Técnico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Vincular ao Hospital:
                  </label>
                  <select
                    value={userHospitalId}
                    onChange={(e) => setUserHospitalId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todos os Hospitais (Acesso Global)</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Operador'}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
