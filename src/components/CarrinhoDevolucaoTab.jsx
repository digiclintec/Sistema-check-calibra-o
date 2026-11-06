import React, { useState, useMemo, useRef } from 'react';
import { 
  Truck, 
  Search, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Layers, 
  RotateCcw, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Check, 
  QrCode,
  Tag,
  Hash,
  Filter,
  PackageCheck,
  AlertCircle
} from 'lucide-react';
import { playSuccessSound } from '../utils/audio';

export default function CarrinhoDevolucaoTab({
  equipments = [],
  hospitalName = '',
  planTitle = '',
  sectorColors = {},
  onOpenScanner
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('ALL');
  const [expandedSectors, setExpandedSectors] = useState({});
  const [scannedResult, setScannedResult] = useState(null);
  const [cartPackedIds, setCartPackedIds] = useState(() => new Set());
  const quickSearchInputRef = useRef(null);

  // Filtra apenas equipamentos que já estão conferidos/calibrados (prontos para devolução)
  const readyEquipments = useMemo(() => {
    return equipments.filter(e => 
      Boolean(e.checado || e.check_calibracao || e.check_preventiva || e.check_seguranca || e.check_externa)
    );
  }, [equipments]);

  // Equipamentos ainda pendentes na bancada
  const pendingCount = equipments.length - readyEquipments.length;

  // Agrupamento dos equipamentos prontos pelo setor de destino (setor_retirada ou setor original)
  const sectorGroups = useMemo(() => {
    const groups = {};
    readyEquipments.forEach(item => {
      const targetSector = (item.setor_retirada || item.setor || 'Setor Não Definido').trim();
      if (!groups[targetSector]) {
        groups[targetSector] = [];
      }
      groups[targetSector].push(item);
    });

    // Ordena setores alfabeticamente
    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map(secName => ({
      name: secName,
      items: groups[secName],
      count: groups[secName].length
    }));
  }, [readyEquipments]);

  // Lista de nomes de setores para o filtro
  const availableSectors = useMemo(() => {
    return sectorGroups.map(g => g.name);
  }, [sectorGroups]);

  // Grupos filtrados pelo termo de busca e filtro de setor
  const filteredGroups = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return sectorGroups
      .filter(group => {
        if (selectedSectorFilter !== 'ALL' && group.name !== selectedSectorFilter) {
          return false;
        }
        return true;
      })
      .map(group => {
        if (!query) return group;
        const matchingItems = group.items.filter(item => {
          return (
            (item.tag && item.tag.toLowerCase().includes(query)) ||
            (item.serie && item.serie.toLowerCase().includes(query)) ||
            (item.codigoBarras && item.codigoBarras.toLowerCase().includes(query)) ||
            (item.equipamento && item.equipamento.toLowerCase().includes(query)) ||
            (item.modelo && item.modelo.toLowerCase().includes(query)) ||
            (group.name.toLowerCase().includes(query))
          );
        });
        return {
          ...group,
          items: matchingItems,
          count: matchingItems.length
        };
      })
      .filter(group => group.items.length > 0);
  }, [sectorGroups, selectedSectorFilter, searchTerm]);

  // Total de bombas prontas nos grupos filtrados
  const totalFilteredReady = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredGroups]);

  // Alterna expansão de um setor
  const toggleSectorExpand = (secName) => {
    setExpandedSectors(prev => ({
      ...prev,
      [secName]: !prev[secName]
    }));
  };

  // Alterna marcação visual "No carrinho"
  const togglePacked = (id) => {
    setCartPackedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bip de Verificação Rápida via digitação ou leitor USB
  const handleQuickLookup = (rawVal) => {
    const val = String(rawVal || '').trim().toLowerCase();
    if (!val) return;

    const found = equipments.find(e => 
      String(e.id || '').toLowerCase() === val ||
      String(e.codigoBarras || '').toLowerCase() === val ||
      String(e.tag || '').toLowerCase() === val ||
      String(e.serie || '').toLowerCase() === val
    );

    if (found) {
      const targetSec = found.setor_retirada || found.setor || 'Setor Não Informado';
      setScannedResult({
        equipment: found,
        targetSector: targetSec,
        isReady: Boolean(found.checado || found.check_calibracao || found.check_preventiva || found.check_seguranca || found.check_externa),
        timestamp: Date.now()
      });
      playSuccessSound();
      setSearchTerm('');
    } else {
      setScannedResult({
        notFoundQuery: rawVal,
        timestamp: Date.now()
      });
    }
  };

  // Cor do setor
  const getSectorColor = (sectorName) => {
    if (!sectorName) return '#3b82f6';
    const norm = sectorName.toLowerCase().trim();
    if (sectorColors[norm]) return sectorColors[norm];
    if (sectorColors[sectorName]) return sectorColors[sectorName];
    // Cores automáticas suaves baseadas no nome
    const defaultPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    return defaultPalette[Math.abs(hash) % defaultPalette.length];
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
      
      {/* Banner Principal com Estatísticas e Botão de Scanner de Devolução */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 border border-slate-800 p-5 sm:p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <Truck className="w-3.5 h-3.5" />
              <span>Logística de Distribuição Hospitalar</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Carrinho & Devolução aos Setores</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Consulte rapidamente o setor de destino de cada bomba antes de abastecer o carrinho de transporte.
              {hospitalName ? ` • ${hospitalName}` : ''} {planTitle ? `(${planTitle})` : ''}
            </p>
          </div>

          {/* Botão de Bipar para Ver Destino */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="w-full md:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2"
                title="Bipar bomba na câmera para identificar o setor de destino"
              >
                <Camera className="w-4 h-4" />
                <span>Bipar Bomba (Câmera)</span>
              </button>
            )}
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Prontas p/ Devolução</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span>{readyEquipments.length}</span>
              <span className="text-xs font-semibold text-slate-400">bombas</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Setores com Bombas</div>
            <div className="text-xl sm:text-2xl font-black text-blue-400 flex items-center gap-1.5 mt-0.5">
              <span>{sectorGroups.length}</span>
              <span className="text-xs font-semibold text-slate-400">setores</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">No Carrinho (Marcadas)</div>
            <div className="text-xl sm:text-2xl font-black text-indigo-400 flex items-center gap-1.5 mt-0.5">
              <span>{cartPackedIds.size}</span>
              <span className="text-xs font-semibold text-slate-400">separadas</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Ainda na Bancada</div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 flex items-center gap-1.5 mt-0.5">
              <span>{pendingCount}</span>
              <span className="text-xs font-semibold text-slate-400">pendentes</span>
            </div>
          </div>
        </div>
      </div>

      {/* FLASH CARD: Resultado do Bip de Verificação Rápida */}
      {scannedResult && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl relative animate-in zoom-in-95 duration-200">
          <button
            onClick={() => setScannedResult(null)}
            className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            title="Fechar card"
          >
            <X className="w-5 h-5" />
          </button>

          {scannedResult.equipment ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md font-black text-lg"
                  style={{ backgroundColor: getSectorColor(scannedResult.targetSector) }}
                >
                  <MapPin className="w-6 h-6" />
                </div>
                
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Destino para Devolução:
                    </span>
                    <span 
                      className="text-xs font-black px-2.5 py-0.5 rounded-full text-white shadow-xs"
                      style={{ backgroundColor: getSectorColor(scannedResult.targetSector) }}
                    >
                      {scannedResult.targetSector}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {scannedResult.equipment.equipamento} {scannedResult.equipment.modelo ? `(${scannedResult.equipment.modelo})` : ''}
                  </h3>

                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                    <span className="font-bold flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-500" />
                      Tag: <strong>{scannedResult.equipment.tag || 'S/ Tag'}</strong>
                    </span>
                    {scannedResult.equipment.serie && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        Série: <strong>{scannedResult.equipment.serie}</strong>
                      </span>
                    )}
                    {scannedResult.equipment.setor_retirada && (
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        Retirada original: {scannedResult.equipment.setor_retirada}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status do Equipamento */}
              <div className="flex items-center gap-2 self-end md:self-center">
                {scannedResult.isReady ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Pronta para o Carrinho</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-extrabold">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Ainda Pendente de Calibração</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => togglePacked(scannedResult.equipment.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                    cartPackedIds.has(scannedResult.equipment.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{cartPackedIds.has(scannedResult.equipment.id) ? 'No Carrinho ✓' : 'Marcar no Carrinho'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <strong>Equipamento não encontrado:</strong> "{scannedResult.notFoundQuery}". Verifique a Tag ou Código digitado.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra de Filtros e Busca Rápida por Leitor USB / Teclado */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Input de Busca / Bipagem USB */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={quickSearchInputRef}
            type="text"
            placeholder="Bipar ou buscar Tag, Série..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickLookup(searchTerm);
              }
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Filtro por Setor */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <button
            type="button"
            onClick={() => setSelectedSectorFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              selectedSectorFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos os Setores ({sectorGroups.length})
          </button>

          {availableSectors.map(secName => (
            <button
              key={secName}
              type="button"
              onClick={() => setSelectedSectorFilter(secName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedSectorFilter === secName
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {secName}
            </button>
          ))}
        </div>
      </div>

      {/* LISTAGEM DE CARDS AGRUPADOS POR SETOR DE DEVOLUÇÃO */}
      {filteredGroups.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
            Nenhuma bomba pronta para devolução encontrada
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm 
              ? `Nenhum resultado para a busca "${searchTerm}".` 
              : 'Assim que as bombas forem calibradas e conferidas na aba de Conferência, elas aparecerão aqui agrupadas por setor de retorno.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const isExpanded = expandedSectors[group.name] ?? true; // Padrão aberto
            const secColor = getSectorColor(group.name);
            const packedInThisGroup = group.items.filter(it => cartPackedIds.has(it.id)).length;

            return (
              <div 
                key={group.name}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition"
              >
                {/* Header do Setor */}
                <div 
                  onClick={() => toggleSectorExpand(group.name)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs font-black text-sm"
                      style={{ backgroundColor: secColor }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          {group.name}
                        </h2>
                        <span 
                          className="px-2.5 py-0.5 rounded-full text-xs font-black text-white shadow-xs"
                          style={{ backgroundColor: secColor }}
                        >
                          {group.count} {group.count === 1 ? 'bomba' : 'bombas'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {packedInThisGroup > 0 
                          ? `${packedInThisGroup} de ${group.count} separadas no carrinho` 
                          : 'Prontas para embarcar no carrinho de devolução'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                  </div>
                </div>

                {/* Itens do Setor (Grade de Bombas) */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                    {group.items.map(item => {
                      const isPacked = cartPackedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                            isPacked
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                                {item.equipamento}
                              </span>
                              {item.modelo && (
                                <span className="text-[10px] text-slate-400 truncate">
                                  {item.modelo}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                              <span className="font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Tag className="w-3 h-3" />
                                {item.tag || item.serie || item.codigoBarras || item.id}
                              </span>
                              {item.serie && item.tag && (
                                <span className="text-slate-400">
                                  SN: {item.serie}
                                </span>
                              )}
                            </div>

                            {item.setor_retirada && item.setor_retirada !== group.name && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                Retirada em: {item.setor_retirada}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePacked(item.id)}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center border shrink-0 transition ${
                              isPacked
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-500'
                            }`}
                            title={isPacked ? 'Separada no carrinho (clique para desmarcar)' : 'Marcar como colocada no carrinho'}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Card de Ajuda e Instruções Rápidas */}
      <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong>Dica Operacional:</strong> Você não precisa re-bipar todas as bombas. Use a lista agrupada por setores para carregar o carrinho em lotes organizados por andar. O botão de câmera serve apenas para consulta rápida de destino quando você estiver com uma bomba avulsa na mão.
        </div>
      </div>

    </div>
  );
}
