import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Users, 
  Trash2, 
  Sparkles, 
  Target, 
  Wrench, 
  Zap, 
  Check, 
  ShieldCheck, 
  UserCheck, 
  UserPlus, 
  Save, 
  Edit3,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';

export default function HospitalModal({
  isOpen,
  onClose,
  hospitals = [],
  activeHospitalId,
  onSwitchHospital,
  onRefreshHospitals,
  currentUser,
  initialTab = 'create' // 'create' | 'list'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [hospName, setHospName] = useState('');
  const [hospCity, setHospCity] = useState('');
  const [hospCnpj, setHospCnpj] = useState('');
  const [hospPlan, setHospPlan] = useState('pro');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Inline team editor for existing hospital
  const [editingHospitalId, setEditingHospitalId] = useState(null);
  const [editingUserIds, setEditingUserIds] = useState([]);

  // Inline rename / edit hospital name (Master only)
  const [renamingHospitalId, setRenamingHospitalId] = useState(null);
  const [renamingName, setRenamingName] = useState('');
  const [renamingCity, setRenamingCity] = useState('');
  const [renamingCnpj, setRenamingCnpj] = useState('');

  const isMaster = currentUser?.role === 'master' || currentUser?.email?.toLowerCase() === 'digiclintec@gmail.com';

  const handleStartRename = (h) => {
    setRenamingHospitalId(h.id);
    setRenamingName(h.name || '');
    setRenamingCity(h.cidade || '');
    setRenamingCnpj(h.cnpj || '');
    setMessage(null);
  };

  const handleCancelRename = () => {
    setRenamingHospitalId(null);
    setRenamingName('');
    setRenamingCity('');
    setRenamingCnpj('');
  };

  const handleSaveRename = async (hospId) => {
    if (!renamingName.trim()) {
      setMessage({ type: 'error', text: 'O nome do hospital é obrigatório.' });
      return;
    }

    try {
      const res = await fetch('/api/hospitals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: hospId,
          name: renamingName.trim(),
          cidade: renamingCity.trim(),
          cnpj: renamingCnpj.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Hospital renomeado com sucesso para "${renamingName.trim()}"!` });
        setRenamingHospitalId(null);
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao renomear hospital.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão ao renomear hospital.' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setMessage(null);
      loadUsers();
      if (onRefreshHospitals) onRefreshHospitals();
    }
  }, [isOpen, initialTab]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        // Default: pre-select all non-master users or empty
        setSelectedUserIds(data.users.map(u => u.id));
      }
    } catch (e) {
      console.warn('Erro ao carregar usuários:', e);
    }
  };

  const handleToggleUserSelection = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
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
          plano: hospPlan,
          assignedUserIds: selectedUserIds
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.hospital) {
        setMessage({ type: 'success', text: `Hospital "${data.hospital.name}" cadastrado com sucesso!` });
        setHospName('');
        setHospCity('');
        setHospCnpj('');

        if (onRefreshHospitals) await onRefreshHospitals();
        if (onSwitchHospital) onSwitchHospital(data.hospital.id);

        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao cadastrar hospital.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de conexão ao salvar hospital.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditingTeam = (hospital) => {
    setEditingHospitalId(hospital.id);
    const assignedIds = (hospital.assignedUsers || []).map(u => u.id);
    setEditingUserIds(assignedIds);
  };

  const handleToggleEditingUser = (userId) => {
    if (editingUserIds.includes(userId)) {
      setEditingUserIds(editingUserIds.filter(id => id !== userId));
    } else {
      setEditingUserIds([...editingUserIds, userId]);
    }
  };

  const handleSaveHospitalTeam = async (hospitalId) => {
    try {
      const res = await fetch('/api/hospitals/assign-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          userIds: editingUserIds
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Equipe atualizada para este hospital com sucesso!' });
        setEditingHospitalId(null);
        if (onRefreshHospitals) onRefreshHospitals();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erro ao salvar equipe.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    }
  };

  const handleDeleteHospital = async (hospId, hospTitle) => {
    if (hospitals.length <= 1) {
      alert('Você precisa manter pelo menos 1 hospital cadastrado no sistema.');
      return;
    }

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Gestão de Hospitais
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {hospitals.length} Unidades
                </span>
              </h3>
              <p className="text-xs text-slate-400">Cadastre novos hospitais, troque de unidade e defina os operadores autorizados</p>
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setMessage(null); }}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>+ Cadastrar Novo Hospital</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('list'); setMessage(null); }}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-400" />
            <span>Hospitais & Trocar Unidade ({hospitals.length})</span>
          </button>
        </div>

        {/* Body Content */}
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
              <div className="leading-relaxed font-semibold">{message.text}</div>
            </div>
          )}

          {/* ================= ABA 1: FORMULÁRIO DE CADASTRO ================= */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateHospital} className="space-y-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    Nome do Hospital, Clínica ou Filial: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hospital Santa Clara, Hospital Unimed, Clínica São José"
                    value={hospName}
                    onChange={(e) => setHospName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Cidade / Estado:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo - SP, Belo Horizonte - MG"
                      value={hospCity}
                      onChange={(e) => setHospCity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      CNPJ (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={hospCnpj}
                      onChange={(e) => setHospCnpj(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plano de Serviço Contratado:
                  </label>
                  <select
                    value={hospPlan}
                    onChange={(e) => setHospPlan(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="basico">Plano Básico (Até 100 equipamentos • R$ 290/mês)</option>
                    <option value="pro">Plano Profissional (Até 500 equipamentos • R$ 590/mês)</option>
                    <option value="enterprise">Plano Enterprise (Equipamentos Ilimitados • R$ 1.290/mês)</option>
                  </select>
                </div>

                {/* VÍNCULO DE USUÁRIOS AO HOSPITAL */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      Técnicos e Operadores com Acesso a este Hospital:
                    </label>
                    {users.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllUsers}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        {selectedUserIds.length === users.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Selecione quais técnicos da equipe poderão visualizar e realizar bipagens neste hospital:
                  </p>

                  {users.length === 0 ? (
                    <div className="text-xs text-slate-500 italic p-2 bg-slate-900 rounded-xl border border-slate-800">
                      Nenhum outro usuário cadastrado no sistema além do Master.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-800">
                      {users.map(u => {
                        const isChecked = selectedUserIds.includes(u.id);
                        return (
                          <label 
                            key={u.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${
                              isChecked 
                                ? 'bg-blue-950/40 border-blue-500/50 text-blue-200' 
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleUserSelection(u.id)}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">{u.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate">{u.email}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>{loading ? 'Cadastrando e Ativando...' : 'Cadastrar e Abrir Hospital Imediatamente'}</span>
              </button>
            </form>
          )}

          {/* ================= ABA 2: LISTA DE HOSPITAIS & TROCA RÁPIDA ================= */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Clique em <strong>"Abrir Hospital"</strong> para alternar sua planilha e trabalho:</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  + Novo Hospital
                </button>
              </div>

              {hospitals.map((h) => {
                const isActive = h.id === activeHospitalId;
                const isEditingThisTeam = editingHospitalId === h.id;
                const total = h.equipmentCount || 0;

                return (
                  <div
                    key={h.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border-blue-500/60 shadow-lg ring-1 ring-blue-500/30' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {renamingHospitalId === h.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveRename(h.id);
                            }}
                            className="flex flex-col gap-2 pt-1"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                value={renamingName}
                                onChange={(e) => setRenamingName(e.target.value)}
                                placeholder="Nome do Hospital..."
                                autoFocus
                                className="bg-slate-900 border border-blue-500 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-full sm:w-80 shadow-inner"
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md"
                                title="Salvar nome do hospital"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Salvar</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                                title="Cancelar edição"
                              >
                                Cancelar
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                value={renamingCity}
                                onChange={(e) => setRenamingCity(e.target.value)}
                                placeholder="Cidade / UF (opcional)"
                                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500 w-36 sm:w-44"
                              />
                              <input
                                type="text"
                                value={renamingCnpj}
                                onChange={(e) => setRenamingCnpj(e.target.value)}
                                placeholder="CNPJ (opcional)"
                                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500 w-36 sm:w-44 font-mono"
                              />
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-white text-base flex items-center gap-1.5">
                                <span>{h.name}</span>
                                {isMaster && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename(h)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                                    title="Editar nome deste hospital"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </h4>
                              {isActive && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Ativo Agora
                                </span>
                              )}
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {h.plano?.toUpperCase() || 'PRO'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {h.cidade && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {h.cidade}</span>}
                              {h.cnpj && <span className="font-mono text-slate-500">CNPJ: {h.cnpj}</span>}
                              <span className="text-blue-400 font-semibold">
                                📦 {total} equipamentos ({h.checkedCount || 0} conferidos)
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onSwitchHospital) onSwitchHospital(h.id);
                              onClose();
                            }}
                            className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir Hospital</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-bold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Ativo
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingThisTeam) setEditingHospitalId(null);
                            else handleStartEditingTeam(h);
                          }}
                          className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                          title="Gerenciar quais técnicos têm acesso a este hospital"
                        >
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Equipe</span>
                        </button>

                        {isMaster && hospitals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteHospital(h.id, h.name)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Excluir este hospital"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Progress Bar Summary */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800/60 text-center">
                      <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-blue-400 font-bold block">Calibração</span>
                        <span className="text-xs font-extrabold text-white">{h.calPercent || 0}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-emerald-400 font-bold block">Preventiva</span>
                        <span className="text-xs font-extrabold text-white">{h.prevPercent || 0}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-purple-400 font-bold block">Seg. Elétrica</span>
                        <span className="text-xs font-extrabold text-white">{h.segPercent || 0}%</span>
                      </div>
                    </div>

                    {/* Inline Team Assignment Editor */}
                    {isEditingThisTeam && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-300">
                            Selecione os operadores que podem atuar em "{h.name}":
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingHospitalId(null)}
                            className="text-slate-400 hover:text-white text-xs"
                          >
                            Cancelar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                          {users.map(u => {
                            const isAssigned = editingUserIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer text-xs transition ${
                                  isAssigned 
                                    ? 'bg-indigo-950/30 border-indigo-500/50 text-indigo-200' 
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => handleToggleEditingUser(u.id)}
                                  className="rounded text-indigo-600 focus:ring-0"
                                />
                                <span className="font-medium truncate">{u.name}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveHospitalTeam(h.id)}
                            className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar Acesso da Equipe</span>
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

