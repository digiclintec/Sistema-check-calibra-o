import React, { useState, useMemo } from 'react';
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
  Info
} from 'lucide-react';

export default function ConsultaAparelhoTab({
  equipments = [],
  activeHospital,
  activePlanId,
  onOpenScanner,
  onAddEquipmentToActivePlan,
  onCheckEquipment,
  onNavigateToConferencia,
  sectorColors = {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isSearchingArkmeds, setIsSearchingArkmeds] = useState(false);
  const [arkmedsSearchResult, setArkmedsSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [listFilter, setListFilter] = useState('todos'); // 'todos', 'checados', 'pendentes', 'arkmeds'
  const [listSearch, setListSearch] = useState('');

  // Copia texto para o clipboard com feedback
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Busca local imediata na lista de equipamentos carregados
  const handleLocalSearch = (termToSearch) => {
    const term = (termToSearch !== undefined ? termToSearch : searchTerm).trim().toLowerCase();
    if (!term) return;

    setSearchError('');
    setArkmedsSearchResult(null);

    // Tenta correspondência exata primeiro (tag, série, arkmedsId, qrToken, código de barras)
    let found = equipments.find(eq => 
      (eq.tag && eq.tag.toLowerCase() === term) ||
      (eq.serie && eq.serie.toLowerCase() === term) ||
      (eq.codigoBarras && eq.codigoBarras.toLowerCase() === term) ||
      (eq.arkmedsId && String(eq.arkmedsId) === term) ||
      (eq.arkmedsQrToken && String(eq.arkmedsQrToken) === term)
    );

    // Se não encontrou exato, tenta correspondência parcial
    if (!found) {
      found = equipments.find(eq => 
        (eq.tag && eq.tag.toLowerCase().includes(term)) ||
        (eq.serie && eq.serie.toLowerCase().includes(term)) ||
        (eq.equipamento && eq.equipamento.toLowerCase().includes(term)) ||
        (eq.setor && eq.setor.toLowerCase().includes(term))
      );
    }

    if (found) {
      setSelectedEquipment(found);
      setArkmedsSearchResult(null);
    } else {
      // Se não encontrou localmente, sugere busca online no Arkmeds
      setSelectedEquipment(null);
      handleOnlineArkmedsSearch(term);
    }
  };

  // Consulta online direta no Arkmeds via backend (SOMENTE LEITURA)
  const handleOnlineArkmedsSearch = async (termToSearch) => {
    const raw = (termToSearch !== undefined ? termToSearch : searchTerm).trim();
    if (!raw) return;

    setIsSearchingArkmeds(true);
    setSearchError('');
    setArkmedsSearchResult(null);

    try {
      const res = await fetch('/api/arkmeds/resolve-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: raw })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.message || `Aparelho "${raw}" não localizado no plano local nem no Arkmeds.`);
      } else {
        setArkmedsSearchResult(data);
        // Cria um modelo unificado para visualização
        setSelectedEquipment({
          id: data.calibraCheckPayload?.id || `ARK-${data.arkmedsId}`,
          arkmedsId: data.arkmedsId,
          arkmedsQrToken: data.qrCodeToken,
          arkmedsQrUrl: data.qrCodeUrl,
          tag: data.tag || `TAG-${data.arkmedsId}`,
          serie: data.serie,
          codigoBarras: data.serie || data.tag || data.arkmedsId,
          equipamento: data.equipamento,
          fabricante: data.fabricante,
          modelo: data.modelo,
          setor: data.setor || 'Geral',
          unidadeHospital: data.hospital || data.proprietario,
          proprietarioCompleto: data.proprietario,
          validadeCalibracao: 'Válido',
          statusCalibracao: 'Válido',
          anvisa: data.anvisa,
          dataAquisicao: data.dataAquisicao,
          checado: false,
          origem: 'arkmeds_online'
        });
      }
    } catch (err) {
      setSearchError('Erro ao consultar Arkmeds: ' + err.message);
    } finally {
      setIsSearchingArkmeds(false);
    }
  };

  // Filtro da lista de aparelhos
  const filteredList = useMemo(() => {
    let list = equipments;

    if (listFilter === 'checados') {
      list = list.filter(e => e.checado);
    } else if (listFilter === 'pendentes') {
      list = list.filter(e => !e.checado);
    } else if (listFilter === 'arkmeds') {
      list = list.filter(e => e.origem === 'arkmeds' || e.arkmedsId || e.arkmedsQrToken);
    }

    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase();
      list = list.filter(e => 
        (e.tag && e.tag.toLowerCase().includes(q)) ||
        (e.serie && e.serie.toLowerCase().includes(q)) ||
        (e.equipamento && e.equipamento.toLowerCase().includes(q)) ||
        (e.setor && e.setor.toLowerCase().includes(q)) ||
        (e.arkmedsId && String(e.arkmedsId).includes(q))
      );
    }

    return list;
  }, [equipments, listFilter, listSearch]);

  // Checa ou adiciona o aparelho ao plano ativo
  const handleActionCheckOrAdd = () => {
    if (!selectedEquipment) return;

    // Se já está na lista local
    const existsLocally = equipments.some(eq => 
      (eq.tag && eq.tag === selectedEquipment.tag) ||
      (eq.serie && eq.serie === selectedEquipment.serie) ||
      (eq.id && eq.id === selectedEquipment.id)
    );

    if (existsLocally && onCheckEquipment) {
      onCheckEquipment(selectedEquipment.id);
      setSelectedEquipment(prev => prev ? { ...prev, checado: true, dataCheck: new Date().toISOString() } : null);
    } else if (onAddEquipmentToActivePlan) {
      onAddEquipmentToActivePlan(selectedEquipment);
      setSelectedEquipment(prev => prev ? { ...prev, checado: true, dataCheck: new Date().toISOString() } : null);
    }
  };

  const isSelectedChecked = selectedEquipment?.checado || equipments.some(e => 
    ((e.tag && e.tag === selectedEquipment?.tag) || (e.serie && e.serie === selectedEquipment?.serie)) && e.checado
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-6">
      
      {/* ============================================================
          BANNER HEADER DE CONSULTA
      ============================================================ */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-blue-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs flex items-center gap-1.5">
                <Database className="w-3 h-3 text-cyan-300" />
                Consulta de Aparelho & QR Code Arkmeds
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Somente Leitura
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Ficha Técnica & Inspeção do Aparelho
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-2xl">
              Consulte qualquer equipamento por QR Code Arkmeds, Tag, Número de Série ou ID. Visualize dados de calibração, setor e conformidade em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white text-blue-900 hover:bg-blue-50 transition shadow-lg flex items-center gap-2 active:scale-95"
              >
                <Scan className="w-4 h-4 text-blue-600" />
                <span>Escanear com Câmera</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE PESQUISA PRINCIPAL */}
        <div className="mt-5 relative z-10">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleLocalSearch();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: UTIAHL-0119, CN23950450, ID 3538, ou cole o link do QR Code..."
                className="w-full pl-10 pr-24 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 border-2 border-transparent focus:border-cyan-400 focus:outline-none text-xs sm:text-sm shadow-md font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedEquipment(null);
                    setArkmedsSearchResult(null);
                    setSearchError('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-md"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSearchingArkmeds || !searchTerm.trim()}
                className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md"
              >
                <Search className="w-4 h-4" />
                <span>Consultar</span>
              </button>

              <button
                type="button"
                onClick={() => handleOnlineArkmedsSearch()}
                disabled={isSearchingArkmeds || !searchTerm.trim()}
                className="px-4 py-3 rounded-2xl bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 backdrop-blur-xs border border-white/20"
                title="Consulta direta e imediata aos servidores do Arkmeds"
              >
                {isSearchingArkmeds ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 text-cyan-300" />
                )}
                <span className="hidden sm:inline">Buscar no Arkmeds</span>
              </button>
            </div>
          </form>

          {/* Quick tags de busca de exemplo */}
          <div className="flex items-center gap-2 mt-3 text-[11px] text-blue-200 flex-wrap">
            <span className="opacity-75">Exemplos de busca:</span>
            {['UTIAHL-0119', 'CN23950450', '3538', '001005'].map(sample => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setSearchTerm(sample);
                  handleLocalSearch(sample);
                }}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/25 text-white font-mono text-[10px] transition border border-white/10"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FEEDBACK DE ERRO OU CARREGAMENTO */}
      {isSearchingArkmeds && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium">
            Consultando servidores do Arkmeds em tempo real para obter a ficha oficial do aparelho...
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
          FICHA TÉCNICA DO APARELHO SELECIONADO (DETALHE COMPLETO)
      ============================================================ */}
      {selectedEquipment && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          
          {/* TOPO DA FICHA */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  {selectedEquipment.tipo || 'Equipamento Hospitalar'}
                </span>

                {selectedEquipment.arkmedsId && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    ID Arkmeds: #{selectedEquipment.arkmedsId}
                  </span>
                )}

                {isSelectedChecked ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Checado no Ciclo Atual
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pendente de Conferência
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
                {selectedEquipment.equipamento}
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedEquipment.unidadeHospital || selectedEquipment.proprietarioCompleto || activeHospital?.name}</span>
                {selectedEquipment.setor && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedEquipment.setor}</span>
                  </>
                )}
              </p>
            </div>

            {/* BOTÕES DE AÇÃO RÁPIDA */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleActionCheckOrAdd}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-sm ${
                  isSelectedChecked 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{isSelectedChecked ? 'Já Conferido' : '⚡ Conferir Agora'}</span>
              </button>

              {selectedEquipment.arkmedsId && (
                <a
                  href={`https://hifaclinica.arkmeds.com/cadastros/equipamento/visual/${selectedEquipment.arkmedsId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition flex items-center gap-1.5"
                  title="Abrir a ficha completa deste aparelho diretamente no Arkmeds"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver no Arkmeds</span>
                </a>
              )}
            </div>
          </div>

          {/* GRID DE INFORMAÇÕES TÉCNICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Tag / Identificação */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Identificação / Tag</span>
                {selectedEquipment.tag && (
                  <button
                    onClick={() => handleCopy(selectedEquipment.tag, 'tag')}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="Copiar Tag"
                  >
                    {copiedKey === 'tag' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                {selectedEquipment.tag || 'Sem Tag'}
              </p>
            </div>

            {/* Número de Série */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Número de Série</span>
                {selectedEquipment.serie && (
                  <button
                    onClick={() => handleCopy(selectedEquipment.serie, 'serie')}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="Copiar Número de Série"
                  >
                    {copiedKey === 'serie' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                {selectedEquipment.serie || 'Não consta'}
              </p>
            </div>

            {/* Setor */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Setor Clínico</span>
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {selectedEquipment.setor || 'Geral'}
              </p>
            </div>

            {/* Validade de Calibração */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Validade Calibração</span>
              <p className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1.5 truncate">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{selectedEquipment.validadeCalibracao || selectedEquipment.vencimento || 'N/A'}</span>
              </p>
            </div>

            {/* Fabricante */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fabricante</span>
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
                {selectedEquipment.fabricante || 'Não informado'}
              </p>
            </div>

            {/* Modelo */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Modelo</span>
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
                {selectedEquipment.modelo || 'Não informado'}
              </p>
            </div>

            {/* QR Token Arkmeds */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">QR Code Arkmeds</span>
              <p className="text-xs sm:text-sm font-mono font-bold text-purple-600 dark:text-purple-400 mt-1 truncate flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>{selectedEquipment.arkmedsQrToken ? `Token ${selectedEquipment.arkmedsQrToken}` : (selectedEquipment.arkmedsId ? `ID ${selectedEquipment.arkmedsId}` : 'Não vinculado')}</span>
              </p>
            </div>

            {/* Registro ANVISA */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registro ANVISA</span>
              <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                {selectedEquipment.anvisa || 'N/A'}
              </p>
            </div>

          </div>

          {/* RODAPÉ DO CARD COM AVISO DE SOMENTE LEITURA */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Sincronização 100% Segura e em Modo Leitura (Sem impacto no Arkmeds)</span>
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
          LISTA GERAL DE APARELHOS DO HOSPITAL ATIVO
      ============================================================ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Aparelhos Cadastrados no Hospital ({filteredList.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Clique em qualquer aparelho para abrir a ficha técnica completa e consultar QR Code.
            </p>
          </div>

          {/* FILTROS DA LISTA */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setListFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                listFilter === 'todos' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Todos ({equipments.length})
            </button>

            <button
              onClick={() => setListFilter('checados')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                listFilter === 'checados' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Checados ({equipments.filter(e => e.checado).length})
            </button>

            <button
              onClick={() => setListFilter('pendentes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                listFilter === 'pendentes' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Pendentes ({equipments.filter(e => !e.checado).length})
            </button>

            <button
              onClick={() => setListFilter('arkmeds')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                listFilter === 'arkmeds' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Arkmeds ({equipments.filter(e => e.origem === 'arkmeds' || e.arkmedsId).length})
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
            placeholder="Filtrar nesta lista por tag, série, setor ou nome..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* LISTAGEM EM TABELA / CARDS */}
        {filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
            Nenhum aparelho corresponde ao filtro selecionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredList.map((eq, idx) => {
              const isSelected = selectedEquipment?.id === eq.id || selectedEquipment?.tag === eq.tag;
              const sectorColor = sectorColors[eq.setor] || '#64748b';

              return (
                <div
                  key={eq.id || eq.tag || idx}
                  onClick={() => setSelectedEquipment(eq)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected 
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm' 
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
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
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Conferido
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
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
                    <span>{eq.origem === 'arkmeds' ? 'Arkmeds' : 'Local'}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                      Ver detalhes
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
