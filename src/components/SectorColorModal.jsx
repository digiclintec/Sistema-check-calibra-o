import React, { useState, useMemo } from 'react';
import { 
  Palette, 
  X, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Info, 
  Layers, 
  Search,
  CheckCircle2
} from 'lucide-react';
import { 
  SECTOR_COLOR_PRESETS, 
  getSectorColor, 
  normalizeSectorKey, 
  getSectorBadgeStyles 
} from '../utils/sectorColors';

export default function SectorColorModal({
  isOpen,
  onClose,
  equipments = [],
  sectorColors = {},
  onSaveSectorColors,
  isDark = false
}) {
  if (!isOpen) return null;

  // Local draft of sector colors: { [normalizedKey]: hex }
  const [draftColors, setDraftColors] = useState(() => ({ ...(sectorColors || {}) }));
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Extract all unique sectors from equipments (both registered and collected sectors)
  const sectorsList = useMemo(() => {
    const map = new Map();

    equipments.forEach(eq => {
      // Setor de Retirada
      if (eq.setor_retirada && eq.setor_retirada.trim()) {
        const name = eq.setor_retirada.trim();
        const key = normalizeSectorKey(name);
        if (!map.has(key)) {
          map.set(key, { name, countRetirada: 0, countCadastrado: 0 });
        }
        map.get(key).countRetirada += 1;
      }
      // Setor Cadastrado
      if (eq.setor && eq.setor.trim()) {
        const name = eq.setor.trim();
        const key = normalizeSectorKey(name);
        if (!map.has(key)) {
          map.set(key, { name, countRetirada: 0, countCadastrado: 0 });
        }
        map.get(key).countCadastrado += 1;
      }
    });

    // Also include any previously customized sectors not currently in equipment list
    Object.keys(draftColors || {}).forEach(k => {
      if (!map.has(k)) {
        const capitalized = k.charAt(0).toUpperCase() + k.slice(1);
        map.set(k, { name: capitalized, countRetirada: 0, countCadastrado: 0 });
      }
    });

    // Fallback if empty
    if (map.size === 0) {
      map.set('enfermaria', { name: 'Enfermaria', countRetirada: 0, countCadastrado: 0 });
      map.set('utin', { name: 'UTIN', countRetirada: 0, countCadastrado: 0 });
      map.set('centro cirurgico', { name: 'Centro Cirúrgico', countRetirada: 0, countCadastrado: 0 });
      map.set('geral', { name: 'Geral', countRetirada: 0, countCadastrado: 0 });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [equipments, draftColors]);

  // Filter sectors by search query
  const filteredSectors = useMemo(() => {
    if (!searchQuery.trim()) return sectorsList;
    const q = searchQuery.toLowerCase().trim();
    return sectorsList.filter(s => s.name.toLowerCase().includes(q));
  }, [sectorsList, searchQuery]);

  // Handle color change for a specific sector
  const handleSelectColor = (sectorName, hex) => {
    const key = normalizeSectorKey(sectorName);
    setDraftColors(prev => ({
      ...prev,
      [key]: hex
    }));
    setSavedSuccess(false);
  };

  // Reset a single sector to its default system color
  const handleResetSector = (sectorName) => {
    const key = normalizeSectorKey(sectorName);
    setDraftColors(prev => {
      const next = { ...prev };
      delete next[key];
      delete next[sectorName];
      return next;
    });
    setSavedSuccess(false);
  };

  // Reset all to system defaults
  const handleResetAll = () => {
    if (window.confirm('Deseja restaurar as cores de todos os setores para o padrão do sistema?')) {
      setDraftColors({});
      setSavedSuccess(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveSectorColors(draftColors);
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Erro ao salvar cores:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-amber-50/30 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200 dark:border-orange-800/60 shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base sm:text-lg flex items-center gap-2">
                Cores dos Setores na Planilha
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
                  {sectorsList.length} setores
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalize a cor de cada setor. Bombas recolhidas usam a cor do setor de coleta!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Rule Card */}
        <div className="px-5 pt-3 pb-2 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-800/30 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-900 dark:text-amber-200/90 leading-relaxed">
            <strong>Regra de Coleta:</strong> Quando uma bomba de um setor (ex: <em>UTIN</em>) é recolhida em outro (ex: <em>Enfermaria</em>), ela assume na tabela e no espelho a <strong>cor do setor de onde foi recolhida</strong>.
          </p>
        </div>

        {/* Search Bar & Reset Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar setor..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            title="Restaurar todas as cores para o padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Padrões</span>
          </button>
        </div>

        {/* Sector Rows List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[55vh]">
          {filteredSectors.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Nenhum setor encontrado para "{searchQuery}".
            </div>
          ) : (
            filteredSectors.map((sector) => {
              const currentColor = getSectorColor(sector.name, draftColors);
              const badgeStyle = getSectorBadgeStyles(currentColor, isDark);
              const totalItems = sector.countRetirada + sector.countCadastrado;

              return (
                <div key={sector.name} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Sector info & live badge */}
                  <div className="flex items-center gap-3">
                    {/* Live Badge Preview */}
                    <span
                      style={badgeStyle}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all inline-flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentColor.hex }} />
                      {sector.name}
                    </span>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {totalItems > 0 ? (
                        <span>
                          {sector.countRetirada > 0 && <span className="text-teal-600 dark:text-teal-400 font-medium">📍 {sector.countRetirada} recolhidas </span>}
                          {sector.countCadastrado > 0 && <span>• {sector.countCadastrado} cadastradas</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Setor no sistema</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Color swatch palette & native color picker */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Quick Preset Swatches */}
                    {SECTOR_COLOR_PRESETS.slice(0, 8).map((preset) => {
                      const isSelected = currentColor.hex.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectColor(sector.name, preset.hex)}
                          title={`${preset.name} (${preset.hex})`}
                          style={{ backgroundColor: preset.hex }}
                          className={`w-6 h-6 rounded-full transition-transform active:scale-90 flex items-center justify-center ${
                            isSelected 
                              ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110 shadow-sm' 
                              : 'hover:scale-105 opacity-85 hover:opacity-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      );
                    })}

                    {/* Native Hex Color Picker Input */}
                    <label 
                      title="Escolher qualquer outra cor (Hex)"
                      className="relative flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition ml-1"
                    >
                      <input
                        type="color"
                        value={currentColor.hex}
                        onChange={(e) => handleSelectColor(sector.name, e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    </label>

                    {/* Reset single sector button */}
                    {currentColor.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleResetSector(sector.name)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition ml-1"
                        title="Restaurar cor padrão deste setor"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {savedSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Cores salvas com sucesso!
              </span>
            ) : (
              <span>Salva no servidor e sincroniza com toda a equipe</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 rounded-xl shadow-md hover:shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Cores</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

