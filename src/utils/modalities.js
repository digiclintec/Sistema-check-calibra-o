/**
 * modalities.js
 * 
 * Gerencia as 3 frentes de trabalho / modalidades técnicas:
 * 1. Calibração Metrológica (🎯)
 * 2. Manutenção Preventiva (🔧)
 * 3. Teste de Segurança Elétrica - TSE (⚡)
 * 4. Visão Integrada / Todas as Equipes (📋)
 */

export const MODALITIES = {
  calibracao: {
    id: 'calibracao',
    name: 'Calibração Metrológica',
    shortName: 'Calibração',
    icon: '🎯',
    color: 'blue',
    checkField: 'check_calibracao',
    dateField: 'data_calibracao',
    userField: 'usuario_calibracao',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    btnClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20',
    ringClass: 'ring-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40',
    description: 'Validação metrológica e conferência de parâmetros'
  },
  preventiva: {
    id: 'preventiva',
    name: 'Manutenção Preventiva',
    shortName: 'Preventiva',
    icon: '🔧',
    color: 'emerald',
    checkField: 'check_preventiva',
    dateField: 'data_preventiva',
    userField: 'usuario_preventiva',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    btnClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20',
    ringClass: 'ring-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
    description: 'Inspeção mecânica, limpeza técnica e troca de peças/bateria'
  },
  seguranca: {
    id: 'seguranca',
    name: 'Teste de Segurança (TSE)',
    shortName: 'Seg. Elétrica',
    icon: '⚡',
    color: 'amber',
    checkField: 'check_seguranca',
    dateField: 'data_seguranca',
    userField: 'usuario_seguranca',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    btnClass: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/20',
    ringClass: 'ring-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    description: 'Corrente de fuga, isolação e aterramento (NBR IEC 60601)'
  },
  geral: {
    id: 'geral',
    name: 'Visão Integrada (Todas as Equipes)',
    shortName: 'Visão Geral',
    icon: '📋',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    btnClass: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20',
    ringClass: 'ring-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/40',
    description: 'Acompanhamento unificado das 3 equipes em tempo real'
  }
};

/**
 * Normaliza um equipamento para garantir que possui os campos das 3 modalidades
 */
export function normalizeEquipmentModalities(eq) {
  if (!eq) return eq;

  const isLegacyChecked = Boolean(eq.checado);
  const legacyDate = eq.dataCheck || null;
  const legacyUser = eq.conferidoPor || null;

  const checkCalibracao = eq.check_calibracao !== undefined 
    ? Boolean(eq.check_calibracao) 
    : isLegacyChecked;

  const checkPreventiva = Boolean(eq.check_preventiva);
  const checkSeguranca = Boolean(eq.check_seguranca);

  return {
    ...eq,
    // Calibração
    check_calibracao: checkCalibracao,
    data_calibracao: eq.data_calibracao || (checkCalibracao ? legacyDate : null),
    usuario_calibracao: eq.usuario_calibracao || (checkCalibracao ? legacyUser : null),

    // Preventiva
    check_preventiva: checkPreventiva,
    data_preventiva: eq.data_preventiva || null,
    usuario_preventiva: eq.usuario_preventiva || null,

    // Teste de Segurança
    check_seguranca: checkSeguranca,
    data_seguranca: eq.data_seguranca || null,
    usuario_seguranca: eq.usuario_seguranca || null,

    // Campo compatível legado
    checado: checkCalibracao || checkPreventiva || checkSeguranca
  };
}

/**
 * Retorna se o equipamento está checado de acordo com a modalidade
 */
export function isEquipmentChecked(eq, modality = 'calibracao') {
  if (!eq) return false;
  if (modality === 'calibracao') return Boolean(eq.check_calibracao);
  if (modality === 'preventiva') return Boolean(eq.check_preventiva);
  if (modality === 'seguranca') return Boolean(eq.check_seguranca);
  // Se for visão geral, retorna true somente se as 3 frentes estiverem concluídas
  return Boolean(eq.check_calibracao && eq.check_preventiva && eq.check_seguranca);
}

/**
 * Retorna os detalhes de quem conferiu e quando para a modalidade
 */
export function getCheckMeta(eq, modality = 'calibracao') {
  if (!eq) return { checked: false, date: null, user: null };

  if (modality === 'preventiva') {
    return {
      checked: Boolean(eq.check_preventiva),
      date: eq.data_preventiva,
      user: eq.usuario_preventiva
    };
  }

  if (modality === 'seguranca') {
    return {
      checked: Boolean(eq.check_seguranca),
      date: eq.data_seguranca,
      user: eq.usuario_seguranca
    };
  }

  // Calibração (padrão)
  return {
    checked: Boolean(eq.check_calibracao !== undefined ? eq.check_calibracao : eq.checado),
    date: eq.data_calibracao || eq.dataCheck,
    user: eq.usuario_calibracao || eq.conferidoPor
  };
}
