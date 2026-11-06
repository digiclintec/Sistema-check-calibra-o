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
  externa: {
    id: 'externa',
    name: 'Manutenção Externa (Terceirizada)',
    shortName: 'Manut. Externa',
    icon: '📦',
    color: 'purple',
    checkField: 'check_externa',
    dateField: 'data_externa',
    userField: 'usuario_externa',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    btnClass: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20',
    ringClass: 'ring-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40',
    description: 'Equipamento recolhido para calibração e conserto por equipe externa terceirizada'
  },
  geral: {
    id: 'geral',
    name: 'Total Bipados',
    shortName: 'Bipados',
    icon: '📋',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    btnClass: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20',
    ringClass: 'ring-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/40',
    description: 'Total de equipamentos lidos, bipados e separados (serviço interno ou saída para manutenção)'
  }
};

/**
 * Normaliza um equipamento para garantir que possui os campos das 3 modalidades
 */
export function normalizeEquipmentModalities(eq) {
  if (!eq) return eq;

  const isExterna = Boolean(eq.check_externa);
  const isLegacyChecked = Boolean(eq.checado);
  const legacyDate = eq.dataCheck || null;
  const legacyUser = eq.conferidoPor || null;

  // Se estiver em Manutenção Externa, NUNCA pode constar como calibração interna
  const checkCalibracao = isExterna
    ? false
    : (eq.check_calibracao !== undefined ? Boolean(eq.check_calibracao) : isLegacyChecked);

  const checkPreventiva = isExterna ? false : Boolean(eq.check_preventiva);
  const checkSeguranca = isExterna ? false : Boolean(eq.check_seguranca);

  return {
    ...eq,
    // Calibração
    check_calibracao: checkCalibracao,
    data_calibracao: checkCalibracao ? (eq.data_calibracao || legacyDate) : null,
    usuario_calibracao: checkCalibracao ? (eq.usuario_calibracao || legacyUser) : null,

    // Preventiva
    check_preventiva: checkPreventiva,
    data_preventiva: checkPreventiva ? eq.data_preventiva : null,
    usuario_preventiva: checkPreventiva ? eq.usuario_preventiva : null,

    // Teste de Segurança
    check_seguranca: checkSeguranca,
    data_seguranca: checkSeguranca ? eq.data_seguranca : null,
    usuario_seguranca: checkSeguranca ? eq.usuario_seguranca : null,

    // Manutenção Externa (Terceirizada)
    check_externa: isExterna,
    data_externa: eq.data_externa || null,
    usuario_externa: eq.usuario_externa || null,
    motivo_externa: eq.motivo_externa || null,

    // Campo compatível legado
    checado: checkCalibracao || checkPreventiva || checkSeguranca || isExterna
  };
}

/**
 * Retorna se o equipamento está checado de acordo com a modalidade
 */
export function isEquipmentChecked(eq, modality = 'calibracao', serviceConfig = null) {
  if (!eq) return false;

  // Equipamentos em Manutenção Externa já foram atendidos, bipados e separados para envio/conserto
  // Por isso contam como checados em qualquer frente de trabalho na lista de bombas
  if (eq.check_externa) return true;

  if (modality === 'calibracao') return Boolean(eq.check_calibracao !== undefined ? eq.check_calibracao : eq.checado);
  if (modality === 'preventiva') return Boolean(eq.check_preventiva);
  if (modality === 'seguranca') return Boolean(eq.check_seguranca);
  if (modality === 'externa' || modality === 'manutencao_externa') return Boolean(eq.check_externa);
  // Visão Geral / Bipados: Qualquer equipamento já lido, bipado e separado (calibração ou saída p/ manutenção)
  if (modality === 'geral') {
    return Boolean(eq.checado || eq.check_calibracao || eq.check_preventiva || eq.check_seguranca || eq.check_externa);
  }
  return isEquipmentFullyChecked(eq, serviceConfig);
}

/**
 * Retorna se o equipamento está 100% conferido considerando as modalidades ativas
 * OU se foi bipado/registrado para Manutenção Externa (pois teve saída e foi atendido)
 */
export function isEquipmentFullyChecked(eq, serviceConfig) {
  if (!eq) return false;
  return Boolean(eq.checado || eq.check_calibracao || eq.check_preventiva || eq.check_seguranca || eq.check_externa);
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

  if (modality === 'externa' || modality === 'manutencao_externa') {
    return {
      checked: Boolean(eq.check_externa),
      date: eq.data_externa,
      user: eq.usuario_externa,
      motivo: eq.motivo_externa || 'Calibração e conserto por terceirizados'
    };
  }

  if (modality === 'geral') {
    if (eq.check_externa) {
      return {
        checked: true,
        date: eq.data_externa || eq.dataCheck,
        user: eq.usuario_externa || eq.conferidoPor || 'Manutenção Externa',
        motivo: eq.motivo_externa || 'Saída para Manutenção'
      };
    }
    const isFull = isEquipmentFullyChecked(eq);
    return {
      checked: isFull,
      date: eq.data_calibracao || eq.data_preventiva || eq.data_seguranca || eq.dataCheck,
      user: eq.usuario_calibracao || eq.usuario_preventiva || eq.usuario_seguranca || eq.conferidoPor
    };
  }

  // Calibração (padrão)
  return {
    checked: Boolean(eq.check_calibracao !== undefined ? eq.check_calibracao : eq.checado),
    date: eq.data_calibracao || eq.dataCheck,
    user: eq.usuario_calibracao || eq.conferidoPor
  };
}

