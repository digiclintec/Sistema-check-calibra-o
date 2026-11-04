import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Check, 
  X, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Tag, 
  Hash, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  Barcode, 
  CheckCircle2, 
  Filter, 
  ArrowUpDown,
  Building2,
  Cpu
} from 'lucide-react';

export default function EquipmentTable({ 
  equipments, 
  onToggleCheck, 
  activeFilter, 
  setActiveFilter, 
  onQuickScanCode,
  lastScannedId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [sortField, setSortField] = useState('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const sectors = useMemo(() => {
    const list = new Set();
    equipments.forEach(e => {
      if (e.setor) list.add(e.setor);
    });
    return Array.from(list).sort();
  }, [equipments]);

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (!quickCodeInput.trim()) return;
    onQuickScanCode(quickCodeInput.trim());
    setQuickCodeInput('');
  };

  const filteredEquipments = useMemo(() => {
    let result = [...equipments];

    if (activeFilter === 'checados') {
      result = result.filter(e => e.checado);
    } else if (activeFilter === 'pendentes') {
      result = result.filter(e => !e.checado);
    } else if (activeFilter === 'vencidos') {
      result = result.filter(e => 
        e.statusCalibracao?.toLowerCase().includes('vencid') || 
        e.statusCalibracao?.toLowerCase().includes('alerta') ||
        e.statusCalibracao?.toLowerCase().includes('a vencer')
      );
    }

    if (selectedSector !== 'ALL') {
      result = result.filter(e => e.setor === selectedSector);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e => {
        return (
          e.codigoBarras?.toLowerCase().includes(q) ||
          e.tag?.toLowerCase().includes(q) ||
          e.equipamento?.toLowerCase().includes(q) ||
          e.fabricante?.toLowerCase().includes(q) ||
          e.modelo?.toLowerCase().includes(q) ||
          e.serie?.toLowerCase().includes(q) ||
          e.setor?.toLowerCase().includes(q) ||
          e.observacao?.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'name') {
        valA = a.equipamento || '';
        valB = b.equipamento || '';
      } else if (sortField === 'tag') {
        valA = a.tag || '';
        valB = b.tag || '';
      } else if (sortField === 'validade') {
        valA = a.validadeCalibracao || '';
        valB = b.validadeCalibracao || '';
      } else {
        valA = a.checado ? 1 : 0;
        valB = b.checado ? 1 : 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [equipments, activeFilter, selectedSector, searchQuery, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('vencid')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-3 h-3" />
          Vencido
        </span>
      );
    }
    if (s.includes('a vencer') || s.includes('alerta') || s.includes('proximo')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
          <Clock className="w-3 h-3" />
          A Vencer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
        <Check className="w-3 h-3" />
        Válido
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
      
      {/* Search and Quick Scan Bar */}
      <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Row 1: Direct Gun/Barcode Scan Bar */}
        <form onSubmit={handleQuickSubmit} className="relative flex items-center">
          <div className="absolute left-3.5 text-blue-600 dark:text-blue-400 flex items-center gap-1.5 pointer-events-none">
            <Barcode className="w-5 h-5 animate-pulse" />
          </div>
          <input
            type="text"
            placeholder="Aponte o leitor de código de barras ou digite..."
            value={quickCodeInput}
            onChange={(e) => setQuickCodeInput(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border-2 border-blue-500/40 dark:border-blue-500/50 rounded-2xl pl-11 pr-20 py-2.5 sm:py-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check
          </button>
        </form>

        {/* Row 2: Search Query & Sector Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          
          {/* Smart Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, tag, série, modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sector Selector */}
          {sectors.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full sm:w-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Todos os Setores ({equipments.length})</option>
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['todos', 'pendentes', 'checados', 'vencidos'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
                  activeFilter === f
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* MOBILE VIEW: Touch-Optimized Cards for Android & iOS */}
      <div className="sm:hidden p-3 space-y-3">
        {filteredEquipments.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs">Nenhum equipamento encontrado</p>
            <p className="text-[11px] text-slate-400 mt-1">Ajuste os filtros ou a busca acima.</p>
          </div>
        ) : (
          filteredEquipments.map((item) => {
            const isRecentlyScanned = lastScannedId === item.id || lastScannedId === item.codigoBarras;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  item.checado
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/60 dark:border-emerald-800/50'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm'
                } ${isRecentlyScanned ? 'ring-2 ring-blue-500 animate-pulse' : ''}`}
              >
                {/* Top header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.tag || item.codigoBarras}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                      {item.equipamento}
                    </h4>
                  </div>
                  <div>{getStatusBadge(item.statusCalibracao)}</div>
                </div>

                {/* Specs / Details */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 py-2 border-t border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Setor:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.setor || 'Geral'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Validade:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{item.validadeCalibracao || 'N/A'}</span>
                  </div>
                  {(item.fabricante || item.modelo) && (
                    <div className="col-span-2 pt-1 flex items-center gap-1.5 truncate">
                      <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.fabricante} {item.modelo}</span>
                      {item.serie && <span>• S/N: {item.serie}</span>}
                    </div>
                  )}
                  {item.conferidoPor && (
                    <div className="col-span-2 pt-0.5 text-emerald-600 dark:text-emerald-400 text-[10px]">
                      ✓ Conferido por: {item.conferidoPor}
                    </div>
                  )}
                </div>

                {/* Big Touch Action Button */}
                <div className="pt-2.5">
                  <button
                    onClick={() => onToggleCheck(item.id)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm ${
                      item.checado
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                    }`}
                  >
                    {item.checado ? (
                      <>
                        <X className="w-4 h-4 text-slate-500" />
                        Desmarcar Checagem
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        Confirmar Check
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW: High-Density Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider select-none">
            <tr>
              <th className="py-3.5 px-4 w-16 text-center">Status</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1.5">
                  Equipamento / Aparelho
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white hidden md:table-cell" onClick={() => toggleSort('tag')}>
                <div className="flex items-center gap-1.5">
                  Tag / Código
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 hidden lg:table-cell">Setor / Local</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort('validade')}>
                <div className="flex items-center gap-1.5">
                  Validade Calibração
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-4 text-center">Calibração</th>
              <th className="py-3.5 px-4 text-center w-28">Ação Check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredEquipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-400" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhum equipamento encontrado</p>
                    <p className="text-xs">Tente ajustar seus termos de busca ou mudar o filtro selecionado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEquipments.map((item) => {
                const isRecentlyScanned = lastScannedId === item.id || lastScannedId === item.codigoBarras;

                return (
                  <tr 
                    key={item.id}
                    className={`transition-colors duration-200 group ${
                      item.checado 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15' 
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    } ${isRecentlyScanned ? 'animate-pulse bg-blue-100/60 dark:bg-blue-900/40' : ''}`}
                  >
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleCheck(item.id)}
                        className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                          item.checado
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'border-2 border-slate-300 dark:border-slate-700 text-transparent hover:border-blue-500'
                        }`}
                        title={item.checado ? "Desmarcar equipamento" : "Marcar como checado"}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <span>{item.equipamento}</span>
                        {item.checado && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            OK
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                        {item.fabricante && <span>{item.fabricante}</span>}
                        {item.modelo && <span>• Mod: {item.modelo}</span>}
                        {item.serie && <span>• S/N: {item.serie}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell font-mono">
                      <div className="text-slate-800 dark:text-slate-200 font-bold">{item.tag}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Barcode className="w-3 h-3 text-slate-400" />
                        {item.codigoBarras}
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden lg:table-cell text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                        {item.setor || 'Geral'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.validadeCalibracao || 'Não informada'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(item.statusCalibracao)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleCheck(item.id)}
                        className={`w-full py-1.5 px-3 rounded-xl font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 ${
                          item.checado
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-400'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                        }`}
                      >
                        {item.checado ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            Desmarcar
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Checar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats summary */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div>
          Exibindo <strong>{filteredEquipments.length}</strong> de <strong>{equipments.length}</strong> equipamentos
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Checados: {equipments.filter(e => e.checado).length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            Pendentes: {equipments.filter(e => !e.checado).length}
          </span>
        </div>
      </div>

    </div>
  );
}
