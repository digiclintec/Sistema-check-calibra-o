/**
 * Utilitário de Busca Inteligente e Similaridade de Códigos para Bombas e Equipamentos Hospitalares
 * 
 * Permite encontrar equipamentos mesmo quando:
 * 1. O código de barras contém prefixos/sufixos adicionais (ex: "(21)2104010003", "SN-2104010003", "2104010003A").
 * 2. O código de barras é lido em um QR Code / DataMatrix contendo múltiplos campos GS1.
 * 3. O código de barras coincide com a TAG / Identificação hospitalar (ex: "CCHL-0075").
 * 4. Apenas parte dos dígitos coincide (ex: 8, 9 ou 10 dígitos sequenciais idênticos).
 */

/**
 * Extrai apenas números de uma string
 */
export function extractDigits(str) {
  if (!str) return '';
  return String(str).replace(/\D/g, '');
}

/**
 * Normaliza string removendo pontuações, espaços e caracteres especiais
 */
export function cleanAlphanumeric(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Encontra o comprimento da maior sequência contígua de caracteres ou dígitos em comum
 */
export function longestCommonSubstringLength(s1, s2) {
  if (!s1 || !s2) return 0;
  const n = s1.length;
  const m = s2.length;
  let maxLen = 0;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
        }
      }
    }
  }
  return maxLen;
}

/**
 * Distância de Levenshtein para calcular proximidade geral de strings
 */
export function levenshteinDistance(s1, s2) {
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Avalia a similaridade entre o código lido e um valor de campo do equipamento
 */
function evaluateFieldMatch(scannedRaw, fieldRaw) {
  if (!scannedRaw || !fieldRaw) return { score: 0, reason: '', confidence: 0, matchingDigits: 0 };

  const scannedStr = String(scannedRaw).trim();
  const fieldStr = String(fieldRaw).trim();

  const scannedClean = cleanAlphanumeric(scannedStr);
  const fieldClean = cleanAlphanumeric(fieldStr);

  const scannedDigits = extractDigits(scannedStr);
  const fieldDigits = extractDigits(fieldStr);

  // 1. Coincidência Exata Absoluta (100% de confiança)
  if (scannedClean === fieldClean && scannedClean.length > 0) {
    return {
      score: 1000,
      confidence: 100,
      matchingDigits: scannedDigits.length,
      reason: 'Correspondência 100% Exata'
    };
  }

  // 2. Contenção Direta Alfanumérica (ex: "CCHL-0075" dentro de "TAG-CCHL-0075" ou vice-versa)
  if (scannedClean.length >= 4 && fieldClean.length >= 4) {
    if (scannedClean.includes(fieldClean) || fieldClean.includes(scannedClean)) {
      const shorter = Math.min(scannedClean.length, fieldClean.length);
      const longer = Math.max(scannedClean.length, fieldClean.length);
      const conf = Math.round((shorter / longer) * 98);
      return {
        score: 900 + shorter,
        confidence: Math.max(conf, 90),
        matchingDigits: Math.min(scannedDigits.length, fieldDigits.length),
        reason: `Contém o código completo (${shorter} caracteres)`
      };
    }
  }

  // 3. Comparação de Dígitos Numéricos (Números de Série de Bombas)
  if (scannedDigits.length >= 4 && fieldDigits.length >= 4) {
    // 3a. Os dígitos de um estão inteiramente contidos no outro (ex: QR com GS1 "(21)2104010003" contendo serial "2104010003")
    if (scannedDigits.includes(fieldDigits)) {
      return {
        score: 950 + fieldDigits.length,
        confidence: 98,
        matchingDigits: fieldDigits.length,
        reason: `${fieldDigits.length} dígitos do número de série contidos no QR Code`
      };
    }
    if (fieldDigits.includes(scannedDigits)) {
      return {
        score: 920 + scannedDigits.length,
        confidence: 95,
        matchingDigits: scannedDigits.length,
        reason: `${scannedDigits.length} dígitos lidos contidos no cadastro da bomba`
      };
    }

    // 3b. Maior sequência contígua de números idênticos
    const commonDigits = longestCommonSubstringLength(scannedDigits, fieldDigits);
    const maxDigits = Math.max(scannedDigits.length, fieldDigits.length);
    const minDigits = Math.min(scannedDigits.length, fieldDigits.length);

    // Se pelo menos 4 dígitos seguidos são idênticos
    if (commonDigits >= 4) {
      const ratio = commonDigits / maxDigits;
      const confidence = Math.round(ratio * 100);
      const score = Math.round(ratio * 700) + (commonDigits * 15);

      if (confidence >= 60 || commonDigits >= 6) {
        return {
          score,
          confidence: Math.min(confidence, 94),
          matchingDigits: commonDigits,
          reason: `${commonDigits} números sequenciais idênticos (${confidence}% similar)`
        };
      }
    }
  }

  // 4. Distância de Levenshtein para pequenas variações (ex: 1 dígito de erro de leitura)
  if (scannedClean.length >= 5 && fieldClean.length >= 5) {
    const dist = levenshteinDistance(scannedClean, fieldClean);
    const maxLen = Math.max(scannedClean.length, fieldClean.length);
    const similarity = 1 - (dist / maxLen);

    if (similarity >= 0.70) {
      const confidence = Math.round(similarity * 100);
      return {
        score: Math.round(similarity * 600),
        confidence,
        matchingDigits: Math.max(0, maxLen - dist),
        reason: `Aproximado com ${confidence}% de similaridade`
      };
    }
  }

  return { score: 0, confidence: 0, matchingDigits: 0, reason: '' };
}

/**
 * Encontra os melhores candidatos de equipamentos para o código de barras ou QR Code lido.
 * Prioriza a bomba que tiver a maior quantidade de números parecidos e mais próximos.
 * 
 * @param {string} scannedCode - Texto ou código de barras lido pela câmera ou leitor
 * @param {Array} equipments - Lista completa de equipamentos do hospital ativo
 * @returns {Array} Candidatos ordenados pelo melhor match (maior score)
 */
export function findBestEquipmentMatches(scannedCode, equipments = []) {
  if (!scannedCode || !Array.isArray(equipments) || equipments.length === 0) {
    return [];
  }

  const cleanScan = String(scannedCode).trim();
  if (cleanScan.length < 2) return [];

  const candidates = [];

  for (let i = 0; i < equipments.length; i++) {
    const item = equipments[i];
    let bestFieldMatch = { score: 0, confidence: 0, matchingDigits: 0, reason: '', field: '' };

    // Lista de campos a testar em cada bomba/equipamento
    const testFields = [
      { name: 'Número de Série', value: item.serie },
      { name: 'Identificação / Tag', value: item.tag },
      { name: 'Código de Barras', value: item.codigoBarras },
      { name: 'ID do Sistema', value: item.id },
      { name: 'Patrimônio', value: item.patrimonio },
      { name: 'Identificação Original', value: item._originalRow?.['Identificação'] },
      { name: 'Série Original', value: item._originalRow?.['Número de Série'] },
      { name: 'Patrimônio Original', value: item._originalRow?.['Patrimônio'] || item._originalRow?.['Tombamento'] }
    ];

    for (const tf of testFields) {
      if (!tf.value) continue;
      const res = evaluateFieldMatch(cleanScan, tf.value);
      if (res.score > bestFieldMatch.score) {
        bestFieldMatch = {
          ...res,
          field: tf.name,
          fieldValue: String(tf.value)
        };
      }
    }

    // Se encontrou alguma similaridade relevante (score >= 400 ou confiança >= 50%)
    if (bestFieldMatch.score >= 400 || bestFieldMatch.confidence >= 50) {
      candidates.push({
        equipment: item,
        score: bestFieldMatch.score,
        confidence: bestFieldMatch.confidence,
        matchingDigits: bestFieldMatch.matchingDigits,
        matchedField: bestFieldMatch.field,
        matchedValue: bestFieldMatch.fieldValue,
        reason: bestFieldMatch.reason,
        isExact: bestFieldMatch.confidence === 100
      });
    }
  }

  // Ordena pelo maior score (maior quantidade de números e caracteres parecidos/próximos)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchingDigits !== a.matchingDigits) return b.matchingDigits - a.matchingDigits;
    // Se empatar, prefere o que ainda não foi checado
    if (a.equipment.checado !== b.equipment.checado) {
      return a.equipment.checado ? 1 : -1;
    }
    return 0;
  });

  return candidates;
}

