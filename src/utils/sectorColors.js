/**
 * Utilitário de Cores Dinâmicas e Customizáveis por Setor Hospitalar
 * 
 * Regra Primária de Negócio:
 * A cor de apresentação de uma bomba/equipamento prioriza SEMPRE o Setor onde ela foi
 * RECOLHIDA / RETIRADA (item.setor_retirada), com fallback para o Setor Cadastrado (item.setor).
 * Exemplo: Bomba originalmente da UTIN, recolhida na Enfermaria -> adota a cor Laranja da Enfermaria!
 */

// Paleta de presets vibrantes, modernos e de alto contraste
export const SECTOR_COLOR_PRESETS = [
  {
    id: 'orange',
    name: 'Laranja (Enfermaria)',
    hex: '#f97316',
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fdba74',
    darkBg: 'rgba(249, 115, 22, 0.20)',
    darkText: '#fb923c',
    darkBorder: 'rgba(249, 115, 22, 0.45)',
  },
  {
    id: 'blue',
    name: 'Azul (UTIN / UTI)',
    hex: '#2563eb',
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#93c5fd',
    darkBg: 'rgba(37, 99, 235, 0.20)',
    darkText: '#60a5fa',
    darkBorder: 'rgba(37, 99, 235, 0.45)',
  },
  {
    id: 'emerald',
    name: 'Verde (Centro Cirúrgico)',
    hex: '#10b981',
    bg: '#ecfdf5',
    text: '#047857',
    border: '#6ee7b7',
    darkBg: 'rgba(16, 185, 129, 0.20)',
    darkText: '#34d399',
    darkBorder: 'rgba(16, 185, 129, 0.45)',
  },
  {
    id: 'purple',
    name: 'Roxo (Pediatria)',
    hex: '#8b5cf6',
    bg: '#f5f3ff',
    text: '#6d28d9',
    border: '#c4b5fd',
    darkBg: 'rgba(139, 92, 246, 0.20)',
    darkText: '#a78bfa',
    darkBorder: 'rgba(139, 92, 246, 0.45)',
  },
  {
    id: 'red',
    name: 'Vermelho (Emergência / PS)',
    hex: '#ef4444',
    bg: '#fef2f2',
    text: '#b91c1c',
    border: '#fca5a5',
    darkBg: 'rgba(239, 68, 68, 0.20)',
    darkText: '#f87171',
    darkBorder: 'rgba(239, 68, 68, 0.45)',
  },
  {
    id: 'pink',
    name: 'Rosa (Maternidade)',
    hex: '#ec4899',
    bg: '#fdf2f8',
    text: '#be185d',
    border: '#f472b6',
    darkBg: 'rgba(236, 72, 153, 0.20)',
    darkText: '#f472b6',
    darkBorder: 'rgba(236, 72, 153, 0.45)',
  },
  {
    id: 'amber',
    name: 'Âmbar (CME / Esterilização)',
    hex: '#f59e0b',
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fcd34d',
    darkBg: 'rgba(245, 158, 11, 0.20)',
    darkText: '#fbbf24',
    darkBorder: 'rgba(245, 158, 11, 0.45)',
  },
  {
    id: 'cyan',
    name: 'Ciano (Ambulatório)',
    hex: '#06b6d4',
    bg: '#ecfeff',
    text: '#0e7490',
    border: '#67e8f9',
    darkBg: 'rgba(6, 182, 212, 0.20)',
    darkText: '#22d3ee',
    darkBorder: 'rgba(6, 182, 212, 0.45)',
  },
  {
    id: 'indigo',
    name: 'Índigo (Hemodiálise)',
    hex: '#6366f1',
    bg: '#eef2ff',
    text: '#4338ca',
    border: '#a5b4fc',
    darkBg: 'rgba(99, 102, 241, 0.20)',
    darkText: '#818cf8',
    darkBorder: 'rgba(99, 102, 241, 0.45)',
  },
  {
    id: 'teal',
    name: 'Teal (UCO / Cardiologia)',
    hex: '#0d9488',
    bg: '#f0fdfa',
    text: '#0f766e',
    border: '#5eead4',
    darkBg: 'rgba(13, 148, 136, 0.20)',
    darkText: '#2dd4bf',
    darkBorder: 'rgba(13, 148, 136, 0.45)',
  },
  {
    id: 'rose',
    name: 'Rosê (Oncologia)',
    hex: '#f43f5e',
    bg: '#fff1f2',
    text: '#be123c',
    border: '#fda4af',
    darkBg: 'rgba(244, 63, 94, 0.20)',
    darkText: '#fb7185',
    darkBorder: 'rgba(244, 63, 94, 0.45)',
  },
  {
    id: 'violet',
    name: 'Violeta (Neurologia)',
    hex: '#7c3aed',
    bg: '#f5f3ff',
    text: '#5b21b6',
    border: '#ddd6fe',
    darkBg: 'rgba(124, 58, 237, 0.20)',
    darkText: '#a78bfa',
    darkBorder: 'rgba(124, 58, 237, 0.45)',
  },
  {
    id: 'lime',
    name: 'Verde Limão (Fisioterapia)',
    hex: '#84cc16',
    bg: '#f7fee7',
    text: '#4d7c0f',
    border: '#bef264',
    darkBg: 'rgba(132, 204, 22, 0.20)',
    darkText: '#a3e635',
    darkBorder: 'rgba(132, 204, 22, 0.45)',
  },
  {
    id: 'sky',
    name: 'Azul Céu (Radiologia / Imagem)',
    hex: '#0284c7',
    bg: '#f0f9ff',
    text: '#0369a1',
    border: '#7dd3fc',
    darkBg: 'rgba(2, 132, 199, 0.20)',
    darkText: '#38bdf8',
    darkBorder: 'rgba(2, 132, 199, 0.45)',
  },
  {
    id: 'slate',
    name: 'Cinza (Geral)',
    hex: '#64748b',
    bg: '#f8fafc',
    text: '#334155',
    border: '#cbd5e1',
    darkBg: 'rgba(100, 116, 139, 0.20)',
    darkText: '#94a3b8',
    darkBorder: 'rgba(100, 116, 139, 0.45)',
  }
];

// Mapeamentos automáticos padrão por nome de setor (sem acentos, minúsculas)
const PRESET_MAPPINGS = {
  'enfermaria': '#f97316',        // Laranja (especificado pelo usuário)
  'enfermarias': '#f97316',
  'posto enfermagem': '#f97316',
  'utin': '#2563eb',              // Azul
  'uti neonatal': '#2563eb',
  'uti': '#0284c7',               // Azul Céu
  'uti adulto': '#0284c7',
  'uti coronariana': '#0d9488',   // Teal
  'centro cirurgico': '#10b981',  // Verde
  'bloco cirurgico': '#10b981',
  'cc': '#10b981',
  'pronto socorro': '#ef4444',    // Vermelho
  'ps': '#ef4444',
  'emergencia': '#ef4444',
  'upa': '#ef4444',
  'cme': '#f59e0b',               // Âmbar
  'esterilizacao': '#f59e0b',
  'maternidade': '#ec4899',       // Rosa
  'bercario': '#ec4899',
  'pediatria': '#8b5cf6',         // Roxo
  'ambulatorio': '#06b6d4',       // Ciano
  'consultorios': '#06b6d4',
  'hemodialise': '#6366f1',       // Índigo
  'radiologia': '#0284c7',        // Azul Céu
  'oncologia': '#f43f5e',         // Rosê
  'geral': '#64748b'
};

/**
 * Normaliza o nome do setor para comparação sem acentos e em minúsculas
 */
export function normalizeSectorKey(name) {
  if (!name) return 'geral';
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Obtém o setor EFETIVO de um equipamento.
 * REGRA: Onde foi RECOLHIDO/RETIRADO (setor_retirada) tem prioridade sobre o setor cadastrado (setor).
 */
export function getEffectiveSector(item) {
  if (!item) return 'Geral';
  if (item.setor_retirada && String(item.setor_retirada).trim()) {
    return String(item.setor_retirada).trim();
  }
  if (item.setor && String(item.setor).trim()) {
    return String(item.setor).trim();
  }
  return 'Geral';
}

/**
 * Hash determinístico de string para associar qualquer setor a uma cor da paleta
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Converte um HEX livre (#RRGGBB) em derivados de cor
 */
function createColorFromHex(hex, name = '') {
  const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
  return {
    id: 'custom',
    name: name || 'Personalizada',
    hex: cleanHex,
    bg: `${cleanHex}18`,       // ~10% opacidade para fundo claro
    text: cleanHex,
    border: `${cleanHex}60`,   // ~38% opacidade para borda clara
    darkBg: `${cleanHex}28`,   // ~16% opacidade no modo escuro
    darkText: cleanHex,
    darkBorder: `${cleanHex}70`
  };
}

/**
 * Obtém o objeto de estilo e cor completo para um setor.
 * Suporta cores customizadas salvas pelo usuário (`customSectorColors`).
 */
export function getSectorColor(sectorName, customSectorColors = {}) {
  const cleanName = (sectorName && String(sectorName).trim()) || 'Geral';
  const key = normalizeSectorKey(cleanName);

  // 1. Verifica se há customização explícita do usuário
  if (customSectorColors && (customSectorColors[key] || customSectorColors[cleanName])) {
    const custom = customSectorColors[key] || customSectorColors[cleanName];
    const customHex = typeof custom === 'string' ? custom : custom.hex;
    if (customHex) {
      const matchPreset = SECTOR_COLOR_PRESETS.find(p => p.hex.toLowerCase() === customHex.toLowerCase());
      if (matchPreset) {
        return { ...matchPreset, isCustom: true };
      }
      return { ...createColorFromHex(customHex, cleanName), isCustom: true };
    }
  }

  // 2. Verifica se há mapeamento pré-definido para setores hospitalares comuns
  if (PRESET_MAPPINGS[key]) {
    const targetHex = PRESET_MAPPINGS[key];
    const match = SECTOR_COLOR_PRESETS.find(p => p.hex.toLowerCase() === targetHex.toLowerCase());
    if (match) return { ...match, isCustom: false };
  }

  // 3. Setores parciais (ex: "Posto Enfermaria 2" contém "enfermaria" -> laranja)
  for (const [presetKey, targetHex] of Object.entries(PRESET_MAPPINGS)) {
    if (key.includes(presetKey)) {
      const match = SECTOR_COLOR_PRESETS.find(p => p.hex.toLowerCase() === targetHex.toLowerCase());
      if (match) return { ...match, isCustom: false };
    }
  }

  // 4. Hash determinístico da paleta caso não tenha mapeamento
  const hashIdx = hashString(key) % SECTOR_COLOR_PRESETS.length;
  return { ...SECTOR_COLOR_PRESETS[hashIdx], isCustom: false };
}

/**
 * Gera os estilos inline prontos para aplicação direta em elementos React
 */
export function getSectorBadgeStyles(color, isDark = false) {
  if (!color) return {};
  if (isDark) {
    return {
      backgroundColor: color.darkBg || `${color.hex}25`,
      color: color.darkText || color.hex,
      borderColor: color.darkBorder || `${color.hex}60`,
      boxShadow: `0 0 0 1px ${color.hex}25`
    };
  }
  return {
    backgroundColor: color.bg || `${color.hex}15`,
    color: color.text || color.hex,
    borderColor: color.border || `${color.hex}50`,
    boxShadow: `0 0 0 1px ${color.hex}20`
  };
}
