import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Search, 
  Sliders, 
  Database, 
  Download, 
  Plus, 
  ExternalLink,
  QrCode,
  Tag,
  Hash,
  Layers
} from 'lucide-react';

export default function ArkmedsSyncModal({
  isOpen,
  onClose,
  activeHospitalName = '',
  activeHospitalId = '',
  activePlanId = '',
  activePlanTitle = '',
  currentEquipments = [],
  onEquipmentsSynced
}) {
  const [connectionStatus, setConnectionStatus] = useState({ loading: true, connected: false, user: '' });
  const [proprietarioFilter, setProprietarioFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPages, setMaxPages] = useState('10'); // 10 páginas = ~250 aparelhos por padrão
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  // Sugestões rápidas de proprietário / hospital baseadas na rede HIFA
  const PRESET_UNITS = [
    { label: 'Dr. Luiz Buaiz', filter: 'LUIZ BUAIZ' },
    { label: 'Hifa Sumaré', filter: 'SUMARÉ' },
    { label: 'Maternidade', filter: 'MATERNIDADE' },
    { label: 'UTI Adulto', filter: 'UTI ADULTO' },
    { label: 'Pronto Socorro', filter: 'PRONTO SOCORRO' },
    { label: 'Todos os Aparelhos', filter: '' }
  ];

  // Verifica status de conexão ao abrir
  useEffect(() => {
    if (!isOpen) return;

    // Sugere o filtro de acordo com o hospital ativo
    if (activeHospitalName) {
      if (activeHospitalName.toLowerCase().includes('buaiz') || activeHospitalName.toLowerCase().includes('geral')) {
        setProprietarioFilter('LUIZ BUAIZ');
        setSelectedPreset('LUIZ BUAIZ');
      } else if (activeHospitalName.toLowerCase().includes('sumare') || activeHospitalName.toLowerCase().includes('sumaré')) {
        setProprietarioFilter('SUMARÉ');
        setSelectedPreset('SUMARÉ');
      }
    }

    setConnectionStatus({ loading: true, connected: false, user: '' });
    fetch('/api/arkmeds/status')
      .then(res => res.json())
      .then(data => {
        setConnectionStatus({
          loading: false,
          connected: Boolean(data.connected),
          user: data.user || 'rodrigo@engemedica.com.br',
          baseUrl: data.baseUrl || 'https://hifaclinica.arkmeds.com'
        });
      })
      .catch(err => {
        setConnectionStatus({
          loading: false,
          connected: false,
          error: err.message
        });
      });
  }, [isOpen, activeHospitalName]);

  const handleSelectPreset = (filter) => {
    setSelectedPreset(filter);
    setProprietarioFilter(filter);
  };

  const handleSearchArkmeds = async () => {
    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const res = await fetch('/api/arkmeds/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proprietario: proprietarioFilter.trim(),
          query: searchTerm.trim(),
          maxPages: parseInt(maxPages, 10) || 10,
          importToPlan: false // Apenas consulta inicial para prévia
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao consultar equipamentos no Arkmeds.');
      }

      // Calcula quantos já existem no plano local
      const existingKeys = new Set();
      currentEquipments.forEach(eq => {
        if (eq.serie) existingKeys.add(String(eq.serie).trim().toLowerCase());
        if (eq.tag) existingKeys.add(String(eq.tag).trim().toLowerCase());
        if (eq.arkmedsId) existingKeys.add(String(eq.arkmedsId).trim());
      });

      let alreadyExistsCount = 0;
      data.equipments.forEach(item => {
        const s = String(item.serie || '').trim().toLowerCase();
        const t = String(item.tag || '').trim().toLowerCase();
        const id = String(item.arkmedsId || '').trim();
        if ((s && existingKeys.has(s)) || (t && existingKeys.has(t)) || (id && existingKeys.has(id))) {
          alreadyExistsCount++;
        }
      });

      setSearchResult({
        ...data,
        alreadyExistsCount,
        newCount: data.equipments.length - alreadyExistsCount
      });
    } catch (err) {
      setSearchError(err.message || 'Erro ao conectar ao Arkmeds.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!searchResult || !searchResult.equipments || searchResult.equipments.length === 0) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/arkmeds/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: activeHospitalId,
          planId: activePlanId,
          proprietario: proprietarioFilter.trim(),
          query: searchTerm.trim(),
          maxPages: parseInt(maxPages, 10) || 10,
          importToPlan: true
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao sincronizar com o plano.');
      }

      if (onEquipmentsSynced) {
        onEquipmentsSynced(data);
      }
      onClose();
    } catch (err) {
      setSearchError(err.message || 'Falha ao salvar sincronização.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Sincronização Arkmeds
                <span className="text-[10px] bg-teal-500/20 text-teal-400 border border-teal-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Consulta & QR Code
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Importação segura dos equipamentos e identificação por QR Code
              </p>
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

        {/* Banner de Segurança & Modo Somente Leitura */}
        <div className="px-4 sm:px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <strong>Modo Somente Leitura (Read-Only) Ativo:</strong> Nenhuma alteração é gravada no sistema Arkmeds. Apenas consultamos os cadastros para trazer ao CalibraCheck.
          </div>
          {connectionStatus.connected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Conectado
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Seletor de Unidades / Presets Rápidos */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Unidade / Hospital no Arkmeds:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_UNITS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleSelectPreset(p.filter)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    selectedPreset === p.filter
                      ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros Personalizados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Filtro de Proprietário / Setor:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={proprietarioFilter}
                  onChange={(e) => {
                    setProprietarioFilter(e.target.value);
                    setSelectedPreset('');
                  }}
                  placeholder="Ex: LUIZ BUAIZ, UTI ADULTO, SUMARÉ..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Volume a Buscar:
              </label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="5">5 páginas (~125 aparelhos)</option>
                <option value="10">10 páginas (~250 aparelhos)</option>
                <option value="20">20 páginas (~500 aparelhos)</option>
                <option value="46">Unidade Inteira (Até 46 páginas)</option>
                <option value="100">Máximo (Até 100 páginas)</option>
              </select>
            </div>
          </div>

          {/* Botão de Busca */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isSearching}
              onClick={handleSearchArkmeds}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/30 flex items-center gap-2 active:scale-95 transition"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Consultando Arkmeds...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar Aparelhos no Arkmeds</span>
                </>
              )}
            </button>
          </div>

          {/* Mensagem de Erro */}
          {searchError && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Resultados da Busca */}
          {searchResult && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-white">
                    {searchResult.totalCount} aparelhos localizados
                  </span>
                  <span className="text-slate-400">
                    ({searchResult.pagesFetched} {searchResult.pagesFetched === 1 ? 'página consultada' : 'páginas consultadas'})
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[11px]">
                    +{searchResult.newCount} novos
                  </span>
                  {searchResult.alreadyExistsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono text-[11px]">
                      {searchResult.alreadyExistsCount} já no plano
                    </span>
                  )}
                </div>
              </div>

              {/* Tabela de Amostra dos Equipamentos Encontrados */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-slate-950/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[10px] uppercase font-bold text-slate-400 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="py-2 px-3">ID Arkmeds</th>
                      <th className="py-2 px-3">Equipamento</th>
                      <th className="py-2 px-3">Setor</th>
                      <th className="py-2 px-3">Identificação</th>
                      <th className="py-2 px-3">Nº Série</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {searchResult.equipments.map((eq, i) => (
                      <tr key={eq.id || i} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 font-mono font-bold text-teal-400">
                          #{eq.arkmedsId}
                        </td>
                        <td className="py-2 px-3 font-medium text-white truncate max-w-[200px]" title={eq.equipamento}>
                          {eq.equipamento}
                        </td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-[150px]" title={eq.setor}>
                          {eq.setor}
                        </td>
                        <td className="py-2 px-3 font-mono text-amber-300">
                          {eq.tag || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300">
                          {eq.serie || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Destino da Sincronização */}
              <div className="p-3 bg-gradient-to-r from-teal-950/30 via-slate-900 to-indigo-950/20 border border-teal-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-teal-400" />
                    Destino: {activePlanTitle || 'Plano Atual'} ({activeHospitalName})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Os aparelhos serão incorporados com seus números de série e tags para bipagem imediata.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isImporting || searchResult.equipments.length === 0}
                  onClick={handleConfirmSync}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition shrink-0"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Sincronizar no Plano Atual</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-teal-400" />
            <span>Ao bipar etiquetas com QR Code da Arkmeds, a conferência é automática.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
