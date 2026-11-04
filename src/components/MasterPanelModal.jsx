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
  EyeOff
} from 'lucide-react';

export default function MasterPanelModal({ isOpen, onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operador');
  const [showPassword, setShowPassword] = useState(false);

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
    if (!name.trim() || !email.trim() || !password.trim()) {
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
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Usuário "${name}" cadastrado com sucesso!` });
        setName('');
        setEmail('');
        setPassword('');
        setActiveTab('list');
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

  const handleDeleteUser = async (id, userName) => {
    if (!window.confirm(`Tem certeza que deseja excluir o acesso de "${userName}"?`)) {
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
        setMessage({ type: 'success', text: `Usuário "${userName}" removido com sucesso.` });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Painel Master
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Gerenciar Acessos
                </span>
              </h3>
              <p className="text-xs text-slate-400">Cadastre e controle os operadores da planilha</p>
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveTab('list'); setMessage(null); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Usuários Cadastrados ({users.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setMessage(null); }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cadastrar Novo Acesso
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4">
          
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

          {/* TAB 1: LIST USERS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {users.map((u) => {
                const isMaster = u.role === 'master' || u.email.toLowerCase() === 'digiclintec@gmail.com';
                const isEditingThis = editingUserId === u.id;

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
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUserId(isEditingThis ? null : u.id);
                          setNewPassword('');
                        }}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                        title="Trocar senha deste usuário"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Trocar Senha</span>
                      </button>

                      {!isMaster && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Excluir este acesso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Inline password change box */}
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

          {/* TAB 2: CREATE USER */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Usuário / Operador:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Metrologista"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha Inicial:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Defina uma senha..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Perfil de Acesso:
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="operador">Operador de Bipagem (Visualiza e dá check)</option>
                  <option value="administrador">Administrador Técnico (Importa planilhas e confere)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Acesso'}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
