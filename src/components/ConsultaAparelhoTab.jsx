import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  QrCode, 
  Scan, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Building2, 
  Tag, 
  ShieldCheck, 
  Copy, 
  Plus, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  FileText, 
  Check, 
  Layers,
  ChevronRight,
  Database,
  Cpu,
  Info,
  Wrench,
  FileDown,
  History,
  Eye,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

export default function ConsultaAparelhoTab({
  equipments = [],
  activeHospital,
  activePlanId,
  initialSearchTerm = '',
  onOpenScanner,
  onAddEquipmentToActivePlan,
  onCheckEquipment,
  onToggleCheck = null,
  onNavigateToConferencia,
  sectorColors = {}
}) {
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isSearchingArkmeds, setIsSearchingArkmeds] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [activeCardTab, setActiveCardTab] = useState('os'); // 'os' (Ordens de Serviço), 'tecnico' (Dados Técnicos), 'visitas' (Planos / Visitas Programadas)

  // Dispara busca automática se um termo inicial foi injetado (via scanner ou prop)
  useEffect(() => {
    if (initialSearchTerm && initialSearchTerm.trim()) {
      setSearchTerm(initialSearchTerm.trim());
      handleSearch(initialSearchTerm.trim());
    }
  }, [initialSearchTerm]);
  const [recentConsultas, setRecentConsultas] = useState(() => {
    try {
      const saved = localStorage.getItem('calibracheck_recent_consultas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [listFilter, setListFilter] = useState('hospital'); // 'hospital' (Aparelhos do Hospital Ativo), 'recentes' (Consultados Recentemente)
  const [listSearch, setListSearch] = useState('');

  // Salva histórico de consultas recentes no localStorage
  const saveRecentConsulta = (equip) => {
    if (!equip) return;
    setRecentConsultas(prev => {
      const filtered = prev.filter(e => e.id !== equip.id && e.arkmedsId !== equip.arkmedsId);
      const updated = [equip, ...filtered].slice(0, 20); // guarda os 20 mais recentes
      try {
        localStorage.setItem('calibracheck_recent_consultas', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Copia texto com feedback visual
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Busca Universal: localmente ou em toda a base Arkmeds
  const handleSearch = async (termToSearch) => {
    const raw = (termToSearch !== undefined ? termToSearch : searchTerm).trim();
    if (!raw) return;

    setSearchError('');
    setIsSearchingArkmeds(true);

    try {
      // 1. Tenta consulta completa no Arkmeds em toda a rede hospitalar
      const res = await fetch('/api/arkmeds/search-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: raw })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Constrói objeto unificado rico
        const fullEquip = {
          id: data.calibraCheckPayload?.id || `ARK-${data.arkmedsId}`,
          arkmedsId: data.arkmedsId,
          qrCodeToken: data.qrCodeToken,
          qrCodeUrl: data.qrCodeUrl,
          visualUrl: data.visualUrl,
          equipamento: data.equipamento,
          tipo: data.tipo,
          fabricante: data.fabricante,
          modelo: data.modelo,
          serie: data.serie,
          tag: data.tag,
          patrimonio: data.patrimonio || data.calibraCheckPayload?.patrimonio || '',
          proprietario: data.proprietario,
          setor: data.setor || 'Geral',
          unidadeHospital: data.hospital || data.proprietario,
          estado: data.estado || 'Ativo',
          anvisa: data.anvisa,
          dataAquisicao: data.dataAquisicao,
          rawFields: data.rawFields || {},
          visitasProgramadas: data.visitasProgramadas || [],
          ordensServico: data.ordensServico || [],
          ultimaOrdemServico: data.ultimaOrdemServico || null,
          codigoBarras: data.serie || data.tag || data.arkmedsId,
          origem: 'arkmeds'
        };

        setSelectedEquipment(fullEquip);
        saveRecentConsulta(fullEquip);
        // Abre na aba de Ordens de Serviço se houver OS
        if (fullEquip.ultimaOrdemServico) {
          setActiveCardTab('os');
        } else {
          setActiveCardTab('tecnico');
        }
        return;
      }

      // 2. Se a busca online do Arkmeds falhar, tenta na base local carregada no CalibraCheck
      const termLower = raw.toLowerCase();
      const localMatch = equipments.find(eq => 
        (eq.tag && eq.tag.toLowerCase() === termLower) ||
        (eq.patrimonio && eq.patrimonio.toLowerCase() === termLower) ||
        (eq.serie && eq.serie.toLowerCase() === termLower) ||
        (eq.codigoBarras && eq.codigoBarras.toLowerCase() === termLower) ||
        (eq.arkmedsId && String(eq.arkmedsId) === raw) ||
        (eq.tag && eq.tag.toLowerCase().includes(termLower)) ||
        (eq.patrimonio && eq.patrimonio.toLowerCase().includes(termLower)) ||
        (eq.equipamento && eq.equipamento.toLowerCase().includes(termLower))
      );

      if (localMatch) {
        setSelectedEquipment({
          ...localMatch,
          visitasProgramadas: [],
          ordensServico: [],
          ultimaOrdemServico: null
        });
        setActiveCardTab('tecnico');
      } else {
        setSearchError(data.message || `Aparelho "${raw}" não localizado em nenhum hospital do Arkmeds nem na base local.`);
      }
    } catch (err) {
      setSearchError('Erro ao consultar: ' + err.message);
    } finally {
      setIsSearchingArkmeds(false);
    }
  };

  // Localiza o aparelho correspondente na planilha do hospital ativo (se já constar)
  const matchingLocalEquipment = useMemo(() => {
    if (!selectedEquipment) return null;
    return equipments.find(e => 
      e.id === selectedEquipment.id ||
      (e.tag && selectedEquipment.tag && e.tag.toLowerCase().trim() === selectedEquipment.tag.toLowerCase().trim()) ||
      (e.serie && selectedEquipment.serie && e.serie.toLowerCase().trim() === selectedEquipment.serie.toLowerCase().trim()) ||
      (e.patrimonio && selectedEquipment.patrimonio && String(e.patrimonio).trim() === String(selectedEquipment.patrimonio).trim()) ||
      (e.arkmedsId && selectedEquipment.arkmedsId && String(e.arkmedsId) === String(selectedEquipment.arkmedsId))
    );
  }, [selectedEquipment, equipments]);

  // Verifica se o aparelho atualmente aberto está checado no plano local
  const isSelectedCheckedInLocalPlan = Boolean(matchingLocalEquipment && matchingLocalEquipment.checado);

  // Checa ou adiciona o aparelho ao plano ativo
  const handleActionCheckOrAdd = () => {
    if (!selectedEquipment) return;

    if (matchingLocalEquipment) {
      if (onCheckEquipment) {
        onCheckEquipment(matchingLocalEquipment.id);
      } else if (onToggleCheck) {
        onToggleCheck(matchingLocalEquipment.id);
      }
    } else if (onAddEquipmentToActivePlan) {
      onAddEquipmentToActivePlan(selectedEquipment);
    }
  };

  // Reverte / desmarca a checagem se já conferido
  const handleActionToggleUndo = () => {
    if (!matchingLocalEquipment) return;
    if (onToggleCheck) {
      onToggleCheck(matchingLocalEquipment.id);
    }
  };

  // Lista para o explorador inferior
  const displayedList = useMemo(() => {
    let list = listFilter === 'recentes' ? recentConsultas : equipments;
    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase();
      list = list.filter(e => 
        (e.tag && e.tag.toLowerCase().includes(q)) ||
        (e.patrimonio && e.patrimonio.toLowerCase().includes(q)) ||
        (e.serie && e.serie.toLowerCase().includes(q)) ||
        (e.equipamento && e.equipamento.toLowerCase().includes(q)) ||
        (e.setor && e.setor.toLowerCase().includes(q)) ||
        (e.arkmedsId && String(e.arkmedsId).includes(q))
      );
    }
    return list;
  }, [listFilter, recentConsultas, equipments, listSearch]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-6">
      
      {/* ============================================================
          CARD DE BUSCA ARKMEDS (CLEAN, MODERNO E DIRETO AO PONTO)
      ============================================================ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/60 dark:border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Cabeçalho limpo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Consulta de Equipamentos</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Arkmeds
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Busca direta por <strong className="text-slate-200">IDEC</strong>, <strong className="text-slate-200">QR Code</strong> ou <strong className="text-slate-200">Número de Série (NS)</strong>.
            </p>
          </div>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-md flex items-center gap-1.5 active:scale-95 shrink-0"
              title="Ler QR Code ou código com a câmera"
            >
              <Scan className="w-4 h-4 text-slate-950" />
              <span>Escanear Câmera</span>
            </button>
          )}
        </div>

        {/* Barra de Pesquisa */}
        <div className="relative z-10">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o IDEC, QR Code ou Número de Série (NS)..."
                className="w-full pl-10 pr-20 py-2.5 sm:py-3 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 border border-slate-300 dark:border-slate-700 focus:border-cyan-400 focus:outline-none text-xs sm:text-sm font-medium shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSearchError('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1"
                >
                  Limpar
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearchingArkmeds || !searchTerm.trim()}
              className="px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md active:scale-95 shrink-0"
            >
              {isSearchingArkmeds ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </form>

          {/* Formatos de busca aceitos */}
          <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-400 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Buscar por:</span>
            <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px] font-mono">
              🏷️ IDEC
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px] font-mono">
              📱 QR Code
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px] font-mono">
              🔢 Número de Série (NS)
            </span>
          </div>
        </div>
      </div>

      {/* FEEDBACK DE CARREGAMENTO OU ERRO */}
      {isSearchingArkmeds && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium">
            Localizando equipamento nos servidores do Arkmeds, carregando ficha técnica e histórico de Ordens de Serviço (O.S.)...
          </div>
        </div>
      )}

      {searchError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
              Aparelho não localizado
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
              {searchError}
            </p>
          </div>
        </div>
      )}

      {/* ============================================================
          FICHA TÉCNICA COMPLETA DO APARELHO (DOSSIÊ INTEGRAL)
      ============================================================ */}
      {selectedEquipment && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          
          {/* TOPO: IDENTIFICAÇÃO PRINCIPAL & AÇÕES RÁPIDAS */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  {selectedEquipment.tipo || 'Equipamento Hospitalar'}
                </span>

                {selectedEquipment.arkmedsId && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    ID Arkmeds: #{selectedEquipment.arkmedsId}
                  </span>
                )}

                {selectedEquipment.unidadeHospital && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    {selectedEquipment.unidadeHospital}
                  </span>
                )}

                {isSelectedCheckedInLocalPlan ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conferido no Plano Atual
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pendente de Conferência
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {selectedEquipment.equipamento}
              </h2>
              
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span>Setor: <strong className="text-slate-700 dark:text-slate-200">{selectedEquipment.setor}</strong></span>
                <span>•</span>
                <span>Tag: <strong className="font-mono text-slate-700 dark:text-slate-200">{selectedEquipment.tag || 'N/A'}</strong></span>
                {selectedEquipment.patrimonio && (
                  <>
                    <span>•</span>
                    <span>Patrimônio: <strong className="font-mono text-slate-700 dark:text-slate-200">{selectedEquipment.patrimonio}</strong></span>
                  </>
                )}
                {selectedEquipment.serie && (
                  <>
                    <span>•</span>
                    <span>Série: <strong className="font-mono text-slate-700 dark:text-slate-200">{selectedEquipment.serie}</strong></span>
                  </>
                )}
              </div>
            </div>

            {/* BOTÕES DE AÇÃO RÁPIDA DE CHECAGEM */}
            <div className="flex items-center gap-2 flex-wrap">
              {matchingLocalEquipment ? (
                isSelectedCheckedInLocalPlan ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>✓ Aparelho Já Conferido</span>
                    </div>

                    {onToggleCheck && (
                      <button
                        type="button"
                        onClick={handleActionToggleUndo}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition flex items-center gap-1.5 active:scale-95 shadow-xs"
                        title="Desmarcar / reverter checagem deste aparelho no plano"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desmarcar Checagem</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleActionCheckOrAdd}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/25 active:scale-95 transition flex items-center gap-2"
                    title="Realizar checagem imediata deste aparelho no plano ativo"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>⚡ Realizar Checagem do Aparelho</span>
                  </button>
                )
              ) : (
                <button
                  onClick={handleActionCheckOrAdd}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-95 transition flex items-center gap-2"
                  title="Adicionar aparelho ao plano ativo deste hospital e realizar a checagem"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>➕ Adicionar ao Plano & Checar</span>
                </button>
              )}

              {selectedEquipment.arkmedsId && (
                <a
                  href={`https://hifaclinica.arkmeds.com/cadastros/equipamento/visual/${selectedEquipment.arkmedsId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition flex items-center gap-1.5"
                  title="Abrir a ficha completa deste aparelho no Arkmeds"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver no Arkmeds</span>
                </a>
              )}
            </div>
          </div>

          {/* ============================================================
              DESTAQUE: ÚLTIMA ORDEM DE SERVIÇO (SOLICITADO PELO USUÁRIO)
          ============================================================ */}
          {selectedEquipment.ultimaOrdemServico ? (
            <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 rounded-2xl p-4 sm:p-5 border-2 border-indigo-200 dark:border-indigo-800/80 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Última Ordem de Serviço Registrada
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>OS #{selectedEquipment.ultimaOrdemServico.numero}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedEquipment.ultimaOrdemServico.estado?.toLowerCase() === 'fechada'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {selectedEquipment.ultimaOrdemServico.estado}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">• {selectedEquipment.ultimaOrdemServico.tipoServico}</span>
                    </h3>
                  </div>
                </div>

                {selectedEquipment.ultimaOrdemServico.pdfUrl && (
                  <a
                    href={selectedEquipment.ultimaOrdemServico.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm active:scale-95 self-start sm:self-auto"
                    title="Baixar ou visualizar o PDF oficial da Ordem de Serviço"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Baixar PDF da OS</span>
                  </a>
                )}
              </div>

              {/* DETALHES DA ÚLTIMA OS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">TÍTULO DA OS</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {selectedEquipment.ultimaOrdemServico.titulo || 'Manutenção'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">TÉCNICO RESPONSÁVEL</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {selectedEquipment.ultimaOrdemServico.responsavel || 'Não atribuído'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">DATA DE CRIAÇÃO</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {selectedEquipment.ultimaOrdemServico.dataCriacao || 'N/A'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">DATA DE CONCLUSÃO</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                    {selectedEquipment.ultimaOrdemServico.dataConclusao || 'Em aberto'}
                  </p>
                </div>
              </div>

              {selectedEquipment.ultimaOrdemServico.problema && (
                <div className="pt-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-500 text-[10px] block">SERVIÇO / PROBLEMA RELATADO:</span>
                  <p className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl mt-0.5 border border-slate-200/60 dark:border-slate-700/60">
                    {selectedEquipment.ultimaOrdemServico.problema}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Nenhuma Ordem de Serviço registrada anteriormente para este equipamento no Arkmeds.</span>
            </div>
          )}

          {/* ============================================================
              SUB-NAVEGAÇÃO DA FICHA TÉCNICA
          ============================================================ */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <button
              onClick={() => setActiveCardTab('os')}
              className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeCardTab === 'os'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Histórico de OS ({selectedEquipment.ordensServico?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveCardTab('visitas')}
              className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeCardTab === 'visitas'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Planos / Visitas Programadas ({selectedEquipment.visitasProgramadas?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveCardTab('tecnico')}
              className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeCardTab === 'tecnico'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Ficha Técnica Completa</span>
            </button>
          </div>

          {/* ============================================================
              ABA 1: HISTÓRICO DE ORDENS DE SERVIÇO
          ============================================================ */}
          {activeCardTab === 'os' && (
            <div className="space-y-3">
              {(!selectedEquipment.ordensServico || selectedEquipment.ordensServico.length === 0) ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhuma ordem de serviço cadastrada no histórico deste aparelho.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {selectedEquipment.ordensServico.map((os) => (
                    <div
                      key={os.id || os.numero}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            OS #{os.numero}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                            os.estado?.toLowerCase() === 'fechada'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {os.estado}
                          </span>
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            {os.tipoServico}
                          </span>
                        </div>

                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                          {os.titulo || os.problema || 'Manutenção preventiva/corretiva'}
                        </p>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                          <span>Técnico: <strong>{os.responsavel || 'Não consta'}</strong></span>
                          <span>•</span>
                          <span>Abertura: <strong>{os.dataCriacao}</strong></span>
                          {os.dataConclusao && (
                            <>
                              <span>•</span>
                              <span>Conclusão: <strong className="text-emerald-600 dark:text-emerald-400">{os.dataConclusao}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {os.pdfUrl && (
                          <a
                            href={os.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>PDF da OS</span>
                          </a>
                        )}

                        <a
                          href={os.visualUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              ABA 2: VISITAS PROGRAMADAS & PLANOS MENSAIS
          ============================================================ */}
          {activeCardTab === 'visitas' && (
            <div className="space-y-3">
              {(!selectedEquipment.visitasProgramadas || selectedEquipment.visitasProgramadas.length === 0) ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Este aparelho não está alocado em nenhum plano mensal cadastrado no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEquipment.visitasProgramadas.map((visita, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          {visita.tipoServico || 'Manutenção'}
                        </span>
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {visita.periodoPrevisto}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                        {visita.plano}
                      </h4>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              ABA 3: DADOS TÉCNICOS & CADASTRAIS
          ============================================================ */}
          {activeCardTab === 'tecnico' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identificação / Tag</span>
                  {selectedEquipment.tag && (
                    <button
                      onClick={() => handleCopy(selectedEquipment.tag, 'tag')}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      {copiedKey === 'tag' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                  {selectedEquipment.tag || 'Sem Tag'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patrimônio / Tombamento</span>
                  {selectedEquipment.patrimonio && (
                    <button
                      onClick={() => handleCopy(selectedEquipment.patrimonio, 'patrimonio')}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      {copiedKey === 'patrimonio' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                  {selectedEquipment.patrimonio || 'N/A'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Série</span>
                  {selectedEquipment.serie && (
                    <button
                      onClick={() => handleCopy(selectedEquipment.serie, 'serie')}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      {copiedKey === 'serie' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                  {selectedEquipment.serie || 'Não consta'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fabricante</span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.fabricante || 'Não informado'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo</span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.modelo || 'Não informado'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Setor Clínico</span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.setor || 'Geral'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital / Unidade</span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.unidadeHospital || selectedEquipment.proprietario}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registro ANVISA</span>
                <p className="text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.anvisa || 'N/A'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Aquisição</span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedEquipment.dataAquisicao || 'N/A'}
                </p>
              </div>

              {(selectedEquipment.qrCodeToken || selectedEquipment.qrCodeUrl) && (
                <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                      <QrCode className="w-3 h-3" />
                      QR Code Arkmeds
                    </span>
                    <button
                      onClick={() => handleCopy(selectedEquipment.qrCodeUrl || selectedEquipment.qrCodeToken, 'qr')}
                      className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-200 p-1"
                      title="Copiar token / link do QR Code"
                    >
                      {copiedKey === 'qr' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-sm sm:text-base font-black text-cyan-900 dark:text-cyan-100 font-mono mt-1 truncate">
                    {selectedEquipment.qrCodeToken ? `#${selectedEquipment.qrCodeToken}` : 'Ativo'}
                  </p>
                </div>
              )}

            </div>
          )}

          {/* RODAPÉ DO CARD */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Consulta 100% segura (Somente Leitura - Não altera nenhum dado no Arkmeds)</span>
            </span>

            {onNavigateToConferencia && (
              <button
                onClick={onNavigateToConferencia}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Ir para tela de conferência</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          EXPLORADOR INFERIOR: HOSPITAL ATIVO VS CONSULTADOS RECENTES
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Explorador de Equipamentos</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Alterne entre os aparelhos do hospital atual ou seu histórico de consultas recentes.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setListFilter('hospital')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                listFilter === 'hospital' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Hospital Ativo ({equipments.length})
            </button>

            <button
              onClick={() => setListFilter('recentes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                listFilter === 'recentes' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Consultados Recentemente ({recentConsultas.length})</span>
            </button>
          </div>
        </div>

        {/* BUSCA RÁPIDA NA LISTA */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Filtrar por tag, série, setor ou nome..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* LISTAGEM EM CARDS */}
        {displayedList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Nenhum aparelho encontrado nesta lista.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {displayedList.map((eq, idx) => {
              const isSelected = selectedEquipment?.id === eq.id || selectedEquipment?.tag === eq.tag;
              const sectorColor = sectorColors[eq.setor] || '#64748b';

              return (
                <div
                  key={eq.id || eq.tag || idx}
                  onClick={() => handleSearch(eq.tag || eq.serie || eq.arkmedsId || eq.codigoBarras)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected 
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[160px]"
                        style={{
                          backgroundColor: `${sectorColor}20`,
                          color: sectorColor
                        }}
                      >
                        {eq.setor || 'Geral'}
                      </span>

                      {eq.checado ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Conferido
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-600 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {eq.equipamento}
                    </h4>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                      <span>Tag: <strong>{eq.tag || 'N/A'}</strong></span>
                      {eq.serie && (
                        <>
                          <span>•</span>
                          <span>NS: <strong>{eq.serie}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50 text-[10px] text-slate-400">
                    <span>{eq.unidadeHospital || eq.hospital || 'Hospital'}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                      Abrir Dossiê
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
