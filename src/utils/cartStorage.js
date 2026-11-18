// Utilitários para gestão unificada do Carrinho & Devolução aos Setores

export const getCartStorageKeys = (planId) => {
  const planKey = planId || 'default';
  return {
    SERIES_KEY: `calibracheck_cart_series_${planKey}`,
    PACKED_KEY: `calibracheck_cart_packed_${planKey}`,
    RETURNED_KEY: `calibracheck_cart_returned_${planKey}`
  };
};

export const getCartSeries = (planId) => {
  const { SERIES_KEY } = getCartStorageKeys(planId);
  try {
    const raw = localStorage.getItem(SERIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const getCartPackedIds = (planId) => {
  const { PACKED_KEY } = getCartStorageKeys(planId);
  try {
    const raw = localStorage.getItem(PACKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
};

export const addEquipmentToCart = (planId, equipment, targetSector = null) => {
  if (!equipment || !equipment.id) return [];
  return addMultipleEquipmentsToCart(planId, [{ equipment, targetSector }]);
};

export const addMultipleEquipmentsToCart = (planId, items) => {
  if (!items || items.length === 0) return [];
  const { SERIES_KEY, PACKED_KEY, RETURNED_KEY } = getCartStorageKeys(planId);

  let currentSeries = [];
  try {
    const raw = localStorage.getItem(SERIES_KEY);
    currentSeries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    currentSeries = [];
  }

  let currentPacked = new Set();
  try {
    const raw = localStorage.getItem(PACKED_KEY);
    currentPacked = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    currentPacked = new Set();
  }

  let returnedIds = new Set();
  try {
    const raw = localStorage.getItem(RETURNED_KEY);
    returnedIds = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    returnedIds = new Set();
  }

  const now = Date.now();
  const newEntries = [];

  items.forEach((it, idx) => {
    const eq = it.equipment || it;
    if (!eq || !eq.id) return;

    const sector = (it.targetSector || it.setorRetirada || eq.setor_retirada || eq.setor || 'Geral').trim();
    const isReturned = returnedIds.has(eq.id) || Boolean(eq.devolvido);

    // Se já estiver devolvido, não insere na carga do carrinho
    if (isReturned) return;

    newEntries.push({
      equipment: eq,
      targetSector: sector,
      isReady: true,
      isReturned: false,
      timestamp: now + idx,
      scanId: `${eq.id}-${now + idx}`
    });

    currentPacked.add(eq.id);
  });

  if (newEntries.length === 0) return currentSeries;

  // Evita duplicatas: remove da série antiga e adiciona as novas no topo (mais recentes no início)
  const newIds = new Set(newEntries.map(e => e.equipment.id));
  const filteredOld = currentSeries.filter(s => !newIds.has(s.equipment.id));
  const updatedSeries = [...newEntries, ...filteredOld];

  try {
    localStorage.setItem(SERIES_KEY, JSON.stringify(updatedSeries));
    localStorage.setItem(PACKED_KEY, JSON.stringify(Array.from(currentPacked)));
  } catch (e) {
    console.warn('[cartStorage] Falha ao salvar no localStorage:', e);
  }

  // Notifica toda a aplicação para atualização reativa instantânea
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calibracheck_cart_updated', {
      detail: { planId, count: updatedSeries.length }
    }));
  }

  return updatedSeries;
};
