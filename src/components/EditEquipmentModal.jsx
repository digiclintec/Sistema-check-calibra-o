import React, { useState, useEffect, useRef } from 'react';
import { 
  Pencil, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  KeyRound, 
  Barcode, 
  Tag, 
  Cpu, 
  Building2, 
  Eye, 
  EyeOff, 
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

export default function EditEquipmentModal({
  isOpen,
  onClose,
  equipment,
  hospitalName = '',
  currentUser = null,
  onSave
}) {
  const [tag, setTag] = useState('');
  const [serie, setSerie] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [modelo, setModelo] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [setor, setSetor] = useState('');
  
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const tagInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && equipment) {
      setTag(equipment.tag || '');
      setSerie(equipment.serie || '');
      setCodigoBarras(equipment.codigoBarras || equipment.barcode || '');
      setEquipamento(equipment.equipamento || equipment.nome || '');
      setModelo(equipment.modelo || '');
      setFabricante(equipment.fabricante || '');
      setSetor(equipment.setor || '');
      setPin('');
      setError('');
      setShowAdvanced(false);

      setTimeout(() => {
        tagInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, equipment]);

  if (!isOpen || !equipment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validações básicas
    if (!tag.trim() && !serie.trim() && !codigoBarras.trim()) {
      setError('O aparelho precisa ter ao menos um identificador (Tag, Série ou Código de Barras).');
      return;
    }

    if (!pin.trim()) {
      setError('Digite a senha de segurança para confirmar a alteração.');
      return;
    }

    setIsLoading(true);

    try {
      const updatedData = {
        ...equipment,
        tag: tag.trim(),
        serie: serie.trim(),
        codigoBarras: codigoBarras.trim() || serie.trim() || tag.trim(),
        equipamento: equipamento.trim() || equipment.equipamento,
        modelo: modelo.trim(),
        fabricante: fabricante.trim(),
        setor: setor.trim() || equipment.setor || 'Geral'
      };

      const res = await onSave(updatedData, pin.trim());
      if (res && res.success === false) {
        setError(res.message || 'Senha incorreta. (Padrão: 1234)');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Falha ao salvar alterações.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSerialAsBarcode = () => {
    if (serie.trim()) {
      setCodigoBarras(serie.trim());
    }
  };

  const handleUseTagAsBarcode = () => {
    if (tag.trim()) {
      setCodigoBarras(tag.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-4 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Pencil className="w-5 h-5" />
          </div>
          <div className="pr-6 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                Correção de Cadastro
              </span>
              {hospitalName && (
                <span className="text-[10px] text-slate-400 font-semibold truncate">
                  • {hospitalName}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate mt-0.5">
              Editar Identificação da Bomba
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Corrija Número de Série, Tag/IDEC ou Código de Barras com confirmação por senha.
            </p>
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* Current Equipment Context Card */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Equipamento Atual:
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white truncate">
                {equipment.equipamento || 'Bomba de Infusão'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {equipment.fabricante} {equipment.modelo} • Setor: {equipment.setor || 'Geral'}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 block">
                ID: {equipment.id}
              </span>
            </div>
          </div>

          {/* CAMPOS PRINCIPAIS DE IDENTIFICAÇÃO (DESTAQUE) */}
          <div className="space-y-3">
            
            {/* 1. Número de Série (S/N) - Destaque Principal solicitado pelo usuário */}
            <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Número de Série (S/N):</span>
                </label>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  (Crucial para calibração)
                </span>
              </div>
              <input
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="Ex: 18040029, SN-987654..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>O leitor e o OCR usam este número para encontrar a bomba.</span>
                {serie && (
                  <button
                    type="button"
                    onClick={handleUseSerialAsBarcode}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0 text-[10px]"
                    title="Preencher o código de barras com o mesmo valor da série"
                  >
                    Copiar para Código de Barras →
                  </button>
                )}
              </div>
            </div>

            {/* 2. Tag / IDEC / Tombamento */}
            <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Tag / IDEC / Patrimônio / Tombamento:</span>
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  ID Hospitalar
                </span>
              </div>
              <input
                ref={tagInputRef}
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex: TAG-1049, IDEC-0023..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>Etiqueta física colada na carcaça do equipamento.</span>
                {tag && (
                  <button
                    type="button"
                    onClick={handleUseTagAsBarcode}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0 text-[10px]"
                    title="Preencher o código de barras com o mesmo valor da tag"
                  >
                    Copiar para Código de Barras →
                  </button>
                )}
              </div>
            </div>

            {/* 3. Código de Barras */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-slate-500" />
                <span>Código de Barras (Leitor Laser / Câmera):</span>
              </label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Ex: 7891234567890 ou o mesmo número de série"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Se deixar em branco, o sistema utilizará o número de série ou a tag como código de barras.
              </p>
            </div>

          </div>

          {/* Opções Avançadas (Nome, Modelo, Fabricante, Setor) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5"
            >
              <span>{showAdvanced ? '▾ Ocultar detalhes do aparelho' : '▸ Editar também nome, modelo e setor'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs animate-in fade-in duration-150">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Nome do Equipamento:
                  </label>
                  <input
                    type="text"
                    value={equipamento}
                    onChange={(e) => setEquipamento(e.target.value)}
                    placeholder="Ex: Bomba de Infusão Peristáltica"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Fabricante:
                    </label>
                    <input
                      type="text"
                      value={fabricante}
                      onChange={(e) => setFabricante(e.target.value)}
                      placeholder="Ex: Terumo, B. Braun..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Modelo:
                    </label>
                    <input
                      type="text"
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      placeholder="Ex: TE-112, Infusomat..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Setor Cadastrado:
                  </label>
                  <input
                    type="text"
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder="Ex: UTIN, UCINCO, Centro Cirúrgico..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CAMPO OBRIGATÓRIO DE SENHA DE SEGURANÇA */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Senha de Confirmação (Obrigatória):</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setPin('1234');
                  if (error) setError('');
                }}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                title="Preencher com senha padrão (1234)"
              >
                Senha Padrão (1234)
              </button>
            </div>

            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Digite a senha ou PIN..."
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                title={showPin ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[10px] text-amber-800/80 dark:text-amber-400 leading-tight">
              Proteção contra alterações acidentais. Aceita sua senha de técnico ou a senha padrão <strong>1234</strong>.
            </p>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition text-xs sm:text-sm"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className={`py-2.5 px-5 rounded-xl font-extrabold text-white text-xs sm:text-sm flex items-center gap-2 shadow-lg transition active:scale-95 ${
                isLoading
                  ? 'bg-slate-400 cursor-wait opacity-70'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
              }`}
            >
              {isLoading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Atualizar</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

